using System.Security.Claims;
using JournalBackend.Database;
using JournalBackend.Models;
using JournalBackend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JournalBackend.Controllers;

[ApiController]
[Authorize]
[Route("api/attachments")]
public class AttachmentsController : ControllerBase
{
    private static readonly HashSet<string> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "application/pdf", "text/plain", "text/markdown", "image/png", "image/jpeg", "image/webp",
        "application/zip", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    };
    private static readonly Dictionary<string, string[]> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ["application/pdf"] = new[] { ".pdf" },
        ["text/plain"] = new[] { ".txt" },
        ["text/markdown"] = new[] { ".md" },
        ["image/png"] = new[] { ".png" },
        ["image/jpeg"] = new[] { ".jpg", ".jpeg" },
        ["image/webp"] = new[] { ".webp" },
        ["application/zip"] = new[] { ".zip" },
        ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"] = new[] { ".docx" },
        ["application/vnd.openxmlformats-officedocument.presentationml.presentation"] = new[] { ".pptx" },
        ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] = new[] { ".xlsx" },
    };
    private const long MaxBytes = 25L * 1024 * 1024;
    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _env;
    private readonly IAuditService _audit;

    public AttachmentsController(AppDbContext db, IWebHostEnvironment env, IAuditService audit)
    { _db = db; _env = env; _audit = audit; }

    [HttpGet("lesson/{lessonId:int}")]
    public async Task<IActionResult> List(int lessonId)
    {
        var user = await CurrentUser(); if (user is null) return Unauthorized();
        if (!await CanAccessLesson(user, lessonId)) return Forbid();
        var files = await _db.LessonAttachments.AsNoTracking().Where(x => x.ScheduleEntryId == lessonId)
            .OrderByDescending(x => x.CreatedAt).Select(x => new { x.Id, x.FileName, x.ContentType, x.SizeBytes, x.CreatedAt, uploader = x.Uploader.FullName }).ToListAsync();
        return Ok(files);
    }

    [HttpPost("lesson/{lessonId:int}")]
    [RequestSizeLimit(MaxBytes + 1024 * 1024)]
    public async Task<IActionResult> Upload(int lessonId, IFormFile file)
    {
        var user = await CurrentUser(); if (user is null) return Unauthorized();
        if (!await CanAccessLesson(user, lessonId)) return Forbid();
        if (user.Role is not (UserRoles.Admin or UserRoles.Teacher)) return Forbid();
        if (file is null || file.Length == 0 || file.Length > MaxBytes) return BadRequest(new { message = "Файл пустой или превышает 25 MB." });
        if (!AllowedTypes.Contains(file.ContentType)) return BadRequest(new { message = "Тип файла не разрешён." });
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtensions.TryGetValue(file.ContentType, out var okExt) || !okExt.Contains(ext))
            return BadRequest(new { message = "Расширение файла не соответствует разрешённому типу." });
        var safeName = Path.GetFileName(file.FileName);
        foreach (var bad in Path.GetInvalidFileNameChars()) safeName = safeName.Replace(bad, '_');
        if (safeName.Length > 200) safeName = safeName[..200];
        var key = $"{Guid.NewGuid():N}{ext}";
        var root = Path.Combine(_env.ContentRootPath, "storage", "attachments");
        Directory.CreateDirectory(root);
        await using (var stream = System.IO.File.Create(Path.Combine(root, key))) await file.CopyToAsync(stream);
        var item = new LessonAttachment { ScheduleEntryId = lessonId, UploaderId = user.Id, FileName = safeName, ContentType = file.ContentType, SizeBytes = file.Length, StorageKey = key };
        _db.LessonAttachments.Add(item); await _db.SaveChangesAsync();
        await _audit.WriteAsync(HttpContext, "attachment.upload", $"lesson:{lessonId}", safeName);
        return Ok(new { item.Id, item.FileName, item.ContentType, item.SizeBytes, item.CreatedAt });
    }

    [HttpGet("{id:int}/download")]
    public async Task<IActionResult> Download(int id)
    {
        var user = await CurrentUser(); if (user is null) return Unauthorized();
        var item = await _db.LessonAttachments.FindAsync(id); if (item is null) return NotFound();
        if (!await CanAccessLesson(user, item.ScheduleEntryId)) return Forbid();
        var root = Path.GetFullPath(Path.Combine(_env.ContentRootPath, "storage", "attachments"));
        var path = Path.GetFullPath(Path.Combine(root, item.StorageKey));
        if (!path.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.Ordinal) || !System.IO.File.Exists(path)) return NotFound();
        await _audit.WriteAsync(HttpContext, "attachment.download", $"attachment:{id}", item.FileName);
        return PhysicalFile(path, item.ContentType, item.FileName, enableRangeProcessing: true);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var user = await CurrentUser(); if (user is null) return Unauthorized();
        if (user.Role is not (UserRoles.Admin or UserRoles.Teacher)) return Forbid();
        var item = await _db.LessonAttachments.FindAsync(id); if (item is null) return NotFound();
        if (!await CanAccessLesson(user, item.ScheduleEntryId)) return Forbid();
        if (user.Role == UserRoles.Teacher && !await _db.ScheduleEntries.AnyAsync(x => x.Id == item.ScheduleEntryId && x.TeacherId == user.Id)) return Forbid();
        var root = Path.GetFullPath(Path.Combine(_env.ContentRootPath, "storage", "attachments"));
        var path = Path.GetFullPath(Path.Combine(root, item.StorageKey));
        if (path.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.Ordinal) && System.IO.File.Exists(path)) System.IO.File.Delete(path);
        _db.LessonAttachments.Remove(item); await _db.SaveChangesAsync();
        await _audit.WriteAsync(HttpContext, "attachment.delete", $"attachment:{id}", item.FileName);
        return NoContent();
    }

    [HttpGet("material/{materialId:int}")]
    public async Task<IActionResult> ListMaterial(int materialId, CancellationToken ct)
    {
        var user = await CurrentUser(); if (user is null) return Unauthorized();
        var material = await _db.StudyMaterials.Include(x => x.ScheduleEntry).FirstOrDefaultAsync(x => x.Id == materialId, ct);
        if (material is null) return NotFound();
        if (!await CanAccessMaterial(user, material, ct)) return Forbid();
        var rows = await _db.MaterialAttachments.AsNoTracking()
            .Where(x => x.StudyMaterialId == materialId).OrderByDescending(x => x.CreatedAt)
            .Select(x => new { x.Id, x.FileName, x.ContentType, x.SizeBytes, x.CreatedAt, uploader = x.Uploader.FullName })
            .ToListAsync(ct);
        return Ok(rows);
    }

    [HttpPost("material/{materialId:int}")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    [RequestSizeLimit(MaxBytes + 1024 * 1024)]
    public async Task<IActionResult> UploadMaterial(int materialId, IFormFile file, CancellationToken ct)
    {
        var user = await CurrentUser(); if (user is null) return Unauthorized();
        var material = await _db.StudyMaterials.Include(x => x.ScheduleEntry).FirstOrDefaultAsync(x => x.Id == materialId, ct);
        if (material is null) return NotFound();
        if (!IsOwnerOrAdmin(user, material.ScheduleEntry.TeacherId)) return Forbid();
        var validation = ValidateFile(file); if (validation is not null) return validation;
        var stored = await SaveAttachment(file!, "materials", ct);
        var item = new MaterialAttachment { StudyMaterialId = materialId, UploaderId = user.Id, FileName = stored.FileName, ContentType = file!.ContentType, SizeBytes = file.Length, StorageKey = stored.StorageKey };
        _db.MaterialAttachments.Add(item); await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(HttpContext, "attachment.material.upload", $"material:{materialId}", stored.FileName);
        return Ok(new { item.Id, item.FileName, item.ContentType, item.SizeBytes, item.CreatedAt });
    }

    [HttpGet("material/{materialId:int}/{id:int}/download")]
    public async Task<IActionResult> DownloadMaterial(int materialId, int id, CancellationToken ct)
    {
        var user = await CurrentUser(); if (user is null) return Unauthorized();
        var item = await _db.MaterialAttachments.Include(x => x.StudyMaterial).ThenInclude(x => x.ScheduleEntry).FirstOrDefaultAsync(x => x.Id == id && x.StudyMaterialId == materialId, ct);
        if (item is null) return NotFound();
        if (!await CanAccessMaterial(user, item.StudyMaterial, ct)) return Forbid();
        return await SendStoredFile(item.StorageKey, item.ContentType, item.FileName, "material-attachment", id);
    }

    [HttpDelete("material/{materialId:int}/{id:int}")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> DeleteMaterial(int materialId, int id, CancellationToken ct)
    {
        var user = await CurrentUser(); if (user is null) return Unauthorized();
        var item = await _db.MaterialAttachments.Include(x => x.StudyMaterial).ThenInclude(x => x.ScheduleEntry).FirstOrDefaultAsync(x => x.Id == id && x.StudyMaterialId == materialId, ct);
        if (item is null) return NotFound();
        if (!IsOwnerOrAdmin(user, item.StudyMaterial.ScheduleEntry.TeacherId)) return Forbid();
        DeleteStoredFile(item.StorageKey, "materials");
        _db.MaterialAttachments.Remove(item); await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(HttpContext, "attachment.material.delete", $"material:{materialId}", item.FileName);
        return NoContent();
    }

    [HttpGet("homework/{homeworkId:int}")]
    public async Task<IActionResult> ListHomework(int homeworkId, CancellationToken ct)
    {
        var user = await CurrentUser(); if (user is null) return Unauthorized();
        var homework = await _db.LocalHomeworks.Include(x => x.ScheduleEntry).FirstOrDefaultAsync(x => x.Id == homeworkId, ct);
        if (homework is null) return NotFound();
        if (!await CanAccessHomework(user, homework, ct)) return Forbid();
        var rows = await _db.HomeworkAttachments.AsNoTracking()
            .Where(x => x.HomeworkId == homeworkId).OrderByDescending(x => x.CreatedAt)
            .Select(x => new { x.Id, x.FileName, x.ContentType, x.SizeBytes, x.CreatedAt, uploader = x.Uploader.FullName })
            .ToListAsync(ct);
        return Ok(rows);
    }

    [HttpPost("homework/{homeworkId:int}")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    [RequestSizeLimit(MaxBytes + 1024 * 1024)]
    public async Task<IActionResult> UploadHomework(int homeworkId, IFormFile file, CancellationToken ct)
    {
        var user = await CurrentUser(); if (user is null) return Unauthorized();
        var homework = await _db.LocalHomeworks.Include(x => x.ScheduleEntry).FirstOrDefaultAsync(x => x.Id == homeworkId, ct);
        if (homework is null) return NotFound();
        if (!IsOwnerOrAdmin(user, homework.ScheduleEntry.TeacherId)) return Forbid();
        var validation = ValidateFile(file); if (validation is not null) return validation;
        var stored = await SaveAttachment(file!, "homework", ct);
        var item = new HomeworkAttachment { HomeworkId = homeworkId, UploaderId = user.Id, FileName = stored.FileName, ContentType = file!.ContentType, SizeBytes = file.Length, StorageKey = stored.StorageKey };
        _db.HomeworkAttachments.Add(item); await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(HttpContext, "attachment.homework.upload", $"homework:{homeworkId}", stored.FileName);
        return Ok(new { item.Id, item.FileName, item.ContentType, item.SizeBytes, item.CreatedAt });
    }

    [HttpGet("homework/{homeworkId:int}/{id:int}/download")]
    public async Task<IActionResult> DownloadHomework(int homeworkId, int id, CancellationToken ct)
    {
        var user = await CurrentUser(); if (user is null) return Unauthorized();
        var item = await _db.HomeworkAttachments.Include(x => x.Homework).ThenInclude(x => x.ScheduleEntry).FirstOrDefaultAsync(x => x.Id == id && x.HomeworkId == homeworkId, ct);
        if (item is null) return NotFound();
        if (!await CanAccessHomework(user, item.Homework, ct)) return Forbid();
        return await SendStoredFile(item.StorageKey, item.ContentType, item.FileName, "homework-attachment", id);
    }

    [HttpDelete("homework/{homeworkId:int}/{id:int}")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> DeleteHomework(int homeworkId, int id, CancellationToken ct)
    {
        var user = await CurrentUser(); if (user is null) return Unauthorized();
        var item = await _db.HomeworkAttachments.Include(x => x.Homework).ThenInclude(x => x.ScheduleEntry).FirstOrDefaultAsync(x => x.Id == id && x.HomeworkId == homeworkId, ct);
        if (item is null) return NotFound();
        if (!IsOwnerOrAdmin(user, item.Homework.ScheduleEntry.TeacherId)) return Forbid();
        DeleteStoredFile(item.StorageKey, "homework");
        _db.HomeworkAttachments.Remove(item); await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(HttpContext, "attachment.homework.delete", $"homework:{homeworkId}", item.FileName);
        return NoContent();
    }

    private IActionResult? ValidateFile(IFormFile? file)
    {
        if (file is null || file.Length == 0 || file.Length > MaxBytes) return BadRequest(new { message = "Файл пустой или превышает 25 MB." });
        if (!AllowedTypes.Contains(file.ContentType)) return BadRequest(new { message = "Тип файла не разрешён." });
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtensions.TryGetValue(file.ContentType, out var okExt) || !okExt.Contains(ext)) return BadRequest(new { message = "Расширение файла не соответствует разрешённому типу." });
        return null;
    }

    private async Task<(string FileName, string StorageKey)> SaveAttachment(IFormFile file, string category, CancellationToken ct)
    {
        var safeName = Path.GetFileName(file.FileName);
        foreach (var bad in Path.GetInvalidFileNameChars()) safeName = safeName.Replace(bad, '_');
        if (safeName.Length > 200) safeName = safeName[..200];
        var ext = Path.GetExtension(safeName).ToLowerInvariant();
        var key = $"{Guid.NewGuid():N}{ext}";
        var root = Path.Combine(_env.ContentRootPath, "storage", "attachments", category);
        Directory.CreateDirectory(root);
        await using var stream = System.IO.File.Create(Path.Combine(root, key));
        await file.CopyToAsync(stream, ct);
        return (safeName, key);
    }

    private async Task<IActionResult> SendStoredFile(string storageKey, string contentType, string fileName, string category, int id)
    {
        var root = Path.GetFullPath(Path.Combine(_env.ContentRootPath, "storage", "attachments", category));
        var path = Path.GetFullPath(Path.Combine(root, storageKey));
        if (!path.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.Ordinal) || !System.IO.File.Exists(path)) return NotFound();
        await _audit.WriteAsync(HttpContext, "attachment.download", $"{category}:{id}", fileName);
        return PhysicalFile(path, contentType, fileName, enableRangeProcessing: true);
    }

    private void DeleteStoredFile(string storageKey, string category)
    {
        var root = Path.GetFullPath(Path.Combine(_env.ContentRootPath, "storage", "attachments", category));
        var path = Path.GetFullPath(Path.Combine(root, storageKey));
        if (path.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.Ordinal) && System.IO.File.Exists(path)) System.IO.File.Delete(path);
    }

    private static bool IsOwnerOrAdmin(User user, int teacherId) => user.Role == UserRoles.Admin || (user.Role == UserRoles.Teacher && teacherId == user.Id);

    private async Task<bool> CanAccessMaterial(User user, StudyMaterial material, CancellationToken ct)
    {
        if (user.Role == UserRoles.Admin || (user.Role == UserRoles.Teacher && material.ScheduleEntry.TeacherId == user.Id)) return true;
        if (!material.IsPublished) return false;
        if (user.Role == UserRoles.Student) return await _db.Users.AnyAsync(x => x.Id == user.Id && x.StudyGroupId == material.ScheduleEntry.GroupId, ct);
        if (user.Role == UserRoles.Parent)
            return await _db.ParentStudents.AnyAsync(ps => ps.ParentId == user.Id && _db.Users.Any(st => st.Id == ps.StudentId && st.StudyGroupId == material.ScheduleEntry.GroupId), ct);
        return false;
    }

    private async Task<bool> CanAccessHomework(User user, LocalHomework homework, CancellationToken ct)
    {
        if (user.Role == UserRoles.Admin || (user.Role == UserRoles.Teacher && homework.ScheduleEntry.TeacherId == user.Id)) return true;
        if (user.Role == UserRoles.Student) return await _db.Users.AnyAsync(x => x.Id == user.Id && x.StudyGroupId == homework.ScheduleEntry.GroupId, ct);
        if (user.Role == UserRoles.Parent)
            return await _db.ParentStudents.AnyAsync(ps => ps.ParentId == user.Id && _db.Users.Any(st => st.Id == ps.StudentId && st.StudyGroupId == homework.ScheduleEntry.GroupId), ct);
        return false;
    }

    private Task<User?> CurrentUser() { var raw = User.FindFirstValue(ClaimTypes.NameIdentifier); return int.TryParse(raw, out var id) ? _db.Users.FirstOrDefaultAsync(x => x.Id == id) : Task.FromResult<User?>(null); }
    private Task<bool> CanAccessLesson(User user, int lessonId) => _db.ScheduleEntries.AnyAsync(x => x.Id == lessonId && (user.Role == UserRoles.Admin || x.TeacherId == user.Id || (user.Role == UserRoles.Student && x.GroupId == user.StudyGroupId) || (user.Role == UserRoles.Parent && _db.ParentStudents.Any(ps => ps.ParentId == user.Id && _db.Users.Any(st => st.Id == ps.StudentId && st.StudyGroupId == x.GroupId)))));
}
