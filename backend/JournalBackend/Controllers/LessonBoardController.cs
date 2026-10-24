using System.Security.Claims;
using JournalBackend.Database;
using JournalBackend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JournalBackend.Controllers;

[ApiController]
[Route("api/lessons")]
[Authorize]
public class LessonBoardController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly JournalBackend.Services.IAuditService _audit;
    public LessonBoardController(AppDbContext db, JournalBackend.Services.IAuditService audit) { _db = db; _audit = audit; }

    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private bool IsTeacher => User.IsInRole(UserRoles.Teacher) || User.IsInRole(UserRoles.Admin);
    private bool IsAdmin => User.IsInRole(UserRoles.Admin);

    /// <summary>Board content is visible only to lesson participants: admin, owner teacher, students of the group.</summary>
    private async Task<bool> CanAccessLessonAsync(int lessonId, CancellationToken ct)
    {
        var lesson = await _db.ScheduleEntries.AsNoTracking().FirstOrDefaultAsync(x => x.Id == lessonId, ct);
        if (lesson is null) return false;
        if (IsAdmin) return true;
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (role == UserRoles.Teacher) return lesson.TeacherId == UserId;
        if (role == UserRoles.Student) return await _db.Users.AnyAsync(u => u.Id == UserId && u.StudyGroupId == lesson.GroupId, ct);
        return false;
    }

    private async Task<bool> IsOwnerOrAdminAsync(int lessonId, CancellationToken ct)
    {
        if (IsAdmin) return true;
        return await _db.ScheduleEntries.AnyAsync(x => x.Id == lessonId && x.TeacherId == UserId, ct);
    }

    [HttpGet("{lessonId:int}/board")]
    public async Task<IActionResult> GetBoard(int lessonId, CancellationToken ct)
    {
        var lesson = await _db.ScheduleEntries.AsNoTracking().FirstOrDefaultAsync(x => x.Id == lessonId, ct);
        if (lesson is null) return NotFound(new { message = "Пара не найдена." });
        if (!await CanAccessLessonAsync(lessonId, ct)) return Forbid();
        var board = await _db.LessonBoards.AsNoTracking().FirstOrDefaultAsync(x => x.ScheduleEntryId == lessonId, ct);
        if (board is null) return Ok(new { content = "{}", mode = "all", canEdit = IsTeacher, isTeacher = IsTeacher, isBroadcast = false });
        var editorIds = (board.EditorIds ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries).Select(int.Parse).ToList();
        var canEdit = IsTeacher || (board.Mode == "all") || (board.Mode == "selected" && editorIds.Contains(UserId));
        return Ok(new { content = board.Content, mode = board.Mode, canEdit, isTeacher = IsTeacher, editorIds, isBroadcast = board.IsBroadcast, broadcastStartedAt = board.BroadcastStartedAt, updatedAt = board.UpdatedAt });
    }

    [HttpPut("{lessonId:int}/board")]
    public async Task<IActionResult> SaveBoard(int lessonId, [FromBody] BoardSaveRequest req, CancellationToken ct)
    {
        var lesson = await _db.ScheduleEntries.AsNoTracking().FirstOrDefaultAsync(x => x.Id == lessonId, ct);
        if (lesson is null) return NotFound(new { message = "Пара не найдена." });
        if (!await CanAccessLessonAsync(lessonId, ct)) return Forbid();
        var board = await _db.LessonBoards.FirstOrDefaultAsync(x => x.ScheduleEntryId == lessonId, ct);
        if (board is null)
        {
            board = new LessonBoard { ScheduleEntryId = lessonId, Content = req.Content ?? "{}", Mode = IsTeacher ? "all" : "view", UpdatedAt = DateTime.UtcNow };
            _db.LessonBoards.Add(board);
        }
        else
        {
            var editorIds = (board.EditorIds ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries).Select(int.Parse).ToList();
            var canEdit = IsTeacher || (board.Mode == "all") || (board.Mode == "selected" && editorIds.Contains(UserId));
            if (!canEdit) return Forbid();
            board.Content = req.Content ?? "{}";
            board.UpdatedAt = DateTime.UtcNow;
        }
        await _db.SaveChangesAsync(ct);
        return Ok(new { ok = true, updatedAt = board.UpdatedAt });
    }

    [HttpPut("{lessonId:int}/board/mode")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> SetMode(int lessonId, [FromBody] BoardModeRequest req, CancellationToken ct)
    {
        var lesson = await _db.ScheduleEntries.AsNoTracking().FirstOrDefaultAsync(x => x.Id == lessonId, ct);
        if (lesson is null) return NotFound(new { message = "Пара не найдена." });
        if (!await IsOwnerOrAdminAsync(lessonId, ct)) return Forbid();
        if (req.Mode is not ("all" or "view" or "selected")) return BadRequest(new { message = "Недопустимый режим доски." });
        var board = await _db.LessonBoards.FirstOrDefaultAsync(x => x.ScheduleEntryId == lessonId, ct);
        if (board is null)
        {
            board = new LessonBoard { ScheduleEntryId = lessonId, Content = "{}", Mode = req.Mode, EditorIds = req.EditorIds, UpdatedAt = DateTime.UtcNow };
            _db.LessonBoards.Add(board);
        }
        else
        {
            board.Mode = req.Mode;
            board.EditorIds = req.EditorIds;
            board.UpdatedAt = DateTime.UtcNow;
        }
        await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(HttpContext, "board.mode", $"lesson:{lessonId}", $"{req.Mode} editors:{req.EditorIds ?? "-"}");
        return Ok(new { ok = true, mode = board.Mode, editorIds = board.EditorIds });
    }

    /// <summary>
    /// Turns on board projection: students of the lesson group see the board open on their
    /// screens (their «Текущая пара» page polls this state) while the teacher draws.
    /// </summary>
    [HttpPost("{lessonId:int}/board/broadcast/start")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> StartBroadcast(int lessonId, CancellationToken ct)
    {
        var lesson = await _db.ScheduleEntries.AsNoTracking().FirstOrDefaultAsync(x => x.Id == lessonId, ct);
        if (lesson is null) return NotFound(new { message = "Пара не найдена." });
        if (!await IsOwnerOrAdminAsync(lessonId, ct)) return Forbid();
        if (lesson.CompletedAt.HasValue) return Conflict(new { message = "Пара уже завершена." });
        var board = await _db.LessonBoards.FirstOrDefaultAsync(x => x.ScheduleEntryId == lessonId, ct);
        if (board is null)
        {
            board = new LessonBoard { ScheduleEntryId = lessonId, Content = "{}", Mode = "view", UpdatedAt = DateTime.UtcNow };
            _db.LessonBoards.Add(board);
        }
        board.IsBroadcast = true;
        board.BroadcastStartedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(HttpContext, "board.broadcast_start", $"lesson:{lessonId}");
        return Ok(new { ok = true, isBroadcast = board.IsBroadcast, broadcastStartedAt = board.BroadcastStartedAt });
    }

    [HttpPost("{lessonId:int}/board/broadcast/stop")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> StopBroadcast(int lessonId, CancellationToken ct)
    {
        var lesson = await _db.ScheduleEntries.AsNoTracking().FirstOrDefaultAsync(x => x.Id == lessonId, ct);
        if (lesson is null) return NotFound(new { message = "Пара не найдена." });
        if (!await IsOwnerOrAdminAsync(lessonId, ct)) return Forbid();
        var board = await _db.LessonBoards.FirstOrDefaultAsync(x => x.ScheduleEntryId == lessonId, ct);
        if (board is not null && board.IsBroadcast)
        {
            board.IsBroadcast = false;
            await _db.SaveChangesAsync(ct);
        }
        await _audit.WriteAsync(HttpContext, "board.broadcast_stop", $"lesson:{lessonId}");
        return Ok(new { ok = true, isBroadcast = false });
    }

    [HttpGet("{lessonId:int}/board/students")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> GetStudents(int lessonId, CancellationToken ct)
    {
        var lesson = await _db.ScheduleEntries.AsNoTracking().FirstOrDefaultAsync(x => x.Id == lessonId, ct);
        if (lesson is null) return NotFound(new { message = "Пара не найдена." });
        var students = await _db.Users.AsNoTracking()
            .Where(u => u.Role == "Student" && u.StudyGroupId == lesson.GroupId)
            .Select(u => new { u.Id, u.FullName, u.Login })
            .ToListAsync(ct);
        return Ok(students);
    }

    public class BoardSaveRequest { public string? Content { get; set; } }
    public class BoardModeRequest { public string Mode { get; set; } = "all"; public string? EditorIds { get; set; } }
}
