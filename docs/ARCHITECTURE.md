# Architecture

## Components

```mermaid
flowchart LR
    Browser[React/Vite frontend] -->|JWT HTTPS API| Proxy[Caddy / reverse proxy]
    Proxy --> Nginx[Frontend nginx]
    Nginx --> API[ASP.NET Core]
    Nginx --> Chat[SignalR]
    Nginx --> Collab[Hocuspocus]
    API --> DB[(SQLite journal.db)]
    API --> Files[(storage/attachments)]
    API --> Judge[Judge0]
    API --> LiveKit[LiveKit]
    Collab --> CollabDB[(collab.sqlite)]
```

## Runtime boundaries

- ASP.NET Core owns domain authorization, database access, audit and external-service token issuance.
- User code is queued and executed by Judge0, not inside the ASP.NET process.
- Hocuspocus owns Yjs persistence for collaborative documents/boards.
- LiveKit owns media transport; ASP.NET issues room tokens.
- Caddy is the production public HTTPS boundary.

## Request flow

```mermaid
sequenceDiagram
    participant U as Browser
    participant P as Caddy/nginx
    participant A as ASP.NET
    participant D as SQLite
    U->>P: HTTPS request + Bearer JWT
    P->>A: forwarded request
    A->>A: JWT validation + role/ownership check
    A->>D: authorized query/update
    D-->>A: result
    A-->>P: JSON/file
    P-->>U: response
```

## Design rule

A feature is considered implemented only when UI → API → backend → persistence/external service forms a working path. UI-only placeholders are not considered production functionality.
