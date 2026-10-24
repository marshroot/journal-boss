using System.ComponentModel.DataAnnotations;

namespace JournalBackend.Models;

/// <summary>
/// Example payment record for the demo payment system. No real payment provider is
/// called: <c>Provider = "example"</c> marks the simulated checkout used by the UI.
/// </summary>
public class Payment
{
    public int Id { get; set; }
    public int PayerId { get; set; }
    public User Payer { get; set; } = null!;
    /// <summary>Student the payment is for (optional; a parent pays for a linked child).</summary>
    public int? StudentId { get; set; }
    public User? Student { get; set; }
    [MaxLength(200)] public string Title { get; set; } = string.Empty;
    [MaxLength(1000)] public string? Description { get; set; }
    public decimal Amount { get; set; }
    [MaxLength(8)] public string Currency { get; set; } = "RUB";
    /// <summary>Pending | Paid | Cancelled | Refunded</summary>
    [MaxLength(20)] public string Status { get; set; } = "Pending";
    [MaxLength(50)] public string Provider { get; set; } = "example";
    [MaxLength(128)] public string? ExternalRef { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAt { get; set; }
    public DateTime? CancelledAt { get; set; }
}

/// <summary>Image uploaded for a chat message (lesson chat, direct message or group chat).</summary>
public class ChatAttachment
{
    public int Id { get; set; }
    public int UploaderId { get; set; }
    public User Uploader { get; set; } = null!;
    [MaxLength(200)] public string FileName { get; set; } = string.Empty;
    [MaxLength(255)] public string ContentType { get; set; } = "application/octet-stream";
    public long SizeBytes { get; set; }
    [MaxLength(128)] public string StorageKey { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
