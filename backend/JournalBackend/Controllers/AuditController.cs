using JournalBackend.Database;
using JournalBackend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JournalBackend.Controllers;

[ApiController]
[Authorize(Roles = UserRoles.Admin)]
[Route("api/admin/audit")]
public class AuditController : ControllerBase
{
    private readonly AppDbContext _db;
    public AuditController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] int take = 100)
    {
        take = Math.Clamp(take, 1, 500);
        var rows = await _db.AuditLogs.AsNoTracking().OrderByDescending(x => x.CreatedAt).Take(take)
            .Select(x => new { x.Id, x.UserId, user = x.User != null ? x.User.FullName : null, x.Action, x.Resource, x.Details, x.IpAddress, x.CreatedAt }).ToListAsync();
        return Ok(rows);
    }
}
