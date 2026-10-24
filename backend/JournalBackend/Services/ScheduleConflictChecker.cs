using JournalBackend.Database;
using Microsoft.EntityFrameworkCore;

namespace JournalBackend.Services;

public record ScheduleConflictInfo(int LessonId, string GroupName, string SubjectName, string TeacherName, DateTime StartAt, DateTime EndAt);

/// <summary>
/// Shared overlap check for schedule create/update/reschedule: a lesson may not overlap
/// another lesson of the same group or of the same teacher.
/// </summary>
public static class ScheduleConflictChecker
{
    public static async Task<ScheduleConflictInfo?> FindAsync(
        AppDbContext db, int groupId, int teacherId, DateTime startAt, DateTime endAt, int? excludeLessonId, CancellationToken ct)
    {
        var query = db.ScheduleEntries.AsNoTracking()
            .Where(x => (x.GroupId == groupId || x.TeacherId == teacherId) && x.StartAt < endAt && startAt < x.EndAt);
        if (excludeLessonId.HasValue) query = query.Where(x => x.Id != excludeLessonId.Value);
        var conflict = await query
            .OrderBy(x => x.StartAt)
            .Select(x => new { x.Id, GroupName = x.Group.Name, SubjectName = x.Subject.Name, TeacherName = x.Teacher.FullName, x.StartAt, x.EndAt })
            .FirstOrDefaultAsync(ct);
        return conflict is null
            ? null
            : new ScheduleConflictInfo(conflict.Id, conflict.GroupName, conflict.SubjectName, conflict.TeacherName, conflict.StartAt, conflict.EndAt);
    }

    /// <summary>Human-readable 409 body describing the conflicting lesson.</summary>
    public static object ConflictResponse(ScheduleConflictInfo conflict)
    {
        return new
        {
            message = $"Пересечение расписания: на это время уже стоит пара «{conflict.SubjectName}» " +
                      $"(группа {conflict.GroupName}, преподаватель {conflict.TeacherName}) " +
                      $"{conflict.StartAt:dd.MM.yyyy HH:mm}–{conflict.EndAt:HH:mm} (UTC).",
            conflict = new { conflict.LessonId, conflict.GroupName, conflict.SubjectName, conflict.TeacherName, conflict.StartAt, conflict.EndAt }
        };
    }
}
