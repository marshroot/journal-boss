using System.Text;

namespace JournalBackend.Services.LiveKit;

/// <summary>
/// Builds <see cref="LiveKitOptions"/> from the application configuration.
/// The root <c>.env</c> file is used as a fallback, matching the behaviour of the
/// local authentication flow, so that a local checkout works without exporting
/// environment variables by hand.
/// </summary>
public static class LiveKitConfiguration
{
    public static LiveKitOptions Build(IConfiguration configuration, string contentRootPath)
    {
        var fileValues = ReadRootEnvFile(contentRootPath);

        string? Pick(string configurationKey, string envName)
        {
            // 1) Explicit configuration section (appsettings / user secrets).
            var fromConfiguration = configuration[configurationKey];
            if (!string.IsNullOrWhiteSpace(fromConfiguration)) return fromConfiguration.Trim();

            // 2) Plain environment variable, as used by Docker Compose.
            var fromEnvironment = configuration[envName];
            if (!string.IsNullOrWhiteSpace(fromEnvironment)) return fromEnvironment.Trim();

            // 3) Root .env file of the checkout.
            if (fileValues.TryGetValue(envName, out var fromFile) && !string.IsNullOrWhiteSpace(fromFile))
                return fromFile.Trim();

            return null;
        }

        var legacyUrl = Pick("LiveKit:Url", "LIVEKIT_URL");
        var publicUrl = Pick("LiveKit:PublicUrl", "LIVEKIT_PUBLIC_URL") ?? legacyUrl;
        var serverUrl = Pick("LiveKit:ServerUrl", "LIVEKIT_SERVER_URL") ?? ToHttpUrl(legacyUrl);

        var rawTtl = Pick("LiveKit:TokenTtlSeconds", "LIVEKIT_TOKEN_TTL_SECONDS");

        return new LiveKitOptions
        {
            ApiKey = Pick("LiveKit:ApiKey", "LIVEKIT_API_KEY") ?? string.Empty,
            ApiSecret = Pick("LiveKit:ApiSecret", "LIVEKIT_API_SECRET") ?? string.Empty,
            PublicUrl = publicUrl ?? string.Empty,
            ServerUrl = serverUrl ?? string.Empty,
            TokenTtlSeconds =
                int.TryParse(rawTtl, out var ttl) && ttl >= 300 && ttl <= 86400 ? ttl : 7200
        };
    }

    /// <summary>Converts a browser-facing websocket address into a server-side http address.</summary>
    public static string? ToHttpUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;
        var trimmed = url.Trim();
        if (trimmed.StartsWith("wss://", StringComparison.OrdinalIgnoreCase))
            return "https://" + trimmed[5..];
        if (trimmed.StartsWith("ws://", StringComparison.OrdinalIgnoreCase))
            return "http://" + trimmed[5..];
        if (trimmed.StartsWith("https://", StringComparison.OrdinalIgnoreCase) ||
            trimmed.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
            return trimmed;
        return "http://" + trimmed;
    }

    private static Dictionary<string, string> ReadRootEnvFile(string contentRootPath)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (var directory in EnumerateCandidateDirectories(contentRootPath))
        {
            var envPath = Path.Combine(directory, ".env");
            if (!File.Exists(envPath)) continue;

            try
            {
                foreach (var line in File.ReadLines(envPath))
                {
                    var trimmed = line.Trim();
                    if (trimmed.Length == 0 || trimmed.StartsWith("#")) continue;

                    var separator = trimmed.IndexOf('=');
                    if (separator <= 0) continue;

                    var key = trimmed[..separator].Trim();
                    var value = trimmed[(separator + 1)..].Trim();
                    if (value.Length >= 2 &&
                        ((value[0] == '"' && value[^1] == '"') || (value[0] == '\'' && value[^1] == '\'')))
                        value = value[1..^1];

                    result[key] = value;
                }
            }
            catch (IOException)
            {
                // A broken .env file must not prevent the application from starting.
            }

            break;
        }

        return result;
    }

    private static IEnumerable<string> EnumerateCandidateDirectories(string contentRootPath)
    {
        var current = new DirectoryInfo(contentRootPath);
        while (current != null)
        {
            yield return current.FullName;
            current = current.Parent;
        }

        var baseDirectory = new DirectoryInfo(AppContext.BaseDirectory);
        while (baseDirectory != null)
        {
            yield return baseDirectory.FullName;
            baseDirectory = baseDirectory.Parent;
        }
    }
}
