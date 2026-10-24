using System.Security.Claims;
using JournalBackend.Database;
using JournalBackend.Models;

namespace JournalBackend.Services;

public interface IAuditService
{
    Task WriteAsync(HttpContext context, string action, string? resource = null, string? details = null);
}

public sealed class AuditService : IAuditService
{
    private readonly AppDbContext _db;
    public AuditService(AppDbContext db) => _db = db;

    public async Task WriteAsync(HttpContext context, string action, string? resource = null, string? details = null)
    {
        int? userId = null;
        var raw = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (int.TryParse(raw, out var parsed)) userId = parsed;
        _db.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            Action = action,
            Resource = resource,
            Details = details,
            IpAddress = context.Connection.RemoteIpAddress?.ToString()
        });
        await _db.SaveChangesAsync();
    }
}
