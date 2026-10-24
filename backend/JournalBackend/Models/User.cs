using System;

namespace JournalBackend.Models
{
    public class User
    {
        public int Id { get; set; }

        // Legacy Telegram identity is kept temporarily so existing AI/bot jobs and data are not broken.
        public long TelegramId { get; set; }

        // External Top Academy credentials. Login is NOT the local site login.
        public string? Login { get; set; }
        public string? ExternalPassword { get; set; }

        // Local site authentication.
        public string? AuthLogin { get; set; }
        public string? PasswordHash { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Role { get; set; } = UserRoles.Student;

        // Academic membership. A student belongs to one study group; parents are linked through ParentStudent.
        public int? StudyGroupId { get; set; }
        public StudyGroup? StudyGroup { get; set; }

        public string? JournalToken { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public static class UserRoles
    {
        public const string Admin = "Admin";
        public const string Teacher = "Teacher";
        public const string Student = "Student";
        public const string Parent = "Parent";

        public static bool IsValid(string? role) => role is Admin or Teacher or Student or Parent;
    }
}
