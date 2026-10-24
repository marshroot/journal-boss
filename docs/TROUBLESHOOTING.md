# Troubleshooting

## Backend refuses to start

Check `Jwt:Key` / `JWT_KEY`. It must contain at least 32 characters.

## Login returns 429

The login endpoint is limited to 10 attempts/minute/IP. Wait for the fixed window to expire and verify there is no retry loop.

## API returns 429

Canonical API traffic is limited to 300 requests/minute per authenticated user or client IP.

## Code Lab cannot run code

Set `JUDGE0_URL` and verify the Judge0 service is reachable from the backend/container network.

## LiveKit does not start

Set `LIVEKIT_URL`, `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`.

## Collaboration fails

Verify the browser reaches `/collab`, the `JWT_KEY` matches the backend, and Hocuspocus can access its `collab.sqlite` volume.

## Production redirects incorrectly

Verify `DOMAIN`, Caddy DNS/TCP 80/443 and forwarded-header handling. The public HTTPS request must arrive at Caddy.

## Restore appears successful but collaboration is stale

Restart the Hocuspocus/collaboration service after restore so it reloads `collab.sqlite`.
