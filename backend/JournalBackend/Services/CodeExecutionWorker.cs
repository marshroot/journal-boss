using JournalBackend.Database;
using JournalBackend.Models;
using Microsoft.EntityFrameworkCore;

namespace JournalBackend.Services;

public sealed class CodeExecutionWorker : BackgroundService
{
    private readonly CodeExecutionQueue _queue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<CodeExecutionWorker> _logger;

    public CodeExecutionWorker(CodeExecutionQueue queue, IServiceScopeFactory scopeFactory, ILogger<CodeExecutionWorker> logger)
    {
        _queue = queue;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var request in _queue.ReadAllAsync(stoppingToken))
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var judge0 = scope.ServiceProvider.GetRequiredService<Judge0Client>();
                var execution = await db.CodeExecutions.FirstOrDefaultAsync(x => x.Id == request.ExecutionId, stoppingToken);
                if (execution is null) continue;

                execution.Status = "Running";
                await db.SaveChangesAsync(stoppingToken);

                try
                {
                    var result = await judge0.RunAsync(request.Language, request.Code, request.Stdin, request.Files, stoppingToken);
                    ApplyResult(execution, result);
                    execution.CompletedAt = DateTime.UtcNow;
                    await db.SaveChangesAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    execution.Status = "Failed";
                    execution.Stderr = ex.Message.Length > 20000 ? ex.Message[..20000] : ex.Message;
                    execution.CompletedAt = DateTime.UtcNow;
                    await db.SaveChangesAsync(stoppingToken);
                    _logger.LogError(ex, "Code execution {ExecutionId} failed", request.ExecutionId);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Code execution worker loop failed");
            }
        }
    }

    private static void ApplyResult(CodeExecution execution, object result)
    {
        var type = result.GetType();
        execution.Status = ReadString(type, result, "status") ?? "Completed";
        execution.Stdout = ReadString(type, result, "stdout") ?? string.Empty;
        execution.Stderr = ReadString(type, result, "stderr") ?? string.Empty;
        execution.CompileOutput = ReadString(type, result, "compileOutput") ?? string.Empty;
        execution.ExecutionTime = ReadDouble(type, result, "time");
        execution.MemoryUsed = ReadLong(type, result, "memory");
        execution.ExitCode = ReadInt(type, result, "exitCode");
    }

    private static string? ReadString(Type type, object obj, string name) => type.GetProperty(name)?.GetValue(obj)?.ToString();
    private static double? ReadDouble(Type type, object obj, string name) => type.GetProperty(name)?.GetValue(obj) as double? ?? (double.TryParse(type.GetProperty(name)?.GetValue(obj)?.ToString(), out var v) ? v : null);
    private static long? ReadLong(Type type, object obj, string name) => long.TryParse(type.GetProperty(name)?.GetValue(obj)?.ToString(), out var v) ? v : null;
    private static int? ReadInt(Type type, object obj, string name) => int.TryParse(type.GetProperty(name)?.GetValue(obj)?.ToString(), out var v) ? v : null;
}
