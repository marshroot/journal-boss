using System.Security.Claims;
using JournalBackend.Controllers;
using JournalBackend.Database;
using JournalBackend.Models;
using JournalBackend.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace JournalBackend.Tests;

public sealed class SecurityTests
{
    [Fact]
    public async Task LocalLogin_ReturnsJwtForValidPassword()
    {
        await using var db = CreateDb(out var connection);
        await using (connection)
        {
            var user = new User { Id = 1, AuthLogin = "teacher", FullName = "Teacher", Role = UserRoles.Teacher };
            user.PasswordHash = new PasswordHasher<User>().HashPassword(user, "correct-password");
            db.Users.Add(user);
            await db.SaveChangesAsync();

            var controller = new LocalAuthController(db, Configuration(), new PasswordHasher<User>(), TestProtector(), new FakeAudit());
            controller.ControllerContext = ContextAs(1, UserRoles.Teacher);

            var result = await controller.Login(new LoginRequest { Login = "teacher", Password = "correct-password" });

            var ok = Assert.IsType<OkObjectResult>(result);
            Assert.NotNull(ok.Value);
            Assert.Contains("accessToken", ok.Value!.GetType().GetProperties().Select(p => p.Name));
        }
    }

    [Fact]
    public async Task LocalLogin_RejectsWrongPassword()
    {
        await using var db = CreateDb(out var connection);
        await using (connection)
        {
            var user = new User { Id = 1, AuthLogin = "teacher", FullName = "Teacher", Role = UserRoles.Teacher };
            user.PasswordHash = new PasswordHasher<User>().HashPassword(user, "correct-password");
            db.Users.Add(user);
            await db.SaveChangesAsync();

            var controller = new LocalAuthController(db, Configuration(), new PasswordHasher<User>(), TestProtector(), new FakeAudit());
            controller.ControllerContext = ContextAs(1, UserRoles.Teacher);

            var result = await controller.Login(new LoginRequest { Login = "teacher", Password = "wrong-password" });

            Assert.IsType<UnauthorizedObjectResult>(result);
        }
    }

    [Fact]
    public async Task ParentCannotReadUnlinkedChildAttendance()
    {
        await using var db = CreateDb(out var connection);
        await using (connection)
        {
            db.Users.AddRange(
                new User { Id = 1, AuthLogin = "parent", FullName = "Parent", Role = UserRoles.Parent },
                new User { Id = 2, AuthLogin = "child-a", FullName = "Child A", Role = UserRoles.Student },
                new User { Id = 3, AuthLogin = "child-b", FullName = "Child B", Role = UserRoles.Student });
            await db.SaveChangesAsync();
            db.ParentStudents.Add(new ParentStudent { ParentId = 1, StudentId = 2 });
            await db.SaveChangesAsync();

            var controller = new ParentProgressController(db);
            controller.ControllerContext = ContextAs(1, UserRoles.Parent);

            var result = await controller.Attendance(3, CancellationToken.None);

            Assert.IsType<ForbidResult>(result);
        }
    }

    [Fact]
    public async Task StudentCannotSubmitHomeworkFromAnotherGroup()
    {
        await using var db = CreateDb(out var connection);
        await using (connection)
        {
            var groupA = new StudyGroup { Id = 10, Name = "A" };
            var groupB = new StudyGroup { Id = 20, Name = "B" };
            var subject = new Subject { Id = 30, Name = "Math" };
            var teacher = new User { Id = 40, AuthLogin = "teacher", FullName = "Teacher", Role = UserRoles.Teacher };
            var student = new User { Id = 50, AuthLogin = "student", FullName = "Student", Role = UserRoles.Student, StudyGroupId = groupB.Id };
            var lesson = new ScheduleEntry { Id = 60, GroupId = groupA.Id, Group = groupA, SubjectId = subject.Id, Subject = subject, TeacherId = teacher.Id, Teacher = teacher, StartAt = DateTime.UtcNow.AddHours(-1), EndAt = DateTime.UtcNow.AddHours(1) };
            var homework = new LocalHomework { Id = 70, ScheduleEntryId = lesson.Id, ScheduleEntry = lesson, Title = "HW", Description = "Do it" };
            db.AddRange(groupA, groupB, subject, teacher, student, lesson, homework);
            await db.SaveChangesAsync();

            var controller = new AssessmentController(db, new FakeAudit());
            controller.ControllerContext = ContextAs(student.Id, UserRoles.Student);

            var result = await controller.SubmitHomework(homework.Id, new AssessmentController.SubmissionRequest("answer"), CancellationToken.None);

            Assert.IsType<ForbidResult>(result);
            Assert.Empty(await db.HomeworkSubmissions.ToListAsync());
        }
    }

    [Fact]
    public async Task TeacherCannotGradeForeignLesson()
    {
        await using var db = CreateDb(out var connection);
        await using (connection)
        {
            var group = new StudyGroup { Id = 10, Name = "A" };
            var subject = new Subject { Id = 20, Name = "Math" };
            var owner = new User { Id = 30, AuthLogin = "owner", FullName = "Owner", Role = UserRoles.Teacher };
            var foreign = new User { Id = 40, AuthLogin = "foreign", FullName = "Foreign", Role = UserRoles.Teacher };
            var student = new User { Id = 50, AuthLogin = "student", FullName = "Student", Role = UserRoles.Student, StudyGroupId = group.Id };
            var lesson = new ScheduleEntry { Id = 60, GroupId = group.Id, Group = group, SubjectId = subject.Id, Subject = subject, TeacherId = owner.Id, Teacher = owner, StartAt = DateTime.UtcNow.AddHours(-1), EndAt = DateTime.UtcNow.AddHours(1) };
            db.AddRange(group, subject, owner, foreign, student, lesson);
            await db.SaveChangesAsync();

            var controller = new AssessmentController(db, new FakeAudit());
            controller.ControllerContext = ContextAs(foreign.Id, UserRoles.Teacher);

            var result = await controller.SaveGrades(lesson.Id, new AssessmentController.GradeRequest(new() { new(student.Id, 8, null) }), CancellationToken.None);

            Assert.IsType<ForbidResult>(result);
            Assert.Empty(await db.GradeRecords.ToListAsync());
        }
    }

    [Fact]
    public async Task TeacherCanSetFinalHomeworkGradeAndItPersists()
    {
        await using var db = CreateDb(out var connection);
        await using (connection)
        {
            var group = new StudyGroup { Id = 10, Name = "A" };
            var subject = new Subject { Id = 20, Name = "Math" };
            var teacher = new User { Id = 30, AuthLogin = "teacher", FullName = "Teacher", Role = UserRoles.Teacher };
            var student = new User { Id = 40, AuthLogin = "student", FullName = "Student", Role = UserRoles.Student, StudyGroupId = group.Id };
            var lesson = new ScheduleEntry { Id = 50, GroupId = group.Id, Group = group, SubjectId = subject.Id, Subject = subject, TeacherId = teacher.Id, Teacher = teacher, StartAt = DateTime.UtcNow.AddHours(-1), EndAt = DateTime.UtcNow.AddHours(1) };
            var homework = new LocalHomework { Id = 60, ScheduleEntryId = lesson.Id, ScheduleEntry = lesson, Title = "HW", Description = "Do it" };
            var submission = new HomeworkSubmission { Id = 70, HomeworkId = homework.Id, Homework = homework, StudentId = student.Id, Student = student, Answer = "answer" };
            db.AddRange(group, subject, teacher, student, lesson, homework, submission);
            await db.SaveChangesAsync();

            var controller = new AssessmentController(db, new FakeAudit());
            controller.ControllerContext = ContextAs(teacher.Id, UserRoles.Teacher);

            var result = await controller.Review(submission.Id, new AssessmentController.ReviewRequest(8, "ok"), CancellationToken.None);

            Assert.IsType<OkResult>(result);
            Assert.Equal(8, submission.TeacherScore);
            Assert.NotNull(submission.ReviewedAt);
        }
    }

    [Fact]
    public async Task ParentCannotReadUnlinkedChildGrades()
    {
        await using var db = CreateDb(out var connection);
        await using (connection)
        {
            var group = new StudyGroup { Id = 10, Name = "A" };
            var subject = new Subject { Id = 20, Name = "Math" };
            var parent = new User { Id = 30, AuthLogin = "parent", FullName = "Parent", Role = UserRoles.Parent };
            var linked = new User { Id = 40, AuthLogin = "linked", FullName = "Linked", Role = UserRoles.Student, StudyGroupId = group.Id };
            var foreign = new User { Id = 50, AuthLogin = "foreign", FullName = "Foreign", Role = UserRoles.Student, StudyGroupId = group.Id };
            var teacher = new User { Id = 60, AuthLogin = "teacher", FullName = "Teacher", Role = UserRoles.Teacher };
            var lesson = new ScheduleEntry { Id = 70, GroupId = group.Id, Group = group, SubjectId = subject.Id, Subject = subject, TeacherId = teacher.Id, Teacher = teacher, StartAt = DateTime.UtcNow.AddHours(-2), EndAt = DateTime.UtcNow.AddHours(-1) };
            db.AddRange(group, subject, parent, linked, foreign, teacher, lesson);
            db.ParentStudents.Add(new ParentStudent { ParentId = parent.Id, StudentId = linked.Id });
            db.GradeRecords.Add(new GradeRecord { ScheduleEntryId = lesson.Id, StudentId = foreign.Id, Value = 10, Comment = "secret", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
            await db.SaveChangesAsync();

            var controller = new ParentProgressController(db);
            controller.ControllerContext = ContextAs(parent.Id, UserRoles.Parent);

            var result = await controller.Grades(foreign.Id, CancellationToken.None);
            Assert.IsType<ForbidResult>(result);
        }
    }

    [Fact]
    public async Task ParentCannotReadUnlinkedChildHomework()
    {
        await using var db = CreateDb(out var connection);
        await using (connection)
        {
            var group = new StudyGroup { Id = 10, Name = "A" };
            var subject = new Subject { Id = 20, Name = "Math" };
            var parent = new User { Id = 30, AuthLogin = "parent", FullName = "Parent", Role = UserRoles.Parent };
            var linked = new User { Id = 40, AuthLogin = "linked", FullName = "Linked", Role = UserRoles.Student, StudyGroupId = group.Id };
            var foreign = new User { Id = 50, AuthLogin = "foreign", FullName = "Foreign", Role = UserRoles.Student, StudyGroupId = group.Id };
            var teacher = new User { Id = 60, AuthLogin = "teacher", FullName = "Teacher", Role = UserRoles.Teacher };
            var lesson = new ScheduleEntry { Id = 70, GroupId = group.Id, Group = group, SubjectId = subject.Id, Subject = subject, TeacherId = teacher.Id, Teacher = teacher, StartAt = DateTime.UtcNow.AddHours(-2), EndAt = DateTime.UtcNow.AddHours(-1) };
            db.AddRange(group, subject, parent, linked, foreign, teacher, lesson);
            db.ParentStudents.Add(new ParentStudent { ParentId = parent.Id, StudentId = linked.Id });
            db.LocalHomeworks.Add(new LocalHomework { Id = 80, ScheduleEntryId = lesson.Id, ScheduleEntry = lesson, Title = "Private HW", Description = "secret" });
            await db.SaveChangesAsync();

            var controller = new ParentProgressController(db);
            controller.ControllerContext = ContextAs(parent.Id, UserRoles.Parent);

            var result = await controller.Homework(foreign.Id, CancellationToken.None);
            Assert.IsType<ForbidResult>(result);
        }
    }

    [Fact]
    public async Task ParentCannotReadUnlinkedChildSchedule()
    {
        await using var db = CreateDb(out var connection);
        await using (connection)
        {
            var group = new StudyGroup { Id = 10, Name = "A" };
            var subject = new Subject { Id = 20, Name = "Math" };
            var parent = new User { Id = 30, AuthLogin = "parent", FullName = "Parent", Role = UserRoles.Parent };
            var linked = new User { Id = 40, AuthLogin = "linked", FullName = "Linked", Role = UserRoles.Student, StudyGroupId = group.Id };
            var foreign = new User { Id = 50, AuthLogin = "foreign", FullName = "Foreign", Role = UserRoles.Student, StudyGroupId = group.Id };
            var teacher = new User { Id = 60, AuthLogin = "teacher", FullName = "Teacher", Role = UserRoles.Teacher };
            db.AddRange(group, subject, parent, linked, foreign, teacher);
            db.ParentStudents.Add(new ParentStudent { ParentId = parent.Id, StudentId = linked.Id });
            db.ScheduleEntries.Add(new ScheduleEntry { Id = 70, GroupId = group.Id, Group = group, SubjectId = subject.Id, Subject = subject, TeacherId = teacher.Id, Teacher = teacher, StartAt = DateTime.UtcNow.AddHours(-2), EndAt = DateTime.UtcNow.AddHours(-1) });
            await db.SaveChangesAsync();

            var controller = new ParentProgressController(db);
            controller.ControllerContext = ContextAs(parent.Id, UserRoles.Parent);

            var result = await controller.Schedule(foreign.Id, null, null, CancellationToken.None);
            Assert.IsType<ForbidResult>(result);
        }
    }

    [Fact]
    public async Task StudentCannotOpenForeignLesson()
    {
        await using var db = CreateDb(out var connection);
        await using (connection)
        {
            var ownGroup = new StudyGroup { Id = 10, Name = "Own" };
            var foreignGroup = new StudyGroup { Id = 20, Name = "Foreign" };
            var subject = new Subject { Id = 30, Name = "Math" };
            var teacher = new User { Id = 40, AuthLogin = "teacher", FullName = "Teacher", Role = UserRoles.Teacher };
            var student = new User { Id = 50, AuthLogin = "student", FullName = "Student", Role = UserRoles.Student, StudyGroupId = ownGroup.Id };
            var foreignLesson = new ScheduleEntry { Id = 60, GroupId = foreignGroup.Id, Group = foreignGroup, SubjectId = subject.Id, Subject = subject, TeacherId = teacher.Id, Teacher = teacher, StartAt = DateTime.UtcNow.AddHours(-1), EndAt = DateTime.UtcNow.AddHours(1) };
            db.AddRange(ownGroup, foreignGroup, subject, teacher, student, foreignLesson);
            await db.SaveChangesAsync();

            var controller = new StudentLessonController(db);
            controller.ControllerContext = ContextAs(student.Id, UserRoles.Student);

            var result = await controller.Lesson(foreignLesson.Id, CancellationToken.None);
            Assert.IsType<ForbidResult>(result);
        }
    }

    [Fact]
    public async Task StudentCannotReadDraftMaterial()
    {
        await using var db = CreateDb(out var connection);
        await using (connection)
        {
            var group = new StudyGroup { Id = 10, Name = "A" };
            var subject = new Subject { Id = 20, Name = "Math" };
            var teacher = new User { Id = 30, AuthLogin = "teacher", FullName = "Teacher", Role = UserRoles.Teacher };
            var student = new User { Id = 40, AuthLogin = "student", FullName = "Student", Role = UserRoles.Student, StudyGroupId = group.Id };
            var lesson = new ScheduleEntry { Id = 50, GroupId = group.Id, Group = group, SubjectId = subject.Id, Subject = subject, TeacherId = teacher.Id, Teacher = teacher, StartAt = DateTime.UtcNow.AddHours(-1), EndAt = DateTime.UtcNow.AddHours(1) };
            var material = new StudyMaterial { Id = 60, ScheduleEntryId = lesson.Id, ScheduleEntry = lesson, Title = "Draft", ContentJson = "{}", IsPublished = false };
            db.AddRange(group, subject, teacher, student, lesson, material);
            await db.SaveChangesAsync();

            var controller = new MaterialsController(db, new FakeAudit());
            controller.ControllerContext = ContextAs(student.Id, UserRoles.Student);

            var result = await controller.List(lesson.Id, null, CancellationToken.None);

            var ok = Assert.IsType<OkObjectResult>(result);
            var rows = Assert.IsAssignableFrom<System.Collections.IEnumerable>(ok.Value);
            Assert.Empty(rows.Cast<object>());
        }
    }


    [Fact]
    public async Task CollaborationBoardToken_UsesDedicatedAudienceAndRoomBinding()
    {
        await using var db = CreateDb(out var connection);
        await using (connection)
        {
            var group = new StudyGroup { Id = 10, Name = "A" };
            var subject = new Subject { Id = 20, Name = "Math" };
            var teacher = new User { Id = 30, AuthLogin = "teacher", FullName = "Teacher", Role = UserRoles.Teacher };
            var lesson = new ScheduleEntry { Id = 40, GroupId = group.Id, Group = group, SubjectId = subject.Id, Subject = subject, TeacherId = teacher.Id, Teacher = teacher, StartAt = DateTime.UtcNow.AddMinutes(-1), EndAt = DateTime.UtcNow.AddMinutes(50) };
            db.AddRange(group, subject, teacher, lesson);
            await db.SaveChangesAsync();

            var controller = new CollaborationController(db, ConfigurationWithJwt());
            controller.ControllerContext = ContextAs(teacher.Id, UserRoles.Teacher);

            var result = await controller.BoardToken(lesson.Id, CancellationToken.None);
            var ok = Assert.IsType<OkObjectResult>(result);
            var token = ok.Value!.GetType().GetProperty("token")!.GetValue(ok.Value)!.ToString();
            var room = ok.Value.GetType().GetProperty("room")!.GetValue(ok.Value)!.ToString();

            var handler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
            var jwt = handler.ReadJwtToken(token);
            Assert.Equal("JournalCollab", jwt.Audiences.Single());
            Assert.Equal(room, jwt.Claims.Single(c => c.Type == "collab_room").Value);
            Assert.True(jwt.ValidTo > DateTime.UtcNow.AddMinutes(20));
        }
    }

    [Fact]
    public async Task CodeLabCollaborationToken_UsesDedicatedAudienceAndRoomBinding()
    {
        await using var db = CreateDb(out var connection);
        await using (connection)
        {
            var group = new StudyGroup { Id = 10, Name = "A" };
            var subject = new Subject { Id = 20, Name = "Math" };
            var teacher = new User { Id = 30, AuthLogin = "teacher", FullName = "Teacher", Role = UserRoles.Teacher };
            var lesson = new ScheduleEntry { Id = 40, GroupId = group.Id, Group = group, SubjectId = subject.Id, Subject = subject, TeacherId = teacher.Id, Teacher = teacher, StartAt = DateTime.UtcNow.AddMinutes(-1), EndAt = DateTime.UtcNow.AddMinutes(50) };
            var exercise = new CodeExercise { Id = 50, ScheduleEntryId = lesson.Id, ScheduleEntry = lesson, Title = "Exercise" };
            db.AddRange(group, subject, teacher, lesson, exercise);
            await db.SaveChangesAsync();

            var controller = new CodeLabController(db, null!, ConfigurationWithJwt());
            controller.ControllerContext = ContextAs(teacher.Id, UserRoles.Teacher);

            var result = await controller.CollaborationToken(exercise.Id, CancellationToken.None);
            var ok = Assert.IsType<OkObjectResult>(result);
            var token = ok.Value!.GetType().GetProperty("token")!.GetValue(ok.Value)!.ToString();
            var room = ok.Value.GetType().GetProperty("room")!.GetValue(ok.Value)!.ToString();

            var handler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
            var jwt = handler.ReadJwtToken(token);
            Assert.Equal("JournalCollab", jwt.Audiences.Single());
            Assert.Equal(room, jwt.Claims.Single(c => c.Type == "collab_room").Value);
            Assert.True(jwt.ValidTo > DateTime.UtcNow.AddMinutes(20));
        }
    }

    [Fact]
    public void SqliteSchemaUpgrade_AddsAnnouncementPublicationFlagWithoutLosingRows()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        connection.Open();
        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options;
        using var db = new AppDbContext(options);
        db.Database.EnsureCreated();

        // Simulate a legacy database whose announcements table predates the EF entity:
        // replace the EF-created table with the old column set and keep one row.
        using (var command = connection.CreateCommand())
        {
            command.CommandText = @"
                DROP TABLE announcements;
                CREATE TABLE announcements (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, body TEXT NOT NULL, published_at TEXT NOT NULL);
                INSERT INTO announcements(title, body, published_at) VALUES ('Legacy notice', 'Keep this row', '2026-01-01');";
            command.ExecuteNonQuery();
        }

        SqliteSchemaUpgrades.Apply(db);

        using var verify = connection.CreateCommand();
        verify.CommandText = "SELECT title, IsPublished FROM announcements WHERE id = 1";
        using var reader = verify.ExecuteReader();
        Assert.True(reader.Read());
        Assert.Equal("Legacy notice", reader.GetString(0));
        Assert.Equal(1, reader.GetInt32(1));
    }

    private static AppDbContext CreateDb(out SqliteConnection connection)
    {
        connection = new SqliteConnection("Data Source=:memory:");
        connection.Open();
        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options;
        var db = new AppDbContext(options);
        db.Database.EnsureCreated();
        return db;
    }

    private static IConfiguration ConfigurationWithJwt() => new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Jwt:Key"] = "test-jwt-key-must-be-at-least-32-characters-long-123",
            ["Jwt:Issuer"] = "JournalBackend"
        })
        .Build();

    private static IConfiguration Configuration() => new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Jwt:Key"] = "test-jwt-key-that-is-at-least-32-characters-long",
            ["Jwt:Issuer"] = "JournalBackend",
            ["Jwt:Audience"] = "JournalFrontend",
            ["Jwt:ExpiresMinutes"] = "60"
        })
        .Build();

    private static ControllerContext ContextAs(int userId, string role)
    {
        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Role, role)
        }, "Test");
        return new ControllerContext { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) } };
    }

    private sealed class FakeAudit : IAuditService
    {
        public Task WriteAsync(HttpContext context, string action, string? resource = null, string? details = null) => Task.CompletedTask;
    }

    private static JournalBackend.Services.Security.IExternalCredentialProtector TestProtector() =>
        new JournalBackend.Services.Security.ExternalCredentialProtector(
            new Microsoft.AspNetCore.DataProtection.EphemeralDataProtectionProvider());
}

public class ExternalCredentialProtectionTests
{
    [Fact]
    public void ExternalCredentialProtector_EncryptsAndRoundTripsWithoutPlaintextPrefix()
    {
        var temp = Path.Combine(Path.GetTempPath(), "jornal-dp-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(temp);
        try
        {
            var provider = Microsoft.AspNetCore.DataProtection.DataProtectionProvider.Create(new DirectoryInfo(temp));
            var protector = new JournalBackend.Services.Security.ExternalCredentialProtector(provider);

            const string secret = "TopAcademy-secret-123";
            var encrypted = protector.Protect(secret);

            Assert.StartsWith("enc:v1:", encrypted);
            Assert.DoesNotContain(secret, encrypted);
            Assert.True(protector.IsProtected(encrypted));
            Assert.Equal(secret, protector.Unprotect(encrypted));
            Assert.Throws<InvalidOperationException>(() => protector.Unprotect(secret));
        }
        finally
        {
            try { Directory.Delete(temp, recursive: true); } catch { }
        }
    }
}
