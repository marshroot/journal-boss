using System.Security.Claims;
using JournalBackend.Database;
using JournalBackend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JournalBackend.Controllers;

/// <summary>
/// Canonical document API used by the classroom workspace. A document is backed by an existing StudyMaterial,
/// so the new API does not introduce a second content store or duplicate the SQLite domain model.
/// </summary>
[ApiController]
[Route("api/documents")]
[Authorize]
public sealed class DocumentsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly JournalBackend.Services.IAuditService _audit;

    public DocumentsController(AppDbContext db, JournalBackend.Services.IAuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    [HttpGet("{documentId:int}")]
    public async Task<IActionResult> Get(int documentId, CancellationToken ct)
    {
        var material = await _db.StudyMaterials.AsNoTracking()
            .Include(x => x.ScheduleEntry).ThenInclude(x => x.Subject)
            .Include(x => x.ScheduleEntry).ThenInclude(x => x.Group)
            .FirstOrDefaultAsync(x => x.Id == documentId, ct);
        if (material is null) return NotFound(new { message = "Документ не найден." });
        if (!await CanRead(material, ct)) return Forbid();
        return Ok(ToDto(material));
    }

    [HttpPut("{documentId:int}")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> Update(int documentId, [FromBody] UpdateDocumentRequest request, CancellationToken ct)
    {
        var material = await _db.StudyMaterials.Include(x => x.ScheduleEntry).FirstOrDefaultAsync(x => x.Id == documentId, ct);
        if (material is null) return NotFound(new { message = "Документ не найден." });
        if (!IsAdmin() && material.ScheduleEntry.TeacherId != CurrentUserId()) return Forbid();
        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.ContentJson))
            return BadRequest(new { message = "Название и содержимое обязательны." });
        if (request.ContentJson.Length > 120000) return BadRequest(new { message = "Документ слишком большой." });
        material.Title = request.Title.Trim();
        material.ContentJson = request.ContentJson;
        material.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(HttpContext, "document.update", $"document:{documentId}", material.Title);
        return Ok(new { material.Id, material.Title, material.ContentJson, material.UpdatedAt });
    }

    private int? CurrentUserId() => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
    private bool IsAdmin() => User.IsInRole(UserRoles.Admin);

    private async Task<bool> CanRead(StudyMaterial material, CancellationToken ct)
    {
        if (IsAdmin()) return true;
        var uid = CurrentUserId();
        if (uid is null) return false;
        if (User.IsInRole(UserRoles.Teacher)) return material.ScheduleEntry.TeacherId == uid;
        if (User.IsInRole(UserRoles.Student))
            return material.IsPublished && await _db.Users.AnyAsync(x => x.Id == uid && x.StudyGroupId == material.ScheduleEntry.GroupId, ct);
        if (User.IsInRole(UserRoles.Parent))
        {
            return material.IsPublished && await _db.ParentStudents
                .Where(x => x.ParentId == uid)
                .Join(_db.Users, x => x.StudentId, x => x.Id, (_, student) => student.StudyGroupId)
                .AnyAsync(groupId => groupId == material.ScheduleEntry.GroupId, ct);
        }
        return false;
    }

    private static object ToDto(StudyMaterial material) => new
    {
        id = material.Id,
        title = material.Title,
        contentJson = material.ContentJson,
        lessonId = material.ScheduleEntryId,
        subject = material.ScheduleEntry.Subject.Name,
        group = material.ScheduleEntry.Group.Name,
        isPublished = material.IsPublished,
        publishedAt = material.PublishedAt,
        createdAt = material.CreatedAt,
        updatedAt = material.UpdatedAt
    };

    public record UpdateDocumentRequest(string Title, string ContentJson);
}
