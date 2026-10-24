using System.IdentityModel.Tokens.Jwt;
using System.IO;
using System.Net.Http;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using JournalBackend.Database;
using JournalBackend.Models;
using JournalBackend.Services.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace JournalBackend.Controllers;

[ApiController]
[Route("api/auth")]
public class LocalAuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _configuration;
    private readonly IPasswordHasher<User> _passwordHasher;
    private readonly IExternalCredentialProtector _externalCredentials;
    private readonly JournalBackend.Services.IAuditService _audit;
    private static readonly HttpClient _httpClient = new();

    public LocalAuthController(AppDbContext db, IConfiguration configuration, IPasswordHasher<User> passwordHasher, IExternalCredentialProtector externalCredentials, JournalBackend.Services.IAuditService audit)
    {
        _audit = audit;
        _db = db;
        _configuration = configuration;
        _passwordHasher = passwordHasher;
        _externalCredentials = externalCredentials;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Login) || string.IsNullOrEmpty(request.Password))
            return BadRequest(new { message = "Введите логин и пароль." });

        var login = request.Login.Trim();

        var user = await _db.Users.Include(u => u.StudyGroup).FirstOrDefaultAsync(u => u.AuthLogin == login);

        if (user != null && !string.IsNullOrEmpty(user.PasswordHash))
        {
            var result = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
            if (result != PasswordVerificationResult.Failed)
            {
                if (!UserRoles.IsValid(user.Role))
                    return StatusCode(500, new { message = "У пользователя настроена некорректная роль." });

                var token = CreateToken(user);
                await _audit.WriteAsync(HttpContext, "auth.login", $"user:{user.Id}", user.Role);
                return Ok(BuildLoginResponse(user, token));
            }
        }

        var journalResult = await TryJournalLoginAsync(login, request.Password);
        if (journalResult.Success)
        {
            var journalUser = await EnsureJournalUserAsync(login, request.Password, journalResult.Token, journalResult.FullName);
            if (journalUser == null)
                return StatusCode(500, new { message = "Не удалось создать локальную учётную запись." });

            if (!UserRoles.IsValid(journalUser.Role))
                return StatusCode(500, new { message = "У пользователя настроена некорректная роль." });

            var token = CreateToken(journalUser);
            await _audit.WriteAsync(HttpContext, "auth.login_journal", $"user:{journalUser.Id}", journalUser.Role);
            return Ok(BuildLoginResponse(journalUser, token));
        }

        await _audit.WriteAsync(HttpContext, "auth.login_failed", "login", login.Length > 100 ? login[..100] : login);
        return Unauthorized(new { message = journalResult.ErrorMessage ?? "Неверный логин или пароль." });
    }

    private object BuildLoginResponse(User user, string token) => new
    {
        accessToken = token,
        user = new { id = user.Id, login = user.AuthLogin, fullName = user.FullName, role = user.Role, studyGroupId = user.StudyGroupId, studyGroupName = user.StudyGroup != null ? user.StudyGroup.Name : null }
    };

    private async Task<JournalLoginResult> TryJournalLoginAsync(string username, string password)
    {
        var appKey = GetApplicationKey();
        if (string.IsNullOrEmpty(appKey))
            return new JournalLoginResult { Success = false, ErrorMessage = "Ключ приложения журнала не настроен." };

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://msapi.top-academy.ru/api/v2/auth/login");
            request.Headers.Add("Accept", "application/json, text/plain, */*");
            request.Headers.Add("Referer", "https://journal.top-academy.ru/");
            request.Headers.Add("Origin", "https://journal.top-academy.ru");
            request.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

            var payload = new { application_key = appKey, id_city = (int?)null, username, password };
            request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            var response = await MyStatRateLimiter.ExecuteSafeAsync(() => _httpClient.SendAsync(request));
            var responseString = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                using var doc = JsonDocument.Parse(responseString);
                if (doc.RootElement.TryGetProperty("access_token", out var tokenProp))
                {
                    var token = tokenProp.GetString() ?? string.Empty;
                    var fullName = await FetchJournalFullNameAsync(token);
                    return new JournalLoginResult { Success = true, Token = token, FullName = fullName };
                }
                return new JournalLoginResult { Success = false, ErrorMessage = "Токен не найден в ответе сервера журнала." };
            }

            string error = "Неверный логин или пароль.";
            try
            {
                using var doc = JsonDocument.Parse(responseString);
                if (doc.RootElement.ValueKind == JsonValueKind.Array && doc.RootElement.GetArrayLength() > 0)
                {
                    var firstErr = doc.RootElement[0];
                    if (firstErr.TryGetProperty("message", out var msgProp))
                        error = msgProp.GetString() ?? error;
                }
                else if (doc.RootElement.TryGetProperty("message", out var msgProp))
                {
                    error = msgProp.GetString() ?? error;
                }
            }
            catch { }

            return new JournalLoginResult { Success = false, ErrorMessage = error };
        }
        catch (Exception ex)
        {
            return new JournalLoginResult { Success = false, ErrorMessage = $"Ошибка подключения к журналу: {ex.Message}" };
        }
    }

    private async Task<string?> FetchJournalFullNameAsync(string token)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, "https://msapi.top-academy.ru/api/v2/settings/user-info");
            request.Headers.Add("Accept", "application/json, text/plain, */*");
            request.Headers.Add("Referer", "https://journal.top-academy.ru/");
            request.Headers.Add("Origin", "https://journal.top-academy.ru");
            request.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            request.Headers.Add("Authorization", $"Bearer {token}");

            var response = await MyStatRateLimiter.ExecuteSafeAsync(() => _httpClient.SendAsync(request));
            if (!response.IsSuccessStatusCode) return null;

            var responseString = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(responseString);
            if (doc.RootElement.TryGetProperty("full_name", out var nameProp))
                return nameProp.GetString();
        }
        catch { }
        return null;
    }

    private async Task<User?> EnsureJournalUserAsync(string journalLogin, string journalPassword, string journalToken, string? fullName)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Login == journalLogin);

        if (user == null)
        {
            var authLogin = journalLogin;
            var suffix = 1;
            while (await _db.Users.AnyAsync(u => u.AuthLogin == authLogin))
            {
                authLogin = $"{journalLogin}_{suffix++}";
            }

            user = new User
            {
                Login = journalLogin,
                AuthLogin = authLogin,
                FullName = fullName ?? journalLogin,
                Role = UserRoles.Student,
                TelegramId = 0,
                CreatedAt = DateTime.UtcNow
            };
            _db.Users.Add(user);
        }
        else
        {
            user.FullName = fullName ?? user.FullName;
        }

        user.ExternalPassword = _externalCredentials.Protect(journalPassword);
        user.JournalToken = journalToken;
        user.PasswordHash = _passwordHasher.HashPassword(user, journalPassword);

        await _db.SaveChangesAsync();
        await _db.Entry(user).Reference(u => u.StudyGroup).LoadAsync();
        return user;
    }

    private string GetApplicationKey()
    {
        var envKey = _configuration["APPLICATION_KEY"] ?? _configuration["Journal:ApplicationKey"];
        if (!string.IsNullOrEmpty(envKey)) return envKey;

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
        return string.Empty;
    }

    private static string FindProjectRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            if (System.IO.File.Exists(Path.Combine(dir.FullName, "run.bat")) || Directory.Exists(Path.Combine(dir.FullName, ".git")))
                return dir.FullName;
            dir = dir.Parent;
        }
        return AppContext.BaseDirectory;
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var idClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(idClaim, out var userId))
            return Unauthorized(new { message = "Некорректный токен." });

        var user = await _db.Users.AsNoTracking().Include(u => u.StudyGroup).FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
            return Unauthorized(new { message = "Пользователь не найден." });

        return Ok(new { id = user.Id, login = user.AuthLogin, fullName = user.FullName, role = user.Role, studyGroupId = user.StudyGroupId, studyGroupName = user.StudyGroup?.Name });
    }

    private string CreateToken(User user)
    {
        var key = _configuration["Jwt:Key"] ?? _configuration["JWT_KEY"];
        if (string.IsNullOrWhiteSpace(key) || key.Length < 32)
            throw new InvalidOperationException("Jwt:Key должен быть задан и содержать минимум 32 символа.");

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.AuthLogin ?? string.Empty),
            new(ClaimTypes.Role, user.Role),
            new("full_name", user.FullName ?? string.Empty)
        };

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            SecurityAlgorithms.HmacSha256);

        var expiresMinutes = _configuration.GetValue<int?>("Jwt:ExpiresMinutes") ?? 480;
        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"] ?? "JournalBackend",
            audience: _configuration["Jwt:Audience"] ?? "JournalFrontend",
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiresMinutes),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

internal sealed class JournalLoginResult
{
    public bool Success { get; set; }
    public string Token { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string? ErrorMessage { get; set; }
}

public sealed class LoginRequest
{
    public string Login { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}
