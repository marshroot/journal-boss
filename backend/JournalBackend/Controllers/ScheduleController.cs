using System;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using JournalBackend.Database;
using JournalBackend.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Caching.Memory;
using JournalBackend.Services.Security;

namespace JournalBackend.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/[controller]")]
    public class ScheduleController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly IMemoryCache _cache;
        private readonly IExternalCredentialProtector _externalCredentials;
        private static readonly System.Threading.SemaphoreSlim _tokenRefreshSemaphore = new System.Threading.SemaphoreSlim(1, 1);

        public ScheduleController(AppDbContext context, IConfiguration configuration, IMemoryCache cache, IExternalCredentialProtector externalCredentials)
        {
            _context = context;
            _configuration = configuration;
            _cache = cache;
            _externalCredentials = externalCredentials;
        }

        // 1. Forward schedule operations (get-by-date, get-month, get-by-date-range, month-events)
        [HttpGet("operations/{actionName}")]
        public async Task<IActionResult> ForwardScheduleAction(string actionName)
        {
            // Only allow the read-only schedule operations required by the UI.
            var allowedActions = new[] { "get-by-date", "get-month", "get-by-date-range", "month-events" };
            if (!allowedActions.Contains(actionName, StringComparer.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "Недопустимая операция расписания." });
            }
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized(new { message = "Некорректный JWT." });
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
            {
                return NotFound(new { message = "Пользователь не найден." });
            }

            if (string.IsNullOrEmpty(user.JournalToken))
            {
                return BadRequest(new { message = "Дневник не привязан к аккаунту." });
            }

            // Never forward credentials supplied in query parameters to the upstream service.
            var queryParams = HttpContext.Request.Query
                .Where(q => !string.Equals(q.Key, "sessionToken", StringComparison.OrdinalIgnoreCase))
                .Select(q => $"{Uri.EscapeDataString(q.Key)}={Uri.EscapeDataString(q.Value!)}");
            var queryString = string.Join("&", queryParams);

            var relativeUrl = $"/schedule/operations/{actionName}";
            if (!string.IsNullOrEmpty(queryString))
            {
                relativeUrl += $"?{queryString}";
            }

            // Check memory cache
            string cacheKey = $"schedule_cache_{user.Id}_{actionName}_{queryString}";
            if (_cache.TryGetValue(cacheKey, out string? cachedResponse) && cachedResponse != null)
            {
                return Content(cachedResponse, "application/json");
            }

            var (response, content) = await MakeMyStatRequestAsync(user, relativeUrl, HttpMethod.Get, null);

            if (!response.IsSuccessStatusCode)
            {
                return StatusCode((int)response.StatusCode, content);
            }

            // Cache schedule responses for 10 minutes
            var cacheEntryOptions = new MemoryCacheEntryOptions()
                .SetAbsoluteExpiration(TimeSpan.FromMinutes(10));
            _cache.Set(cacheKey, content, cacheEntryOptions);

            return Content(content, "application/json");
        }

        // 2. Fetch past lessons available for rating
        [HttpGet("feedback/evaluate-lesson-list")]
        public async Task<IActionResult> GetEvaluateLessonList()
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized(new { message = "Некорректный JWT." });
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
            {
                return NotFound(new { message = "Пользователь не найден." });
            }

            if (string.IsNullOrEmpty(user.JournalToken))
            {
                return BadRequest(new { message = "Дневник не привязан к аккаунту." });
            }

            string cacheKey = $"rateable_lessons_cache_{user.Id}";
            if (_cache.TryGetValue(cacheKey, out string? cachedResponse) && cachedResponse != null)
            {
                return Content(cachedResponse, "application/json");
            }

            var (response, content) = await MakeMyStatRequestAsync(user, "/feedback/students/evaluate-lesson-list", HttpMethod.Get, null);

            if (!response.IsSuccessStatusCode)
            {
                return StatusCode((int)response.StatusCode, content);
            }

            // Cache rateable lesson lists for 5 minutes
            var cacheEntryOptions = new MemoryCacheEntryOptions()
                .SetAbsoluteExpiration(TimeSpan.FromMinutes(5));
            _cache.Set(cacheKey, content, cacheEntryOptions);

            return Content(content, "application/json");
        }

        // 3. Rate a past lesson
        [HttpPost("feedback/evaluate-lesson")]
        public async Task<IActionResult> EvaluateLesson([FromBody] JsonElement payload)
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized(new { message = "Некорректный JWT." });
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
            {
                return NotFound(new { message = "Пользователь не найден." });
            }

            if (string.IsNullOrEmpty(user.JournalToken))
            {
                return BadRequest(new { message = "Дневник не привязан к аккаунту." });
            }

            var jsonBody = JsonSerializer.Serialize(payload);
            var (response, content) = await MakeMyStatRequestAsync(user, "/feedback/students/evaluate-lesson", HttpMethod.Post, jsonBody);

            if (!response.IsSuccessStatusCode)
            {
                return StatusCode((int)response.StatusCode, content);
            }

            // Invalidate rateable lessons cache on successful submission
            string cacheKey = $"rateable_lessons_cache_{user.Id}";
            _cache.Remove(cacheKey);

            return Content(content, "application/json");
        }

        // ── Helper methods (replicated from LeaderboardController for robust session token proxying) ──

        private async Task<(HttpResponseMessage Response, string Content)> MakeMyStatRequestAsync(User user, string relativeUrl, HttpMethod method, string? jsonBody)
        {
            string responseString = "";
            HttpResponseMessage response;
            string tokenUsed = user.JournalToken ?? "";

            using (var client = CreateHttpClient())
            {
                SetupHeaders(client, tokenUsed);

                HttpRequestMessage request = new HttpRequestMessage(method, $"https://msapi.top-academy.ru/api/v2{relativeUrl}");
                if (method == HttpMethod.Post && jsonBody != null)
                {
                    request.Content = new StringContent(jsonBody, Encoding.UTF8, "application/json");
                }

                response = await MyStatRateLimiter.ExecuteSafeAsync(() => client.SendAsync(request));
                responseString = await response.Content.ReadAsStringAsync();

                if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                {
                    // Token expired/invalid, try to refresh safely with semaphore
                    var refreshed = await RefreshJournalTokenAsync(user, tokenUsed);
                    if (refreshed)
                    {
                        // Retry with new token
                        using var retryClient = CreateHttpClient();
                        SetupHeaders(retryClient, user.JournalToken ?? "");

                        HttpRequestMessage retryRequest = new HttpRequestMessage(method, $"https://msapi.top-academy.ru/api/v2{relativeUrl}");
                        if (method == HttpMethod.Post && jsonBody != null)
                        {
                            retryRequest.Content = new StringContent(jsonBody, Encoding.UTF8, "application/json");
                        }

                        response = await MyStatRateLimiter.ExecuteSafeAsync(() => retryClient.SendAsync(retryRequest));
                        responseString = await response.Content.ReadAsStringAsync();
                    }
                }
            }

            return (response, responseString);
        }

        private void SetupHeaders(HttpClient client, string token)
        {
            client.DefaultRequestHeaders.Add("Accept", "application/json, text/plain, */*");
            client.DefaultRequestHeaders.Add("Referer", "https://journal.top-academy.ru/");
            client.DefaultRequestHeaders.Add("Origin", "https://journal.top-academy.ru");
            client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");
        }

        private async Task<bool> RefreshJournalTokenAsync(User user, string tokenUsed)
        {
            await _tokenRefreshSemaphore.WaitAsync();
            try
            {
                // Double-check: has another parallel task already refreshed the token?
                if (user.JournalToken != tokenUsed)
                {
                    return true;
                }

                // Reload user entity from database to pick up changes from other concurrent HTTP requests
                await _context.Entry(user).ReloadAsync();
                if (user.JournalToken != tokenUsed)
                {
                    return true;
                }

                if (string.IsNullOrEmpty(user.Login) || string.IsNullOrEmpty(user.ExternalPassword))
                {
                    return false;
                }

                var appKey = GetApplicationKey();
                if (string.IsNullOrEmpty(appKey))
                {
                    return false;
                }

                var authResult = await CallTopAcademyAuthAsync(user.Login, _externalCredentials.Unprotect(user.ExternalPassword)!, appKey);
                if (authResult.Success)
                {
                    user.JournalToken = authResult.Token;
                    await _context.SaveChangesAsync();
                    return true;
                }

                return false;
            }
            finally
            {
                _tokenRefreshSemaphore.Release();
            }
        }

        private string FindProjectRoot()
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir != null)
            {
                if (System.IO.File.Exists(Path.Combine(dir.FullName, "run.bat")) || Directory.Exists(Path.Combine(dir.FullName, ".git")))
                {
                    return dir.FullName;
                }
                dir = dir.Parent;
            }
            return AppContext.BaseDirectory;
        }

        private string GetApplicationKey()
        {
            var rootPath = FindProjectRoot();
            
            // 1. Try to load from root .env
            var envPath = Path.Combine(rootPath, ".env");
            if (System.IO.File.Exists(envPath))
            {
                try
                {
                    foreach (var line in System.IO.File.ReadLines(envPath))
                    {
                        var trimmed = line.Trim();
                        if (string.IsNullOrEmpty(trimmed) || trimmed.StartsWith("#")) continue;
                        var parts = trimmed.Split('=', 2);
                        if (parts.Length == 2 && parts[0].Trim() == "APPLICATION_KEY")
                        {
                            var val = parts[1].Trim();
                            if (val.StartsWith("\"") && val.EndsWith("\"")) val = val.Substring(1, val.Length - 2);
                            if (val.StartsWith("'") && val.EndsWith("'")) val = val.Substring(1, val.Length - 2);
                            return val;
                        }
                    }
                }
                catch { }
            }

            // 2. Try to load from bot/.env
            var botEnvPath = Path.Combine(rootPath, "bot", ".env");
            if (System.IO.File.Exists(botEnvPath))
            {
                try
                {
                    foreach (var line in System.IO.File.ReadLines(botEnvPath))
                    {
                        var trimmed = line.Trim();
                        if (string.IsNullOrEmpty(trimmed) || trimmed.StartsWith("#")) continue;
                        var parts = trimmed.Split('=', 2);
                        if (parts.Length == 2 && parts[0].Trim() == "APPLICATION_KEY")
                        {
                            var val = parts[1].Trim();
                            if (val.StartsWith("\"") && val.EndsWith("\"")) val = val.Substring(1, val.Length - 2);
                            if (val.StartsWith("'") && val.EndsWith("'")) val = val.Substring(1, val.Length - 2);
                            return val;
                        }
                    }
                }
                catch { }
            }

            // 3. Fallback to appsettings.json configuration
            var configKey = _configuration["Journal:ApplicationKey"];
            if (!string.IsNullOrEmpty(configKey))
            {
                return configKey;
            }

            return string.Empty;
        }

        private async Task<(bool Success, string Token, string ErrorMessage)> CallTopAcademyAuthAsync(string username, string password, string appKey)
        {
            try
            {
                using var client = CreateHttpClient();
                
                client.DefaultRequestHeaders.Add("Accept", "application/json, text/plain, */*");
                client.DefaultRequestHeaders.Add("Referer", "https://journal.top-academy.ru/");
                client.DefaultRequestHeaders.Add("Origin", "https://journal.top-academy.ru");
                client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

                var payload = new
                {
                    application_key = appKey,
                    id_city = (int?)null,
                    username = username,
                    password = password
                };

                var json = JsonSerializer.Serialize(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await MyStatRateLimiter.ExecuteSafeAsync(() => client.PostAsync("https://msapi.top-academy.ru/api/v2/auth/login", content));
                var responseString = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    using var doc = JsonDocument.Parse(responseString);
                    if (doc.RootElement.TryGetProperty("access_token", out var tokenProp))
                    {
                        return (true, tokenProp.GetString() ?? string.Empty, string.Empty);
                    }
                    return (false, string.Empty, "Токен не найден в ответе сервера.");
                }
                else
                {
                    try
                    {
                        using var doc = JsonDocument.Parse(responseString);
                        if (doc.RootElement.ValueKind == JsonValueKind.Array && doc.RootElement.GetArrayLength() > 0)
                        {
                            var firstErr = doc.RootElement[0];
                            if (firstErr.TryGetProperty("message", out var msgProp))
                            {
                                return (false, string.Empty, msgProp.GetString() ?? "Ошибка авторизации");
                            }
                        }
                        else if (doc.RootElement.TryGetProperty("message", out var msgProp))
                        {
                            return (false, string.Empty, msgProp.GetString() ?? "Ошибка авторизации");
                        }
                    }
                    catch { }

                    return (false, string.Empty, string.IsNullOrEmpty(responseString) ? $"Ошибка сервера: {response.StatusCode}" : responseString);
                }
            }
            catch (Exception ex)
            {
                return (false, string.Empty, $"Ошибка подключения к API Академии: {ex.Message}");
            }
        }

        private HttpClient CreateHttpClient()
        {
            // Use the platform defaults, including TLS certificate validation.
            return new HttpClient();
        }
    }
}
