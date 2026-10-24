using System.Security.Claims;
using JournalBackend.Database;
using JournalBackend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JournalBackend.Controllers;

[ApiController]
[Route("api/lessons/{lessonId:int}/chat")]
[Authorize]
public class LessonChatController : ControllerBase
{
    private readonly AppDbContext _db;
    public LessonChatController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> History(int lessonId, [FromQuery] int take = 100, CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 200);
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) return Unauthorized();
        var role = User.FindFirstValue(ClaimTypes.Role);
        var lesson = await _db.ScheduleEntries.AsNoTracking().FirstOrDefaultAsync(x => x.Id == lessonId, ct);
        if (lesson is null) return NotFound();

        var allowed = role == UserRoles.Admin ||
                      (role == UserRoles.Teacher && lesson.TeacherId == userId) ||
                      (role == UserRoles.Student && await _db.Users.AnyAsync(x => x.Id == userId && x.Role == UserRoles.Student && x.StudyGroupId == lesson.GroupId, ct));
        if (!allowed) return Forbid();

        var rows = await _db.LessonChatMessages.AsNoTracking()
            .Where(x => x.ScheduleEntryId == lessonId)
            .OrderByDescending(x => x.CreatedAt)
            .Take(take)
            .OrderBy(x => x.CreatedAt)
            .Select(x => new { x.Id, x.UserId, userName = x.User.FullName, x.Message, x.CreatedAt })
            .ToListAsync(ct);
        return Ok(rows);
    }
}
