using System.Net.Http.Json;
using System.IO.Compression;
using System.Text;
namespace JournalBackend;
public sealed class Judge0Client
{
    private readonly HttpClient _http; private readonly IConfiguration _config;
    private static readonly Dictionary<string,int> LanguageIds = new(StringComparer.OrdinalIgnoreCase)
    { ["javascript"] = 63, ["typescript"] = 74, ["python"] = 71, ["csharp"] = 51, ["cpp"] = 54, ["java"] = 62 };
    public Judge0Client(HttpClient http, IConfiguration config) { _http=http; _config=config; _http.Timeout = TimeSpan.FromSeconds(15); }
    public async Task<object> RunAsync(string language,string code,string stdin,IReadOnlyDictionary<string,string>? files,CancellationToken ct)
    {
        if (!LanguageIds.TryGetValue(language,out var languageId)) throw new InvalidOperationException("Язык не поддерживается Judge0.");
        var baseUrl=(_config["Judge0:Url"] ?? Environment.GetEnvironmentVariable("JUDGE0_URL") ?? "").TrimEnd('/');
        if (string.IsNullOrWhiteSpace(baseUrl)) throw new InvalidOperationException("Judge0 не настроен. Укажите JUDGE0_URL только после запуска Judge0.");
        var additionalFiles = BuildAdditionalFiles(files);
        var payload = new { language_id=languageId, source_code=code, stdin, additional_files=additionalFiles, cpu_time_limit=2.0, wall_time_limit=5.0, memory_limit=128000, enable_network=false, max_file_size=1024 };
        using var create=await _http.PostAsJsonAsync($"{baseUrl}/submissions?base64_encoded=false&wait=false",payload,ct); create.EnsureSuccessStatusCode();
        var created=await create.Content.ReadFromJsonAsync<SubmissionResponse>(cancellationToken:ct) ?? throw new InvalidOperationException("Judge0 не вернул token.");
        for(var i=0;i<20;i++){ await Task.Delay(500,ct); var r=await _http.GetFromJsonAsync<JudgeResult>($"{baseUrl}/submissions/{created.token}?base64_encoded=false",ct); if(r?.status?.id>=3) return new {status=r.status.description,stdout=Cut(r.stdout),stderr=Cut(r.stderr),compileOutput=Cut(r.compile_output),time=r.time,memory=r.memory,exitCode=r.exit_code}; }
        return new {status="Выполнение не завершено вовремя",stdout="",stderr="",compileOutput="",time=(double?)null,memory=(long?)null,exitCode=(int?)null};
    }

    private static string? BuildAdditionalFiles(IReadOnlyDictionary<string,string>? files)
    {
        if (files is null || files.Count <= 1) return null;
        using var ms = new MemoryStream();
        using (var archive = new ZipArchive(ms, ZipArchiveMode.Create, true))
        {
            var totalBytes = 0;
            foreach (var item in files.Take(20))
            {
                var name = Path.GetFileName(item.Key);
                if (string.IsNullOrWhiteSpace(name) || name.Length > 160 || item.Value.Length > 50000) continue;
                totalBytes += Encoding.UTF8.GetByteCount(item.Value);
                if (totalBytes > 500_000) break;
                var entry = archive.CreateEntry(name, CompressionLevel.Fastest);
                using var writer = new StreamWriter(entry.Open(), new UTF8Encoding(false));
                writer.Write(item.Value);
            }
        }
        return Convert.ToBase64String(ms.ToArray());
    }

    private const int MaxOutputChars = 20000;
    private static string Cut(string? s) => string.IsNullOrEmpty(s) ? "" : s.Length > MaxOutputChars ? s[..MaxOutputChars] + "\n...[вывод обрезан]" : s;
    private sealed record SubmissionResponse(string token); private sealed record JudgeStatus(int id,string description); private sealed record JudgeResult(JudgeStatus? status,string? stdout,string? stderr,string? compile_output,double? time,long? memory,int? exit_code);
}
