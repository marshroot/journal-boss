using System.Security.Claims;
using JournalBackend.Database;
using JournalBackend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JournalBackend.Controllers;

[ApiController]
[Route("api/messages")]
[Authorize]
public sealed class MessagesController : ControllerBase
{
    private readonly AppDbContext _db;
    public MessagesController(AppDbContext db) => _db = db;

    [HttpGet("contacts")]
    public async Task<IActionResult> Contacts(CancellationToken ct)
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var uid)) return Unauthorized();
        var rows = await _db.Users.AsNoTracking()
            .Where(x => x.Id != uid)
            .OrderBy(x => x.FullName)
            .Select(x => new
            {
                id = x.Id,
                fullName = x.FullName,
                role = x.Role,
                unreadCount = _db.DirectMessages.Count(m => m.RecipientId == uid && m.SenderId == x.Id && !m.IsRead),
                lastMessageAt = _db.DirectMessages
                    .Where(m => (m.SenderId == uid && m.RecipientId == x.Id) || (m.SenderId == x.Id && m.RecipientId == uid))
                    .Select(m => (DateTime?)m.CreatedAt)
                    .Max()
            })
            .OrderByDescending(x => x.unreadCount)
            .ThenByDescending(x => x.lastMessageAt)
            .ThenBy(x => x.fullName)
            .Take(300)
            .ToListAsync(ct);
        return Ok(rows);
    }

    [HttpGet("unread-count")]
    public async Task<IActionResult> UnreadCount(CancellationToken ct)
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var uid)) return Unauthorized();
        var count = await _db.DirectMessages.CountAsync(x => x.RecipientId == uid && !x.IsRead, ct);
        return Ok(new { count });
    }
}
