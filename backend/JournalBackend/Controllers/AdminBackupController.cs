using System.IO.Compression;
using JournalBackend.Database;
using JournalBackend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace JournalBackend.Controllers;

[ApiController]
[Authorize(Roles = UserRoles.Admin)]
[Route("api/admin/backups")]
public class AdminBackupController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _environment;
    private readonly JournalBackend.Services.IAuditService _audit;

    public AdminBackupController(AppDbContext db, IConfiguration configuration, IWebHostEnvironment environment, JournalBackend.Services.IAuditService audit)
    {
        _db = db;
        _configuration = configuration;
        _environment = environment;
        _audit = audit;
    }

    [HttpPost]
    public async Task<IActionResult> Create(CancellationToken cancellationToken)
    {
        var connectionString = _configuration.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString)) return Problem("Database connection is not configured.");
        var source = ResolveDatabasePath(connectionString);
        if (!System.IO.File.Exists(source)) return NotFound(new { message = "Database file was not found." });

        var tempDir = Path.Combine(Path.GetTempPath(), "journal-backup", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);
        var snapshot = Path.Combine(tempDir, "journal.db");
        var zipPath = Path.Combine(tempDir, "journal-backup.zip");
        try
        {
            await _db.Database.ExecuteSqlRawAsync("PRAGMA wal_checkpoint(TRUNCATE);", cancellationToken);
            await using var sourceConnection = new SqliteConnection(connectionString);
            await sourceConnection.OpenAsync(cancellationToken);
            await using var snapshotConnection = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = snapshot }.ToString());
            await snapshotConnection.OpenAsync(cancellationToken);
            sourceConnection.BackupDatabase(snapshotConnection);

            await using (var archive = new FileStream(zipPath, FileMode.CreateNew, FileAccess.ReadWrite, FileShare.None))
            using (var zip = new ZipArchive(archive, ZipArchiveMode.Create))
            {
                zip.CreateEntryFromFile(snapshot, "database/journal.db", CompressionLevel.Optimal);
                AddAttachments(zip);
                AddCollaborationDatabase(zip);
                AddDataProtectionKeys(zip);
                var manifest = zip.CreateEntry("manifest.txt");
                await using var writer = new StreamWriter(manifest.Open());
                await writer.WriteLineAsync($"Journal backup {ReadProjectVersion()}");
                await writer.WriteLineAsync($"CreatedUtc={DateTime.UtcNow:O}");
                await writer.WriteLineAsync("Contents=database/journal.db,storage/attachments,collab/collab.sqlite(+wal/+shm when present),dataprotection/keys");
            }

            await _audit.WriteAsync(HttpContext, "backup.create", "system", "Database, attachments and collaboration storage backup created");
            return File(await System.IO.File.ReadAllBytesAsync(zipPath, cancellationToken), "application/zip", $"journal-backup-{DateTime.UtcNow:yyyyMMdd-HHmmss}.zip");
        }
        finally
        {
            TryDeleteDirectory(tempDir);
        }
    }

    [HttpPost("restore")]
    [RequestSizeLimit(350L * 1024 * 1024)]
    public async Task<IActionResult> Restore(IFormFile archive, CancellationToken ct)
    {
        if (archive is null || archive.Length == 0) return BadRequest(new { message = "Архив не выбран." });
        if (archive.Length > 350L * 1024 * 1024) return BadRequest(new { message = "Backup превышает 350 MB." });

        var root = Path.Combine(Path.GetTempPath(), "journal-restore", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        var zipPath = Path.Combine(root, "upload.zip");
        try
        {
            await using (var output = System.IO.File.Create(zipPath)) await archive.CopyToAsync(output, ct);

            string? dbEntry = null;
            var collabEntries = new List<ZipArchiveEntry>();
            var attachments = new List<ZipArchiveEntry>();
            var keyEntries = new List<ZipArchiveEntry>();

            using (var zip = ZipFile.OpenRead(zipPath))
            {
                foreach (var entry in zip.Entries)
                {
                    var normalized = entry.FullName.Replace('\\', '/');
                    if (normalized.StartsWith("/", StringComparison.Ordinal) || normalized.Contains("../", StringComparison.Ordinal) || normalized.Contains("..\\", StringComparison.Ordinal))
                        return BadRequest(new { message = "Backup содержит небезопасный путь." });

                    if (normalized.Equals("database/journal.db", StringComparison.OrdinalIgnoreCase)) dbEntry = normalized;
                    if (normalized.Equals("collab/collab.sqlite", StringComparison.OrdinalIgnoreCase) ||
                        normalized.Equals("collab/collab.sqlite-wal", StringComparison.OrdinalIgnoreCase) ||
                        normalized.Equals("collab/collab.sqlite-shm", StringComparison.OrdinalIgnoreCase))
                        collabEntries.Add(entry);
                    if (normalized.StartsWith("storage/attachments/", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrEmpty(entry.Name))
                        attachments.Add(entry);
                    if (normalized.StartsWith("dataprotection/keys/", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrEmpty(entry.Name))
                        keyEntries.Add(entry);
                }

                if (dbEntry is null) return BadRequest(new { message = "В backup отсутствует database/journal.db." });
                var manifest = zip.GetEntry("manifest.txt");
                if (manifest is null) return BadRequest(new { message = "В backup отсутствует manifest.txt." });
                var manifestText = await ReadEntryAsync(manifest, ct);
                if (!manifestText.Contains("Journal backup", StringComparison.OrdinalIgnoreCase)) return BadRequest(new { message = "Некорректный manifest backup." });

                zip.GetEntry(dbEntry)!.ExtractToFile(Path.Combine(root, "restored.db"), true);

                foreach (var entry in collabEntries)
                {
                    var relative = entry.FullName["collab/".Length..].Replace('/', Path.DirectorySeparatorChar);
                    var destination = Path.GetFullPath(Path.Combine(root, relative));
                    if (!IsWithinDirectory(destination, root))
                        return BadRequest(new { message = "Backup содержит небезопасный путь collaboration storage." });
                    Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
                    entry.ExtractToFile(destination, true);
                }

                foreach (var entry in keyEntries)
                {
                    const string prefix = "dataprotection/keys/";
                    var relative = entry.FullName[prefix.Length..].Replace('/', Path.DirectorySeparatorChar);
                    var keysRoot = Path.Combine(root, "keys");
                    var destination = Path.GetFullPath(Path.Combine(keysRoot, relative));
                    if (!IsWithinDirectory(destination, keysRoot))
                        return BadRequest(new { message = "Backup содержит небезопасный путь Data Protection key ring." });
                    Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
                    entry.ExtractToFile(destination, true);
                }

                foreach (var entry in attachments)
                {
                    const string prefix = "storage/attachments/";
                    var relative = entry.FullName[prefix.Length..].Replace('/', Path.DirectorySeparatorChar);
                    var attachmentsRoot = Path.Combine(root, "attachments");
                    var destination = Path.GetFullPath(Path.Combine(attachmentsRoot, relative));
                    if (!IsWithinDirectory(destination, attachmentsRoot))
                        return BadRequest(new { message = "Backup содержит небезопасный путь вложения." });
                    Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
                    entry.ExtractToFile(destination, true);
                }
            }

            var restoredDb = Path.Combine(root, "restored.db");
            await using (var check = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = restoredDb }.ToString()))
            {
                await check.OpenAsync(ct);
                await using var command = check.CreateCommand();
                command.CommandText = "PRAGMA integrity_check;";
                var result = Convert.ToString(await command.ExecuteScalarAsync(ct));
                if (!string.Equals(result, "ok", StringComparison.OrdinalIgnoreCase))
                    return BadRequest(new { message = $"Проверка SQLite не пройдена: {result}" });
            }

            var currentDb = ResolveDatabasePath(_configuration.GetConnectionString("DefaultConnection")!);
            Directory.CreateDirectory(Path.GetDirectoryName(currentDb)!);
            await _db.Database.CloseConnectionAsync();
            SqliteConnection.ClearAllPools();
            var safetyCopy = currentDb + ".before-restore-" + DateTime.UtcNow.ToString("yyyyMMddHHmmss");
            System.IO.File.Copy(currentDb, safetyCopy, true);
            System.IO.File.Copy(restoredDb, currentDb, true);

            RestoreCollaborationDatabase(root);
            RestoreDataProtectionKeys(root);
            RestoreAttachments(root);

            await _audit.WriteAsync(HttpContext, "backup.restore", "system", $"Backup restored; safety copy: {Path.GetFileName(safetyCopy)}");
            return Ok(new { message = "Backup успешно восстановлен. Сервер и collaboration service рекомендуется перезапустить.", safetyCopy = Path.GetFileName(safetyCopy) });
        }
        finally
        {
            TryDeleteDirectory(root);
        }
    }

    private string ReadProjectVersion()
    {
        var configured = Environment.GetEnvironmentVariable("JOURNAL_VERSION");
        if (!string.IsNullOrWhiteSpace(configured)) return configured.Trim();

        // Support both source-tree execution and the published container layout.
        var candidates = new[]
        {
            Path.Combine(_environment.ContentRootPath, "VERSION"),
            Path.Combine(_environment.ContentRootPath, "VERSION.txt"),
            Path.Combine(_environment.ContentRootPath, "..", "VERSION"),
            Path.Combine(_environment.ContentRootPath, "..", "VERSION.txt"),
            Path.Combine(AppContext.BaseDirectory, "VERSION"),
            Path.Combine(AppContext.BaseDirectory, "VERSION.txt")
        };
        foreach (var candidate in candidates)
        {
            try
            {
                if (System.IO.File.Exists(candidate))
                {
                    var value = System.IO.File.ReadAllText(candidate).Trim();
                    if (!string.IsNullOrWhiteSpace(value)) return value;
                }
            }
            catch { }
        }
        return "unknown";
    }

    private string ResolveDatabasePath(string connectionString)
    {
        var builder = new SqliteConnectionStringBuilder(connectionString);
        var source = builder.DataSource;
        if (string.IsNullOrWhiteSpace(source) || source.Equals(":memory:", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("A file-backed SQLite database is required.");
        return Path.IsPathRooted(source) ? source : Path.GetFullPath(Path.Combine(_environment.ContentRootPath, source));
    }

    private string ResolveDataProtectionKeyPath()
    {
        var configured = _configuration["DataProtection:KeyRingPath"];
        if (!string.IsNullOrWhiteSpace(configured))
            return Path.IsPathRooted(configured) ? configured : Path.GetFullPath(Path.Combine(_environment.ContentRootPath, configured));
        return Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")?.Equals("Production", StringComparison.OrdinalIgnoreCase) == true
            ? "/data/keys"
            : Path.GetFullPath(Path.Combine(_environment.ContentRootPath, "..", "..", "database", "dp-keys"));
    }

    private string? ResolveCollaborationDatabasePath()
    {
        var configured = _configuration["Collab:DatabasePath"];
        if (string.IsNullOrWhiteSpace(configured)) return null;
        return Path.IsPathRooted(configured) ? configured : Path.GetFullPath(Path.Combine(_environment.ContentRootPath, configured));
    }

    private void AddCollaborationDatabase(ZipArchive zip)
    {
        var path = ResolveCollaborationDatabasePath();
        if (string.IsNullOrWhiteSpace(path) || !System.IO.File.Exists(path)) return;
        zip.CreateEntryFromFile(path, "collab/collab.sqlite", CompressionLevel.Optimal);
        if (System.IO.File.Exists(path + "-wal")) zip.CreateEntryFromFile(path + "-wal", "collab/collab.sqlite-wal", CompressionLevel.Optimal);
        if (System.IO.File.Exists(path + "-shm")) zip.CreateEntryFromFile(path + "-shm", "collab/collab.sqlite-shm", CompressionLevel.Optimal);
    }

    private void AddDataProtectionKeys(ZipArchive zip)
    {
        var keysRoot = ResolveDataProtectionKeyPath();
        if (!Directory.Exists(keysRoot)) return;
        foreach (var file in Directory.EnumerateFiles(keysRoot, "*", SearchOption.AllDirectories))
        {
            var relative = Path.GetRelativePath(keysRoot, file).Replace(Path.DirectorySeparatorChar, '/');
            zip.CreateEntryFromFile(file, $"dataprotection/keys/{relative}", CompressionLevel.Optimal);
        }
    }

    private void AddAttachments(ZipArchive zip)
    {
        var attachments = Path.Combine(_environment.ContentRootPath, "storage", "attachments");
        if (!Directory.Exists(attachments)) return;
        foreach (var file in Directory.EnumerateFiles(attachments, "*", SearchOption.AllDirectories))
        {
            var relative = Path.GetRelativePath(attachments, file).Replace(Path.DirectorySeparatorChar, '/');
            zip.CreateEntryFromFile(file, $"storage/attachments/{relative}", CompressionLevel.Optimal);
        }
    }

    private void RestoreCollaborationDatabase(string root)
    {
        var target = ResolveCollaborationDatabasePath();
        if (string.IsNullOrWhiteSpace(target) || !System.IO.File.Exists(Path.Combine(root, "collab.sqlite"))) return;
        Directory.CreateDirectory(Path.GetDirectoryName(target)!);
        System.IO.File.Copy(Path.Combine(root, "collab.sqlite"), target, true);
        var wal = Path.Combine(root, "collab.sqlite-wal");
        var shm = Path.Combine(root, "collab.sqlite-shm");
        if (System.IO.File.Exists(wal)) System.IO.File.Copy(wal, target + "-wal", true); else TryDeleteFile(target + "-wal");
        if (System.IO.File.Exists(shm)) System.IO.File.Copy(shm, target + "-shm", true); else TryDeleteFile(target + "-shm");
    }

    private void RestoreDataProtectionKeys(string root)
    {
        var source = Path.Combine(root, "keys");
        if (!Directory.Exists(source)) return;
        var target = ResolveDataProtectionKeyPath();
        Directory.CreateDirectory(target);
        foreach (var file in Directory.EnumerateFiles(source, "*", SearchOption.AllDirectories))
        {
            var relative = Path.GetRelativePath(source, file);
            var destination = Path.GetFullPath(Path.Combine(target, relative));
            if (!IsWithinDirectory(destination, target)) throw new InvalidDataException("Backup Data Protection key path escaped key ring root.");
            Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
            System.IO.File.Copy(file, destination, true);
        }
    }

    private void RestoreAttachments(string root)
    {
        var source = Path.Combine(root, "attachments");
        var target = Path.Combine(_environment.ContentRootPath, "storage", "attachments");
        if (Directory.Exists(target)) Directory.Delete(target, true);
        Directory.CreateDirectory(target);
        if (!Directory.Exists(source)) return;

        foreach (var file in Directory.EnumerateFiles(source, "*", SearchOption.AllDirectories))
        {
            var relative = Path.GetRelativePath(source, file);
            var destination = Path.GetFullPath(Path.Combine(target, relative));
            if (!IsWithinDirectory(destination, target)) throw new InvalidDataException("Backup attachment path escaped storage root.");
            Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
            System.IO.File.Copy(file, destination, true);
        }
    }

    private static bool IsWithinDirectory(string path, string root)
    {
        var fullRoot = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        var fullPath = Path.GetFullPath(path);
        return fullPath.StartsWith(fullRoot, StringComparison.Ordinal);
    }

    private static void TryDeleteFile(string path)
    {
        try { if (System.IO.File.Exists(path)) System.IO.File.Delete(path); } catch { }
    }

    private static async Task<string> ReadEntryAsync(ZipArchiveEntry entry, CancellationToken ct)
    {
        using var reader = new StreamReader(entry.Open());
        return await reader.ReadToEndAsync(ct);
    }

    private static void TryDeleteDirectory(string path)
    {
        try { if (Directory.Exists(path)) Directory.Delete(path, true); } catch { }
    }
}
