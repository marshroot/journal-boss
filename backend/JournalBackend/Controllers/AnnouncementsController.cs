using System.Security.Claims;
using JournalBackend.Database;
using JournalBackend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JournalBackend.Controllers;

[ApiController]
[Route("api/announcements")]
[Authorize]
public class AnnouncementsController : ControllerBase
{
    private readonly AppDbContext _db;
    public AnnouncementsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var rows = await _db.Announcements.AsNoTracking()
            .Where(x => x.IsPublished)
            .OrderByDescending(x => x.PublishedAt)
            .Take(50)
            .Select(x => new { x.Id, x.Title, x.Body, x.PublishedAt })
            .ToListAsync(ct);
        return Ok(rows);
    }

    [HttpPost]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> Create([FromBody] CreateAnnouncementRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Body))
            return BadRequest(new { message = "Заголовок и текст объявления обязательны." });
        if (request.Title.Trim().Length > 160)
            return BadRequest(new { message = "Заголовок объявления не должен превышать 160 символов." });
        if (request.Body.Trim().Length > 5000)
            return BadRequest(new { message = "Текст объявления не должен превышать 5000 символов." });

        var authorId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : (int?)null;
        var row = new Announcement
        {
            Title = request.Title.Trim(),
            Body = request.Body.Trim(),
            PublishedAt = DateTime.UtcNow,
            IsPublished = true,
            AuthorId = authorId
        };
        _db.Announcements.Add(row);
        await _db.SaveChangesAsync(ct);
        return Created($"/api/announcements/{row.Id}", new { row.Id, row.Title, row.Body, row.PublishedAt });
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> Update(int id, [FromBody] CreateAnnouncementRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Body))
            return BadRequest(new { message = "Заголовок и текст объявления обязательны." });

        if (request.Title.Trim().Length > 160)
            return BadRequest(new { message = "Заголовок объявления не должен превышать 160 символов." });

        if (request.Body.Trim().Length > 5000)
            return BadRequest(new { message = "Текст объявления не должен превышать 5000 символов." });

        var row = await _db.Announcements.FindAsync([id], ct);
        if (row is null) return NotFound();

        row.Title = request.Title.Trim();
        row.Body = request.Body.Trim();
        row.PublishedAt = DateTime.UtcNow;
        row.IsPublished = true;
        await _db.SaveChangesAsync(ct);

        return Ok(new { row.Id, row.Title, row.Body, row.PublishedAt });
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var row = await _db.Announcements.FindAsync([id], ct);
        if (row is null) return NotFound();
        _db.Announcements.Remove(row);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    public sealed record CreateAnnouncementRequest(string Title, string Body);
}
