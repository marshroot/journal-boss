using System.ComponentModel.DataAnnotations;

namespace JournalBackend.Models;

public class StudyGroup
{
    public int Id { get; set; }
    [MaxLength(100)] public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<ScheduleEntry> ScheduleEntries { get; set; } = new List<ScheduleEntry>();
}

public class Subject
{
    public int Id { get; set; }
    [MaxLength(150)] public string Name { get; set; } = string.Empty;
    public int? TeacherId { get; set; }
    public User? Teacher { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<ScheduleEntry> ScheduleEntries { get; set; } = new List<ScheduleEntry>();
}

public class ScheduleEntry
{
    public int Id { get; set; }
    public int GroupId { get; set; }
    public StudyGroup Group { get; set; } = null!;
    public int SubjectId { get; set; }
    public Subject Subject { get; set; } = null!;
    public int TeacherId { get; set; }
    public User Teacher { get; set; } = null!;
    public DateTime StartAt { get; set; }
    public DateTime EndAt { get; set; }
    [MaxLength(30)] public string? Room { get; set; }
    public int LessonNumber { get; set; }
    [MaxLength(500)] public string? Topic { get; set; }
    /// <summary>Set when the teacher presses "Start lesson" / "Complete lesson" on the current-lesson screen.</summary>
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public ICollection<AttendanceRecord> Attendance { get; set; } = new List<AttendanceRecord>();
}

public class AttendanceRecord
{
    public int Id { get; set; }
    public int ScheduleEntryId { get; set; }
    public ScheduleEntry ScheduleEntry { get; set; } = null!;
    public int StudentId { get; set; }
    public User Student { get; set; } = null!;
    [MaxLength(30)] public string Status { get; set; } = "Present";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}


public class OnlineLesson
{
    public int Id { get; set; }
    public int ScheduleEntryId { get; set; }
    public ScheduleEntry ScheduleEntry { get; set; } = null!;
    [MaxLength(120)] public string RoomName { get; set; } = string.Empty;
    [MaxLength(20)] public string Status { get; set; } = "Active";
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? EndedAt { get; set; }
}

public class ParentStudent
{
    public int ParentId { get; set; }
    public User Parent { get; set; } = null!;
    public int StudentId { get; set; }
    public User Student { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class GradeRecord
{
    public int Id { get; set; }
    public int ScheduleEntryId { get; set; }
    public ScheduleEntry ScheduleEntry { get; set; } = null!;
    public int StudentId { get; set; }
    public User Student { get; set; } = null!;
    public decimal Value { get; set; }
    [MaxLength(1000)] public string? Comment { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class LocalHomework
{
    public int Id { get; set; }
    public int ScheduleEntryId { get; set; }
    public ScheduleEntry ScheduleEntry { get; set; } = null!;
    [MaxLength(200)] public string Title { get; set; } = string.Empty;
    [MaxLength(4000)] public string Description { get; set; } = string.Empty;
    public DateTime? Deadline { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<HomeworkSubmission> Submissions { get; set; } = new List<HomeworkSubmission>();
}


public class StudyMaterial
{
    public int Id { get; set; }
    public int ScheduleEntryId { get; set; }
    public ScheduleEntry ScheduleEntry { get; set; } = null!;
    [MaxLength(200)] public string Title { get; set; } = string.Empty;
    [MaxLength(120000)] public string ContentJson { get; set; } = string.Empty;
    /// <summary>Draft (false) is visible only to the owning teacher/admin; published (true) is visible to students and parents.</summary>
    public bool IsPublished { get; set; }
    public DateTime? PublishedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class HomeworkSubmission
{
    public int Id { get; set; }
    public int HomeworkId { get; set; }
    public LocalHomework Homework { get; set; } = null!;
    public int StudentId { get; set; }
    public User Student { get; set; } = null!;
    [MaxLength(20000)] public string Answer { get; set; } = string.Empty;
    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
    [MaxLength(20000)] public string? AiReview { get; set; }
    public decimal? AiScore { get; set; }
    public decimal? TeacherScore { get; set; }
    [MaxLength(2000)] public string? TeacherComment { get; set; }
    public DateTime? ReviewedAt { get; set; }
}


public class MaterialAttachment
{
    public int Id { get; set; }
    public int StudyMaterialId { get; set; }
    public StudyMaterial StudyMaterial { get; set; } = null!;
    public int UploaderId { get; set; }
    public User Uploader { get; set; } = null!;
    [MaxLength(200)] public string FileName { get; set; } = string.Empty;
    [MaxLength(255)] public string ContentType { get; set; } = "application/octet-stream";
    public long SizeBytes { get; set; }
    [MaxLength(128)] public string StorageKey { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class HomeworkAttachment
{
    public int Id { get; set; }
    public int HomeworkId { get; set; }
    public LocalHomework Homework { get; set; } = null!;
    public int UploaderId { get; set; }
    public User Uploader { get; set; } = null!;
    [MaxLength(200)] public string FileName { get; set; } = string.Empty;
    [MaxLength(255)] public string ContentType { get; set; } = "application/octet-stream";
    public long SizeBytes { get; set; }
    [MaxLength(128)] public string StorageKey { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class AiTeacherQuiz
{
    public int Id { get; set; }
    public int SubmissionId { get; set; }
    public HomeworkSubmission Submission { get; set; } = null!;
    public int TeacherId { get; set; }
    public User Teacher { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
    public ICollection<AiTeacherQuizQuestion> Questions { get; set; } = new List<AiTeacherQuizQuestion>();
}


public class AiTeacherQuizQuestion
{
    public int Id { get; set; }
    public int QuizId { get; set; }
    public AiTeacherQuiz Quiz { get; set; } = null!;
    [MaxLength(2000)] public string Question { get; set; } = string.Empty;
    [MaxLength(4000)] public string? ReferenceAnswer { get; set; }
    [MaxLength(4000)] public string? TeacherAnswer { get; set; }
}

public class LessonChatMessage
{
    public int Id { get; set; }
    public int ScheduleEntryId { get; set; }
    public ScheduleEntry ScheduleEntry { get; set; } = null!;
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    [MaxLength(2000)] public string Message { get; set; } = string.Empty;
    /// <summary>Optional image attached to the message (see ChatAttachment).</summary>
    public int? AttachmentId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class LessonBoard
{
    public int Id { get; set; }
    public int ScheduleEntryId { get; set; }
    public ScheduleEntry ScheduleEntry { get; set; } = null!;
    public string Content { get; set; } = "{}";
    [MaxLength(20)] public string Mode { get; set; } = "all";
    public string? EditorIds { get; set; }
    /// <summary>True while the teacher projects the board to the screens of lesson participants.</summary>
    public bool IsBroadcast { get; set; }
    public DateTime? BroadcastStartedAt { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class ChatGroup
{
    public int Id { get; set; }
    [MaxLength(200)] public string Name { get; set; } = string.Empty;
    public int OwnerId { get; set; }
    public User Owner { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class ChatGroupMember
{
    public int GroupId { get; set; }
    public ChatGroup Group { get; set; } = null!;
    public int UserId { get; set; }
    public User User { get; set; } = null!;
}

public class ChatGroupMessage
{
    public int Id { get; set; }
    public int GroupId { get; set; }
    public ChatGroup Group { get; set; } = null!;
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    [MaxLength(2000)] public string Message { get; set; } = string.Empty;
    /// <summary>Optional image attached to the message (see ChatAttachment).</summary>
    public int? AttachmentId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}


public class CodeExercise
{
    public int Id { get; set; }
    public int ScheduleEntryId { get; set; }
    public ScheduleEntry ScheduleEntry { get; set; } = null!;
    [MaxLength(200)] public string Title { get; set; } = string.Empty;
    [MaxLength(12000)] public string Description { get; set; } = string.Empty;
    [MaxLength(30)] public string Language { get; set; } = "javascript";
    [MaxLength(20000)] public string StarterCode { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<CodeSubmission> Submissions { get; set; } = new List<CodeSubmission>();
}

public class CodeFile
{
    public int Id { get; set; }
    public int ExerciseId { get; set; }
    public CodeExercise Exercise { get; set; } = null!;
    [MaxLength(160)] public string Name { get; set; } = "main";
    [MaxLength(30)] public string Language { get; set; } = "javascript";
    [MaxLength(50000)] public string InitialCode { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class CodeSubmission
{
    public int Id { get; set; }
    public int ExerciseId { get; set; }
    public CodeExercise Exercise { get; set; } = null!;
    public int StudentId { get; set; }
    public User Student { get; set; } = null!;
    [MaxLength(50000)] public string Code { get; set; } = string.Empty;
    [MaxLength(30)] public string Status { get; set; } = "Draft";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SubmittedAt { get; set; }
    public decimal? Score { get; set; }
    [MaxLength(2000)] public string? TeacherComment { get; set; }
    public DateTime? ReviewedAt { get; set; }
}



public class DirectMessage
{
    public int Id { get; set; }
    public int SenderId { get; set; }
    public User Sender { get; set; } = null!;
    public int RecipientId { get; set; }
    public User Recipient { get; set; } = null!;
    [MaxLength(4000)] public string Message { get; set; } = string.Empty;
    /// <summary>Optional image attached to the message (see ChatAttachment).</summary>
    public int? AttachmentId { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class CodeSubmissionVersion
{
    public int Id { get; set; }
    public int CodeSubmissionId { get; set; }
    public CodeSubmission Submission { get; set; } = null!;
    [MaxLength(50000)] public string Code { get; set; } = string.Empty;
    [MaxLength(30)] public string Status { get; set; } = "Draft";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class CodeExecution
{
    public int Id { get; set; }
    public int ExerciseId { get; set; }
    public CodeExercise Exercise { get; set; } = null!;
    public int StudentId { get; set; }
    public User Student { get; set; } = null!;
    [MaxLength(50000)] public string Code { get; set; } = string.Empty;
    [MaxLength(10000)] public string Stdin { get; set; } = string.Empty;
    [MaxLength(40)] public string Status { get; set; } = "Queued";
    [MaxLength(20000)] public string Stdout { get; set; } = string.Empty;
    [MaxLength(20000)] public string Stderr { get; set; } = string.Empty;
    [MaxLength(20000)] public string CompileOutput { get; set; } = string.Empty;
    public double? ExecutionTime { get; set; }
    public long? MemoryUsed { get; set; }
    public int? ExitCode { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
}

public class LessonAttachment
{
    public int Id { get; set; }
    public int ScheduleEntryId { get; set; }
    public ScheduleEntry ScheduleEntry { get; set; } = null!;
    public int UploaderId { get; set; }
    public User Uploader { get; set; } = null!;
    [MaxLength(200)] public string FileName { get; set; } = string.Empty;
    [MaxLength(255)] public string ContentType { get; set; } = "application/octet-stream";
    public long SizeBytes { get; set; }
    [MaxLength(128)] public string StorageKey { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class AuditLog
{
    public long Id { get; set; }
    public int? UserId { get; set; }
    public User? User { get; set; }
    [MaxLength(100)] public string Action { get; set; } = string.Empty;
    [MaxLength(200)] public string? Resource { get; set; }
    [MaxLength(1000)] public string? Details { get; set; }
    [MaxLength(64)] public string? IpAddress { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
