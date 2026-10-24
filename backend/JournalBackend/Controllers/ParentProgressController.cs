using System.Security.Claims;
using JournalBackend.Database;
using JournalBackend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JournalBackend.Controllers;

[ApiController]
[Route("api/parent")]
[Authorize(Roles = UserRoles.Parent)]
public class ParentProgressController : ControllerBase
{
    private readonly AppDbContext _db;
    public ParentProgressController(AppDbContext db) => _db = db;
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("children")]
    public async Task<IActionResult> Children(CancellationToken ct)
    {
        var rows = await _db.ParentStudents.Where(x => x.ParentId == UserId).Include(x => x.Student)
            .Select(x => new { id = x.StudentId, fullName = x.Student.FullName, studyGroupId = x.Student.StudyGroupId, studyGroupName = x.Student.StudyGroup != null ? x.Student.StudyGroup.Name : null })
            .ToListAsync(ct);
        return Ok(rows);
    }

    [HttpGet("{studentId:int}/attendance")]
    public async Task<IActionResult> Attendance(int studentId, CancellationToken ct)
    {
        if (!await _db.ParentStudents.AnyAsync(x => x.ParentId == UserId && x.StudentId == studentId, ct)) return Forbid();
        var rows = await _db.AttendanceRecords.Where(x => x.StudentId == studentId).Include(x => x.ScheduleEntry).ThenInclude(x => x.Subject)
            .OrderByDescending(x => x.ScheduleEntry.StartAt)
            .Select(x => new { x.Id, x.Status, x.UpdatedAt, lessonId = x.ScheduleEntryId, x.ScheduleEntry.StartAt, x.ScheduleEntry.Topic, subject = x.ScheduleEntry.Subject.Name })
            .ToListAsync(ct);
        return Ok(rows);
    }
    [HttpGet("{studentId:int}/grades")]
    public async Task<IActionResult> Grades(int studentId, CancellationToken ct)
    {
        if (!await _db.ParentStudents.AnyAsync(x => x.ParentId == UserId && x.StudentId == studentId, ct)) return Forbid();
        var rows = await _db.GradeRecords.Where(x => x.StudentId == studentId)
            .Include(x => x.ScheduleEntry).ThenInclude(x => x.Subject)
            .OrderByDescending(x => x.ScheduleEntry.StartAt)
            .Select(x => new { x.Id, x.Value, x.Comment, x.CreatedAt, lessonId = x.ScheduleEntryId, x.ScheduleEntry.StartAt, subject = x.ScheduleEntry.Subject.Name, topic = x.ScheduleEntry.Topic })
            .ToListAsync(ct);
        return Ok(rows);
    }

    [HttpGet("{studentId:int}/homework")]
    public async Task<IActionResult> Homework(int studentId, CancellationToken ct)
    {
        if (!await _db.ParentStudents.AnyAsync(x => x.ParentId == UserId && x.StudentId == studentId, ct)) return Forbid();
        var studentGroupId = await _db.Users.Where(u => u.Id == studentId && u.Role == UserRoles.Student).Select(u => u.StudyGroupId).SingleOrDefaultAsync(ct);
        if (!studentGroupId.HasValue) return NotFound(new { message = "Студент или его группа не найдены." });
        var rows = await _db.LocalHomeworks
            .Where(h => h.ScheduleEntry.GroupId == studentGroupId.Value)
            .Include(h => h.ScheduleEntry).ThenInclude(x => x.Subject)
            .Select(h => new { h.Id, title = h.Title, description = h.Description, deadline = h.Deadline, subject = h.ScheduleEntry.Subject.Name, topic = h.ScheduleEntry.Topic, submission = h.Submissions.Where(s => s.StudentId == studentId).Select(s => new { s.Id, s.SubmittedAt, s.TeacherScore, s.TeacherComment }).FirstOrDefault() })
            .OrderByDescending(x => x.deadline)
            .ToListAsync(ct);
        return Ok(rows);
    }

    [HttpGet("{studentId:int}/schedule")]
    public async Task<IActionResult> Schedule(int studentId, [FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        if (!await _db.ParentStudents.AnyAsync(x => x.ParentId == UserId && x.StudentId == studentId, ct)) return Forbid();
        var groupId = await _db.Users.Where(x => x.Id == studentId && x.Role == UserRoles.Student).Select(x => x.StudyGroupId).SingleOrDefaultAsync(ct);
        if (!groupId.HasValue) return NotFound(new { message = "Студент или его группа не найдены." });
        var start = from.HasValue ? JournalBackend.Services.UtcDateTimeConverter.Normalize(from.Value) : DateTime.UtcNow.Date;
        var end = to.HasValue ? JournalBackend.Services.UtcDateTimeConverter.Normalize(to.Value) : start.AddDays(7);
        if (end <= start) return BadRequest(new { message = "Параметр to должен быть позже from." });
        var rows = await _db.ScheduleEntries.AsNoTracking()
            .Where(x => x.GroupId == groupId.Value && x.StartAt < end && x.EndAt > start)
            .Include(x => x.Subject).Include(x => x.Teacher).Include(x => x.Group)
            .OrderBy(x => x.StartAt)
            .Select(x => new { x.Id, x.StartAt, x.EndAt, x.LessonNumber, x.Room, x.Topic, groupId = x.GroupId, groupName = x.Group.Name, subjectId = x.SubjectId, subject = x.Subject.Name, teacherId = x.TeacherId, teacher = x.Teacher.FullName })
            .ToListAsync(ct);
        return Ok(rows);
    }

    [HttpGet("{studentId:int}/materials")]
    public async Task<IActionResult> Materials(int studentId, [FromQuery] int? lessonId, CancellationToken ct)
    {
        if (!await _db.ParentStudents.AnyAsync(x => x.ParentId == UserId && x.StudentId == studentId, ct)) return Forbid();
        var groupId = await _db.Users.Where(x => x.Id == studentId && x.Role == UserRoles.Student).Select(x => x.StudyGroupId).SingleOrDefaultAsync(ct);
        if (!groupId.HasValue) return NotFound(new { message = "Студент или его группа не найдены." });
        var query = _db.StudyMaterials.AsNoTracking().Where(x => x.IsPublished && x.ScheduleEntry.GroupId == groupId.Value);
        if (lessonId.HasValue) query = query.Where(x => x.ScheduleEntryId == lessonId.Value);
        var rows = await query.Include(x => x.ScheduleEntry).ThenInclude(x => x.Subject)
            .OrderByDescending(x => x.PublishedAt ?? x.UpdatedAt)
            .Select(x => new { x.Id, x.Title, x.ContentJson, x.PublishedAt, x.UpdatedAt, lessonId = x.ScheduleEntryId, x.ScheduleEntry.StartAt, subject = x.ScheduleEntry.Subject.Name })
            .ToListAsync(ct);
        return Ok(rows);
    }

}
