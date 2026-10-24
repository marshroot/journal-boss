using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using JournalBackend.Database;
using JournalBackend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JournalBackend.Controllers;

[ApiController]
[Route("api/lessons")]
[Authorize]
public class LessonsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly JournalBackend.Services.IAuditService _audit;
    public LessonsController(AppDbContext db, JournalBackend.Services.IAuditService audit) { _db = db; _audit = audit; }

    [HttpGet("teacher") ]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> TeacherLessons([FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var teacherId)) return Unauthorized();
        var start = (from ?? DateTime.Today).Date;
        var end = (to ?? start.AddDays(7)).Date.AddDays(1);
        if (end <= start || (end - start).TotalDays > 62) return BadRequest(new { message = "Некорректный диапазон дат (максимум 62 дня)." });
        var rows = await _db.ScheduleEntries.AsNoTracking()
            .Where(x => (IsAdmin() || x.TeacherId == teacherId) && x.StartAt >= start && x.StartAt < end)
            .Include(x => x.Group).Include(x => x.Subject)
            .OrderBy(x => x.StartAt).ThenBy(x => x.LessonNumber)
            .Select(x => new { x.Id, x.StartAt, x.EndAt, x.LessonNumber, x.Room, x.Topic, groupId=x.GroupId, groupName=x.Group.Name, subjectId=x.SubjectId, subjectName=x.Subject.Name })
            .ToListAsync(ct);
        return Ok(rows);
    }

    [HttpGet("{id:int}")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        var lesson = await _db.ScheduleEntries.AsNoTracking().Include(x=>x.Group).Include(x=>x.Subject).FirstOrDefaultAsync(x=>x.Id==id,ct);
        if (lesson == null) return NotFound(new { message="Занятие не найдено." });
        if (!IsAdmin() && !await IsOwnTeacherLesson(id, ct)) return Forbid();
        var students = await _db.Users.AsNoTracking().Where(u=>u.Role==UserRoles.Student && u.StudyGroupId==lesson.GroupId)
            .OrderBy(u=>u.FullName).Select(u=>new { id=u.Id, fullName=u.FullName, status=_db.AttendanceRecords.Where(a=>a.ScheduleEntryId==id && a.StudentId==u.Id).Select(a=>a.Status).FirstOrDefault() ?? "Unknown" }).ToListAsync(ct);
        return Ok(new { id=lesson.Id, topic=lesson.Topic, startAt=lesson.StartAt, endAt=lesson.EndAt, lessonNumber=lesson.LessonNumber, room=lesson.Room, groupId=lesson.GroupId, groupName=lesson.Group.Name, subjectId=lesson.SubjectId, subjectName=lesson.Subject.Name, students });
    }

    [HttpPost("{id:int}/start")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> Start(int id, CancellationToken ct)
    {
        var lesson = await _db.ScheduleEntries.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (lesson == null) return NotFound(new { message = "Занятие не найдено." });
        if (!IsAdmin() && !await IsOwnTeacherLesson(id, ct)) return Forbid();
        if (lesson.CompletedAt.HasValue) return Conflict(new { message = "Пара уже завершена." });
        if (!lesson.StartedAt.HasValue)
        {
            lesson.StartedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            await _audit.WriteAsync(HttpContext, "lesson.start", $"lesson:{id}");
        }
        return Ok(new { lesson.Id, lesson.StartedAt, lesson.CompletedAt });
    }

    [HttpPost("{id:int}/complete")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> Complete(int id, CancellationToken ct)
    {
        var lesson = await _db.ScheduleEntries.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (lesson == null) return NotFound(new { message = "Занятие не найдено." });
        if (!IsAdmin() && !await IsOwnTeacherLesson(id, ct)) return Forbid();
        if (!lesson.CompletedAt.HasValue)
        {
            var now = DateTime.UtcNow;
            lesson.StartedAt ??= now;
            lesson.CompletedAt = now;
            // Completing the lesson also closes its active online room and stops the board projection.
            var rooms = await _db.OnlineLessons.Where(x => x.ScheduleEntryId == id && x.Status == "Active").ToListAsync(ct);
            foreach (var r in rooms) { r.Status = "Ended"; r.EndedAt = now; }
            var boards = await _db.LessonBoards.Where(x => x.ScheduleEntryId == id && x.IsBroadcast).ToListAsync(ct);
            foreach (var b in boards) b.IsBroadcast = false;
            await _db.SaveChangesAsync(ct);
            await _audit.WriteAsync(HttpContext, "lesson.complete", $"lesson:{id}");
        }
        return Ok(new { lesson.Id, lesson.StartedAt, lesson.CompletedAt });
    }

    /// <summary>
    /// Moves a lesson to a new time (or edits start/end of it). The owning teacher and admins may
    /// reschedule a lesson that has not completed yet; once started only the end time may change.
    /// </summary>
    [HttpPut("{id:int}/reschedule")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> Reschedule(int id, [FromBody] RescheduleRequest request, CancellationToken ct)
    {
        var lesson = await _db.ScheduleEntries.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (lesson == null) return NotFound(new { message = "Занятие не найдено." });
        if (!IsAdmin() && !await IsOwnTeacherLesson(id, ct)) return Forbid();
        if (lesson.CompletedAt.HasValue) return Conflict(new { message = "Завершённую пару перенести нельзя." });
        if (request.EndAt <= request.StartAt) return BadRequest(new { message = "Окончание пары должно быть позже начала." });
        if (lesson.StartedAt.HasValue && request.StartAt != lesson.StartAt)
            return Conflict(new { message = "Пара уже начата: можно изменить только время окончания." });
        if (request.LessonNumber is < 1) return BadRequest(new { message = "Номер пары должен быть положительным." });
        var conflict = await Services.ScheduleConflictChecker.FindAsync(_db, lesson.GroupId, lesson.TeacherId, request.StartAt, request.EndAt, id, ct);
        if (conflict is not null) return Conflict(Services.ScheduleConflictChecker.ConflictResponse(conflict));
        var previous = (lesson.StartAt, lesson.EndAt);
        lesson.StartAt = request.StartAt;
        lesson.EndAt = request.EndAt;
        if (request.LessonNumber.HasValue) lesson.LessonNumber = request.LessonNumber.Value;
        if (request.Room != null) lesson.Room = string.IsNullOrWhiteSpace(request.Room) ? null : request.Room.Trim();
        await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(HttpContext, "schedule.reschedule", $"lesson:{id}",
            $"{previous.StartAt:u}->{lesson.StartAt:u} group:{lesson.GroupId}");
        return Ok(new { lesson.Id, lesson.StartAt, lesson.EndAt, lesson.LessonNumber, lesson.Room });
    }

    [HttpPut("{id:int}/topic")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> SetTopic(int id, [FromBody] TopicRequest request, CancellationToken ct)
    {
        var lesson=await _db.ScheduleEntries.FirstOrDefaultAsync(x=>x.Id==id,ct);
        if(lesson==null) return NotFound(new {message="Занятие не найдено."});
        if(!IsAdmin() && !await IsOwnTeacherLesson(id,ct)) return Forbid();
        lesson.Topic=string.IsNullOrWhiteSpace(request.Topic)?null:request.Topic.Trim();
        await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(HttpContext, "lesson.topic", $"lesson:{id}", lesson.Topic);
        return Ok(new { lesson.Id, lesson.Topic });
    }

    [HttpPut("{id:int}/attendance")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> SaveAttendance(int id, [FromBody] AttendanceRequest request, CancellationToken ct)
    {
        var lesson=await _db.ScheduleEntries.FirstOrDefaultAsync(x=>x.Id==id,ct);
        if(lesson==null) return NotFound(new {message="Занятие не найдено."});
        if(!IsAdmin() && !await IsOwnTeacherLesson(id,ct)) return Forbid();
        var studentIds=await _db.Users.Where(u=>u.Role==UserRoles.Student && u.StudyGroupId==lesson.GroupId).Select(u=>u.Id).ToHashSetAsync(ct);
        var allowed=new[]{"Present","Absent","Late","Excused"};
        foreach(var item in request.Items)
        {
            if(!studentIds.Contains(item.StudentId)) return BadRequest(new {message=$"Студент {item.StudentId} не относится к группе этой пары."});
            if(!allowed.Contains(item.Status)) return BadRequest(new {message="Недопустимый статус посещаемости."});
            var record=await _db.AttendanceRecords.FirstOrDefaultAsync(a=>a.ScheduleEntryId==id && a.StudentId==item.StudentId,ct);
            if(record==null) _db.AttendanceRecords.Add(new AttendanceRecord{ScheduleEntryId=id,StudentId=item.StudentId,Status=item.Status,UpdatedAt=DateTime.UtcNow});
            else { record.Status=item.Status; record.UpdatedAt=DateTime.UtcNow; }
        }
        await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(HttpContext, "attendance.save", $"lesson:{id}", string.Join(",", request.Items.Select(i => $"{i.StudentId}={i.Status}")));
        return Ok();
    }

    private bool IsAdmin()=>User.IsInRole(UserRoles.Admin);
    private async Task<bool> IsOwnTeacherLesson(int id,CancellationToken ct)=>int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier),out var uid) && await _db.ScheduleEntries.AnyAsync(x=>x.Id==id && x.TeacherId==uid,ct);
    public record TopicRequest([MaxLength(500)] string? Topic);
    public record RescheduleRequest(DateTime StartAt, DateTime EndAt, int? LessonNumber, string? Room);
    public record AttendanceItem(int StudentId,string Status);
    public record AttendanceRequest(List<AttendanceItem> Items);
}
