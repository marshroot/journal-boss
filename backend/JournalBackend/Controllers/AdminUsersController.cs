using System.ComponentModel.DataAnnotations;
using JournalBackend.Database;
using JournalBackend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JournalBackend.Controllers;

[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = UserRoles.Admin)]
public class AdminUsersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IPasswordHasher<User> _passwordHasher;

    public AdminUsersController(AppDbContext db, IPasswordHasher<User> passwordHasher)
    {
        _db = db;
        _passwordHasher = passwordHasher;
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken)
    {
        var users = await _db.Users.AsNoTracking()
            .OrderBy(u => u.FullName)
            .ThenBy(u => u.AuthLogin)
            .Select(u => new AdminUserDto
            {
                Id = u.Id,
                Login = u.AuthLogin ?? string.Empty,
                FullName = u.FullName,
                Role = u.Role,
                StudyGroupId = u.StudyGroupId,
                StudyGroupName = u.StudyGroup != null ? u.StudyGroup.Name : null,
                CreatedAt = u.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(users);
    }

    [HttpGet("simple")]
    [Authorize(Roles = UserRoles.Admin + "," + UserRoles.Teacher)]
    public async Task<IActionResult> SimpleList(CancellationToken cancellationToken)
    {
        var users = await _db.Users.AsNoTracking()
            .OrderBy(u => u.FullName)
            .Select(u => new { u.Id, u.FullName, u.Role })
            .ToListAsync(cancellationToken);
        return Ok(users);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest request, CancellationToken cancellationToken)
    {
        var validation = ValidateRequest(request.Login, request.FullName, request.Role, request.Password, requirePassword: true);
        if (validation != null) return validation;
        var groupValidation = await ValidateGroupAssignment(request.Role, request.StudyGroupId, cancellationToken);
        if (groupValidation != null) return groupValidation;

        var login = request.Login.Trim();
        if (await _db.Users.AnyAsync(u => u.AuthLogin == login, cancellationToken))
            return Conflict(new { message = "Такой логин уже занят." });

        var user = new User
        {
            AuthLogin = login,
            FullName = request.FullName.Trim(),
            Role = request.Role,
            StudyGroupId = request.StudyGroupId,
            CreatedAt = DateTime.UtcNow,
            TelegramId = 0
        };
        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);

        _db.Users.Add(user);
        await _db.SaveChangesAsync(cancellationToken);

        return Created($"/api/admin/users/{user.Id}", ToDto(user));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateUserRequest request, CancellationToken cancellationToken)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
        if (user == null) return NotFound(new { message = "Пользователь не найден." });

        if (string.IsNullOrWhiteSpace(request.FullName))
            return BadRequest(new { message = "ФИО не может быть пустым." });
        if (!UserRoles.IsValid(request.Role))
            return BadRequest(new { message = "Недопустимая роль." });
        var groupValidation = await ValidateGroupAssignment(request.Role, request.StudyGroupId, cancellationToken);
        if (groupValidation != null) return groupValidation;

        var login = request.Login.Trim();
        if (string.IsNullOrWhiteSpace(login))
            return BadRequest(new { message = "Логин не может быть пустым." });

        if (await _db.Users.AnyAsync(u => u.Id != id && u.AuthLogin == login, cancellationToken))
            return Conflict(new { message = "Такой логин уже занят." });

        user.AuthLogin = login;
        user.FullName = request.FullName.Trim();
        user.Role = request.Role;
        user.StudyGroupId = request.Role == UserRoles.Student ? request.StudyGroupId : null;

        if (!string.IsNullOrWhiteSpace(request.NewPassword))
            user.PasswordHash = _passwordHasher.HashPassword(user, request.NewPassword);

        await _db.SaveChangesAsync(cancellationToken);
        return Ok(ToDto(user));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var currentIdValue = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (int.TryParse(currentIdValue, out var currentId) && currentId == id)
            return BadRequest(new { message = "Нельзя удалить собственную учётную запись." });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
        if (user == null) return NotFound(new { message = "Пользователь не найден." });

        _db.Users.Remove(user);
        await _db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpGet("parents/{parentId:int}/students")]
    public async Task<IActionResult> GetParentStudents(int parentId, CancellationToken ct)
    {
        var parent = await _db.Users.AnyAsync(u => u.Id == parentId && u.Role == UserRoles.Parent, ct);
        if (!parent) return NotFound(new { message = "Родитель не найден." });
        var students = await _db.ParentStudents.AsNoTracking().Where(x => x.ParentId == parentId).Select(x => new { id = x.StudentId, fullName = x.Student.FullName, groupId = x.Student.StudyGroupId, groupName = x.Student.StudyGroup != null ? x.Student.StudyGroup.Name : null }).ToListAsync(ct);
        return Ok(students);
    }

    [HttpPost("parents/{parentId:int}/students/{studentId:int}")]
    public async Task<IActionResult> LinkParentStudent(int parentId, int studentId, CancellationToken ct)
    {
        if (!await _db.Users.AnyAsync(u => u.Id == parentId && u.Role == UserRoles.Parent, ct)) return NotFound(new { message = "Родитель не найден." });
        if (!await _db.Users.AnyAsync(u => u.Id == studentId && u.Role == UserRoles.Student, ct)) return NotFound(new { message = "Студент не найден." });
        if (await _db.ParentStudents.AnyAsync(x => x.ParentId == parentId && x.StudentId == studentId, ct)) return Conflict(new { message = "Связь уже существует." });
        _db.ParentStudents.Add(new ParentStudent { ParentId = parentId, StudentId = studentId });
        await _db.SaveChangesAsync(ct);
        return Ok();
    }

    [HttpDelete("parents/{parentId:int}/students/{studentId:int}")]
    public async Task<IActionResult> UnlinkParentStudent(int parentId, int studentId, CancellationToken ct)
    {
        var link = await _db.ParentStudents.FirstOrDefaultAsync(x => x.ParentId == parentId && x.StudentId == studentId, ct);
        if (link == null) return NotFound();
        _db.ParentStudents.Remove(link);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private async Task<IActionResult?> ValidateGroupAssignment(string role, int? groupId, CancellationToken ct)
    {
        if (role != UserRoles.Student && groupId.HasValue)
            return new BadRequestObjectResult(new { message = "Группа назначается только студенту." });
        if (role == UserRoles.Student && groupId.HasValue && !await _db.StudyGroups.AnyAsync(g => g.Id == groupId.Value, ct))
            return new BadRequestObjectResult(new { message = "Учебная группа не найдена." });
        return null;
    }

    private static IActionResult? ValidateRequest(string login, string fullName, string role, string password, bool requirePassword)
    {
        if (string.IsNullOrWhiteSpace(login)) return new BadRequestObjectResult(new { message = "Логин не может быть пустым." });
        if (string.IsNullOrWhiteSpace(fullName)) return new BadRequestObjectResult(new { message = "ФИО не может быть пустым." });
        if (!UserRoles.IsValid(role)) return new BadRequestObjectResult(new { message = "Недопустимая роль." });
        if (requirePassword && string.IsNullOrWhiteSpace(password)) return new BadRequestObjectResult(new { message = "Пароль не может быть пустым." });
        if (!string.IsNullOrWhiteSpace(password) && password.Length < 8) return new BadRequestObjectResult(new { message = "Пароль должен содержать минимум 8 символов." });
        return null;
    }

    private static AdminUserDto ToDto(User user) => new()
    {
        Id = user.Id,
        Login = user.AuthLogin ?? string.Empty,
        FullName = user.FullName,
        Role = user.Role,
        CreatedAt = user.CreatedAt
    };
}

public sealed class CreateUserRequest
{
    [Required] public string Login { get; set; } = string.Empty;
    [Required] public string FullName { get; set; } = string.Empty;
    [Required] public string Role { get; set; } = UserRoles.Student;
    [Required] public string Password { get; set; } = string.Empty;
    public int? StudyGroupId { get; set; }
}

public sealed class UpdateUserRequest
{
    [Required] public string Login { get; set; } = string.Empty;
    [Required] public string FullName { get; set; } = string.Empty;
    [Required] public string Role { get; set; } = UserRoles.Student;
    public string? NewPassword { get; set; }
    public int? StudyGroupId { get; set; }
}

public sealed class AdminUserDto
{
    public int Id { get; set; }
    public string Login { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public int? StudyGroupId { get; set; }
    public string? StudyGroupName { get; set; }
    public DateTime CreatedAt { get; set; }
}
