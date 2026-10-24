using System.Security.Claims;
using JournalBackend.Database;
using JournalBackend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JournalBackend.Controllers;

[ApiController]
[Route("api/chat-groups")]
[Authorize]
public class ChatGroupController : ControllerBase
{
    private readonly AppDbContext _db;
    public ChatGroupController(AppDbContext db) { _db = db; }

    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var groups = await _db.ChatGroupMembers.AsNoTracking()
            .Where(m => m.UserId == UserId)
            .Join(_db.ChatGroups.AsNoTracking(), m => m.GroupId, g => g.Id, (m, g) => new { g.Id, g.Name, g.OwnerId, g.CreatedAt })
            .ToListAsync(ct);
        return Ok(groups);
    }

    [HttpPost]
    [Authorize(Roles = UserRoles.Admin + "," + UserRoles.Teacher)]
    public async Task<IActionResult> Create([FromBody] CreateGroupRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest(new { message = "Название группы обязательно." });
        var group = new ChatGroup { Name = req.Name.Trim(), OwnerId = UserId, CreatedAt = DateTime.UtcNow };
        _db.ChatGroups.Add(group);
        await _db.SaveChangesAsync(ct);
        _db.ChatGroupMembers.Add(new ChatGroupMember { GroupId = group.Id, UserId = UserId });
        foreach (var uid in req.MemberIds ?? Array.Empty<int>())
        {
            if (uid == UserId) continue;
            _db.ChatGroupMembers.Add(new ChatGroupMember { GroupId = group.Id, UserId = uid });
        }
        await _db.SaveChangesAsync(ct);
        return Ok(new { group.Id, group.Name, group.OwnerId, group.CreatedAt });
    }

    [HttpGet("{groupId:int}/members")]
    public async Task<IActionResult> Members(int groupId, CancellationToken ct)
    {
        if (!await IsMember(groupId, ct)) return Forbid();
        var members = await _db.ChatGroupMembers.AsNoTracking()
            .Where(m => m.GroupId == groupId)
            .Join(_db.Users.AsNoTracking(), m => m.UserId, u => u.Id, (m, u) => new { u.Id, u.FullName, u.Role })
            .ToListAsync(ct);
        return Ok(members);
    }

    [HttpPost("{groupId:int}/members")]
    [Authorize(Roles = UserRoles.Admin + "," + UserRoles.Teacher)]
    public async Task<IActionResult> AddMembers(int groupId, [FromBody] MemberIdsRequest req, CancellationToken ct)
    {
        var group = await _db.ChatGroups.FirstOrDefaultAsync(g => g.Id == groupId, ct);
        if (group is null) return NotFound();
        if (group.OwnerId != UserId && !User.IsInRole(UserRoles.Admin)) return Forbid();
        foreach (var uid in req.MemberIds ?? Array.Empty<int>())
        {
            var exists = await _db.ChatGroupMembers.AnyAsync(m => m.GroupId == groupId && m.UserId == uid, ct);
            if (!exists) _db.ChatGroupMembers.Add(new ChatGroupMember { GroupId = groupId, UserId = uid });
        }
        await _db.SaveChangesAsync(ct);
        return Ok(new { ok = true });
    }

    [HttpDelete("{groupId:int}/members/{userId:int}")]
    [Authorize(Roles = UserRoles.Admin + "," + UserRoles.Teacher)]
    public async Task<IActionResult> RemoveMember(int groupId, int userId, CancellationToken ct)
    {
        var group = await _db.ChatGroups.FirstOrDefaultAsync(g => g.Id == groupId, ct);
        if (group is null) return NotFound();
        if (group.OwnerId != UserId && !User.IsInRole(UserRoles.Admin)) return Forbid();
        if (userId == UserId) return BadRequest(new { message = "Нельзя удалить себя." });
        var member = await _db.ChatGroupMembers.FirstOrDefaultAsync(m => m.GroupId == groupId && m.UserId == userId, ct);
        if (member is not null) _db.ChatGroupMembers.Remove(member);
        await _db.SaveChangesAsync(ct);
        return Ok(new { ok = true });
    }

    [HttpDelete("{groupId:int}")]
    [Authorize(Roles = UserRoles.Admin + "," + UserRoles.Teacher)]
    public async Task<IActionResult> DeleteGroup(int groupId, CancellationToken ct)
    {
        var group = await _db.ChatGroups.FirstOrDefaultAsync(g => g.Id == groupId, ct);
        if (group is null) return NotFound();
        if (group.OwnerId != UserId && !User.IsInRole(UserRoles.Admin)) return Forbid();
        _db.ChatGroups.Remove(group);
        await _db.SaveChangesAsync(ct);
        return Ok(new { ok = true });
    }

    [HttpGet("{groupId:int}/messages")]
    public async Task<IActionResult> Messages(int groupId, [FromQuery] int before = 0, [FromQuery] int take = 50, CancellationToken ct = default)
    {
        if (!await IsMember(groupId, ct)) return Forbid();
        var q = _db.ChatGroupMessages.AsNoTracking().Where(m => m.GroupId == groupId);
        if (before > 0) q = q.Where(m => m.Id < before);
        var messages = await q
            .OrderByDescending(m => m.Id)
            .Take(take)
            .Join(_db.Users.AsNoTracking(), m => m.UserId, u => u.Id, (m, u) => new { m.Id, m.Message, m.CreatedAt, m.UserId, u.FullName })
            .ToListAsync(ct);
        return Ok(messages);
    }

    [HttpPost("{groupId:int}/messages")]
    public async Task<IActionResult> Send(int groupId, [FromBody] SendMessageRequest req, CancellationToken ct)
    {
        if (!await IsMember(groupId, ct)) return Forbid();
        if (string.IsNullOrWhiteSpace(req.Message)) return BadRequest(new { message = "Сообщение не может быть пустым." });
        var msg = new ChatGroupMessage { GroupId = groupId, UserId = UserId, Message = req.Message.Trim(), CreatedAt = DateTime.UtcNow };
        _db.ChatGroupMessages.Add(msg);
        await _db.SaveChangesAsync(ct);
        return Ok(new { msg.Id, msg.Message, msg.CreatedAt, msg.UserId });
    }

    private async Task<bool> IsMember(int groupId, CancellationToken ct) =>
        await _db.ChatGroupMembers.AnyAsync(m => m.GroupId == groupId && m.UserId == UserId, ct);

    public class CreateGroupRequest { public string Name { get; set; } = string.Empty; public int[]? MemberIds { get; set; } }
    public class MemberIdsRequest { public int[]? MemberIds { get; set; } }
    public class SendMessageRequest { public string Message { get; set; } = string.Empty; }
}
