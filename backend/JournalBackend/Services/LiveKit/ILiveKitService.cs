using Livekit.Server.Sdk.Dotnet;

namespace JournalBackend.Services.LiveKit;

public interface ILiveKitService
{
    LiveKitOptions Options { get; }

    bool IsConfigured { get; }

    /// <summary>Creates a participant access token for the given room.</summary>
    string CreateParticipantToken(string identity, string displayName, string roomName, bool isModerator);

    /// <summary>Creates the room if it does not exist yet.</summary>
    Task EnsureRoomAsync(string roomName, CancellationToken ct);

    /// <summary>Removes the room and disconnects everyone inside it.</summary>
    Task DeleteRoomAsync(string roomName, CancellationToken ct);

    Task<IReadOnlyList<ParticipantInfo>> ListParticipantsAsync(string roomName, CancellationToken ct);

    Task MuteTrackAsync(string roomName, string identity, string trackSid, bool muted, CancellationToken ct);

    Task RemoveParticipantAsync(string roomName, string identity, CancellationToken ct);

    /// <summary>Sends a data message to the participants of the room.</summary>
    Task SendDataAsync(string roomName, string topic, string payload, CancellationToken ct, IReadOnlyCollection<string>? destinationIdentities = null);
}
