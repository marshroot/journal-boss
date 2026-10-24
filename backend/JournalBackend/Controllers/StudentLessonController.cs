using System.Security.Claims;
using JournalBackend.Database;
using JournalBackend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JournalBackend.Controllers;

[ApiController]
[Route("api/student")]
[Authorize(Roles = UserRoles.Student)]
public class StudentLessonController : ControllerBase
{
    private readonly AppDbContext _db;
    public StudentLessonController(AppDbContext db) => _db = db;

    private int UserId => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;

    [HttpGet("current-lesson")]
    public async Task<IActionResult> CurrentLesson(CancellationToken ct)
    {
        var studentId = UserId;
        if (studentId <= 0) return Unauthorized();

        var groupId = await _db.Users.AsNoTracking()
            .Where(x => x.Id == studentId && x.Role == UserRoles.Student)
            .Select(x => x.StudyGroupId)
            .SingleOrDefaultAsync(ct);
        if (!groupId.HasValue) return NoContent();

        var now = DateTime.UtcNow;
        var lesson = await _db.ScheduleEntries.AsNoTracking()
            .Where(x => x.GroupId == groupId.Value && x.StartAt <= now && x.EndAt >= now)
            .Include(x => x.Group)
            .Include(x => x.Subject)
            .Include(x => x.Teacher)
            .OrderBy(x => x.StartAt)
            .FirstOrDefaultAsync(ct);

        if (lesson is null) return NoContent();

        var attendance = await _db.AttendanceRecords.AsNoTracking()
            .Where(x => x.ScheduleEntryId == lesson.Id && x.StudentId == studentId)
            .Select(x => x.Status)
            .FirstOrDefaultAsync(ct);

        var grade = await _db.GradeRecords.AsNoTracking()
            .Where(x => x.ScheduleEntryId == lesson.Id && x.StudentId == studentId)
            .OrderByDescending(x => x.UpdatedAt)
            .Select(x => new { x.Value, x.Comment, x.UpdatedAt })
            .FirstOrDefaultAsync(ct);

        var homeworks = await _db.LocalHomeworks.AsNoTracking()
            .Where(x => x.ScheduleEntryId == lesson.Id)
            .OrderBy(x => x.Deadline)
            .Select(x => new
            {
                x.Id,
                x.Title,
                x.Description,
                x.Deadline,
                submission = x.Submissions.Where(s => s.StudentId == studentId)
                    .Select(s => new { s.Id, s.SubmittedAt, s.TeacherScore, s.TeacherComment })
                    .FirstOrDefault()
            }).ToListAsync(ct);

        var materials = await _db.StudyMaterials.AsNoTracking()
            .Where(x => x.ScheduleEntryId == lesson.Id && x.IsPublished)
            .OrderByDescending(x => x.PublishedAt ?? x.UpdatedAt)
            .Select(x => new { x.Id, x.Title, x.ContentJson, x.PublishedAt, x.UpdatedAt })
            .ToListAsync(ct);

        var attachments = await _db.LessonAttachments.AsNoTracking()
            .Where(x => x.ScheduleEntryId == lesson.Id)
            .OrderBy(x => x.FileName)
            .Select(x => new { x.Id, x.FileName, x.ContentType, x.SizeBytes, x.CreatedAt })
            .ToListAsync(ct);

        var online = await _db.OnlineLessons.AsNoTracking()
            .Where(x => x.ScheduleEntryId == lesson.Id && x.Status == "Active")
            .OrderByDescending(x => x.StartedAt)
            .Select(x => new { x.Id, x.RoomName, x.Status, x.StartedAt })
            .FirstOrDefaultAsync(ct);

        return Ok(new
        {
            lesson.Id,
            lesson.StartAt,
            lesson.EndAt,
            lesson.LessonNumber,
            lesson.Room,
            lesson.Topic,
            lesson.StartedAt,
            lesson.CompletedAt,
            groupId = lesson.GroupId,
            groupName = lesson.Group.Name,
            subjectId = lesson.SubjectId,
            subjectName = lesson.Subject.Name,
            teacherId = lesson.TeacherId,
            teacherName = lesson.Teacher.FullName,
            attendance,
            grade,
            homeworks,
            materials,
            attachments,
            online
        });
    }

    [HttpGet("lessons/{lessonId:int}")]
    public async Task<IActionResult> Lesson(int lessonId, CancellationToken ct)
    {
        var studentId = UserId;
        var lesson = await _db.ScheduleEntries.AsNoTracking()
            .Include(x => x.Subject)
            .Include(x => x.Group)
            .Include(x => x.Teacher)
            .FirstOrDefaultAsync(x => x.Id == lessonId, ct);
        if (lesson is null) return NotFound();

        var belongs = await _db.Users.AnyAsync(x => x.Id == studentId && x.Role == UserRoles.Student && x.StudyGroupId == lesson.GroupId, ct);
        if (!belongs) return Forbid();

        var materials = await _db.StudyMaterials.AsNoTracking()
            .Where(x => x.ScheduleEntryId == lessonId && x.IsPublished)
            .Select(x => new { x.Id, x.Title, x.ContentJson, x.PublishedAt, x.UpdatedAt })
            .ToListAsync(ct);
        var homeworks = await _db.LocalHomeworks.AsNoTracking()
            .Where(x => x.ScheduleEntryId == lessonId)
            .Select(x => new
            {
                x.Id, x.Title, x.Description, x.Deadline,
                submission = x.Submissions.Where(s => s.StudentId == studentId)
                    .Select(s => new { s.Id, s.SubmittedAt, s.TeacherScore, s.TeacherComment })
                    .FirstOrDefault()
            }).ToListAsync(ct);

        return Ok(new
        {
            lesson.Id, lesson.StartAt, lesson.EndAt, lesson.LessonNumber, lesson.Room, lesson.Topic,
            lesson.StartedAt, lesson.CompletedAt,
            groupId = lesson.GroupId, groupName = lesson.Group.Name,
            subjectId = lesson.SubjectId, subjectName = lesson.Subject.Name,
            teacherId = lesson.TeacherId, teacherName = lesson.Teacher.FullName,
            materials, homeworks
        });
    }
}
