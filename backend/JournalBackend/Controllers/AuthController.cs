using System;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using JournalBackend.Database;
using JournalBackend.Models;

namespace JournalBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        public AuthController(AppDbContext context)
        {
            _context = context;
        }

        // 5. Debug/Test endpoint to list all users in the SQL database
        [HttpGet("users")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetUsers()
        {
            var users = await _context.Users
                .AsNoTracking()
                .Select(u => new
                {
                    u.Id,
                    u.AuthLogin,
                    u.FullName,
                    u.Role,
                    u.CreatedAt
                })
                .ToListAsync();
            return Ok(users);
        }

        // 6. Fetch user profile from Top Academy (gems, coins, level, avatar, etc.)
        [Authorize]
        [HttpGet("profile")]
        public async Task<IActionResult> GetProfile()
        {
            // Resolve the account from the validated JWT, never from a bearer-like
            // session token supplied in the URL.
            var idClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(idClaim, out var userId))
            {
                return Unauthorized(new { message = "Некорректный токен авторизации." });
            }

            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null)
            {
                return Unauthorized(new { message = "Пользователь не найден." });
            }

            if (user == null || string.IsNullOrEmpty(user.JournalToken))
            {
                return NotFound(new { message = "Пользователь не найден или не авторизован в журнале." });
            }

            try
            {
                using var client = CreateHttpClient();
                client.DefaultRequestHeaders.Add("Accept", "application/json, text/plain, */*");
                client.DefaultRequestHeaders.Add("Referer", "https://journal.top-academy.ru/");
                client.DefaultRequestHeaders.Add("Origin", "https://journal.top-academy.ru");
                client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
                client.DefaultRequestHeaders.Add("Authorization", $"Bearer {user.JournalToken}");

                var response = await MyStatRateLimiter.ExecuteSafeAsync(() => client.GetAsync("https://msapi.top-academy.ru/api/v2/settings/user-info"));
                var responseString = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    using var doc = JsonDocument.Parse(responseString);
                    var root = doc.RootElement;

                    // Extract level
                    int level = 1;
                    if (root.TryGetProperty("level", out var lvlProp) && lvlProp.ValueKind == JsonValueKind.Number)
                    {
                        level = lvlProp.GetInt32();
                    }

                    // Extract avatar/photo
                    string photo = string.Empty;
                    if (root.TryGetProperty("photo", out var photoProp))
                    {
                        photo = photoProp.GetString() ?? string.Empty;
                    }

                    // Extract full name
                    string fullName = string.Empty;
                    if (root.TryGetProperty("full_name", out var nameProp))
                    {
                        fullName = nameProp.GetString() ?? string.Empty;
                    }

                    // Extract group name
                    string groupName = string.Empty;
                    if (root.TryGetProperty("group_name", out var groupProp))
                    {
                        groupName = groupProp.GetString() ?? string.Empty;
                    }

                    // Calculate crystals (gems) and coins
                    int gemsTotal = 0;
                    int coinsTotal = 0;
                    int gemsSpent = 0;
                    int coinsSpent = 0;

                    if (root.TryGetProperty("gaming_points", out var gpProp) && gpProp.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var point in gpProp.EnumerateArray())
                        {
                            if (point.TryGetProperty("new_gaming_point_types__id", out var idProp) &&
                                point.TryGetProperty("points", out var pointsProp))
                            {
                                int id = idProp.GetInt32();
                                int pts = pointsProp.GetInt32();
                                if (id == 1) coinsTotal = pts; // type 1: coins
                                if (id == 2) gemsTotal = pts;  // type 2: crystals/gems
                            }
                        }
                    }

                    if (root.TryGetProperty("spent_gaming_points", out var sgpProp) && sgpProp.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var point in sgpProp.EnumerateArray())
                        {
                            if (point.TryGetProperty("new_gaming_point_types__id", out var idProp) &&
                                point.TryGetProperty("points", out var pointsProp))
                            {
                                int id = idProp.GetInt32();
                                int pts = pointsProp.GetInt32();
                                if (id == 1) coinsSpent = pts; // type 1: coins
                                if (id == 2) gemsSpent = pts;  // type 2: crystals/gems
                            }
                        }
                    }

                    return Ok(new
                    {
                        fullName,
                        photo,
                        level,
                        groupName,
                        gems = new {
                            available = Math.Max(0, gemsTotal - gemsSpent),
                            total = gemsTotal
                        },
                        coins = new {
                            available = Math.Max(0, coinsTotal - coinsSpent),
                            total = coinsTotal
                        }
                    });
                }

                return StatusCode((int)response.StatusCode, new { message = "Ошибка при запросе профиля в журнале.", details = responseString });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Внутренняя ошибка сервера: {ex.Message}" });
            }
        }

        // ── Вспомогательные методы авторизации ──

        private HttpClient CreateHttpClient()
        {
            // Use the platform defaults, including TLS certificate validation.
            return new HttpClient();
        }
    }

}
