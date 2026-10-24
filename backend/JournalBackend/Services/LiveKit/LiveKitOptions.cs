namespace JournalBackend.Services.LiveKit;

/// <summary>
/// Configuration of the LiveKit deployment used for online lessons.
/// </summary>
public sealed class LiveKitOptions
{
    public const string SectionName = "LiveKit";

    /// <summary>API key issued by the LiveKit server.</summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>API secret issued by the LiveKit server.</summary>
    public string ApiSecret { get; set; } = string.Empty;

    /// <summary>Address handed to browsers (ws:// or wss://).</summary>
    public string PublicUrl { get; set; } = string.Empty;

    /// <summary>Address used by the backend for server-side API calls (http:// or https://).</summary>
    public string ServerUrl { get; set; } = string.Empty;

    /// <summary>Lifetime of a participant access token, in seconds.</summary>
    public int TokenTtlSeconds { get; set; } = 7200;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(ApiKey) &&
        !string.IsNullOrWhiteSpace(ApiSecret) &&
        !string.IsNullOrWhiteSpace(PublicUrl) &&
        !string.IsNullOrWhiteSpace(ServerUrl);
}
