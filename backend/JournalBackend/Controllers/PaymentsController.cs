using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using JournalBackend.Database;
using JournalBackend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JournalBackend.Controllers;

/// <summary>
/// Example payment system (ТЗ: «платёжная система, пример»). Records invoices and runs a
/// simulated checkout: no real provider is contacted, "pay" is a demo confirmation.
/// Swap the Pay/Cancel logic for a real provider (ЮKassa/Stripe) webhook later.
/// </summary>
[ApiController]
[Route("api/payments")]
[Authorize]
public class PaymentsController : ControllerBase
{
    private const decimal MinAmount = 0.01m;
    private const decimal MaxAmount = 10_000_000m;
    private static readonly HashSet<string> TerminalStates = new(StringComparer.OrdinalIgnoreCase) { "Paid", "Cancelled", "Refunded" };

    private readonly AppDbContext _db;
    private readonly JournalBackend.Services.IAuditService _audit;
    public PaymentsController(AppDbContext db, JournalBackend.Services.IAuditService audit) { _db = db; _audit = audit; }

    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private bool IsAdmin => User.IsInRole(UserRoles.Admin);

    [HttpPost]
    public async Task<IActionResult> Create(CreatePaymentRequest request, CancellationToken ct)
    {
        var title = request.Title?.Trim();
        if (string.IsNullOrWhiteSpace(title)) return BadRequest(new { message = "Укажите назначение платежа." });
        if (request.Amount < MinAmount || request.Amount > MaxAmount)
            return BadRequest(new { message = $"Сумма должна быть от {MinAmount} до {MaxAmount:0}." });

        int? studentId = null;
        if (request.StudentId.HasValue)
        {
            var student = await _db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.StudentId.Value && x.Role == UserRoles.Student, ct);
            if (student is null) return BadRequest(new { message = "Указанный студент не найден." });
            var role = User.FindFirstValue(ClaimTypes.Role);
            var allowed = IsAdmin
                || (role == UserRoles.Parent && await _db.ParentStudents.AnyAsync(p => p.ParentId == UserId && p.StudentId == request.StudentId.Value, ct))
                || (role == UserRoles.Student && request.StudentId.Value == UserId);
            if (!allowed) return Forbid();
            studentId = request.StudentId.Value;
        }

        var payment = new Payment
        {
            PayerId = UserId,
            StudentId = studentId,
            Title = title,
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            Amount = Math.Round(request.Amount, 2),
            Currency = string.IsNullOrWhiteSpace(request.Currency) ? "RUB" : request.Currency.Trim().ToUpperInvariant(),
            Status = "Pending",
            Provider = "example"
        };
        _db.Payments.Add(payment);
        await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(HttpContext, "payment.create", $"payment:{payment.Id}", $"{payment.Amount:0.##} {payment.Currency} {title}");
        return Created($"/api/payments/{payment.Id}", await Project(payment, ct));
    }

    [HttpGet("my")]
    public async Task<IActionResult> My(CancellationToken ct)
    {
        var rows = await _db.Payments.AsNoTracking()
            .Where(x => x.PayerId == UserId || x.StudentId == UserId)
            .OrderByDescending(x => x.CreatedAt).Take(200)
            .Select(x => new
            {
                x.Id, x.Title, x.Description, x.Amount, x.Currency, x.Status, x.Provider, x.ExternalRef,
                x.PayerId, payerName = x.Payer.FullName, x.StudentId, studentName = x.Student != null ? x.Student.FullName : null,
                x.CreatedAt, x.PaidAt, x.CancelledAt
            })
            .ToListAsync(ct);
        return Ok(rows);
    }

    [HttpGet]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> All([FromQuery] string? status, CancellationToken ct)
    {
        var query = _db.Payments.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status);
        var rows = await query.OrderByDescending(x => x.CreatedAt).Take(500)
            .Select(x => new
            {
                x.Id, x.Title, x.Description, x.Amount, x.Currency, x.Status, x.Provider, x.ExternalRef,
                x.PayerId, payerName = x.Payer.FullName, x.StudentId, studentName = x.Student != null ? x.Student.FullName : null,
                x.CreatedAt, x.PaidAt, x.CancelledAt
            })
            .ToListAsync(ct);
        return Ok(rows);
    }

    /// <summary>Demo checkout: marks the invoice as paid without contacting a real provider.</summary>
    [HttpPost("{id:int}/pay")]
    public async Task<IActionResult> Pay(int id, CancellationToken ct)
    {
        var payment = await _db.Payments.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (payment is null) return NotFound(new { message = "Платёж не найден." });
        if (!IsAdmin && payment.PayerId != UserId) return Forbid();
        if (payment.Status == "Paid") return Conflict(new { message = "Платёж уже оплачен." });
        if (TerminalStates.Contains(payment.Status)) return Conflict(new { message = $"Платёж в статусе {payment.Status}; оплата недоступна." });
        payment.Status = "Paid";
        payment.PaidAt = DateTime.UtcNow;
        payment.ExternalRef = $"demo-{Guid.NewGuid():N}";
        await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(HttpContext, "payment.paid", $"payment:{id}", payment.ExternalRef);
        return Ok(await Project(payment, ct));
    }

    [HttpPost("{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id, CancellationToken ct)
    {
        var payment = await _db.Payments.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (payment is null) return NotFound(new { message = "Платёж не найден." });
        if (!IsAdmin && payment.PayerId != UserId) return Forbid();
        if (payment.Status != "Pending") return Conflict(new { message = $"Отменить можно только неоплаченный платёж (статус {payment.Status})." });
        payment.Status = "Cancelled";
        payment.CancelledAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(HttpContext, "payment.cancel", $"payment:{id}");
        return Ok(await Project(payment, ct));
    }

    [HttpPost("{id:int}/refund")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> Refund(int id, CancellationToken ct)
    {
        var payment = await _db.Payments.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (payment is null) return NotFound(new { message = "Платёж не найден." });
        if (payment.Status != "Paid") return Conflict(new { message = "Вернуть можно только оплаченный платёж." });
        payment.Status = "Refunded";
        await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(HttpContext, "payment.refund", $"payment:{id}");
        return Ok(await Project(payment, ct));
    }

    private async Task<object> Project(Payment x, CancellationToken ct)
    {
        var payer = await _db.Users.AsNoTracking().Where(u => u.Id == x.PayerId).Select(u => u.FullName).FirstOrDefaultAsync(ct);
        var student = x.StudentId.HasValue
            ? await _db.Users.AsNoTracking().Where(u => u.Id == x.StudentId.Value).Select(u => u.FullName).FirstOrDefaultAsync(ct)
            : null;
        return new
        {
            x.Id, x.Title, x.Description, x.Amount, x.Currency, x.Status, x.Provider, x.ExternalRef,
            x.PayerId, payerName = payer, x.StudentId, studentName = student,
            x.CreatedAt, x.PaidAt, x.CancelledAt
        };
    }

    public record CreatePaymentRequest([Required] string Title, decimal Amount, string? Description, int? StudentId, string? Currency);
}
