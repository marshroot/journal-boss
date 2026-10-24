# Database

Jornal uses SQLite through Entity Framework Core.

## Main entities

```mermaid
erDiagram
    USERS ||--o{ SCHEDULE_ENTRIES : teaches
    STUDY_GROUPS ||--o{ USERS : contains
    STUDY_GROUPS ||--o{ SCHEDULE_ENTRIES : has
    SUBJECTS ||--o{ SCHEDULE_ENTRIES : used_by
    USERS ||--o{ PARENT_STUDENTS : parent
    USERS ||--o{ PARENT_STUDENTS : student
    SCHEDULE_ENTRIES ||--o{ ATTENDANCE_RECORDS : records
    SCHEDULE_ENTRIES ||--o{ GRADE_RECORDS : grades
    SCHEDULE_ENTRIES ||--o{ LOCAL_HOMEWORK : assigns
    LOCAL_HOMEWORK ||--o{ HOMEWORK_SUBMISSIONS : receives
    SCHEDULE_ENTRIES ||--o{ STUDY_MATERIALS : contains
    STUDY_MATERIALS ||--o{ MATERIAL_ATTACHMENTS : has
    SCHEDULE_ENTRIES ||--o{ LESSON_ATTACHMENTS : has
    CODE_EXERCISES ||--o{ CODE_FILES : contains
    CODE_EXERCISES ||--o{ CODE_SUBMISSIONS : receives
```

The exact EF model is defined in `backend/JournalBackend/Database/AppDbContext.cs`.

## Realtime state

Hocuspocus uses a separate SQLite database, `collab.sqlite`, stored in the `collab_data` volume. It is not part of `journal.db` and is included separately in P28+ backups when available.
