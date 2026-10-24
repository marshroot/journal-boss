using System.ComponentModel.DataAnnotations;
using JournalBackend.Database;
using JournalBackend.Models;
using JournalBackend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JournalBackend.Controllers;

[ApiController]
[Route("api/admin/academic")]
[Authorize(Roles = UserRoles.Admin)]
public class AdminAcademicController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly JournalBackend.Services.IAuditService _audit;
    public AdminAcademicController(AppDbContext db, JournalBackend.Services.IAuditService audit) { _db = db; _audit = audit; }

    [HttpGet("groups")]
    public async Task<IActionResult> Groups(CancellationToken ct) => Ok(await _db.StudyGroups.AsNoTracking().OrderBy(x => x.Name).ToListAsync(ct));

    [HttpPost("groups")]
    public async Task<IActionResult> CreateGroup(CreateNameRequest request, CancellationToken ct)
    {
        var name = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest(new { message = "Название группы не может быть пустым." });
        if (await _db.StudyGroups.AnyAsync(x => x.Name == name, ct)) return Conflict(new { message = "Такая группа уже существует." });
        var item = new StudyGroup { Name = name };
        _db.StudyGroups.Add(item); await _db.SaveChangesAsync(ct); return Created($"/api/admin/academic/groups/{item.Id}", item);
    }

    [HttpDelete("groups/{id:int}")]
    public async Task<IActionResult> DeleteGroup(int id, CancellationToken ct) => await DeleteEntity(_db.StudyGroups, id, ct);

    [HttpGet("subjects")]
    public async Task<IActionResult> Subjects(CancellationToken ct) => Ok(await _db.Subjects.AsNoTracking().Include(x => x.Teacher).OrderBy(x => x.Name).Select(x => new { x.Id, x.Name, teacherId = x.TeacherId, teacherName = x.Teacher != null ? x.Teacher.FullName : null }).ToListAsync(ct));

    [HttpPost("subjects")]
    public async Task<IActionResult> CreateSubject(CreateNameRequest request, CancellationToken ct)
    {
        var name = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest(new { message = "Название предмета не может быть пустым." });
        if (await _db.Subjects.AnyAsync(x => x.Name == name, ct)) return Conflict(new { message = "Такой предмет уже существует." });
        var item = new Subject { Name = name };
        _db.Subjects.Add(item); await _db.SaveChangesAsync(ct); return Created($"/api/admin/academic/subjects/{item.Id}", item);
    }

    [HttpPut("subjects/{id:int}/teacher")]
    public async Task<IActionResult> AssignSubjectTeacher(int id, [FromBody] AssignSubjectTeacherRequest request, CancellationToken ct)
    {
        var subject = await _db.Subjects.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (subject == null) return NotFound(new { message = "Предмет не найден." });
        if (!request.TeacherId.HasValue)
        {
            subject.TeacherId = null;
            await _db.SaveChangesAsync(ct);
            return Ok(new { subject.Id, teacherId = (int?)null });
        }
        var teacherExists = await _db.Users.AnyAsync(x => x.Id == request.TeacherId.Value && x.Role == UserRoles.Teacher, ct);
        if (!teacherExists) return BadRequest(new { message = "Указанный пользователь не является преподавателем." });
        subject.TeacherId = request.TeacherId.Value;
        await _db.SaveChangesAsync(ct);
        return Ok(new { subject.Id, teacherId = subject.TeacherId });
    }

    [HttpDelete("subjects/{id:int}")]
    public async Task<IActionResult> DeleteSubject(int id, CancellationToken ct) => await DeleteEntity(_db.Subjects, id, ct);

    [HttpGet("teachers")]
    public async Task<IActionResult> Teachers(CancellationToken ct) => Ok(await _db.Users.AsNoTracking().Where(u => u.Role == UserRoles.Teacher).OrderBy(u => u.FullName).Select(u => new { id = u.Id, fullName = u.FullName, login = u.AuthLogin }).ToListAsync(ct));

    [HttpGet("schedule")]
    public async Task<IActionResult> Schedule(CancellationToken ct)
    {
        var rows = await _db.ScheduleEntries.AsNoTracking().Include(x => x.Group).Include(x => x.Subject).Include(x => x.Teacher).OrderBy(x => x.StartAt).ToListAsync(ct);
        return Ok(rows.Select(x => new { x.Id, groupId = x.GroupId, groupName = x.Group.Name, subjectId = x.SubjectId, subjectName = x.Subject.Name, teacherId = x.TeacherId, teacherName = x.Teacher.FullName, x.StartAt, x.EndAt, x.Room, x.LessonNumber }));
    }

    [HttpPost("schedule")]
    public async Task<IActionResult> CreateSchedule(CreateScheduleRequest request, CancellationToken ct)
    {
        if (request.EndAt <= request.StartAt) return BadRequest(new { message = "Окончание пары должно быть позже начала." });
        if (request.LessonNumber < 1) return BadRequest(new { message = "Номер пары должен быть положительным." });
        var groupExists = await _db.StudyGroups.AnyAsync(x => x.Id == request.GroupId, ct);
        var subjectExists = await _db.Subjects.AnyAsync(x => x.Id == request.SubjectId, ct);
        var subject = await _db.Subjects.FirstOrDefaultAsync(x => x.Id == request.SubjectId, ct);
        var teacher = await _db.Users.FirstOrDefaultAsync(x => x.Id == request.TeacherId && x.Role == UserRoles.Teacher, ct);
        if (!groupExists || subject == null || teacher == null) return BadRequest(new { message = "Группа, предмет или преподаватель не найдены." });
        if (!subject.TeacherId.HasValue) return BadRequest(new { message = "Сначала закрепите преподавателя за предметом." });
        if (subject.TeacherId.Value != request.TeacherId) return BadRequest(new { message = "Преподаватель занятия не совпадает с преподавателем, закреплённым за предметом." });
        var conflict = await ScheduleConflictChecker.FindAsync(_db, request.GroupId, request.TeacherId, request.StartAt, request.EndAt, null, ct);
        if (conflict is not null) return Conflict(ScheduleConflictChecker.ConflictResponse(conflict));
        var item = new ScheduleEntry { GroupId = request.GroupId, SubjectId = request.SubjectId, TeacherId = subject.TeacherId.Value, StartAt = request.StartAt, EndAt = request.EndAt, Room = request.Room?.Trim(), LessonNumber = request.LessonNumber };
        _db.ScheduleEntries.Add(item); await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(HttpContext, "schedule.create", $"lesson:{item.Id}", $"group:{item.GroupId} subject:{item.SubjectId} {item.StartAt:u}");
        return Created($"/api/admin/academic/schedule/{item.Id}", item);
    }

    [HttpPut("schedule/{id:int}")]
    public async Task<IActionResult> UpdateSchedule(int id, CreateScheduleRequest request, CancellationToken ct)
    {
        var item = await _db.ScheduleEntries.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (item == null) return NotFound(new { message = "Пара не найдена." });
        if (item.CompletedAt.HasValue) return Conflict(new { message = "Завершённую пару изменить нельзя." });
        if (request.EndAt <= request.StartAt) return BadRequest(new { message = "Окончание пары должно быть позже начала." });
        if (request.LessonNumber < 1) return BadRequest(new { message = "Номер пары должен быть положительным." });
        var subject = await _db.Subjects.FirstOrDefaultAsync(x => x.Id == request.SubjectId, ct);
        var groupExists = await _db.StudyGroups.AnyAsync(x => x.Id == request.GroupId, ct);
        if (!groupExists || subject == null) return BadRequest(new { message = "Группа или предмет не найдены." });
        if (!subject.TeacherId.HasValue) return BadRequest(new { message = "У предмета не закреплён преподаватель." });
        // The teacher is always the one assigned to the subject.
        var teacherId = subject.TeacherId.Value;
        var conflict = await ScheduleConflictChecker.FindAsync(_db, request.GroupId, teacherId, request.StartAt, request.EndAt, id, ct);
        if (conflict is not null) return Conflict(ScheduleConflictChecker.ConflictResponse(conflict));
        item.GroupId = request.GroupId; item.SubjectId = request.SubjectId; item.TeacherId = teacherId;
        item.StartAt = request.StartAt; item.EndAt = request.EndAt; item.LessonNumber = request.LessonNumber; item.Room = request.Room?.Trim();
        await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(HttpContext, "schedule.update", $"lesson:{id}", $"group:{item.GroupId} subject:{item.SubjectId} {item.StartAt:u}");
        return Ok(item);
    }

    [HttpDelete("schedule/{id:int}")]
    public async Task<IActionResult> DeleteSchedule(int id, [FromQuery] bool force = false, CancellationToken ct = default)
    {
        var item = await _db.ScheduleEntries.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (item == null) return NotFound(new { message = "Пара не найдена." });
        // Deleting a lesson cascades to grades, attendance, homework and materials: require an explicit confirmation.
        var hasData = await _db.GradeRecords.AnyAsync(x => x.ScheduleEntryId == id, ct)
                      || await _db.LocalHomeworks.AnyAsync(x => x.ScheduleEntryId == id, ct)
                      || await _db.StudyMaterials.AnyAsync(x => x.ScheduleEntryId == id, ct);
        if (hasData && !force) return Conflict(new { message = "У пары есть оценки, ДЗ или материалы — они будут удалены вместе с ней. Подтвердите удаление.", requiresConfirmation = true });
        _db.ScheduleEntries.Remove(item); await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(HttpContext, "schedule.delete", $"lesson:{id}", hasData ? "with data" : "empty");
        return NoContent();
    }

    private async Task<IActionResult> DeleteEntity<TEntity>(DbSet<TEntity> set, int id, CancellationToken ct) where TEntity : class
    {
        var entity = await set.FindAsync(new object[] { id }, ct);
        if (entity == null) return NotFound(new { message = "Запись не найдена." });
        set.Remove(entity); await _db.SaveChangesAsync(ct); return NoContent();
    }

    public record CreateNameRequest([Required] string Name);
    public record AssignSubjectTeacherRequest(int? TeacherId);
    public record CreateScheduleRequest(int GroupId, int SubjectId, int TeacherId, DateTime StartAt, DateTime EndAt, int LessonNumber, string? Room);
}
