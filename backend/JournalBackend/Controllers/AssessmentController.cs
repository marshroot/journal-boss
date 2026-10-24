using System.Text.Json;
using System.Security.Claims;
using JournalBackend.Database;
using JournalBackend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JournalBackend.Controllers;

[ApiController]
[Route("api/assessment")]
[Authorize]
public class AssessmentController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly JournalBackend.Services.IAuditService _audit;
    public AssessmentController(AppDbContext db, JournalBackend.Services.IAuditService audit) { _db = db; _audit = audit; }
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private bool Admin => User.IsInRole(UserRoles.Admin);

    [HttpGet("lesson/{lessonId:int}")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> Lesson(int lessonId, CancellationToken ct)
    {
        var lesson = await _db.ScheduleEntries.Include(x=>x.Group).Include(x=>x.Subject).FirstOrDefaultAsync(x=>x.Id==lessonId,ct);
        if (lesson is null) return NotFound();
        if (!Admin && lesson.TeacherId != UserId) return Forbid();
        var grades = await _db.GradeRecords.Where(x=>x.ScheduleEntryId==lessonId).Select(x=>new {x.StudentId,x.Value,x.Comment}).ToListAsync(ct);
        var homeworks = await _db.LocalHomeworks.Where(x=>x.ScheduleEntryId==lessonId).Select(x=>new {x.Id,x.Title,x.Description,x.Deadline,x.CreatedAt}).ToListAsync(ct);
        return Ok(new { lessonId, grades, homeworks });
    }

    [HttpPut("lesson/{lessonId:int}/grades")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> SaveGrades(int lessonId, [FromBody] GradeRequest request, CancellationToken ct)
    {
        var lesson = await _db.ScheduleEntries.FirstOrDefaultAsync(x=>x.Id==lessonId,ct);
        if (lesson is null) return NotFound();
        if (!Admin && lesson.TeacherId != UserId) return Forbid();
        var students = await _db.Users.Where(x=>x.Role==UserRoles.Student && x.StudyGroupId==lesson.GroupId).Select(x=>x.Id).ToHashSetAsync(ct);
        foreach (var item in request.Items)
        {
            if (!students.Contains(item.StudentId) || item.Value < 0 || item.Value > 10) return BadRequest(new {message="Некорректная оценка или студент не относится к группе."});
            var grade = await _db.GradeRecords.FirstOrDefaultAsync(x=>x.ScheduleEntryId==lessonId && x.StudentId==item.StudentId,ct);
            if (grade is null) _db.GradeRecords.Add(new GradeRecord { ScheduleEntryId=lessonId, StudentId=item.StudentId, Value=item.Value, Comment=item.Comment, CreatedAt=DateTime.UtcNow, UpdatedAt=DateTime.UtcNow });
            else { grade.Value=item.Value; grade.Comment=item.Comment; grade.UpdatedAt=DateTime.UtcNow; }
        }
        await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(HttpContext, "grade.save", $"lesson:{lessonId}", $"items={request.Items.Count}; " + string.Join(",", request.Items.Select(i => $"{i.StudentId}={i.Value}")));
        return Ok();
    }

    [HttpPost("lesson/{lessonId:int}/homework")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> CreateHomework(int lessonId, [FromBody] HomeworkRequest request, CancellationToken ct)
    {
        var lesson = await _db.ScheduleEntries.FirstOrDefaultAsync(x=>x.Id==lessonId,ct);
        if (lesson is null) return NotFound();
        if (!Admin && lesson.TeacherId != UserId) return Forbid();
        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Description)) return BadRequest(new {message="Название и условие обязательны."});
        var hw = new LocalHomework { ScheduleEntryId=lessonId, Title=request.Title.Trim(), Description=request.Description.Trim(), Deadline=request.Deadline, CreatedAt=DateTime.UtcNow, UpdatedAt=DateTime.UtcNow };
        _db.LocalHomeworks.Add(hw); await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(HttpContext, "homework.create", $"homework:{hw.Id}", $"lesson:{lessonId}");
        return Ok(new {hw.Id,hw.Title,hw.Description,hw.Deadline,hw.CreatedAt});
    }

    [HttpPost("homework/{homeworkId:int}/submit")]
    [Authorize(Roles = UserRoles.Student)]
    public async Task<IActionResult> SubmitHomework(int homeworkId, [FromBody] SubmissionRequest request, CancellationToken ct)
    {
        var hw = await _db.LocalHomeworks.Include(x=>x.ScheduleEntry).FirstOrDefaultAsync(x=>x.Id==homeworkId,ct);
        if (hw is null) return NotFound();
        var student = await _db.Users.AsNoTracking().FirstOrDefaultAsync(x=>x.Id==UserId && x.Role==UserRoles.Student,ct);
        if (student is null || student.StudyGroupId != hw.ScheduleEntry.GroupId) return Forbid();
        if (hw.Deadline.HasValue && DateTime.UtcNow > hw.Deadline.Value) return BadRequest(new {message="Срок сдачи истёк."});
        if (string.IsNullOrWhiteSpace(request.Answer)) return BadRequest(new {message="Ответ не может быть пустым."});
        var submission = await _db.HomeworkSubmissions.FirstOrDefaultAsync(x=>x.HomeworkId==homeworkId && x.StudentId==UserId,ct);
        if (submission is null) _db.HomeworkSubmissions.Add(new HomeworkSubmission {HomeworkId=homeworkId,StudentId=UserId,Answer=request.Answer.Trim(),SubmittedAt=DateTime.UtcNow});
        else
        {
            if (submission.TeacherScore.HasValue) return Conflict(new {message="Работа уже оценена преподавателем, повторная сдача невозможна."});
            submission.Answer=request.Answer.Trim();
            submission.SubmittedAt=DateTime.UtcNow;
            submission.TeacherScore=null;
            submission.TeacherComment=null;
            submission.ReviewedAt=null;
        }
        await _db.SaveChangesAsync(ct); return Ok();
    }

    [HttpGet("student")]
    [Authorize(Roles = UserRoles.Student + "," + UserRoles.Parent)]
    public async Task<IActionResult> StudentView([FromQuery] int? studentId, CancellationToken ct)
    {
        var id=UserId;
        if (User.IsInRole(UserRoles.Parent))
        {
            if (!studentId.HasValue || !await _db.ParentStudents.AnyAsync(x=>x.ParentId==id && x.StudentId==studentId.Value,ct)) return Forbid();
            id=studentId.Value;
        }
        var student = await _db.Users.AsNoTracking().FirstOrDefaultAsync(x=>x.Id==id && x.Role==UserRoles.Student,ct);
        if (student is null) return NotFound(new {message="Студент не найден."});
        var rows=await _db.LocalHomeworks
            .Where(h=>h.ScheduleEntry.GroupId==student.StudyGroupId)
            .Include(h=>h.ScheduleEntry).ThenInclude(x=>x.Subject)
            .Select(h=>new {
                homeworkId=h.Id, title=h.Title, description=h.Description, deadline=h.Deadline,
                subject=h.ScheduleEntry.Subject.Name, scheduleEntryId=h.ScheduleEntryId,
                topic=h.ScheduleEntry.Topic,
                submission=h.Submissions.Where(s=>s.StudentId==id).Select(s=>new {s.Id,s.Answer,s.SubmittedAt,s.TeacherScore,s.TeacherComment}).FirstOrDefault()
            }).OrderByDescending(x=>x.deadline).ToListAsync(ct);
        return Ok(rows);
    }

    [HttpGet("grades/student")]
    [Authorize(Roles = UserRoles.Student + "," + UserRoles.Parent)]
    public async Task<IActionResult> StudentGrades([FromQuery] int? studentId, CancellationToken ct)
    {
        var id=UserId;
        if (User.IsInRole(UserRoles.Parent))
        {
            if (!studentId.HasValue || !await _db.ParentStudents.AnyAsync(x=>x.ParentId==id && x.StudentId==studentId.Value,ct)) return Forbid();
            id=studentId.Value;
        }
        var rows=await _db.GradeRecords.Where(g=>g.StudentId==id)
            .Include(g=>g.ScheduleEntry).ThenInclude(x=>x.Subject)
            .Include(g=>g.ScheduleEntry).ThenInclude(x=>x.Group)
            .OrderByDescending(g=>g.ScheduleEntry.StartAt)
            .Select(g=>new {g.Id,g.Value,g.Comment,g.ScheduleEntryId,g.ScheduleEntry.StartAt,g.ScheduleEntry.Topic,subject=g.ScheduleEntry.Subject.Name,group=g.ScheduleEntry.Group.Name})
            .ToListAsync(ct);
        return Ok(rows);
    }

    [HttpGet("submissions/{lessonId:int}")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> Submissions(int lessonId, CancellationToken ct)
    {
        var lesson=await _db.ScheduleEntries.FirstOrDefaultAsync(x=>x.Id==lessonId,ct); if(lesson is null)return NotFound();
        if(!Admin && lesson.TeacherId!=UserId)return Forbid();
        var rows=await _db.HomeworkSubmissions.Where(x=>x.Homework.ScheduleEntryId==lessonId).Include(x=>x.Student).Include(x=>x.Homework).Select(x=>new{submissionId=x.Id,homeworkId=x.HomeworkId,homework=x.Homework.Title,studentId=x.StudentId,student=x.Student.FullName,x.Answer,x.SubmittedAt,x.TeacherScore,x.TeacherComment}).ToListAsync(ct);
        return Ok(rows);
    }

    [HttpPut("submissions/{submissionId:int}/review")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> Review(int submissionId,[FromBody] ReviewRequest request,CancellationToken ct)
    {
        var s=await _db.HomeworkSubmissions.Include(x=>x.Homework).ThenInclude(x=>x.ScheduleEntry).FirstOrDefaultAsync(x=>x.Id==submissionId,ct); if(s is null)return NotFound();
        if(!Admin && s.Homework.ScheduleEntry.TeacherId!=UserId)return Forbid();


        if(request.TeacherScore is < 0 or > 10)return BadRequest(new{message="Оценка должна быть от 0 до 10."});
        var oldScore=s.TeacherScore;s.TeacherScore=request.TeacherScore;s.TeacherComment=request.TeacherComment;s.ReviewedAt=DateTime.UtcNow;await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(HttpContext, "homework.final_grade", $"submission:{submissionId}", $"{oldScore}->{request.TeacherScore}");
        return Ok();
    }

    public record GradeRequest(List<GradeItem> Items);
    public record GradeItem(int StudentId, decimal Value, string? Comment);
    public record HomeworkRequest(string Title,string Description,DateTime? Deadline);
    public record SubmissionRequest(string Answer);
    public record ReviewRequest(decimal? TeacherScore,string? TeacherComment);
}
