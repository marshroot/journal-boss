using System.Collections.Concurrent;
using System.Security.Claims;
using JournalBackend.Database;
using JournalBackend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace JournalBackend.Hubs;

[Authorize]
public class LessonChatHub : Hub
{
    private static readonly ConcurrentDictionary<int, (DateTime WindowStart, int Count)> Rate = new();
    private const int MaxMessagesPerMinute = 20;
    private static bool AllowSend(int userId)
    {
        var now = DateTime.UtcNow;
        var e = Rate.AddOrUpdate(userId, (now, 1), (_, old) => (now - old.WindowStart).TotalSeconds >= 60 ? (now, 1) : (old.WindowStart, old.Count + 1));
        return e.Count <= MaxMessagesPerMinute;
    }

    private readonly AppDbContext _db;
    public LessonChatHub(AppDbContext db) => _db = db;

    public async Task JoinLesson(int lessonId)
    {
        var userId = GetUserId();
        if (!await CanAccessLesson(userId, lessonId)) throw new HubException("Нет доступа к чату этой пары.");
        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(lessonId));
        var rows = await _db.LessonChatMessages.AsNoTracking()
            .Where(x => x.ScheduleEntryId == lessonId)
            .OrderByDescending(x => x.CreatedAt).Take(100).OrderBy(x => x.CreatedAt)
            .Select(x => new { x.Id, x.UserId, userName = x.User.FullName, x.Message, x.AttachmentId, x.CreatedAt })
            .ToListAsync();
        var attachments = await LoadAttachments(rows.Select(x => x.AttachmentId));
        var history = rows.Select(x => new { id = x.Id, x.UserId, userName = x.userName, x.Message, attachment = AttachmentPayload(attachments, x.AttachmentId), x.CreatedAt });
        await Clients.Caller.SendAsync("History", history);
    }

    public async Task SendMessage(int lessonId, string message, int? attachmentId = null)
    {
        var userId = GetUserId();
        if (!await CanAccessLesson(userId, lessonId)) throw new HubException("Нет доступа к чату этой пары.");
        message = (message ?? string.Empty).Trim();
        var attachment = await ResolveAttachment(attachmentId, userId);
        if (message.Length == 0 && attachment is null) return;
        if (message.Length > 2000) throw new HubException("Сообщение не может быть длиннее 2000 символов.");
        if (!AllowSend(userId)) throw new HubException("Слишком много сообщений. Подождите минуту.");
        var row = new LessonChatMessage { ScheduleEntryId=lessonId, UserId=userId, Message=message, AttachmentId=attachment?.Id, CreatedAt=DateTime.UtcNow };
        _db.LessonChatMessages.Add(row); await _db.SaveChangesAsync();
        var userName = await _db.Users.Where(x=>x.Id==userId).Select(x=>x.FullName).FirstAsync();
        await Clients.Group(GroupName(lessonId)).SendAsync("Message", new { id=row.Id, userId, userName, message, attachment = AttachmentPayload(attachment), createdAt=row.CreatedAt });
    }

    public async Task SendDirectMessage(int recipientId, string message, int? attachmentId = null)
    {
        var senderId = GetUserId();
        message = (message ?? string.Empty).Trim();
        var attachment = await ResolveAttachment(attachmentId, senderId);
        if (message.Length == 0 && attachment is null) return;
        if (message.Length > 4000) throw new HubException("Сообщение не может быть длиннее 4000 символов.");
        if (!AllowSend(senderId)) throw new HubException("Слишком много сообщений. Подождите минуту.");
        var recipient = await _db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == recipientId);
        if (recipient == null) throw new HubException("Получатель не найден.");
        var row = new DirectMessage { SenderId = senderId, RecipientId = recipientId, Message = message, AttachmentId = attachment?.Id, CreatedAt = DateTime.UtcNow };
        _db.DirectMessages.Add(row);
        await _db.SaveChangesAsync();
        var senderName = await _db.Users.Where(x => x.Id == senderId).Select(x => x.FullName).FirstAsync();
        var payload = new { id = row.Id, senderId, recipientId, senderName, message, attachment = AttachmentPayload(attachment), createdAt = row.CreatedAt, isRead = false };
        await Clients.User(senderId.ToString()).SendAsync("DirectMessage", payload);
        await Clients.User(recipientId.ToString()).SendAsync("DirectMessage", payload);
    }

    public async Task MarkDirectRead(int otherUserId)
    {
        var userId = GetUserId();
        if (otherUserId == userId) return;
        var exists = await _db.Users.AnyAsync(x => x.Id == otherUserId);
        if (!exists) throw new HubException("Пользователь не найден.");
        await _db.DirectMessages
            .Where(x => x.RecipientId == userId && x.SenderId == otherUserId && !x.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.IsRead, true));
    }

    public async Task GetDirectHistory(int otherUserId)
    {
        var userId = GetUserId();
        var exists = await _db.Users.AnyAsync(x => x.Id == otherUserId);
        if (!exists) throw new HubException("Пользователь не найден.");
        var rows = await _db.DirectMessages.AsNoTracking()
            .Where(x => (x.SenderId == userId && x.RecipientId == otherUserId) || (x.SenderId == otherUserId && x.RecipientId == userId))
            .OrderByDescending(x => x.CreatedAt).Take(100).OrderBy(x => x.CreatedAt)
            .Select(x => new { x.Id, x.SenderId, x.RecipientId, senderName = x.Sender.FullName, x.Message, x.AttachmentId, x.CreatedAt, x.IsRead })
            .ToListAsync();
        var attachments = await LoadAttachments(rows.Select(x => x.AttachmentId));
        var history = rows.Select(x => new { id = x.Id, x.SenderId, x.RecipientId, senderName = x.senderName, x.Message, attachment = AttachmentPayload(attachments, x.AttachmentId), x.CreatedAt, isRead = x.IsRead });
        await _db.DirectMessages.Where(x => x.RecipientId == userId && x.SenderId == otherUserId && !x.IsRead).ExecuteUpdateAsync(s => s.SetProperty(x => x.IsRead, true));
        await Clients.Caller.SendAsync("DirectHistory", history);
    }

    private async Task<bool> CanAccessLesson(int userId, int lessonId)
    {
        var role = Context.User?.FindFirstValue(ClaimTypes.Role);
        if (role == UserRoles.Admin) return await _db.ScheduleEntries.AnyAsync(x=>x.Id==lessonId);
        var lesson = await _db.ScheduleEntries.AsNoTracking().FirstOrDefaultAsync(x=>x.Id==lessonId);
        if (lesson == null) return false;
        if (role == UserRoles.Teacher) return lesson.TeacherId == userId;
        if (role == UserRoles.Student) return await _db.Users.AnyAsync(u=>u.Id==userId && u.Role==UserRoles.Student && u.StudyGroupId==lesson.GroupId);
        return false;
    }

    public async Task JoinGroup(int groupId)
    {
        var userId = GetUserId();
        if (!await IsGroupMember(userId, groupId)) throw new HubException("Нет доступа к этому чату.");
        await Groups.AddToGroupAsync(Context.ConnectionId, ChatGroup(groupId));
        var rows = await _db.ChatGroupMessages.AsNoTracking()
            .Where(x => x.GroupId == groupId)
            .OrderByDescending(x => x.CreatedAt).Take(100).OrderBy(x => x.CreatedAt)
            .Select(x => new { x.Id, x.UserId, userName = x.User.FullName, x.Message, x.AttachmentId, x.CreatedAt })
            .ToListAsync();
        var attachments = await LoadAttachments(rows.Select(x => x.AttachmentId));
        var history = rows.Select(x => new { id = x.Id, x.UserId, userName = x.userName, x.Message, attachment = AttachmentPayload(attachments, x.AttachmentId), x.CreatedAt });
        await Clients.Caller.SendAsync("GroupHistory", new { groupId, history });
    }

    public async Task SendGroupMessage(int groupId, string message, int? attachmentId = null)
    {
        var userId = GetUserId();
        if (!await IsGroupMember(userId, groupId)) throw new HubException("Нет доступа к этому чату.");
        message = (message ?? string.Empty).Trim();
        var attachment = await ResolveAttachment(attachmentId, userId);
        if (message.Length == 0 && attachment is null) return;
        if (message.Length > 2000) throw new HubException("Сообщение не может быть длиннее 2000 символов.");
        if (!AllowSend(userId)) throw new HubException("Слишком много сообщений. Подождите минуту.");
        var row = new ChatGroupMessage { GroupId = groupId, UserId = userId, Message = message, AttachmentId = attachment?.Id, CreatedAt = DateTime.UtcNow };
        _db.ChatGroupMessages.Add(row); await _db.SaveChangesAsync();
        var userName = await _db.Users.Where(x=>x.Id==userId).Select(x=>x.FullName).FirstAsync();
        await Clients.Group(ChatGroup(groupId)).SendAsync("GroupMessage", new { id = row.Id, groupId, userId, userName, message, attachment = AttachmentPayload(attachment), createdAt = row.CreatedAt });
    }

    private async Task<bool> IsGroupMember(int userId, int groupId) =>
        await _db.ChatGroupMembers.AnyAsync(m => m.GroupId == groupId && m.UserId == userId);

    /// <summary>Only the uploader may attach an image to an outgoing message.</summary>
    private async Task<ChatAttachment?> ResolveAttachment(int? attachmentId, int senderId)
    {
        if (!attachmentId.HasValue) return null;
        var item = await _db.ChatAttachments.AsNoTracking().FirstOrDefaultAsync(x => x.Id == attachmentId.Value);
        if (item is null || item.UploaderId != senderId) throw new HubException("Изображение не найдено или не принадлежит вам.");
        return item;
    }

    private async Task<Dictionary<int, ChatAttachment>> LoadAttachments(IEnumerable<int?> ids)
    {
        var distinct = ids.Where(x => x.HasValue).Select(x => x!.Value).Distinct().ToList();
        if (distinct.Count == 0) return new Dictionary<int, ChatAttachment>();
        return await _db.ChatAttachments.AsNoTracking().Where(a => distinct.Contains(a.Id)).ToDictionaryAsync(a => a.Id);
    }

    private static object? AttachmentPayload(ChatAttachment? a) =>
        a is null ? null : new { id = a.Id, fileName = a.FileName, contentType = a.ContentType, sizeBytes = a.SizeBytes };

    private static object? AttachmentPayload(Dictionary<int, ChatAttachment> loaded, int? id) =>
        id.HasValue && loaded.TryGetValue(id.Value, out var a) ? AttachmentPayload(a) : null;

    private int GetUserId() => int.TryParse(Context.User?.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : throw new HubException("Неавторизованный пользователь.");
    private static string GroupName(int lessonId) => $"lesson:{lessonId}";
    private static string ChatGroup(int groupId) => $"group:{groupId}";
}
