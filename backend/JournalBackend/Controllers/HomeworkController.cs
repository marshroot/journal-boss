using System;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
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
    public class HomeworkController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly IMemoryCache _cache;
        private readonly IExternalCredentialProtector _externalCredentials;
        private static readonly System.Threading.SemaphoreSlim _tokenRefreshSemaphore = new System.Threading.SemaphoreSlim(1, 1);

        public HomeworkController(AppDbContext context, IConfiguration configuration, IMemoryCache cache, IExternalCredentialProtector externalCredentials)
        {
            _context = context;
            _configuration = configuration;
            _cache = cache;
            _externalCredentials = externalCredentials;
        }

        // 1. Get Homework List (proxies GET /homework/operations/list)
        [HttpGet("list")]
        public async Task<IActionResult> GetHomeworkList()
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized(new { message = "Не удалось определить пользователя из JWT." });
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

            bool bypassCache = HttpContext.Request.Query.ContainsKey("bypassCache") && 
                               bool.TryParse(HttpContext.Request.Query["bypassCache"], out var bp) && bp;

            // Forward all query parameters except sessionToken and bypassCache
            var queryParams = HttpContext.Request.Query
                .Where(q => !string.Equals(q.Key, "sessionToken", StringComparison.OrdinalIgnoreCase) && !string.Equals(q.Key, "bypassCache", StringComparison.OrdinalIgnoreCase))
                .Select(q => $"{Uri.EscapeDataString(q.Key)}={Uri.EscapeDataString(q.Value!)}");
            var queryString = string.Join("&", queryParams);

            var relativeUrl = "/homework/operations/list";
            if (!string.IsNullOrEmpty(queryString))
            {
                relativeUrl += $"?{queryString}";
            }

            // Check cache
            string cacheKey = $"homework_cache_{user.Id}_{queryString}";
            if (!bypassCache)
            {
                if (_cache.TryGetValue(cacheKey, out string? cachedResponse) && cachedResponse != null)
                {
                    return Content(cachedResponse, "application/json");
                }
            }

            var (response, content) = await MakeMyStatRequestAsync(user, relativeUrl, HttpMethod.Get, null);

            if (!response.IsSuccessStatusCode)
            {
                return StatusCode((int)response.StatusCode, content);
            }

            // Cache homework list for 5 minutes
            var cacheEntryOptions = new MemoryCacheEntryOptions()
                .SetAbsoluteExpiration(TimeSpan.FromMinutes(5));
            _cache.Set(cacheKey, content, cacheEntryOptions);

            return Content(content, "application/json");
        }

        // 2. Submit Homework (proxies POST /homework/operations/create with multipart/form-data)
        [HttpPost("create")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> CreateHomework()
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized(new { message = "Не удалось определить пользователя из JWT." });
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

            var (response, content) = await MakeMyStatMultipartRequestAsync(
                user, 
                "/homework/operations/create", 
                Request.Form, 
                Request.Form.Files
            );

            if (!response.IsSuccessStatusCode)
            {
                return StatusCode((int)response.StatusCode, content);
            }

            // Invalidate homework caches for this user
            InvalidateUserHomeworkCache(user.Id);

            return Content(content, "application/json");
        }

        // 3. Delete Submitted Homework (proxies POST /homework/operations/delete)
        [HttpPost("delete")]
        public async Task<IActionResult> DeleteHomework([FromBody] JsonElement payload)
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized(new { message = "Не удалось определить пользователя из JWT." });
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
            var (response, content) = await MakeMyStatRequestAsync(user, "/homework/operations/delete", HttpMethod.Post, jsonBody);

            if (!response.IsSuccessStatusCode)
            {
                return StatusCode((int)response.StatusCode, content);
            }

            // Invalidate homework caches for this user
            InvalidateUserHomeworkCache(user.Id);

            return Content(content, "application/json");
        }

        // 4. Get File Upload Token (proxies POST /auth/file-token)
        [HttpPost("file-token")]
        public async Task<IActionResult> GetFileToken()
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized(new { message = "Не удалось определить пользователя из JWT." });
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

            var (response, content) = await MakeMyStatRequestAsync(user, "/auth/file-token", HttpMethod.Post, "{}");

            if (!response.IsSuccessStatusCode)
            {
                return StatusCode((int)response.StatusCode, content);
            }

            return Content(content, "application/json");
        }

        // 5. Direct File Uploader to Top Academy FS (proxies POST https://fs.top-academy.ru/api/v1/files)
        [HttpPost("upload")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadFile(
            [FromHeader(Name = "X-File-Storage-Token")] string fileStorageToken,
            [FromForm] string directory)
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdClaim, out var userId) || !await _context.Users.AnyAsync(u => u.Id == userId))
            {
                return Unauthorized(new { message = "Не удалось определить пользователя из JWT." });
            }

            if (string.IsNullOrEmpty(fileStorageToken))
            {
                return BadRequest(new { message = "Токен файлового хранилища не предоставлен." });
            }
            if (string.IsNullOrEmpty(directory))
            {
                return BadRequest(new { message = "Директория загрузки не предоставлена." });
            }
            if (Request.Form.Files.Count == 0)
            {
                return BadRequest(new { message = "Файл не прикреплен." });
            }

            var file = Request.Form.Files[0];

            using var client = CreateHttpClient();
            client.DefaultRequestHeaders.Add("Accept", "application/json, text/plain, */*");
            client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {fileStorageToken}");

            using var multipartContent = new MultipartFormDataContent();
            var streamContent = new StreamContent(file.OpenReadStream());
            streamContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(file.ContentType ?? "application/octet-stream");
            multipartContent.Add(streamContent, "files", file.FileName);
            multipartContent.Add(new StringContent(directory), "directory");

            var response = await MyStatRateLimiter.ExecuteSafeAsync(() => client.PostAsync("https://fs.top-academy.ru/api/v1/files", multipartContent));
            var responseString = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                return StatusCode((int)response.StatusCode, responseString);
            }

            return Content(responseString, "application/json");
        }

        // 6. Get Group History (proxies GET /homework/settings/group-history)
        [HttpGet("group-history")]
        public async Task<IActionResult> GetGroupHistory()
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized(new { message = "Не удалось определить пользователя из JWT." });
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

            var (response, content) = await MakeMyStatRequestAsync(user, "/homework/settings/group-history", HttpMethod.Get, null);

            if (!response.IsSuccessStatusCode)
            {
                return StatusCode((int)response.StatusCode, content);
            }

            return Content(content, "application/json");
        }

        // 7. Get Homework Evaluation Tags (proxies GET /homework/evaluation/operations/get-tags)
        [HttpGet("evaluation/tags")]
        public async Task<IActionResult> GetEvaluationTags()
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized(new { message = "Не удалось определить пользователя из JWT." });
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

            var (response, content) = await MakeMyStatRequestAsync(user, "/homework/evaluation/operations/get-tags", HttpMethod.Get, null);

            if (!response.IsSuccessStatusCode)
            {
                return StatusCode((int)response.StatusCode, content);
            }

            return Content(content, "application/json");
        }

        // 8. Get Homework Evaluation (proxies GET /homework/evaluation/operations/get)
        [HttpGet("evaluation/get")]
        public async Task<IActionResult> GetHomeworkEvaluation([FromQuery] int id)
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized(new { message = "Не удалось определить пользователя из JWT." });
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

            var (response, content) = await MakeMyStatRequestAsync(user, $"/homework/evaluation/operations/get?id={id}", HttpMethod.Get, null);

            if (!response.IsSuccessStatusCode)
            {
                return StatusCode((int)response.StatusCode, content);
            }

            return Content(content, "application/json");
        }

        // 9. Save Homework Evaluation (proxies POST /homework/evaluation/operations/save)
        [HttpPost("evaluation/save")]
        public async Task<IActionResult> SaveHomeworkEvaluation([FromBody] JsonElement payload)
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized(new { message = "Не удалось определить пользователя из JWT." });
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
            var (response, content) = await MakeMyStatRequestAsync(user, "/homework/evaluation/operations/save", HttpMethod.Post, jsonBody);

            if (!response.IsSuccessStatusCode)
            {
                return StatusCode((int)response.StatusCode, content);
            }

            return Content(content, "application/json");
        }

        // ── Helper Cache Invalidator ──
        private void InvalidateUserHomeworkCache(int userId)
        {
            // Clear common combinations of status (0-5), type (0-1) and page (1-10) to avoid stale lists
            for (int status = 0; status <= 5; status++)
            {
                for (int type = 0; type <= 1; type++)
                {
                    // Clear base key without page
                    _cache.Remove($"homework_cache_{userId}_status={status}&type={type}");

                    // Clear paginated keys
                    for (int page = 1; page <= 10; page++)
                    {
                        _cache.Remove($"homework_cache_{userId}_status={status}&type={type}&page={page}");
                    }
                }
            }
        }

        // ── Helper methods (replicated for robust session token proxying with token auto-refresh) ──

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
                    var refreshed = await RefreshJournalTokenAsync(user, tokenUsed);
                    if (refreshed)
                    {
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

        private MultipartFormDataContent BuildMultipartContent(IFormCollection form, IFormFileCollection files)
        {
            var multipartContent = new MultipartFormDataContent();
            foreach (var field in form)
            {
                multipartContent.Add(new StringContent(field.Value!), field.Key);
            }
            foreach (var file in files)
            {
                var streamContent = new StreamContent(file.OpenReadStream());
                streamContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(file.ContentType ?? "application/octet-stream");
                multipartContent.Add(streamContent, file.Name, file.FileName);
            }
            return multipartContent;
        }

        private async Task<(HttpResponseMessage Response, string Content)> MakeMyStatMultipartRequestAsync(
            User user, 
            string relativeUrl, 
            IFormCollection form, 
            IFormFileCollection files)
        {
            string responseString = "";
            HttpResponseMessage response;
            string tokenUsed = user.JournalToken ?? "";

            using (var client = CreateHttpClient())
            {
                SetupHeaders(client, tokenUsed);

                using var content = BuildMultipartContent(form, files);
                HttpRequestMessage request = new HttpRequestMessage(HttpMethod.Post, $"https://msapi.top-academy.ru/api/v2{relativeUrl}")
                {
                    Content = content
                };

                response = await MyStatRateLimiter.ExecuteSafeAsync(() => client.SendAsync(request));
                responseString = await response.Content.ReadAsStringAsync();

                if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                {
                    var refreshed = await RefreshJournalTokenAsync(user, tokenUsed);
                    if (refreshed)
                    {
                        using var retryClient = CreateHttpClient();
                        SetupHeaders(retryClient, user.JournalToken ?? "");

                        using var retryContent = BuildMultipartContent(form, files);
                        HttpRequestMessage retryRequest = new HttpRequestMessage(HttpMethod.Post, $"https://msapi.top-academy.ru/api/v2{relativeUrl}")
                        {
                            Content = retryContent
                        };

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
                if (user.JournalToken != tokenUsed)
                {
                    return true;
                }

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
