using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using JournalBackend.Models;
using Microsoft.EntityFrameworkCore;
using JournalBackend.Database;
using JournalBackend;

var builder = WebApplication.CreateBuilder(args);

// 1. Add services to the container.
builder.Services.AddControllers().AddJsonOptions(o =>
{
    o.JsonSerializerOptions.Converters.Add(new JournalBackend.Services.UtcDateTimeConverter());
    o.JsonSerializerOptions.Converters.Add(new JournalBackend.Services.UtcNullableDateTimeConverter());
});
builder.Services.AddSignalR().AddJsonProtocol(o =>
{
    o.PayloadSerializerOptions.Converters.Add(new JournalBackend.Services.UtcDateTimeConverter());
    o.PayloadSerializerOptions.Converters.Add(new JournalBackend.Services.UtcNullableDateTimeConverter());
});
var keyRingPath = builder.Configuration["DataProtection:KeyRingPath"];
if (string.IsNullOrWhiteSpace(keyRingPath))
    keyRingPath = builder.Environment.IsProduction() ? "/data/keys" : Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", "..", "database", "dp-keys"));
Directory.CreateDirectory(keyRingPath);
builder.Services.AddDataProtection()
    .SetApplicationName("Jornal")
    .PersistKeysToFileSystem(new DirectoryInfo(keyRingPath));
builder.Services.AddSingleton<JournalBackend.Services.Security.IExternalCredentialProtector, JournalBackend.Services.Security.ExternalCredentialProtector>();
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddHttpClient<Judge0Client>();

// LiveKit: the browser and the backend use different addresses, so the public URL
// (ws:// or wss://) and the server URL (http:// or https://) are configured separately.
var liveKitOptions = JournalBackend.Services.LiveKit.LiveKitConfiguration.Build(
    builder.Configuration,
    builder.Environment.ContentRootPath);

builder.Services.AddSingleton(liveKitOptions);
builder.Services.AddHttpClient("livekit", client =>
{
    // An empty server URL means LiveKit is not configured; keep a syntactically valid
    // base address so that the client can still be resolved, and let the service
    // report the missing configuration to the caller.
    var serverUrl = string.IsNullOrWhiteSpace(liveKitOptions.ServerUrl)
        ? "http://localhost:7880"
        : liveKitOptions.ServerUrl.TrimEnd('/');
    client.BaseAddress = new Uri(serverUrl + "/");
    client.Timeout = TimeSpan.FromSeconds(20);
});
builder.Services.AddSingleton<JournalBackend.Services.LiveKit.ILiveKitService, JournalBackend.Services.LiveKit.LiveKitService>();
builder.Services.AddSingleton<JournalBackend.Services.CodeExecutionQueue>();
builder.Services.AddHostedService<JournalBackend.Services.CodeExecutionWorker>();
builder.Services.AddScoped<JournalBackend.Services.IAuditService, JournalBackend.Services.AuditService>();
builder.Services.AddHealthChecks();
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // The backend is not published directly in the production compose stack;
    // the reverse proxy is the trusted boundary for forwarded headers.
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    static string ClientKey(HttpContext ctx) =>
        ctx.User.Identity?.IsAuthenticated == true
            ? "u:" + ctx.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            : "ip:" + (ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown");
    // Apply rate limits globally so every API endpoint is protected, including
    // controllers that do not explicitly opt into a named policy. Login gets a
    // stricter per-IP window; all other requests use the authenticated-user
    // partition (or the client IP for anonymous endpoints).
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
    {
        if (ctx.Request.Path.StartsWithSegments("/health"))
            return RateLimitPartition.GetNoLimiter("health");

        if (ctx.Request.Path.StartsWithSegments("/api/auth/login"))
        {
            var ip = ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            return RateLimitPartition.GetFixedWindowLimiter("login:" + ip,
                _ => new FixedWindowRateLimiterOptions
                { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 });
        }

        return RateLimitPartition.GetFixedWindowLimiter(ClientKey(ctx),
            _ => new FixedWindowRateLimiterOptions
            { PermitLimit = 300, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 });
    });
});

var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
{
    throw new InvalidOperationException("Jwt:Key должен быть задан в конфигурации/переменных окружения и содержать минимум 32 символа.");
}

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/lesson-chat"))
                    context.Token = accessToken;
                return Task.CompletedTask;
            }
        };
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "JournalBackend",
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "JournalFrontend",
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddMemoryCache();

// 2. Configure SQLite Database
// Make sure the folder for the SQLite file exists (e.g. ../../database/ on a fresh checkout).
{
    var sqliteCs = builder.Configuration.GetConnectionString("DefaultConnection");
    if (!string.IsNullOrWhiteSpace(sqliteCs))
    {
        var dataSource = new Microsoft.Data.Sqlite.SqliteConnectionStringBuilder(sqliteCs).DataSource;
        if (!string.IsNullOrWhiteSpace(dataSource) && !dataSource.StartsWith(":memory:", StringComparison.OrdinalIgnoreCase) && !dataSource.StartsWith("file:", StringComparison.OrdinalIgnoreCase))
        {
            var dbDir = Path.GetDirectoryName(Path.GetFullPath(dataSource));
            if (!string.IsNullOrEmpty(dbDir)) Directory.CreateDirectory(dbDir);
        }
    }
}
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

// 3. Configure CORS to allow frontend communication
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        var configured = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? Array.Empty<string>();
        var origins = configured.Length > 0 ? configured : new[] { "http://localhost:3000" };
        policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
    });
});

// 4. Force bind to http://localhost:5000 for consistency with bot and frontend
// Default stays http://localhost:5000; set ASPNETCORE_URLS (e.g. http://0.0.0.0:5000) in Docker/production.
if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("ASPNETCORE_URLS")))
    builder.WebHost.UseUrls("http://localhost:5000");

var app = builder.Build();

app.UseForwardedHeaders();

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.UseRateLimiter();

// Legacy API compatibility boundary. These endpoints still use the historical
// sessionToken contract and are intentionally preserved for existing clients.
// Do not silently remove them: expose explicit deprecation metadata so clients
// can migrate to the JWT-based canonical API without breaking the application.
app.Use(async (context, next) =>
{
    var path = context.Request.Path.Value ?? string.Empty;
    var isLegacy = path.StartsWith("/api/Auth", StringComparison.OrdinalIgnoreCase)
        || path.StartsWith("/api/Schedule", StringComparison.OrdinalIgnoreCase)
        || path.StartsWith("/api/Homework", StringComparison.OrdinalIgnoreCase)
        || path.StartsWith("/api/Leaderboard", StringComparison.OrdinalIgnoreCase);


    if (isLegacy)
    {
        context.Response.Headers["Deprecation"] = "true";
        context.Response.Headers["Sunset"] = "Sat, 31 Jan 2027 23:59:59 GMT";
        context.Response.Headers["X-Jornal-API"] = "legacy-session-token";
    }

    await next();
});
app.MapHealthChecks("/health");

// 5. Apply database creation schema automatically on startup
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    
    // First ensure the database and all EF Core tables are created
    dbContext.Database.EnsureCreated();

    // Align an existing database with the EF model (legacy snake_case columns -> EF names, missing tables/indexes).
    JournalBackend.Database.SqliteSchemaUpgrades.Apply(dbContext);
    
    // Custom database migration logic for SQLite (Users table -> users table)
    var conn = (Microsoft.Data.Sqlite.SqliteConnection)dbContext.Database.GetDbConnection();
    try
    {
        conn.Open();
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = "SELECT name FROM sqlite_master WHERE type='table' AND name='Users';";
            var result = cmd.ExecuteScalar();
            if (result != null && result.ToString() == "Users")
            {
                Console.WriteLine("[DB Migration] Old 'Users' table detected. Migrating to unified 'users' table...");
                using (var transaction = conn.BeginTransaction())
                {
                    try
                    {
                        using (var migrateCmd = conn.CreateCommand())
                        {
                            migrateCmd.Transaction = transaction;
                            
                            // Rename table to temp first to bypass SQLite case-insensitivity check
                            migrateCmd.CommandText = "ALTER TABLE Users RENAME TO users_temp;";
                            migrateCmd.ExecuteNonQuery();

                            // Rename columns on temp table
                            migrateCmd.CommandText = "ALTER TABLE users_temp RENAME COLUMN TelegramId TO tgid;";
                            migrateCmd.ExecuteNonQuery();

                            migrateCmd.CommandText = "ALTER TABLE users_temp RENAME COLUMN Password TO pass;";
                            migrateCmd.ExecuteNonQuery();

                            migrateCmd.CommandText = "ALTER TABLE users_temp RENAME COLUMN JournalToken TO SessionToken;";
                            migrateCmd.ExecuteNonQuery();

                            migrateCmd.CommandText = "ALTER TABLE users_temp RENAME COLUMN CreatedAt TO created_at;";
                            migrateCmd.ExecuteNonQuery();

                            // Rename table to final lowercase name
                            migrateCmd.CommandText = "ALTER TABLE users_temp RENAME TO users;";
                            migrateCmd.ExecuteNonQuery();
                        }
                        transaction.Commit();
                        Console.WriteLine("[DB Migration] Database migration completed successfully!");
                    }
                    catch (Exception ex)
                    {
                        transaction.Rollback();
                        Console.Error.WriteLine($"[DB Migration ERROR] Failed to migrate database: {ex.Message}");
                    }
                }
            }
        }

        // Production-safe auxiliary tables for existing databases.
        using (var auxCmd = conn.CreateCommand())
        {
            auxCmd.CommandText = @"
                CREATE TABLE IF NOT EXISTS lesson_attachments (id INTEGER PRIMARY KEY AUTOINCREMENT, schedule_entry_id INTEGER NOT NULL, uploader_id INTEGER NOT NULL, file_name TEXT NOT NULL, content_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, storage_key TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, FOREIGN KEY(schedule_entry_id) REFERENCES schedule_entries(id) ON DELETE CASCADE, FOREIGN KEY(uploader_id) REFERENCES users(id) ON DELETE RESTRICT);
                CREATE TABLE IF NOT EXISTS announcements (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, body TEXT NOT NULL, published_at TEXT NOT NULL, is_published INTEGER NOT NULL DEFAULT 1, author_id INTEGER NULL, FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE SET NULL);
                CREATE INDEX IF NOT EXISTS ix_announcements_published ON announcements(IsPublished, PublishedAt);
                CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NULL, action TEXT NOT NULL, resource TEXT NULL, details TEXT NULL, ip_address TEXT NULL, created_at TEXT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL);
            ";
            auxCmd.ExecuteNonQuery();
        }

        // Initialize academic structure tables for existing databases.
        using (var academicCmd = conn.CreateCommand())
        {
            academicCmd.CommandText = @"
                CREATE TABLE IF NOT EXISTS study_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS subjects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS schedule_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER NOT NULL, subject_id INTEGER NOT NULL, teacher_id INTEGER NOT NULL, start_at TEXT NOT NULL, end_at TEXT NOT NULL, room TEXT, lesson_number INTEGER NOT NULL, FOREIGN KEY(group_id) REFERENCES study_groups(id) ON DELETE CASCADE, FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE, FOREIGN KEY(teacher_id) REFERENCES users(id) ON DELETE RESTRICT);
            ";
            academicCmd.ExecuteNonQuery();
            Console.WriteLine("[DB Init] Academic structure tables initialized successfully!");
        }

        // Student-to-group and parent-to-student relationships.
        using (var relationsCmd = conn.CreateCommand())
        {
            relationsCmd.CommandText = @"
                ALTER TABLE users ADD COLUMN study_group_id INTEGER;
                CREATE INDEX IF NOT EXISTS ix_users_study_group_id ON users(study_group_id);
                CREATE TABLE IF NOT EXISTS parent_students (
                    parent_id INTEGER NOT NULL,
                    student_id INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY(parent_id, student_id),
                    FOREIGN KEY(parent_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE
                );
            ";
            try { relationsCmd.ExecuteNonQuery(); }
            catch (Microsoft.Data.Sqlite.SqliteException ex) when (ex.SqliteErrorCode == 1 && ex.Message.Contains("duplicate column name", StringComparison.OrdinalIgnoreCase)) {
                using var retry = conn.CreateCommand();
                retry.CommandText = @"
                    CREATE INDEX IF NOT EXISTS ix_users_study_group_id ON users(study_group_id);
                    CREATE TABLE IF NOT EXISTS parent_students (parent_id INTEGER NOT NULL, student_id INTEGER NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(parent_id, student_id), FOREIGN KEY(parent_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE);
                ";
                retry.ExecuteNonQuery();
            }
            Console.WriteLine("[DB Init] Student/group and parent/student relations initialized successfully!");
        }

        // Initialize lesson topics and attendance records.
        using (var lessonCmd = conn.CreateCommand())
        {
            lessonCmd.CommandText = @"
                ALTER TABLE schedule_entries ADD COLUMN topic TEXT;
                CREATE TABLE IF NOT EXISTS attendance_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    schedule_entry_id INTEGER NOT NULL,
                    student_id INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY(schedule_entry_id) REFERENCES schedule_entries(id) ON DELETE CASCADE,
                    FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE
                );
            ";
            try { lessonCmd.ExecuteNonQuery(); }
            catch (Microsoft.Data.Sqlite.SqliteException ex) when (ex.SqliteErrorCode == 1 && ex.Message.Contains("duplicate column name", StringComparison.OrdinalIgnoreCase))
            {
                using var retry = conn.CreateCommand();
                retry.CommandText = @"CREATE TABLE IF NOT EXISTS attendance_records (id INTEGER PRIMARY KEY AUTOINCREMENT, schedule_entry_id INTEGER NOT NULL, student_id INTEGER NOT NULL, status TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(schedule_entry_id) REFERENCES schedule_entries(id) ON DELETE CASCADE, FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE);";
                retry.ExecuteNonQuery();
            }
            Console.WriteLine("[DB Init] Lesson topics and attendance initialized successfully!");
        }

        // Local assessment and homework tables.
        using (var assessmentCmd = conn.CreateCommand())
        {
            assessmentCmd.CommandText = @"
                CREATE TABLE IF NOT EXISTS grade_records (id INTEGER PRIMARY KEY AUTOINCREMENT, schedule_entry_id INTEGER NOT NULL, student_id INTEGER NOT NULL, value REAL NOT NULL, comment TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(schedule_entry_id) REFERENCES schedule_entries(id) ON DELETE CASCADE, FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE);
                CREATE TABLE IF NOT EXISTS local_homework (id INTEGER PRIMARY KEY AUTOINCREMENT, schedule_entry_id INTEGER NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, deadline TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(schedule_entry_id) REFERENCES schedule_entries(id) ON DELETE CASCADE);
                CREATE TABLE IF NOT EXISTS homework_submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, homework_id INTEGER NOT NULL, student_id INTEGER NOT NULL, answer TEXT NOT NULL, submitted_at TEXT NOT NULL, ai_review TEXT, ai_score REAL, teacher_score REAL, teacher_comment TEXT, reviewed_at TEXT, FOREIGN KEY(homework_id) REFERENCES local_homework(id) ON DELETE CASCADE, FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE);
            ";
            assessmentCmd.ExecuteNonQuery();
            Console.WriteLine("[DB Init] Grades and local homework initialized successfully!");

            using var aiQuizCmd = conn.CreateCommand();
            aiQuizCmd.CommandText = @"
                CREATE TABLE IF NOT EXISTS ai_teacher_quizzes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    submission_id INTEGER NOT NULL UNIQUE,
                    teacher_id INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    completed_at TEXT,
                    FOREIGN KEY(submission_id) REFERENCES homework_submissions(id) ON DELETE CASCADE,
                    FOREIGN KEY(teacher_id) REFERENCES users(id) ON DELETE RESTRICT
                );
                CREATE TABLE IF NOT EXISTS ai_teacher_quiz_questions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    quiz_id INTEGER NOT NULL,
                    question TEXT NOT NULL,
                    reference_answer TEXT,
                    teacher_answer TEXT,
                    FOREIGN KEY(quiz_id) REFERENCES ai_teacher_quizzes(id) ON DELETE CASCADE
                );
            ";
            aiQuizCmd.ExecuteNonQuery();
            Console.WriteLine("[DB Init] AI teacher quiz initialized successfully!");
        }

        // Lesson chat messages used by the SignalR classroom chat.
        using (var chatCmd = conn.CreateCommand())
        {
            chatCmd.CommandText = @"CREATE TABLE IF NOT EXISTS lesson_chat_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, schedule_entry_id INTEGER NOT NULL, user_id INTEGER NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(schedule_entry_id) REFERENCES schedule_entries(id) ON DELETE CASCADE, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);";
            chatCmd.ExecuteNonQuery();
            Console.WriteLine("[DB Init] Lesson chat initialized successfully!");
        }

        // Code exercises and student drafts for the classroom code lab.
        using (var codeCmd = conn.CreateCommand())
        {
            codeCmd.CommandText = @"
                CREATE TABLE IF NOT EXISTS code_exercises (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    schedule_entry_id INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    language TEXT NOT NULL,
                    starter_code TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY(schedule_entry_id) REFERENCES schedule_entries(id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS code_submissions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    exercise_id INTEGER NOT NULL,
                    student_id INTEGER NOT NULL,
                    code TEXT NOT NULL,
                    status TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    submitted_at TEXT,
                    Score REAL NULL,
                    TeacherComment TEXT NULL,
                    ReviewedAt TEXT NULL,
                    FOREIGN KEY(exercise_id) REFERENCES code_exercises(id) ON DELETE CASCADE,
                    FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE
                );
            ";
            codeCmd.ExecuteNonQuery();
            Console.WriteLine("[DB Init] Code lab initialized successfully!");
        }

        // Online lesson rooms used by the teacher current-lesson workflow.
        using (var onlineCmd = conn.CreateCommand())
        {
            onlineCmd.CommandText = @"
                CREATE TABLE IF NOT EXISTS online_lessons (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    schedule_entry_id INTEGER NOT NULL,
                    room_name TEXT NOT NULL UNIQUE,
                    status TEXT NOT NULL,
                    started_at TEXT NOT NULL,
                    ended_at TEXT,
                    FOREIGN KEY(schedule_entry_id) REFERENCES schedule_entries(id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS lesson_boards (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    schedule_entry_id INTEGER NOT NULL UNIQUE,
                    content TEXT NOT NULL DEFAULT '{}',
                    mode TEXT NOT NULL DEFAULT 'all',
                    editor_ids TEXT,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY(schedule_entry_id) REFERENCES schedule_entries(id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS chat_groups (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    owner_id INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS chat_group_members (
                    group_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    PRIMARY KEY(group_id, user_id),
                    FOREIGN KEY(group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS chat_group_messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    group_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    message TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                );
            ";
            onlineCmd.ExecuteNonQuery();
        }

        // Study materials authored by teachers and attached to a lesson.
        using (var materialsCmd = conn.CreateCommand())
        {
            materialsCmd.CommandText = @"
                CREATE TABLE IF NOT EXISTS study_materials (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    schedule_entry_id INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    content_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY(schedule_entry_id) REFERENCES schedule_entries(id) ON DELETE CASCADE
                );
            ";
            materialsCmd.ExecuteNonQuery();
            Console.WriteLine("[DB Init] Study materials initialized successfully!");
        }

        // 2. Initialize other bot-related tables if they are missing
        using (var createCmd = conn.CreateCommand())
        {
            createCmd.CommandText = @"
                CREATE TABLE IF NOT EXISTS teachers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    login TEXT NOT NULL,
                    fio TEXT,
                    subject TEXT NOT NULL,
                    created_at TEXT,
                    criteria TEXT
                );
                CREATE TABLE IF NOT EXISTS github_tokens (
                    tgid INTEGER PRIMARY KEY,
                    token TEXT NOT NULL,
                    username TEXT
                );
                CREATE TABLE IF NOT EXISTS admins (
                    tgid INTEGER PRIMARY KEY
                );
                CREATE TABLE IF NOT EXISTS testers (
                    tgid INTEGER PRIMARY KEY
                );
                INSERT OR IGNORE INTO admins (tgid) VALUES (1602647418);
            ";
            createCmd.ExecuteNonQuery();
            Console.WriteLine("[DB Init] Bot-related tables initialized successfully!");
        }
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"[DB Migration ERROR] Failed to connect or inspect database: {ex.Message}");
    }

    // Add local authentication columns to an existing database without requiring a destructive migration.
    try
    {
        // Local accounts use TelegramId=0 until the legacy Telegram identity is migrated.
        // Remove the old full unique index so multiple local-only users can coexist.
        using (var telegramIndexCmd = conn.CreateCommand())
        {
            telegramIndexCmd.CommandText = "DROP INDEX IF EXISTS IX_users_tgid; DROP INDEX IF EXISTS ix_users_tgid; CREATE UNIQUE INDEX IF NOT EXISTS ix_users_tgid_nonzero ON users(tgid) WHERE tgid <> 0;";
            telegramIndexCmd.ExecuteNonQuery();
        }

        var columns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        using var pragma = conn.CreateCommand();
        pragma.CommandText = "PRAGMA table_info(users);";
        using var reader = pragma.ExecuteReader();
        while (reader.Read()) columns.Add(reader.GetString(1));

        var alterStatements = new Dictionary<string, string>
        {
            ["auth_login"] = "ALTER TABLE users ADD COLUMN auth_login TEXT",
            ["password_hash"] = "ALTER TABLE users ADD COLUMN password_hash TEXT",
            ["full_name"] = "ALTER TABLE users ADD COLUMN full_name TEXT NOT NULL DEFAULT ''",
            ["role"] = "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'Student'",
            ["study_group_id"] = "ALTER TABLE users ADD COLUMN study_group_id INTEGER"
        };
        foreach (var item in alterStatements)
        {
            if (!columns.Contains(item.Key))
            {
                using var alter = conn.CreateCommand();
                alter.CommandText = item.Value;
                alter.ExecuteNonQuery();
            }
        }

        using (var roleUpdate = conn.CreateCommand())
        {
            roleUpdate.CommandText = "UPDATE users SET role = 'Admin' WHERE tgid IN (SELECT tgid FROM admins);";
            roleUpdate.ExecuteNonQuery();
        }

        using (var indexCmd = conn.CreateCommand())
        {
            indexCmd.CommandText = "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_auth_login ON users(auth_login) WHERE auth_login IS NOT NULL;";
            indexCmd.ExecuteNonQuery();
        }

        var adminLogin = builder.Configuration["Admin:InitialLogin"];
        var adminPassword = builder.Configuration["Admin:InitialPassword"];
        var adminName = builder.Configuration["Admin:InitialName"] ?? "Главный администратор";
        if (!string.IsNullOrWhiteSpace(adminLogin) && !string.IsNullOrWhiteSpace(adminPassword))
        {
            var hasher = new PasswordHasher<User>();
            using var check = conn.CreateCommand();
            check.CommandText = "SELECT id FROM users WHERE auth_login = $login LIMIT 1;";
            check.Parameters.AddWithValue("$login", adminLogin.Trim());
            var existing = check.ExecuteScalar();
            if (existing == null)
            {
                var hash = hasher.HashPassword(new User(), adminPassword);
                using var seed = conn.CreateCommand();
                seed.CommandText = "INSERT INTO users (tgid, login, pass, SessionToken, created_at, auth_login, password_hash, full_name, role) VALUES (0, NULL, NULL, NULL, $created, $login, $hash, $name, 'Admin');";
                seed.Parameters.AddWithValue("$created", DateTime.UtcNow.ToString("O"));
                seed.Parameters.AddWithValue("$login", adminLogin.Trim());
                seed.Parameters.AddWithValue("$hash", hash);
                seed.Parameters.AddWithValue("$name", adminName);
                seed.ExecuteNonQuery();
                Console.WriteLine($"[Auth] Initial admin '{adminLogin.Trim()}' created.");
            }
        }
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"[Auth Migration ERROR] {ex.Message}");
    }
    finally
    {
        conn.Close();
    }

    // Incremental schema update for existing SQLite databases created by earlier versions.
    // EnsureCreated does not alter an already-existing table, so add the new subject-teacher column explicitly.
    // The connection was closed by the previous migration block; reopen it for this independent step.
    try
    {
        if (conn.State != System.Data.ConnectionState.Open) conn.Open();
        using var schemaCmd = conn.CreateCommand();
        schemaCmd.CommandText = "PRAGMA table_info(subjects);";
        var hasTeacherId = false;
        using (var reader = schemaCmd.ExecuteReader())
        {
            while (reader.Read())
            {
                if (string.Equals(reader.GetString(1), "TeacherId", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(reader.GetString(1), "teacher_id", StringComparison.OrdinalIgnoreCase))
                {
                    hasTeacherId = true;
                    break;
                }
            }
        }

        if (!hasTeacherId)
        {
            using var alter = conn.CreateCommand();
            alter.CommandText = "ALTER TABLE subjects ADD COLUMN TeacherId INTEGER NULL;";
            alter.ExecuteNonQuery();
            Console.WriteLine("[DB Migration] Added subjects.TeacherId.");
        }
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"[DB Migration ERROR] Subject teacher schema update failed: {ex.Message}");
    }

    // v23: material draft/published state. Existing materials were visible to students before, so they are marked as published.
    try
    {
        if (conn.State != System.Data.ConnectionState.Open) conn.Open();
        var matCols = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        using (var colCmd = conn.CreateCommand())
        {
            colCmd.CommandText = "PRAGMA table_info(study_materials);";
            using var colReader = colCmd.ExecuteReader();
            while (colReader.Read()) matCols.Add(colReader.GetString(1));
        }
        if (matCols.Count > 0 && !matCols.Contains("IsPublished"))
        {
            using var alter = conn.CreateCommand();
            alter.CommandText = "ALTER TABLE study_materials ADD COLUMN IsPublished INTEGER NOT NULL DEFAULT 1; ALTER TABLE study_materials ADD COLUMN PublishedAt TEXT NULL;";
            alter.ExecuteNonQuery();
            Console.WriteLine("[DB Migration] Added study_materials.IsPublished/PublishedAt.");
        }
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"[DB Migration ERROR] Study materials publish schema update failed: {ex.Message}");
    }

    // v23: lesson start/complete timestamps for the unified current-lesson screen.
    try
    {
        if (conn.State != System.Data.ConnectionState.Open) conn.Open();
        var lessonCols = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        using (var colCmd = conn.CreateCommand())
        {
            colCmd.CommandText = "PRAGMA table_info(schedule_entries);";
            using var colReader = colCmd.ExecuteReader();
            while (colReader.Read()) lessonCols.Add(colReader.GetString(1));
        }
        if (lessonCols.Count > 0 && !lessonCols.Contains("StartedAt"))
        {
            using var alter = conn.CreateCommand();
            alter.CommandText = "ALTER TABLE schedule_entries ADD COLUMN StartedAt TEXT NULL; ALTER TABLE schedule_entries ADD COLUMN CompletedAt TEXT NULL;";
            alter.ExecuteNonQuery();
            Console.WriteLine("[DB Migration] Added schedule_entries.StartedAt/CompletedAt.");
        }
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"[DB Migration ERROR] Lesson start/complete schema update failed: {ex.Message}");
    }
    finally
    {
        if (conn.State == System.Data.ConnectionState.Open) conn.Close();
    }

    // P41/P42: encrypt legacy Top Academy credentials at rest. Existing plaintext
    // values are migrated once; already-encrypted values are validated on every startup.
    try
    {
        var externalCredentials = app.Services.GetRequiredService<JournalBackend.Services.Security.IExternalCredentialProtector>();
        var usersWithCredentials = await dbContext.Users
            .Where(u => !string.IsNullOrWhiteSpace(u.ExternalPassword))
            .ToListAsync();

        var migrated = 0;
        foreach (var user in usersWithCredentials)
        {
            if (!externalCredentials.IsProtected(user.ExternalPassword))
            {
                user.ExternalPassword = externalCredentials.Protect(user.ExternalPassword!);
                migrated++;
            }
            else
            {
                // Fail startup rather than silently accepting an unreadable credential.
                _ = externalCredentials.Unprotect(user.ExternalPassword);
            }
        }

        if (migrated > 0)
        {
            await dbContext.SaveChangesAsync();
            Console.WriteLine($"[Security] Encrypted {migrated} legacy external credential(s) at rest.");
        }
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"[Security ERROR] External credential encryption migration failed: {ex.Message}");
        throw;
    }

    // Enable WAL (Write-Ahead Logging) mode for SQLite to prevent locking under concurrency
    try
    {
        dbContext.Database.ExecuteSqlRaw("PRAGMA journal_mode=WAL;");
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"[DB ERROR] Failed to enable WAL mode: {ex.Message}");
    }
}

// 6. Request Pipeline
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<JournalBackend.Hubs.LessonChatHub>("/hubs/lesson-chat");

app.Run();
