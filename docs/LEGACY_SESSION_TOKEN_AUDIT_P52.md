# P52 legacy session-token endpoint audit

This report is generated from source declarations by `scripts/legacy-session-token-audit.mjs`.

- Classified public action declarations accepting a `sessionToken`: 27
- Unclassified declarations outside the explicit legacy inventory: 0
- Security disposition: **BLOCKING — not fixed by inventory**

## Scope


These endpoints accept legacy session tokens (some in query strings). Query-string credentials can leak through browser history, proxy/access logs, analytics, and referrer data. This report does not prove token entropy, expiry, revocation, role enforcement, ownership checks, or protection from IDOR.

## Required next steps

1. Trace frontend and bot callers for each action before changing its contract.
2. Migrate callers to canonical `Authorization: Bearer <JWT>` where supported.
3. For endpoints that must continue calling Top Academy legacy APIs, resolve the authenticated Jornal user server-side and keep the external credential server-side; do not treat an arbitrary session token as identity.
4. Add endpoint integration tests for unauthenticated, wrong-role, expired token, linked/unlinked child, foreign homework/file IDs, and query-string token rejection.
5. Remove each controller from the legacy exception inventory only after its tests pass.

Do not disable these endpoints wholesale until the dependent integrations are mapped, as that could break existing user workflows.
