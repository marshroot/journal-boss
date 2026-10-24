using System.Security.Claims;
using JournalBackend.Database;
using JournalBackend.Models;
using JournalBackend.Services.LiveKit;
using Livekit.Server.Sdk.Dotnet;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JournalBackend.Controllers;

[ApiController]
[Route("api/lessons")]
[Authorize]
public class OnlineLessonsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly JournalBackend.Services.IAuditService _audit;
    private readonly ILiveKitService _liveKit;

    public OnlineLessonsController(
        AppDbContext db,
        JournalBackend.Services.IAuditService audit,
        ILiveKitService liveKit)
    {
        _db = db;
        _audit = audit;
        _liveKit = liveKit;
    }

    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private bool IsAdmin => User.IsInRole(UserRoles.Admin);

    /// <summary>Topic used by the browser to exchange screen-sharing requests over the LiveKit data channel.</summary>
    private const string ScreenShareTopic = "jornal.screen-share";

    [HttpGet("teacher/current")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> Current(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var q = _db.ScheduleEntries.AsNoTracking()
            .Where(x => x.StartAt <= now && x.EndAt >= now);
        if (!IsAdmin) q = q.Where(x => x.TeacherId == UserId);
        var lesson = await q.Include(x => x.Group).Include(x => x.Subject)
            .OrderBy(x => x.StartAt).FirstOrDefaultAsync(ct);
        if (lesson is null) return NoContent();
        var online = await _db.OnlineLessons.AsNoTracking()
            .Where(x => x.ScheduleEntryId == lesson.Id && x.Status == "Active")
            .OrderByDescending(x => x.StartedAt).FirstOrDefaultAsync(ct);
        var boardRow = await _db.LessonBoards.AsNoTracking()
            .Where(x => x.ScheduleEntryId == lesson.Id)
            .Select(x => new { x.IsBroadcast, x.BroadcastStartedAt })
            .FirstOrDefaultAsync(ct);
        return Ok(new { lesson.Id, lesson.StartAt, lesson.EndAt, lesson.LessonNumber, lesson.Room, lesson.Topic,
            groupId = lesson.GroupId, groupName = lesson.Group.Name, subjectId = lesson.SubjectId,
            subjectName = lesson.Subject.Name, online = online == null ? null : new { online.Id, online.RoomName, online.Status, online.StartedAt },
            board = boardRow == null ? null : new { isBroadcast = boardRow.IsBroadcast, broadcastStartedAt = boardRow.BroadcastStartedAt } });
    }

    [HttpPost("{lessonId:int}/online/start")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> Start(int lessonId, CancellationToken ct)
    {
        var lesson = await _db.ScheduleEntries.FirstOrDefaultAsync(x => x.Id == lessonId, ct);
        if (lesson is null) return NotFound(new { message = "Пара не найдена." });
        if (!IsAdmin && lesson.TeacherId != UserId) return Forbid();
        if (!_liveKit.IsConfigured) return StatusCode(503, new { message = "LiveKit не настроен. Укажите LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_PUBLIC_URL и LIVEKIT_SERVER_URL." });

        var active = await _db.OnlineLessons.FirstOrDefaultAsync(x => x.ScheduleEntryId == lessonId && x.Status == "Active", ct);
        if (active is null)
        {
            var room = $"myjournal-lesson-{lessonId}-{Guid.NewGuid():N}";
            active = new OnlineLesson { ScheduleEntryId = lessonId, RoomName = room, Status = "Active", StartedAt = DateTime.UtcNow };
            _db.OnlineLessons.Add(active);
            await _db.SaveChangesAsync(ct);
            await _audit.WriteAsync(HttpContext, "online.start", $"lesson:{lessonId}", room);
        }

        try
        {
            await _liveKit.EnsureRoomAsync(active.RoomName, ct);
        }
        catch (LiveKitException ex)
        {
            return StatusCode(502, new { message = "Не удалось создать комнату LiveKit.", detail = ex.Message });
        }

        return Ok(new { active.Id, active.RoomName, active.Status, active.StartedAt, url = _liveKit.Options.PublicUrl });
    }

    [HttpPost("{lessonId:int}/online/end")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> End(int lessonId, CancellationToken ct)
    {
        var lesson = await _db.ScheduleEntries.FirstOrDefaultAsync(x => x.Id == lessonId, ct);
        if (lesson is null) return NotFound(new { message = "Пара не найдена." });
        if (!IsAdmin && lesson.TeacherId != UserId) return Forbid();
        var active = await _db.OnlineLessons.FirstOrDefaultAsync(x => x.ScheduleEntryId == lessonId && x.Status == "Active", ct);
        if (active is null) return NotFound(new { message = "Активная онлайн-пара не найдена." });
        active.Status = "Ended";
        active.EndedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(HttpContext, "online.end", $"lesson:{lessonId}", active.RoomName);

        if (_liveKit.IsConfigured)
        {
            try
            {
                await _liveKit.DeleteRoomAsync(active.RoomName, ct);
            }
            catch (LiveKitException ex)
            {
                return StatusCode(502, new { message = "Не удалось удалить комнату LiveKit.", detail = ex.Message });
            }
        }

        return Ok(new { active.Id, active.Status, active.EndedAt });
    }

    [HttpGet("student/current")]
    [Authorize(Roles = UserRoles.Student)]
    public async Task<IActionResult> StudentCurrent(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var groupId = await _db.Users.Where(x => x.Id == UserId && x.Role == UserRoles.Student).Select(x => x.StudyGroupId).FirstOrDefaultAsync(ct);
        if (!groupId.HasValue) return NoContent();
        var lesson = await _db.ScheduleEntries.AsNoTracking()
            .Where(x => x.GroupId == groupId.Value && x.StartAt <= now && x.EndAt >= now)
            .Include(x => x.Group).Include(x => x.Subject)
            .OrderBy(x => x.StartAt).FirstOrDefaultAsync(ct);
        if (lesson is null) return NoContent();
        var online = await _db.OnlineLessons.AsNoTracking()
            .Where(x => x.ScheduleEntryId == lesson.Id && x.Status == "Active")
            .OrderByDescending(x => x.StartedAt).FirstOrDefaultAsync(ct);
        var boardRow = await _db.LessonBoards.AsNoTracking()
            .Where(x => x.ScheduleEntryId == lesson.Id)
            .Select(x => new { x.IsBroadcast, x.BroadcastStartedAt })
            .FirstOrDefaultAsync(ct);
        return Ok(new { lesson.Id, lesson.StartAt, lesson.EndAt, lesson.LessonNumber, lesson.Room, lesson.Topic,
            groupId = lesson.GroupId, groupName = lesson.Group.Name, subjectId = lesson.SubjectId, subjectName = lesson.Subject.Name,
            online = online == null ? null : new { online.Id, online.RoomName, online.Status, online.StartedAt },
            board = boardRow == null ? null : new { isBroadcast = boardRow.IsBroadcast, broadcastStartedAt = boardRow.BroadcastStartedAt } });
    }

    [HttpPost("{lessonId:int}/online/token")]
    [HttpPost("{lessonId:int}/video-token")]
    public async Task<IActionResult> Token(int lessonId, CancellationToken ct)
    {
        var lesson = await _db.ScheduleEntries.Include(x => x.Group).FirstOrDefaultAsync(x => x.Id == lessonId, ct);
        if (lesson is null) return NotFound(new { message = "Пара не найдена." });
        var role = User.FindFirstValue(ClaimTypes.Role);
        var allowed = role == UserRoles.Admin ||
            (role == UserRoles.Teacher && lesson.TeacherId == UserId) ||
            (role == UserRoles.Student && await _db.Users.AnyAsync(x => x.Id == UserId && x.StudyGroupId == lesson.GroupId, ct));
        if (!allowed) return Forbid();
        var room = await _db.OnlineLessons.FirstOrDefaultAsync(x => x.ScheduleEntryId == lessonId && x.Status == "Active", ct);
        if (room is null) return Conflict(new { message = "Онлайн-пара ещё не запущена." });
        if (!_liveKit.IsConfigured) return StatusCode(503, new { message = "LiveKit не настроен." });

        var identity = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var isModerator = role == UserRoles.Teacher || role == UserRoles.Admin;
        var fullName = await _db.Users
            .Where(x => x.Id == UserId)
            .Select(x => x.FullName)
            .FirstOrDefaultAsync(ct) ?? identity;

        var token = _liveKit.CreateParticipantToken(identity, fullName, room.RoomName, isModerator);

        return Ok(new
        {
            token,
            url = _liveKit.Options.PublicUrl,
            room = room.RoomName,
            identity,
            name = fullName,
            isModerator
        });
    }

    [HttpGet("{lessonId:int}/online/participants")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> Participants(int lessonId, CancellationToken ct)
    {
        var room = await ResolveActiveRoomAsync(lessonId, ct);
        if (room.Failure is not null) return room.Failure;

        IReadOnlyList<ParticipantInfo> participants;
        try
        {
            participants = await _liveKit.ListParticipantsAsync(room.Room!.RoomName, ct);
        }
        catch (LiveKitException ex)
        {
            return StatusCode(502, new { message = "Не удалось получить список участников.", detail = ex.Message });
        }

        return Ok(new
        {
            room = room.Room!.RoomName,
            participants = participants.Select(p => new
            {
                identity = p.Identity,
                name = string.IsNullOrWhiteSpace(p.Name) ? p.Identity : p.Name,
                isPublisher = p.IsPublisher,
                tracks = p.Tracks.Select(t => new
                {
                    sid = t.Sid,
                    type = t.Type.ToString(),
                    source = t.Source.ToString(),
                    muted = t.Muted
                })
            })
        });
    }

    [HttpPost("{lessonId:int}/online/mute")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> MuteParticipant(int lessonId, [FromBody] MuteRequest req, CancellationToken ct)
    {
        var room = await ResolveActiveRoomAsync(lessonId, ct);
        if (room.Failure is not null) return room.Failure;

        var trackSid = req.TrackSid;
        if (string.IsNullOrWhiteSpace(trackSid))
        {
            List<TrackInfo> tracks;
            try
            {
                tracks = await ListParticipantTracksAsync(room.Room!.RoomName, req.Identity, ct);
            }
            catch (LiveKitException ex)
            {
                return StatusCode(502, new { message = "Не удалось получить треки участника.", detail = ex.Message });
            }

            var audio = tracks.FirstOrDefault(t => t.Type == TrackType.Audio);
            if (audio is null) return NotFound(new { message = "Аудиотрек участника не найден." });
            trackSid = audio.Sid;
        }

        try
        {
            await _liveKit.MuteTrackAsync(room.Room!.RoomName, req.Identity, trackSid!, req.Muted, ct);
        }
        catch (LiveKitException ex)
        {
            return StatusCode(502, new { message = "Не удалось изменить микрофон участника.", detail = ex.Message });
        }

        await _audit.WriteAsync(HttpContext, "online.mute", $"lesson:{lessonId}", $"identity:{req.Identity} muted:{req.Muted}");
        return Ok(new { ok = true, identity = req.Identity, trackSid, muted = req.Muted });
    }

    [HttpPost("{lessonId:int}/online/mute-all")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> MuteAll(int lessonId, CancellationToken ct)
    {
        var room = await ResolveActiveRoomAsync(lessonId, ct);
        if (room.Failure is not null) return room.Failure;

        IReadOnlyList<ParticipantInfo> participants;
        try
        {
            participants = await _liveKit.ListParticipantsAsync(room.Room!.RoomName, ct);
        }
        catch (LiveKitException ex)
        {
            return StatusCode(502, new { message = "Не удалось получить список участников.", detail = ex.Message });
        }

        var muted = 0;
        foreach (var participant in participants)
        {
            if (participant.Identity == UserId.ToString()) continue;
            foreach (var track in participant.Tracks.Where(t => t.Type == TrackType.Audio && !t.Muted))
            {
                try
                {
                    await _liveKit.MuteTrackAsync(room.Room!.RoomName, participant.Identity, track.Sid, true, ct);
                    muted++;
                }
                catch (LiveKitException)
                {
                    // A participant may have left the room between listing and muting.
                }
            }
        }

        await _audit.WriteAsync(HttpContext, "online.mute_all", $"lesson:{lessonId}", $"muted:{muted}");
        return Ok(new { ok = true, muted });
    }

    [HttpPost("{lessonId:int}/online/remove-participant")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> RemoveParticipant(int lessonId, [FromBody] IdentityRequest req, CancellationToken ct)
    {
        var room = await ResolveActiveRoomAsync(lessonId, ct);
        if (room.Failure is not null) return room.Failure;

        if (string.IsNullOrWhiteSpace(req.Identity)) return BadRequest(new { message = "Не указан участник." });
        if (req.Identity == UserId.ToString()) return BadRequest(new { message = "Нельзя отключить самого себя." });

        try
        {
            await _liveKit.RemoveParticipantAsync(room.Room!.RoomName, req.Identity, ct);
        }
        catch (LiveKitException ex)
        {
            return StatusCode(502, new { message = "Не удалось отключить участника.", detail = ex.Message });
        }

        await _audit.WriteAsync(HttpContext, "online.remove_participant", $"lesson:{lessonId}", $"identity:{req.Identity}");
        return Ok(new { ok = true, identity = req.Identity });
    }

    /// <summary>
    /// Asks a participant to start sharing their screen. A backend cannot open the
    /// browser capture dialog itself, so the request travels over the LiveKit data
    /// channel and the participant confirms it locally.
    /// </summary>
    [HttpPost("{lessonId:int}/online/screen-share/request")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> RequestScreenShare(int lessonId, [FromBody] IdentityRequest req, CancellationToken ct)
    {
        var room = await ResolveActiveRoomAsync(lessonId, ct);
        if (room.Failure is not null) return room.Failure;

        if (string.IsNullOrWhiteSpace(req.Identity)) return BadRequest(new { message = "Не указан участник." });

        try
        {
            await _liveKit.SendDataAsync(
                room.Room!.RoomName,
                ScreenShareTopic,
                "{\"action\":\"request\"}",
                ct,
                new[] { req.Identity });
        }
        catch (LiveKitException ex)
        {
            return StatusCode(502, new { message = "Не удалось отправить запрос на демонстрацию экрана.", detail = ex.Message });
        }

        await _audit.WriteAsync(HttpContext, "online.screen_share_request", $"lesson:{lessonId}", $"identity:{req.Identity}");
        return Ok(new { ok = true, identity = req.Identity, requested = true });
    }

    /// <summary>
    /// Stops or resumes an already published screen track. The participant is also
    /// notified so that the browser releases the capture.
    /// </summary>
    [HttpPost("{lessonId:int}/online/screen-share")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> ScreenShareParticipant(int lessonId, [FromBody] ScreenShareRequest req, CancellationToken ct)
    {
        var room = await ResolveActiveRoomAsync(lessonId, ct);
        if (room.Failure is not null) return room.Failure;

        List<TrackInfo> tracks;
        try
        {
            tracks = await ListParticipantTracksAsync(room.Room!.RoomName, req.Identity, ct);
        }
        catch (LiveKitException ex)
        {
            return StatusCode(502, new { message = "Не удалось получить треки участника.", detail = ex.Message });
        }

        var screen = tracks.FirstOrDefault(t => t.Type == TrackType.Video && t.Source == TrackSource.ScreenShare);
        if (screen is null) return NotFound(new { message = "Демонстрация экрана у участника не найдена." });

        try
        {
            await _liveKit.MuteTrackAsync(room.Room!.RoomName, req.Identity, screen.Sid, req.Muted, ct);
        }
        catch (LiveKitException ex)
        {
            return StatusCode(502, new { message = "Не удалось изменить демонстрацию экрана участника.", detail = ex.Message });
        }

        if (req.Muted)
        {
            try
            {
                await _liveKit.SendDataAsync(
                    room.Room!.RoomName,
                    ScreenShareTopic,
                    "{\"action\":\"stop\"}",
                    ct,
                    new[] { req.Identity });
            }
            catch (LiveKitException)
            {
                // The track is already muted server-side, so the lesson can continue.
            }
        }

        await _audit.WriteAsync(HttpContext, "online.screen_share", $"lesson:{lessonId}", $"identity:{req.Identity} muted:{req.Muted}");
        return Ok(new { ok = true, identity = req.Identity, muted = req.Muted });
    }

    [HttpPost("{lessonId:int}/online/screen-share-all")]
    [Authorize(Roles = UserRoles.Teacher + "," + UserRoles.Admin)]
    public async Task<IActionResult> ScreenShareAll(int lessonId, CancellationToken ct)
    {
        var room = await ResolveActiveRoomAsync(lessonId, ct);
        if (room.Failure is not null) return room.Failure;

        IReadOnlyList<ParticipantInfo> participants;
        try
        {
            participants = await _liveKit.ListParticipantsAsync(room.Room!.RoomName, ct);
        }
        catch (LiveKitException ex)
        {
            return StatusCode(502, new { message = "Не удалось получить список участников.", detail = ex.Message });
        }

        var stopped = 0;
        foreach (var participant in participants)
        {
            if (participant.Identity == UserId.ToString()) continue;
            foreach (var track in participant.Tracks.Where(t => t.Type == TrackType.Video && t.Source == TrackSource.ScreenShare && !t.Muted))
            {
                try
                {
                    await _liveKit.MuteTrackAsync(room.Room!.RoomName, participant.Identity, track.Sid, true, ct);
                    stopped++;
                }
                catch (LiveKitException)
                {
                    // The participant may have left the room in the meantime.
                }
            }

            try
            {
                await _liveKit.SendDataAsync(
                    room.Room!.RoomName,
                    ScreenShareTopic,
                    "{\"action\":\"stop\"}",
                    ct,
                    new[] { participant.Identity });
            }
            catch (LiveKitException)
            {
                // Nothing to stop on the client side.
            }
        }

        await _audit.WriteAsync(HttpContext, "online.screen_share_all", $"lesson:{lessonId}", $"stopped:{stopped}");
        return Ok(new { ok = true, stopped });
    }

    public class ScreenShareRequest
    {
        public string Identity { get; set; } = string.Empty;
        public bool Muted { get; set; } = true;
    }

    public class IdentityRequest
    {
        public string Identity { get; set; } = string.Empty;
    }

    public class MuteRequest
    {
        public string Identity { get; set; } = string.Empty;
        public string? TrackSid { get; set; }
        public bool Muted { get; set; } = true;
    }

    /// <summary>
    /// Returns the published tracks of a participant. Upstream failures are propagated
    /// so that a LiveKit outage is reported as a gateway error instead of a misleading
    /// "track not found" response.
    /// </summary>
    private async Task<List<TrackInfo>> ListParticipantTracksAsync(string roomName, string identity, CancellationToken ct)
    {
        var participants = await _liveKit.ListParticipantsAsync(roomName, ct);
        var participant = participants.FirstOrDefault(p => p.Identity == identity);
        return participant?.Tracks.ToList() ?? new List<TrackInfo>();
    }

    private async Task<(OnlineLesson? Room, IActionResult? Failure)> ResolveActiveRoomAsync(int lessonId, CancellationToken ct)
    {
        var lesson = await _db.ScheduleEntries.AsNoTracking().FirstOrDefaultAsync(x => x.Id == lessonId, ct);
        if (lesson is null) return (null, NotFound(new { message = "Пара не найдена." }));
        if (!IsAdmin && lesson.TeacherId != UserId) return (null, Forbid());
        if (!_liveKit.IsConfigured) return (null, StatusCode(503, new { message = "LiveKit не настроен." }));

        var room = await _db.OnlineLessons.AsNoTracking()
            .FirstOrDefaultAsync(x => x.ScheduleEntryId == lessonId && x.Status == "Active", ct);
        if (room is null) return (null, NotFound(new { message = "Онлайн-пара не запущена." }));

        return (room, null);
    }
}
