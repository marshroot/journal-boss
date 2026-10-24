# Online lessons

LiveKit is used for media transport.

## Flow

```mermaid
sequenceDiagram
    participant T as Teacher
    participant API as ASP.NET
    participant L as LiveKit
    participant S as Student
    T->>API: start lesson
    API->>API: verify teacher ownership
    API->>L: issue room/token data
    T->>L: join room
    S->>API: request token
    API->>API: verify student group
    API-->>S: short-lived LiveKit token
    S->>L: join room
```

The server controls room start/end and issues tokens with teacher/admin privileges only for teacher/admin identities. Students are limited to the lesson group.

Required environment: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` and optional `LIVEKIT_TOKEN_TTL_SECONDS`.
