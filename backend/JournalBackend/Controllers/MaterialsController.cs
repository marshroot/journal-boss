using System.Security.Claims;
using JournalBackend.Database;
using JournalBackend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JournalBackend.Controllers;

[ApiController]
[Route("api/materials")]
[Authorize]
public class MaterialsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly JournalBackend.Services.IAuditService _audit;
    public MaterialsController(AppDbContext db, JournalBackend.Services.IAuditService audit) { _db = db; _audit = audit; }
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private bool IsAdmin => User.IsInRole(UserRoles.Admin);

    [HttpGet]
    [Authorize(Roles = UserRoles.Admin + "," + UserRoles.Teacher + "," + UserRoles.Student + "," + UserRoles.Parent)]
    public async Task<IActionResult> List([FromQuery] int? lessonId, [FromQuery] int? studentId, CancellationToken ct)
    {
        var query = _db.StudyMaterials
            .AsNoTracking()
            .Include(x => x.ScheduleEntry).ThenInclude(x => x.Subject)
            .Include(x => x.ScheduleEntry).ThenInclude(x => x.Group)
            .AsQueryable();

        if (lessonId.HasValue) query = query.Where(x => x.ScheduleEntryId == lessonId.Value);

        if (User.IsInRole(UserRoles.Teacher))
            query = query.Where(x => IsAdmin || x.ScheduleEntry.TeacherId == UserId);
        else if (User.IsInRole(UserRoles.Student))
        {
            var groupId = await _db.Users.Where(x => x.Id == UserId).Select(x => x.StudyGroupId).FirstOrDefaultAsync(ct);
            query = query.Where(x => x.IsPublished && groupId.HasValue && x.ScheduleEntry.GroupId == groupId.Value);
        }
        else if (User.IsInRole(UserRoles.Parent))
        {
            var studentIds = _db.ParentStudents.Where(x => x.ParentId == UserId).Select(x => x.StudentId);
            var groupIds = _db.Users.Where(x => studentIds.Contains(x.Id)).Select(x => x.StudyGroupId);
            query = query.Where(x => x.IsPublished && groupIds.Contains(x.ScheduleEntry.GroupId));
            if (studentId.HasValue && !await _db.ParentStudents.AnyAsync(x => x.ParentId == UserId && x.StudentId == studentId.Value, ct))
                return Forbid();
            if (studentId.HasValue)
            {
                var selectedGroup = await _db.Users.Where(x => x.Id == studentId.Value).Select(x => x.StudyGroupId).FirstOrDefaultAsync(ct);
                query = query.Where(x => selectedGroup.HasValue && x.ScheduleEntry.GroupId == selectedGroup.Value);
            }
        }

        var rows = await query.OrderByDescending(x => x.UpdatedAt).Select(x => new
        {
            x.Id, x.Title, x.ContentJson, x.ScheduleEntryId, x.CreatedAt, x.UpdatedAt, x.IsPublished, x.PublishedAt,
            subject = x.ScheduleEntry.Subject.Name,
            group = x.ScheduleEntry.Group.Name,
            topic = x.ScheduleEntry.Topic,
            startAt = x.ScheduleEntry.StartAt,
            teacherId = x.ScheduleEntry.TeacherId
        }).ToListAsync(ct);
        return Ok(rows);
    }

    [HttpPost]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> Create([FromBody] MaterialRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.ContentJson))
            return BadRequest(new { message = "Название и содержимое обязательны." });
        var lesson = await _db.ScheduleEntries.FirstOrDefaultAsync(x => x.Id == request.ScheduleEntryId, ct);
        if (lesson is null) return NotFound(new { message = "Пара не найдена." });
        if (!IsAdmin && lesson.TeacherId != UserId) return Forbid();
        if (request.ContentJson.Length > 120000) return BadRequest(new { message = "Материал слишком большой." });
        var material = new StudyMaterial { ScheduleEntryId = lesson.Id, Title = request.Title.Trim(), ContentJson = request.ContentJson, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        _db.StudyMaterials.Add(material);
        await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(HttpContext, "material.create", $"material:{material.Id}", $"lesson:{lesson.Id}");
        return Ok(new { material.Id, material.Title, material.ContentJson, material.ScheduleEntryId, material.CreatedAt, material.UpdatedAt, material.IsPublished, material.PublishedAt });
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> Update(int id, [FromBody] MaterialRequest request, CancellationToken ct)
    {
        var material = await _db.StudyMaterials.Include(x => x.ScheduleEntry).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (material is null) return NotFound();
        if (!IsAdmin && material.ScheduleEntry.TeacherId != UserId) return Forbid();
        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.ContentJson)) return BadRequest(new { message = "Название и содержимое обязательны." });
        if (request.ContentJson.Length > 120000) return BadRequest(new { message = "Материал слишком большой." });
        material.Title = request.Title.Trim(); material.ContentJson = request.ContentJson; material.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var material = await _db.StudyMaterials.Include(x => x.ScheduleEntry).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (material is null) return NotFound();
        if (!IsAdmin && material.ScheduleEntry.TeacherId != UserId) return Forbid();
        _db.StudyMaterials.Remove(material); await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(HttpContext, "material.delete", $"material:{id}", material.Title);
        return NoContent();
    }

    [HttpPost("{id:int}/publish")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public Task<IActionResult> Publish(int id, CancellationToken ct) => SetPublished(id, true, ct);

    [HttpPost("{id:int}/unpublish")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public Task<IActionResult> Unpublish(int id, CancellationToken ct) => SetPublished(id, false, ct);

    private async Task<IActionResult> SetPublished(int id, bool published, CancellationToken ct)
    {
        var material = await _db.StudyMaterials.Include(x => x.ScheduleEntry).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (material is null) return NotFound();
        if (!IsAdmin && material.ScheduleEntry.TeacherId != UserId) return Forbid();
        material.IsPublished = published;
        material.PublishedAt = published ? DateTime.UtcNow : null;
        await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(HttpContext, published ? "material.publish" : "material.unpublish", $"material:{id}", material.Title);
        return Ok(new { material.Id, material.IsPublished, material.PublishedAt });
    }

    public record MaterialRequest(int ScheduleEntryId, string Title, string ContentJson);
}
