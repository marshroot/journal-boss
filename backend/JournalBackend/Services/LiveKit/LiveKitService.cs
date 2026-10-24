using Google.Protobuf;
using Livekit.Server.Sdk.Dotnet;

namespace JournalBackend.Services.LiveKit;

/// <summary>
/// Thin wrapper over the official LiveKit server SDK. It keeps the controllers free of
/// SDK types and turns upstream failures into exceptions that carry a readable message.
/// </summary>
public sealed class LiveKitService : ILiveKitService
{
    private readonly LiveKitOptions _options;
    private readonly RoomServiceClient _client;

    public LiveKitService(LiveKitOptions options, IHttpClientFactory httpClientFactory)
    {
        _options = options;
        var httpClient = httpClientFactory.CreateClient("livekit");
        _client = new RoomServiceClient(
            _options.ServerUrl.TrimEnd('/'),
            _options.ApiKey,
            _options.ApiSecret,
            httpClient);
    }

    public LiveKitOptions Options => _options;

    public bool IsConfigured => _options.IsConfigured;

    public string CreateParticipantToken(string identity, string displayName, string roomName, bool isModerator)
    {
        var grants = new VideoGrants
        {
            RoomJoin = true,
            Room = roomName,
            CanPublish = true,
            CanPublishData = true,
            CanSubscribe = true,
            CanUpdateOwnMetadata = true,
            // Teachers and admins moderate the lesson; students only publish and subscribe.
            RoomAdmin = isModerator
        };

        return new AccessToken(_options.ApiKey, _options.ApiSecret)
            .WithIdentity(identity)
            .WithName(string.IsNullOrWhiteSpace(displayName) ? identity : displayName)
            .WithTtl(TimeSpan.FromSeconds(_options.TokenTtlSeconds))
            .WithGrants(grants)
            .ToJwt();
    }

    public async Task EnsureRoomAsync(string roomName, CancellationToken ct)
    {
        try
        {
            await _client.CreateRoom(new CreateRoomRequest { Name = roomName });
        }
        catch (Twirp.Exception ex) when (ex.Message.Contains("already exists", StringComparison.OrdinalIgnoreCase))
        {
            // The room is already running, which is exactly the desired state.
        }
    }

    public async Task DeleteRoomAsync(string roomName, CancellationToken ct)
    {
        try
        {
            await _client.DeleteRoom(new DeleteRoomRequest { Room = roomName });
        }
        catch (Twirp.Exception ex) when (
            ex.Message.Contains("does not exist", StringComparison.OrdinalIgnoreCase))
        {
            // Nothing to clean up.
        }
    }

    public async Task<IReadOnlyList<ParticipantInfo>> ListParticipantsAsync(string roomName, CancellationToken ct)
    {
        try
        {
            var response = await _client.ListParticipants(new ListParticipantsRequest { Room = roomName });
            return response.Participants.ToList();
        }
        catch (Exception ex) when (ex is Twirp.Exception or HttpRequestException or TaskCanceledException)
        {
            throw new LiveKitException($"Не удалось получить список участников: {ex.Message}", ex);
        }
    }

    public async Task MuteTrackAsync(string roomName, string identity, string trackSid, bool muted, CancellationToken ct)
    {
        try
        {
            await _client.MutePublishedTrack(new MuteRoomTrackRequest
            {
                Room = roomName,
                Identity = identity,
                TrackSid = trackSid,
                Muted = muted
            });
        }
        catch (Exception ex) when (ex is Twirp.Exception or HttpRequestException or TaskCanceledException)
        {
            throw new LiveKitException($"Не удалось изменить состояние трека: {ex.Message}", ex);
        }
    }

    public async Task RemoveParticipantAsync(string roomName, string identity, CancellationToken ct)
    {
        try
        {
            await _client.RemoveParticipant(new RoomParticipantIdentity { Room = roomName, Identity = identity });
        }
        catch (Twirp.Exception ex) when (
            ex.Message.Contains("does not exist", StringComparison.OrdinalIgnoreCase))
        {
            // The participant already left the room.
        }
        catch (Exception ex) when (ex is Twirp.Exception or HttpRequestException or TaskCanceledException)
        {
            throw new LiveKitException($"Не удалось отключить участника: {ex.Message}", ex);
        }
    }

    public async Task SendDataAsync(
        string roomName,
        string topic,
        string payload,
        CancellationToken ct,
        IReadOnlyCollection<string>? destinationIdentities = null)
    {
        var request = new SendDataRequest
        {
            Room = roomName,
            Data = ByteString.CopyFromUtf8(payload),
            Kind = DataPacket.Types.Kind.Reliable,
            Topic = topic
        };

        if (destinationIdentities is { Count: > 0 })
            request.DestinationIdentities.Add(destinationIdentities);

        try
        {
            await _client.SendData(request);
        }
        catch (Exception ex) when (ex is Twirp.Exception or HttpRequestException or TaskCanceledException)
        {
            throw new LiveKitException($"Не удалось отправить сообщение в комнату: {ex.Message}", ex);
        }
    }
}

public sealed class LiveKitException : Exception
{
    public LiveKitException(string message, Exception? inner = null) : base(message, inner) { }
}
