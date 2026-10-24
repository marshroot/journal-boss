using System.Security.Claims;
using JournalBackend.Database;
using JournalBackend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JournalBackend.Controllers;

[ApiController]
[Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
[Route("api/teacher/current-lesson")]
public class TeacherCurrentLessonController : ControllerBase
{
    private readonly AppDbContext _db;
    public TeacherCurrentLessonController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var query = _db.ScheduleEntries.AsNoTracking().Where(x => x.StartAt <= now && x.EndAt >= now);
        if (!User.IsInRole(UserRoles.Admin))
        {
            if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)) return Unauthorized();
            query = query.Where(x => x.TeacherId == id);
        }
        var lesson = await query.Include(x => x.Group).Include(x => x.Subject).OrderBy(x => x.StartAt).FirstOrDefaultAsync(ct);
        if (lesson is null) return NoContent();
        var students = await _db.Users.AsNoTracking().Where(x => x.Role == UserRoles.Student && x.StudyGroupId == lesson.GroupId)
            .OrderBy(x => x.FullName).Select(x => new { id = x.Id, fullName = x.FullName, status = _db.AttendanceRecords.Where(a => a.ScheduleEntryId == lesson.Id && a.StudentId == x.Id).Select(a => a.Status).FirstOrDefault() ?? "Unknown" }).ToListAsync(ct);
        var grades = await _db.GradeRecords.AsNoTracking().Where(x => x.ScheduleEntryId == lesson.Id).Select(x => new { studentId = x.StudentId, value = x.Value, comment = x.Comment }).ToListAsync(ct);
        var homeworks = await _db.LocalHomeworks.AsNoTracking().Where(x => x.ScheduleEntryId == lesson.Id).Select(x => new { x.Id, x.Title, x.Description, x.Deadline, x.CreatedAt }).ToListAsync(ct);
        var materials = await _db.StudyMaterials.AsNoTracking().Where(x => x.ScheduleEntryId == lesson.Id).Select(x => new { x.Id, x.Title, x.CreatedAt, x.UpdatedAt, x.IsPublished }).ToListAsync(ct);
        var attachments = await _db.LessonAttachments.AsNoTracking().Where(x => x.ScheduleEntryId == lesson.Id).Select(x => new { x.Id, x.FileName, x.ContentType, x.SizeBytes, x.CreatedAt }).ToListAsync(ct);
        var online = await _db.OnlineLessons.AsNoTracking().Where(x => x.ScheduleEntryId == lesson.Id && x.Status == "Active").OrderByDescending(x => x.StartedAt).FirstOrDefaultAsync(ct);
        var boardRow = await _db.LessonBoards.AsNoTracking().Where(x => x.ScheduleEntryId == lesson.Id).Select(x => new { x.IsBroadcast, x.BroadcastStartedAt }).FirstOrDefaultAsync(ct);
        return Ok(new { id = lesson.Id, lesson.StartAt, lesson.EndAt, lesson.LessonNumber, lesson.Room, lesson.Topic, startedAt = lesson.StartedAt, completedAt = lesson.CompletedAt, groupId = lesson.GroupId, groupName = lesson.Group.Name, subjectId = lesson.SubjectId, subjectName = lesson.Subject.Name, students, grades, homeworks, materials, attachments, online = online == null ? null : new { online.Id, online.RoomName, online.Status, online.StartedAt }, board = boardRow == null ? null : new { isBroadcast = boardRow.IsBroadcast, broadcastStartedAt = boardRow.BroadcastStartedAt } });
    }
}
