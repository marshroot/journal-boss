using System.Threading.Channels;
using JournalBackend.Models;

namespace JournalBackend.Services;

public sealed record CodeExecutionRequest(
    int ExecutionId,
    string Language,
    string Code,
    string Stdin,
    IReadOnlyDictionary<string, string>? Files);

public sealed class CodeExecutionQueue
{
    private readonly Channel<CodeExecutionRequest> _channel = Channel.CreateBounded<CodeExecutionRequest>(new BoundedChannelOptions(64)
    {
        FullMode = BoundedChannelFullMode.Wait,
        SingleReader = true,
        SingleWriter = false
    });

    public ValueTask EnqueueAsync(CodeExecutionRequest request, CancellationToken ct = default) => _channel.Writer.WriteAsync(request, ct);
    public IAsyncEnumerable<CodeExecutionRequest> ReadAllAsync(CancellationToken ct) => _channel.Reader.ReadAllAsync(ct);
}
