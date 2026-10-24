using JournalBackend.Database;
using JournalBackend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JournalBackend.Controllers;

[ApiController]
[Route("api/admin/overview")]
[Authorize(Roles = UserRoles.Admin)]
public class AdminOverviewController : ControllerBase
{
    private readonly AppDbContext _db;
    public AdminOverviewController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var activeLessons = await _db.ScheduleEntries.AsNoTracking()
            .Where(x => x.StartAt <= now && x.EndAt >= now)
            .Include(x => x.Group).Include(x => x.Subject).Include(x => x.Teacher)
            .Select(x => new { x.Id, x.StartAt, x.EndAt, x.Topic, group = x.Group.Name, subject = x.Subject.Name, teacher = x.Teacher.FullName })
            .ToListAsync(ct);

        return Ok(new
        {
            generatedAt = now,
            users = new
            {
                total = await _db.Users.CountAsync(ct),
                admins = await _db.Users.CountAsync(x => x.Role == UserRoles.Admin, ct),
                teachers = await _db.Users.CountAsync(x => x.Role == UserRoles.Teacher, ct),
                students = await _db.Users.CountAsync(x => x.Role == UserRoles.Student, ct),
                parents = await _db.Users.CountAsync(x => x.Role == UserRoles.Parent, ct)
            },
            academic = new
            {
                groups = await _db.StudyGroups.CountAsync(ct),
                subjects = await _db.Subjects.CountAsync(ct),
                scheduleEntries = await _db.ScheduleEntries.CountAsync(ct),
                materials = await _db.StudyMaterials.CountAsync(ct),
                homeworks = await _db.LocalHomeworks.CountAsync(ct)
            },
            currentLessons = activeLessons
        });
    }
}
