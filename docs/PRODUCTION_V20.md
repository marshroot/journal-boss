# Production hardening — v20

## Added
- Rate limiting: 120 API requests/minute per application instance.
- `/health` endpoint.
- HSTS and HTTPS redirection outside Development.
- Configurable CORS via `Cors:Origins`; wildcard CORS was removed.
- Lesson attachments with 25 MB limit, allow-listed MIME types and server-side storage keys.
- Audit log for file upload/download and an admin-only audit endpoint.
- Dockerfiles for backend and frontend plus a root `docker-compose.yml`.
- Persistent Docker volumes for SQLite and uploaded files.

## Judge0
Judge0 remains an external service. Set `JUDGE0__URL`/`Judge0__Url` to a reachable instance. The compose file intentionally does not pretend to provision the full Judge0 dependency stack.

## Required production secrets
- `JWT_KEY`: random secret, at least 32 characters.
- LiveKit credentials if online lessons are enabled.
- Judge0 endpoint if Code Lab execution is enabled.

## Storage
Uploaded lesson files are stored under `/app/storage/attachments` in the container and persisted by the `journal_uploads` volume.

## Backup

Administrators can create a point-in-time backup with `POST /api/admin/backups`. The endpoint creates a consistent SQLite snapshot and packages it together with uploaded lesson attachments into a ZIP archive. The endpoint is restricted to the `Admin` role and is audit logged as `backup.create`.

For production, store downloaded backups outside the application host as well (for example, object storage or an encrypted backup server) and test restoration regularly. The backup contains sensitive academic data and must be protected accordingly.
