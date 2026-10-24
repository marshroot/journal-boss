# Security

## Main JWT boundary

- JWT signature, issuer, audience and lifetime are validated.
- Local passwords use ASP.NET `PasswordHasher<User>`.
- Role authorization is applied to canonical controllers.
- Ownership checks validate teacher/lesson, student/group and parent/student relationships.
- Files are outside the public web root and require an authorized download endpoint.
- Upload names are sanitized and storage keys are server-generated.
- Rate limiting is global: 300 requests/minute per authenticated user/IP, with 10 login attempts/minute/IP.
- HSTS and HTTPS redirection are enabled outside Development; production TLS terminates at Caddy.

## IDOR checklist

For every endpoint receiving `userId`, `studentId`, `lessonId`, `groupId`, `homeworkId`, `submissionId`, `materialId` or `fileId`, verify that the authenticated principal is authorized for the referenced resource.

## Legacy exception

The legacy Top Academy/Telegram controllers use `sessionToken` instead of JWT. They must not be assumed to have the same role/ownership guarantees as the canonical API.

## Known migration risk

`User.ExternalPassword` exists for the legacy Top Academy integration and is stored separately from the local password hash. It remains a plaintext third-party credential and should be migrated to encrypted-at-rest storage before the legacy flow is considered production-hardened.

## Secrets

Secrets belong in environment variables or a secret manager, not in Git. The repository contains only templates/placeholders.


## Legacy session-token API

The following controllers are retained for compatibility: `AuthController`, `ScheduleController`, `HomeworkController`, and `LeaderboardController`. They use the historical `sessionToken` contract and are not the canonical JWT API. P41 adds explicit `Deprecation: true`, `Sunset`, and `X-Jornal-API: legacy-session-token` response headers to make the migration boundary visible without breaking existing clients.

### External credentials

The legacy `users.pass` / `ExternalPassword` field is still plaintext because legacy controllers read it directly. Do **not** claim this field is production-safe. A proper migration must encrypt existing values with ASP.NET Data Protection (with a persistent protected key ring), update every legacy read/write path, migrate existing rows, verify decryptability, and rotate/revoke the old credentials. Until then, use the legacy integration only when its operational risk is accepted.

## Reverse-proxy headers

Caddy now emits baseline browser security headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`, and a restrictive `Permissions-Policy`. Camera and microphone remain available to the same origin for LiveKit lessons.

## External credential encryption (P43)

Legacy Top Academy credentials in `users.pass` are encrypted at rest with ASP.NET Data Protection using the purpose `Jornal.ExternalCredentials.v1` and the `enc:v1:` storage prefix. Existing plaintext rows are migrated automatically at startup; already encrypted rows are decrypted once to validate the persistent key ring.

Production must persist the Data Protection key ring outside the container filesystem. The Docker deployment uses `/data/keys` inside the existing `journal_data` volume. Set `DataProtection__KeyRingPath` explicitly when deploying outside Docker. If the key ring is lost, encrypted credentials cannot be recovered; restore the key-ring directory together with the database backup.

The application never returns `ExternalPassword` through API DTOs. Legacy controllers decrypt credentials only immediately before calling the external Top Academy service.
