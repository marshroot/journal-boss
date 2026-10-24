using System.Security.Claims;
using JournalBackend.Database;
using JournalBackend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JournalBackend.Controllers;

[ApiController]
[Route("api/schedule")]
[Authorize]
public class PersonalScheduleController : ControllerBase
{
    private readonly AppDbContext _db;
    public PersonalScheduleController(AppDbContext db) => _db = db;

    [HttpGet("personal")]
    public async Task<IActionResult> Personal([FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Unauthorized(new { message = "Некорректный токен." });

        // Query values arrive as ISO instants; normalise to UTC (the DB stores UTC) instead of truncating to the server's local day.
        var start = from.HasValue ? JournalBackend.Services.UtcDateTimeConverter.Normalize(from.Value) : DateTime.UtcNow.Date;
        var end = to.HasValue ? JournalBackend.Services.UtcDateTimeConverter.Normalize(to.Value) : start.AddDays(7);
        if (end <= start) return BadRequest(new { message = "Некорректный диапазон дат." });
        if ((end - start).TotalDays > 62) return BadRequest(new { message = "Диапазон не может превышать 62 дня." });

        var user = await _db.Users.AsNoTracking()
            .Include(u => u.StudyGroup)
            .FirstOrDefaultAsync(u => u.Id == userId, ct);

        if (user == null) return Unauthorized(new { message = "Пользователь не найден." });

        IQueryable<ScheduleEntry> query = _db.ScheduleEntries.AsNoTracking()
            .Include(x => x.Group)
            .Include(x => x.Subject)
            .Include(x => x.Teacher);

        if (user.Role == UserRoles.Student)
        {
            if (user.StudyGroupId == null)
                return Ok(Array.Empty<object>());
            query = query.Where(x => x.GroupId == user.StudyGroupId.Value);
        }
        else if (user.Role == UserRoles.Teacher)
        {
            query = query.Where(x => x.TeacherId == user.Id);
        }
        else if (user.Role == UserRoles.Parent)
        {
            var childGroupIds = _db.ParentStudents
                .Where(x => x.ParentId == user.Id)
                .Join(_db.Users, x => x.StudentId, s => s.Id, (_, s) => s.StudyGroupId)
                .Where(id => id != null)
                .Select(id => id!.Value)
                .Distinct();

            query = query.Where(x => childGroupIds.Contains(x.GroupId));
        }
        // Admin sees the complete schedule.

        var rows = await query
            .Where(x => x.StartAt >= start && x.StartAt < end)
            .OrderBy(x => x.StartAt)
            .ThenBy(x => x.LessonNumber)
            .Select(x => new
            {
                x.Id,
                x.StartAt,
                x.EndAt,
                x.Room,
                x.LessonNumber,
                groupId = x.GroupId,
                groupName = x.Group.Name,
                subjectId = x.SubjectId,
                subjectName = x.Subject.Name,
                teacherId = x.TeacherId,
                teacherName = x.Teacher.FullName
            })
            .ToListAsync(ct);

        return Ok(rows);
    }
}
