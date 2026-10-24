using System.Security.Claims;
using JournalBackend.Database;
using JournalBackend.Models;
using JournalBackend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JournalBackend.Controllers;

/// <summary>
/// Images for chat messages (lesson chat, direct messages and group chats). A client first
/// uploads an image, then sends a chat message referencing it by attachment id. Download is
/// authorized against the chat the referencing message lives in.
/// </summary>
[ApiController]
[Authorize]
[Route("api/chat/attachments")]
public class ChatAttachmentsController : ControllerBase
{
    private static readonly Dictionary<string, string[]> AllowedImages = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/png"] = new[] { ".png" },
        ["image/jpeg"] = new[] { ".jpg", ".jpeg" },
        ["image/webp"] = new[] { ".webp" },
        ["image/gif"] = new[] { ".gif" },
    };
    private const long MaxBytes = 10L * 1024 * 1024;

    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _env;
    private readonly IAuditService _audit;
    public ChatAttachmentsController(AppDbContext db, IWebHostEnvironment env, IAuditService audit)
    { _db = db; _env = env; _audit = audit; }

    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private string Role => User.FindFirstValue(ClaimTypes.Role)!;

    [HttpPost("upload")]
    [RequestSizeLimit(MaxBytes + 1024 * 1024)]
    public async Task<IActionResult> Upload(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0 || file.Length > MaxBytes)
            return BadRequest(new { message = "Файл пустой или превышает 10 MB." });
        if (!AllowedImages.TryGetValue(file.ContentType, out var allowedExt))
            return BadRequest(new { message = "В чат можно отправлять только изображения PNG, JPEG, WebP или GIF." });
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowedExt.Contains(ext))
            return BadRequest(new { message = "Расширение файла не соответствует изображению." });
        var safeName = Path.GetFileName(file.FileName);
        foreach (var bad in Path.GetInvalidFileNameChars()) safeName = safeName.Replace(bad, '_');
        if (safeName.Length > 200) safeName = safeName[..200];
        var key = $"{Guid.NewGuid():N}{ext}";
        var root = Path.Combine(_env.ContentRootPath, "storage", "chat-images");
        Directory.CreateDirectory(root);
        await using (var stream = System.IO.File.Create(Path.Combine(root, key))) await file.CopyToAsync(stream, ct);
        var item = new ChatAttachment { UploaderId = UserId, FileName = safeName, ContentType = file.ContentType, SizeBytes = file.Length, StorageKey = key };
        _db.ChatAttachments.Add(item);
        await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(HttpContext, "chat.image.upload", $"chat-attachment:{item.Id}", safeName);
        return Ok(new { id = item.Id, fileName = item.FileName, contentType = item.ContentType, sizeBytes = item.SizeBytes });
    }

    [HttpGet("{id:int}/download")]
    public async Task<IActionResult> Download(int id, CancellationToken ct)
    {
        var item = await _db.ChatAttachments.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return NotFound(new { message = "Изображение не найдено." });
        if (!await CanAccessAsync(item, ct)) return Forbid();
        var root = Path.GetFullPath(Path.Combine(_env.ContentRootPath, "storage", "chat-images"));
        var path = Path.GetFullPath(Path.Combine(root, item.StorageKey));
        if (!path.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.Ordinal) || !System.IO.File.Exists(path))
            return NotFound(new { message = "Файл изображения отсутствует." });
        Response.Headers.CacheControl = "private, max-age=3600";
        return PhysicalFile(path, item.ContentType, enableRangeProcessing: true);
    }

    /// <summary>
    /// An image is visible exactly to those who can read the message that references it:
    /// lesson chat participants, group chat members, or the two direct-message sides.
    /// An uploaded-but-unsent image is visible only to its uploader.
    /// </summary>
    private async Task<bool> CanAccessAsync(ChatAttachment item, CancellationToken ct)
    {
        if (item.UploaderId == UserId) return true;

        var lessonMessage = await _db.LessonChatMessages.AsNoTracking().FirstOrDefaultAsync(x => x.AttachmentId == item.Id, ct);
        if (lessonMessage is not null)
        {
            if (Role == UserRoles.Admin) return true;
            var lesson = await _db.ScheduleEntries.AsNoTracking().FirstOrDefaultAsync(x => x.Id == lessonMessage.ScheduleEntryId, ct);
            if (lesson is null) return false;
            if (Role == UserRoles.Teacher) return lesson.TeacherId == UserId;
            if (Role == UserRoles.Student)
                return await _db.Users.AnyAsync(u => u.Id == UserId && u.StudyGroupId == lesson.GroupId, ct);
            return false;
        }

        var groupMessage = await _db.ChatGroupMessages.AsNoTracking().FirstOrDefaultAsync(x => x.AttachmentId == item.Id, ct);
        if (groupMessage is not null)
            return await _db.ChatGroupMembers.AnyAsync(m => m.GroupId == groupMessage.GroupId && m.UserId == UserId, ct);

        var directMessage = await _db.DirectMessages.AsNoTracking().FirstOrDefaultAsync(x => x.AttachmentId == item.Id, ct);
        if (directMessage is not null) return directMessage.SenderId == UserId || directMessage.RecipientId == UserId;

        return false;
    }
}
