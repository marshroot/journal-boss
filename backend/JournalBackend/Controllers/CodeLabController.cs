using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using JournalBackend.Database;
using JournalBackend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Net.Http;

namespace JournalBackend.Controllers;

[ApiController]
[Route("api/code-lab")]
[Authorize]
public class CodeLabController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly JournalBackend.Services.CodeExecutionQueue _executionQueue;
    private readonly IConfiguration _configuration;

    public CodeLabController(
        AppDbContext db,
        JournalBackend.Services.CodeExecutionQueue executionQueue,
        IConfiguration configuration)
    {
        _db = db;
        _executionQueue = executionQueue;
        _configuration = configuration;
    }

    [HttpGet("lesson/{lessonId:int}")]
    public async Task<IActionResult> GetLesson(
        int lessonId,
        CancellationToken ct)
    {
        var lesson = await _db.ScheduleEntries
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == lessonId, ct);

        if (lesson == null)
            return NotFound(new { message = "Пара не найдена." });

        if (!await CanAccessLesson(lesson, ct))
            return Forbid();

        var exercises = await _db.CodeExercises
            .AsNoTracking()
            .Where(x => x.ScheduleEntryId == lessonId)
            .OrderByDescending(x => x.UpdatedAt)
            .Select(x => new
            {
                x.Id,
                x.Title,
                x.Description,
                x.Language,
                x.StarterCode,
                x.CreatedAt,
                x.UpdatedAt
            })
            .ToListAsync(ct);

        return Ok(exercises);
    }

    [HttpPost("lesson/{lessonId:int}")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> Create(
        int lessonId,
        [FromBody] CreateExerciseRequest request,
        CancellationToken ct)
    {
        var lesson = await _db.ScheduleEntries
            .FirstOrDefaultAsync(x => x.Id == lessonId, ct);

        if (lesson == null)
            return NotFound(new { message = "Пара не найдена." });

        if (!IsAdmin() && !await IsOwnTeacherLesson(lessonId, ct))
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.Title) ||
            string.IsNullOrWhiteSpace(request.Description))
        {
            return BadRequest(new
            {
                message = "Название и условие обязательны."
            });
        }

        var allowed = new[]
        {
            "javascript",
            "typescript",
            "python",
            "csharp",
            "cpp",
            "java"
        };

        if (!allowed.Contains(
                request.Language,
                StringComparer.OrdinalIgnoreCase))
        {
            return BadRequest(new
            {
                message = "Язык не поддерживается."
            });
        }

        if (request.StarterCode?.Length > 20000)
        {
            return BadRequest(new
            {
                message = "Стартовый код слишком большой."
            });
        }

        var item = new CodeExercise
        {
            ScheduleEntryId = lessonId,
            Title = request.Title.Trim(),
            Description = request.Description.Trim(),
            Language = request.Language.ToLowerInvariant(),
            StarterCode = request.StarterCode ?? string.Empty
        };

        _db.CodeExercises.Add(item);
        await _db.SaveChangesAsync(ct);
        _db.CodeFiles.Add(new CodeFile { ExerciseId = item.Id, Name = request.Language.Equals("python", StringComparison.OrdinalIgnoreCase) ? "main.py" : request.Language.Equals("csharp", StringComparison.OrdinalIgnoreCase) ? "Program.cs" : request.Language.Equals("java", StringComparison.OrdinalIgnoreCase) ? "Main.java" : request.Language.Equals("cpp", StringComparison.OrdinalIgnoreCase) ? "main.cpp" : request.Language.Equals("typescript", StringComparison.OrdinalIgnoreCase) ? "main.ts" : "main.js", Language = item.Language, InitialCode = item.StarterCode });
        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            item.Id,
            item.Title,
            item.Description,
            item.Language,
            item.StarterCode,
            item.CreatedAt,
            item.UpdatedAt
        });
    }

    [HttpGet("exercise/{exerciseId:int}/files")]
    public async Task<IActionResult> Files(int exerciseId, CancellationToken ct)
    {
        var item = await _db.CodeExercises.AsNoTracking().Include(x => x.ScheduleEntry).FirstOrDefaultAsync(x => x.Id == exerciseId, ct);
        if (item == null) return NotFound(new { message = "Задача не найдена." });
        if (!await CanAccessLesson(item.ScheduleEntry, ct)) return Forbid();
        var files = await _db.CodeFiles.AsNoTracking().Where(x => x.ExerciseId == exerciseId).OrderBy(x => x.Id).Select(x => new { x.Id, x.Name, x.Language, x.InitialCode, x.UpdatedAt }).ToListAsync(ct);
        if (files.Count == 0)
        {
            var name = item.Language.Equals("python", StringComparison.OrdinalIgnoreCase) ? "main.py" : item.Language.Equals("csharp", StringComparison.OrdinalIgnoreCase) ? "Program.cs" : item.Language.Equals("java", StringComparison.OrdinalIgnoreCase) ? "Main.java" : item.Language.Equals("cpp", StringComparison.OrdinalIgnoreCase) ? "main.cpp" : item.Language.Equals("typescript", StringComparison.OrdinalIgnoreCase) ? "main.ts" : "main.js";
            _db.CodeFiles.Add(new CodeFile { ExerciseId = exerciseId, Name = name, Language = item.Language, InitialCode = item.StarterCode });
            await _db.SaveChangesAsync(ct);
            files = await _db.CodeFiles.AsNoTracking().Where(x => x.ExerciseId == exerciseId).OrderBy(x => x.Id).Select(x => new { x.Id, x.Name, x.Language, x.InitialCode, x.UpdatedAt }).ToListAsync(ct);
        }
        return Ok(files);
    }

    [HttpPost("exercise/{exerciseId:int}/files")]
    [Authorize(Roles = UserRoles.Student + "," + UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> CreateFile(int exerciseId, [FromBody] CreateFileRequest request, CancellationToken ct)
    {
        var item = await _db.CodeExercises.Include(x => x.ScheduleEntry).FirstOrDefaultAsync(x => x.Id == exerciseId, ct);
        if (item == null) return NotFound(new { message = "Задача не найдена." });
        if (!await CanEditExercise(item, ct)) return Forbid();
        var name = SanitizeFileName(request.Name);
        if (name is null) return BadRequest(new { message = "Некорректное имя файла." });
        if (await _db.CodeFiles.CountAsync(x => x.ExerciseId == exerciseId, ct) >= 20) return BadRequest(new { message = "В задаче можно создать не более 20 файлов." });
        if (await _db.CodeFiles.AnyAsync(x => x.ExerciseId == exerciseId && x.Name == name, ct)) return Conflict(new { message = "Файл с таким именем уже существует." });
        var language = NormalizeLanguage(request.Language, item.Language);
        if (language is null) return BadRequest(new { message = "Язык файла не поддерживается." });
        var initial = request.InitialCode ?? string.Empty;
        if (initial.Length > 50000) return BadRequest(new { message = "Начальный код слишком большой." });
        var file = new CodeFile { ExerciseId = exerciseId, Name = name, Language = language, InitialCode = initial };
        _db.CodeFiles.Add(file); await _db.SaveChangesAsync(ct);
        return Ok(new { file.Id, file.Name, file.Language, file.InitialCode, file.UpdatedAt });
    }

    [HttpPut("exercise/{exerciseId:int}/file/{fileId:int}")]
    [Authorize(Roles = UserRoles.Student + "," + UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> UpdateFile(int exerciseId, int fileId, [FromBody] UpdateFileRequest request, CancellationToken ct)
    {
        var item = await _db.CodeExercises.Include(x => x.ScheduleEntry).FirstOrDefaultAsync(x => x.Id == exerciseId, ct);
        var file = await _db.CodeFiles.FirstOrDefaultAsync(x => x.Id == fileId && x.ExerciseId == exerciseId, ct);
        if (item is null || file is null) return NotFound(new { message = "Файл не найден." });
        if (!await CanEditExercise(item, ct)) return Forbid();
        var name = SanitizeFileName(request.Name);
        if (name is null) return BadRequest(new { message = "Некорректное имя файла." });
        if (await _db.CodeFiles.AnyAsync(x => x.ExerciseId == exerciseId && x.Id != fileId && x.Name == name, ct)) return Conflict(new { message = "Файл с таким именем уже существует." });
        var language = NormalizeLanguage(request.Language, file.Language);
        if (language is null) return BadRequest(new { message = "Язык файла не поддерживается." });
        if ((request.InitialCode ?? string.Empty).Length > 50000) return BadRequest(new { message = "Код слишком большой." });
        file.Name = name; file.Language = language; file.InitialCode = request.InitialCode ?? string.Empty; file.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(new { file.Id, file.Name, file.Language, file.InitialCode, file.UpdatedAt });
    }

    [HttpDelete("exercise/{exerciseId:int}/file/{fileId:int}")]
    [Authorize(Roles = UserRoles.Student + "," + UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> DeleteFile(int exerciseId, int fileId, CancellationToken ct)
    {
        var item = await _db.CodeExercises.Include(x => x.ScheduleEntry).FirstOrDefaultAsync(x => x.Id == exerciseId, ct);
        var file = await _db.CodeFiles.FirstOrDefaultAsync(x => x.Id == fileId && x.ExerciseId == exerciseId, ct);
        if (item is null || file is null) return NotFound(new { message = "Файл не найден." });
        if (!await CanEditExercise(item, ct)) return Forbid();
        var count = await _db.CodeFiles.CountAsync(x => x.ExerciseId == exerciseId, ct);
        if (count <= 1) return BadRequest(new { message = "В задаче должен остаться хотя бы один файл." });
        _db.CodeFiles.Remove(file); await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("/api/files/{fileId:int}/download")]
    public async Task<IActionResult> DownloadFile(int fileId, CancellationToken ct)
    {
        var file = await _db.CodeFiles.AsNoTracking().Include(x => x.Exercise).ThenInclude(x => x.ScheduleEntry).FirstOrDefaultAsync(x => x.Id == fileId, ct);
        if (file is null) return NotFound(new { message = "Файл не найден." });
        if (!await CanAccessLesson(file.Exercise.ScheduleEntry, ct)) return Forbid();
        var bytes = System.Text.Encoding.UTF8.GetBytes(file.InitialCode ?? string.Empty);
        var contentType = Path.GetExtension(file.Name).ToLowerInvariant() switch
        {
            ".html" or ".htm" => "text/html; charset=utf-8",
            ".css" => "text/css; charset=utf-8",
            ".js" or ".mjs" or ".cjs" => "text/javascript; charset=utf-8",
            ".json" => "application/json; charset=utf-8",
            ".xml" => "application/xml; charset=utf-8",
            ".md" => "text/markdown; charset=utf-8",
            _ => "text/plain; charset=utf-8"
        };
        return File(bytes, contentType, file.Name);
    }

    [HttpGet("exercise/{exerciseId:int}")]
    public async Task<IActionResult> GetExercise(
        int exerciseId,
        CancellationToken ct)
    {
        var item = await _db.CodeExercises
            .AsNoTracking()
            .Include(x => x.ScheduleEntry)
            .FirstOrDefaultAsync(x => x.Id == exerciseId, ct);

        if (item == null)
            return NotFound(new
            {
                message = "Задача не найдена."
            });

        if (!await CanAccessLesson(item.ScheduleEntry, ct))
            return Forbid();

        var uid = CurrentUserId();

        var submission = uid.HasValue
            ? await _db.CodeSubmissions
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x => x.ExerciseId == exerciseId &&
                         x.StudentId == uid.Value,
                    ct)
            : null;

        return Ok(new
        {
            item.Id,
            item.ScheduleEntryId,
            item.Title,
            item.Description,
            item.Language,
            item.StarterCode,
            code = submission?.Code ?? item.StarterCode,
            status = submission?.Status ?? "Draft",
            submittedAt = submission?.SubmittedAt,
            score = submission?.Score,
            teacherComment = submission?.TeacherComment,
            reviewedAt = submission?.ReviewedAt
        });
    }

    [HttpPut("exercise/{exerciseId:int}/submission")]
    [Authorize(Roles = UserRoles.Student)]
    public async Task<IActionResult> SaveSubmission(
        int exerciseId,
        [FromBody] SaveCodeRequest request,
        CancellationToken ct)
    {
        var item = await _db.CodeExercises
            .Include(x => x.ScheduleEntry)
            .FirstOrDefaultAsync(x => x.Id == exerciseId, ct);

        if (item == null)
            return NotFound(new
            {
                message = "Задача не найдена."
            });

        if (!await CanAccessLesson(item.ScheduleEntry, ct))
            return Forbid();

        if (request.Code.Length > 50000)
        {
            return BadRequest(new
            {
                message = "Код слишком большой."
            });
        }

        var studentId = CurrentUserId();

        if (studentId == null)
            return Unauthorized();

        var submission = await _db.CodeSubmissions
            .FirstOrDefaultAsync(
                x => x.ExerciseId == exerciseId &&
                     x.StudentId == studentId.Value,
                ct);

        if (submission is not null && submission.Status is not null && submission.Status != "Draft")
        {
            return Conflict(new
            {
                message = submission.Status == "Reviewed"
                    ? "Работа уже проверена преподавателем и доступна только для просмотра."
                    : "Работа уже отправлена преподавателю и доступна только для просмотра."
            });
        }

        if (submission == null)
        {
            submission = new CodeSubmission
            {
                ExerciseId = exerciseId,
                StudentId = studentId.Value
            };

            _db.CodeSubmissions.Add(submission);
        }

        submission.Code = request.Code;
        submission.Status = request.Submit
            ? "Submitted"
            : "Draft";

        submission.UpdatedAt = DateTime.UtcNow;

        if (request.Submit)
            submission.SubmittedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        _db.CodeSubmissionVersions.Add(new CodeSubmissionVersion
        {
            CodeSubmissionId = submission.Id,
            Code = submission.Code,
            Status = submission.Status,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            submission.Id,
            submission.Status,
            submission.UpdatedAt,
            submission.SubmittedAt
        });
    }

    [HttpGet("exercise/{exerciseId:int}/versions")]
    public async Task<IActionResult> Versions(int exerciseId, CancellationToken ct)
    {
        var item = await _db.CodeExercises.AsNoTracking().Include(x => x.ScheduleEntry).FirstOrDefaultAsync(x => x.Id == exerciseId, ct);
        if (item == null) return NotFound(new { message = "Задача не найдена." });
        if (!await CanAccessLesson(item.ScheduleEntry, ct)) return Forbid();
        var uid = CurrentUserId();
        if (uid == null) return Unauthorized();
        var submission = await _db.CodeSubmissions.AsNoTracking().FirstOrDefaultAsync(x => x.ExerciseId == exerciseId && x.StudentId == uid.Value, ct);
        if (submission == null) return Ok(Array.Empty<object>());
        var rows = await _db.CodeSubmissionVersions.AsNoTracking().Where(x => x.CodeSubmissionId == submission.Id).OrderByDescending(x => x.CreatedAt).Take(30).Select(x => new { x.Id, x.Code, x.Status, x.CreatedAt }).ToListAsync(ct);
        return Ok(rows);
    }

    [HttpGet("exercise/{exerciseId:int}/submissions")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> Submissions(int exerciseId, CancellationToken ct)
    {
        var item = await _db.CodeExercises.AsNoTracking().Include(x => x.ScheduleEntry).FirstOrDefaultAsync(x => x.Id == exerciseId, ct);
        if (item == null) return NotFound(new { message = "Задача не найдена." });
        if (!IsAdmin() && item.ScheduleEntry.TeacherId != CurrentUserId()) return Forbid();
        var rows = await _db.CodeSubmissions.AsNoTracking().Where(x => x.ExerciseId == exerciseId).OrderByDescending(x => x.UpdatedAt).Select(x => new { x.Id, studentId = x.StudentId, studentName = x.Student.FullName, x.Code, x.Status, x.Score, x.TeacherComment, x.ReviewedAt, x.UpdatedAt, x.SubmittedAt }).ToListAsync(ct);
        return Ok(rows);
    }

    [HttpPut("submission/{submissionId:int}/review")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> ReviewSubmission(int submissionId, [FromBody] ReviewCodeRequest request, CancellationToken ct)
    {
        if (request.Score is < 0 or > 100) return BadRequest(new { message = "Оценка должна быть от 0 до 100." });
        var row = await _db.CodeSubmissions.Include(x => x.Exercise).ThenInclude(x => x.ScheduleEntry).FirstOrDefaultAsync(x => x.Id == submissionId, ct);
        if (row is null) return NotFound(new { message = "Отправка не найдена." });
        if (!IsAdmin() && row.Exercise.ScheduleEntry.TeacherId != CurrentUserId()) return Forbid();
        row.Score = request.Score;
        row.TeacherComment = string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment.Trim()[..Math.Min(2000, request.Comment.Trim().Length)];
        row.ReviewedAt = DateTime.UtcNow;
        row.Status = "Reviewed";
        await _db.SaveChangesAsync(ct);
        return Ok(new { row.Id, row.Score, row.TeacherComment, row.ReviewedAt, row.Status });
    }

    [HttpPost("exercise/{exerciseId:int}/collaboration-token")]
    [Authorize(
        Roles = UserRoles.Student + "," +
                UserRoles.Teacher + "," +
                UserRoles.Admin)]
    public async Task<IActionResult> CollaborationToken(
        int exerciseId,
        CancellationToken ct)
    {
        var item = await _db.CodeExercises
            .AsNoTracking()
            .Include(x => x.ScheduleEntry)
            .FirstOrDefaultAsync(x => x.Id == exerciseId, ct);

        if (item == null)
            return NotFound(new
            {
                message = "Задача не найдена."
            });

        if (!await CanAccessLesson(item.ScheduleEntry, ct))
            return Forbid();

        var key = _configuration["Jwt:Key"];

        if (string.IsNullOrWhiteSpace(key) || key.Length < 32)
        {
            return Problem(
                "Jwt:Key не настроен.",
                statusCode: StatusCodes.Status500InternalServerError);
        }

        var uid = CurrentUserId();

        if (uid == null)
            return Unauthorized();

        var room = $"code-exercise-{item.Id}";

        var claims = new[]
        {
            new Claim(
                ClaimTypes.NameIdentifier,
                uid.Value.ToString()),

            new Claim(
                ClaimTypes.Role,
                User.FindFirstValue(ClaimTypes.Role) ?? string.Empty),

            new Claim(
                "collab_room",
                room)
        };

        var issuer = _configuration["Jwt:Issuer"]
                     ?? "JournalBackend";

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: "JournalCollab",
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(30),
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(
                    Encoding.UTF8.GetBytes(key)),
                SecurityAlgorithms.HmacSha256));

        return Ok(new
        {
            token = new JwtSecurityTokenHandler()
                .WriteToken(token),

            room,

            expiresAt = token.ValidTo
        });
    }

    [HttpPost("exercise/{exerciseId:int}/file/{fileId:int}/collaboration-token")]
    [Authorize(Roles = UserRoles.Student + "," + UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> FileCollaborationToken(int exerciseId, int fileId, CancellationToken ct)
    {
        var item = await _db.CodeExercises.AsNoTracking().Include(x => x.ScheduleEntry).FirstOrDefaultAsync(x => x.Id == exerciseId, ct);
        var file = await _db.CodeFiles.AsNoTracking().FirstOrDefaultAsync(x => x.Id == fileId && x.ExerciseId == exerciseId, ct);
        if (item == null || file == null) return NotFound(new { message = "Файл не найден." });
        if (!await CanAccessLesson(item.ScheduleEntry, ct)) return Forbid();
        var key = _configuration["Jwt:Key"]; if (string.IsNullOrWhiteSpace(key) || key.Length < 32) return Problem("Jwt:Key не настроен.", statusCode: StatusCodes.Status500InternalServerError);
        var uid = CurrentUserId(); if (uid == null) return Unauthorized();
        var room = $"lesson/{item.ScheduleEntryId}/code/{file.Id}";
        var now = DateTime.UtcNow; var token = new JwtSecurityToken(issuer: _configuration["Jwt:Issuer"] ?? "JournalBackend", audience: "JournalCollab", claims: new[] { new Claim(ClaimTypes.NameIdentifier, uid.Value.ToString()), new Claim(ClaimTypes.Role, User.FindFirstValue(ClaimTypes.Role) ?? string.Empty), new Claim("collab_room", room) }, notBefore: now, expires: now.AddMinutes(30), signingCredentials: new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)), SecurityAlgorithms.HmacSha256));
        return Ok(new { token = new JwtSecurityTokenHandler().WriteToken(token), room, fileId = file.Id, expiresAt = token.ValidTo });
    }

    [HttpPost("exercise/{exerciseId:int}/run")]
    [Authorize(
        Roles = UserRoles.Student + "," +
                UserRoles.Teacher + "," +
                UserRoles.Admin)]
    public async Task<IActionResult> Run(
        int exerciseId,
        [FromBody] RunCodeRequest request,
        CancellationToken ct)
    {
        var item = await _db.CodeExercises
            .Include(x => x.ScheduleEntry)
            .FirstOrDefaultAsync(x => x.Id == exerciseId, ct);

        if (item == null)
            return NotFound(new
            {
                message = "Задача не найдена."
            });

        if (!await CanAccessLesson(item.ScheduleEntry, ct))
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.Code))
        {
            return BadRequest(new
            {
                message = "Код пустой."
            });
        }

        if (request.Code.Length > 50000)
        {
            return BadRequest(new
            {
                message = "Код слишком большой."
            });
        }

        var studentId = CurrentUserId();
        if (studentId == null) return Unauthorized();
        var file = request.FileId.HasValue ? await _db.CodeFiles.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.FileId.Value && x.ExerciseId == exerciseId, ct) : null;
        var runLanguage = file?.Language ?? item.Language;

        var execution = new CodeExecution
        {
            ExerciseId = exerciseId,
            StudentId = studentId.Value,
            Code = request.Code,
            Stdin = request.Stdin ?? string.Empty,
            Status = "Queued",
            CreatedAt = DateTime.UtcNow
        };
        _db.CodeExecutions.Add(execution);
        await _db.SaveChangesAsync(ct);

        var files = request.Files ?? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var safeFiles = files.Where(x => !string.IsNullOrWhiteSpace(x.Key) && x.Key.Length <= 160 && x.Value.Length <= 50000)
            .Take(20).ToDictionary(x => Path.GetFileName(x.Key), x => x.Value, StringComparer.OrdinalIgnoreCase);
        if (!safeFiles.ContainsKey(file?.Name ?? string.Empty) && file is not null) safeFiles[file.Name] = request.Code;
        await _executionQueue.EnqueueAsync(new JournalBackend.Services.CodeExecutionRequest(execution.Id, runLanguage, request.Code, request.Stdin ?? string.Empty, safeFiles), ct);

        for (var attempt = 0; attempt < 80; attempt++)
        {
            await Task.Delay(100, ct);
            await _db.Entry(execution).ReloadAsync(ct);
            if (execution.Status is not ("Queued" or "Running"))
            {
                return Ok(new
                {
                    id = execution.Id,
                    status = execution.Status,
                    stdout = execution.Stdout,
                    stderr = execution.Stderr,
                    compileOutput = execution.CompileOutput,
                    time = execution.ExecutionTime,
                    memory = execution.MemoryUsed,
                    exitCode = execution.ExitCode
                });
            }
        }

        return StatusCode(StatusCodes.Status202Accepted, new { id = execution.Id, status = execution.Status, message = "Задача поставлена в очередь. Обновите результат через историю запусков." });
    }

    [HttpGet("exercise/{exerciseId:int}/runs")]
    public async Task<IActionResult> Runs(int exerciseId, CancellationToken ct)
    {
        var item = await _db.CodeExercises.AsNoTracking().Include(x => x.ScheduleEntry).FirstOrDefaultAsync(x => x.Id == exerciseId, ct);
        if (item == null) return NotFound(new { message = "Задача не найдена." });
        if (!await CanAccessLesson(item.ScheduleEntry, ct)) return Forbid();
        var uid = CurrentUserId();
        if (uid == null) return Unauthorized();
        var rows = await _db.CodeExecutions.AsNoTracking().Where(x => x.ExerciseId == exerciseId && x.StudentId == uid.Value).OrderByDescending(x => x.CreatedAt).Take(30).Select(x => new { x.Id, x.Status, x.Stdout, x.Stderr, x.CompileOutput, x.ExecutionTime, x.MemoryUsed, x.ExitCode, x.CreatedAt, x.CompletedAt }).ToListAsync(ct);
        return Ok(rows);
    }

    [HttpGet("runs/{executionId:int}")]
    public async Task<IActionResult> GetRun(int executionId, CancellationToken ct)
    {
        var uid = CurrentUserId();
        if (uid == null) return Unauthorized();
        var row = await _db.CodeExecutions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == executionId && x.StudentId == uid.Value, ct);
        if (row == null) return NotFound();
        return Ok(new { row.Id, row.Status, row.Stdout, row.Stderr, row.CompileOutput, row.ExecutionTime, row.MemoryUsed, row.ExitCode, row.CreatedAt, row.CompletedAt });
    }

    private async Task<bool> CanEditExercise(CodeExercise exercise, CancellationToken ct)
    {
        if (IsAdmin()) return true;
        var uid = CurrentUserId();
        if (uid is null) return false;
        if (User.IsInRole(UserRoles.Teacher)) return exercise.ScheduleEntry.TeacherId == uid;
        if (!User.IsInRole(UserRoles.Student)) return false;
        var hasAccess = await _db.Users.AnyAsync(u => u.Id == uid && u.StudyGroupId == exercise.ScheduleEntry.GroupId, ct);
        if (!hasAccess) return false;
        var submission = await _db.CodeSubmissions.AsNoTracking().FirstOrDefaultAsync(x => x.ExerciseId == exercise.Id && x.StudentId == uid.Value, ct);
        return submission is null || submission.Status == "Draft";
    }

    private static string? SanitizeFileName(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var name = Path.GetFileName(raw.Trim());
        if (name.Length == 0 || name.Length > 160 || name is "." or "..") return null;
        if (name.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0) return null;
        return name;
    }

    private static string? NormalizeLanguage(string? requested, string fallback)
    {
        var value = string.IsNullOrWhiteSpace(requested) ? fallback : requested.Trim().ToLowerInvariant();
        return new[] { "javascript", "typescript", "python", "csharp", "cpp", "java" }.Contains(value) ? value : null;
    }

    private int? CurrentUserId()
    {
        return int.TryParse(
            User.FindFirstValue(ClaimTypes.NameIdentifier),
            out var id)
            ? id
            : null;
    }

    private bool IsAdmin()
    {
        return User.IsInRole(UserRoles.Admin);
    }

    private async Task<bool> IsOwnTeacherLesson(
        int id,
        CancellationToken ct)
    {
        return CurrentUserId() is int uid &&
               await _db.ScheduleEntries.AnyAsync(
                   x => x.Id == id &&
                        x.TeacherId == uid,
                   ct);
    }

    private async Task<bool> CanAccessLesson(
        ScheduleEntry lesson,
        CancellationToken ct)
    {
        if (IsAdmin())
            return true;

        var uid = CurrentUserId();

        if (uid == null)
            return false;

        if (User.IsInRole(UserRoles.Teacher))
            return lesson.TeacherId == uid;

        if (User.IsInRole(UserRoles.Student))
        {
            return await _db.Users.AnyAsync(
                u => u.Id == uid &&
                     u.StudyGroupId == lesson.GroupId,
                ct);
        }

        return false;
    }

    public record CreateFileRequest(string Name, string Language, string? InitialCode);
    public record UpdateFileRequest(string Name, string Language, string? InitialCode);

    public record CreateExerciseRequest(
        [MaxLength(200)]
        string Title,

        [MaxLength(12000)]
        string Description,

        string Language,

        [MaxLength(20000)]
        string? StarterCode);

    public record SaveCodeRequest(
        [MaxLength(50000)]
        string Code,

        bool Submit = false);

    public record RunCodeRequest(
        [MaxLength(50000)]
        string Code,

        [MaxLength(10000)]
        string? Stdin,

        int? FileId = null,

        Dictionary<string, string>? Files = null);

    public record ReviewCodeRequest(decimal? Score, [MaxLength(2000)] string? Comment);
}