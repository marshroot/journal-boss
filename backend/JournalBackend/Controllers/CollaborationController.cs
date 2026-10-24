using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using JournalBackend.Database;
using JournalBackend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace JournalBackend.Controllers;

[ApiController]
[Route("api/collaboration")]
[Authorize]
public sealed class CollaborationController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _configuration;

    public CollaborationController(AppDbContext db, IConfiguration configuration)
    {
        _db = db;
        _configuration = configuration;
    }

    [HttpPost("lesson/{lessonId:int}/board-token")]
    [HttpPost("/api/lessons/{lessonId:int}/board-token")]
    [HttpGet("/api/lessons/{lessonId:int}/board-token")]
    [Authorize(Roles = UserRoles.Admin + "," + UserRoles.Teacher + "," + UserRoles.Student)]
    public async Task<IActionResult> BoardToken(int lessonId, CancellationToken ct)
    {
        var lesson = await _db.ScheduleEntries.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == lessonId, ct);

        if (lesson == null)
            return NotFound(new { message = "Пара не найдена." });

        if (!await CanAccessLesson(lesson, ct))
            return Forbid();

        var userId = CurrentUserId();
        if (userId == null)
            return Unauthorized();

        var key = _configuration["Jwt:Key"];
        if (string.IsNullOrWhiteSpace(key) || key.Length < 32)
            return Problem("Jwt:Key не настроен.", statusCode: StatusCodes.Status500InternalServerError);

        var room = $"lesson-board-{lessonId}";
        var now = DateTime.UtcNow;
        var expires = now.AddMinutes(30);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.Value.ToString()),
            new Claim(ClaimTypes.Role, User.FindFirstValue(ClaimTypes.Role) ?? string.Empty),
            new Claim("collab_room", room)
        };

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"] ?? "JournalBackend",
            audience: "JournalCollab",
            claims: claims,
            notBefore: now,
            expires: expires,
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
                SecurityAlgorithms.HmacSha256));

        return Ok(new
        {
            token = new JwtSecurityTokenHandler().WriteToken(token),
            room,
            expiresAt = expires
        });
    }

    private int? CurrentUserId() =>
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    private bool IsAdmin() => User.IsInRole(UserRoles.Admin);

    private async Task<bool> CanAccessLesson(ScheduleEntry lesson, CancellationToken ct)
    {
        if (IsAdmin()) return true;

        var uid = CurrentUserId();
        if (uid == null) return false;

        if (User.IsInRole(UserRoles.Teacher))
            return lesson.TeacherId == uid;

        if (User.IsInRole(UserRoles.Student))
            return await _db.Users.AnyAsync(
                u => u.Id == uid && u.StudyGroupId == lesson.GroupId, ct);

        return false;
    }
}
