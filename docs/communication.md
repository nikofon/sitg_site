# Communication and authentication

## Transport

The browser uses relative URLs under its website origin. In development Vite proxies them;
in production the website reverse proxy forwards `/api/` and `/auth/` to the SITG server.
Preserve the browser's Origin and public Host. Do not point the browser directly at the
Mini App domain: cookies are host-only, sessions are origin-bound, and CSP uses `connect-src 'self'`.

The HTTP listener currently accepts JSON bodies up to 5 MiB. Query parameters and UUID path
segments must be URL-encoded. Timestamps use ISO 8601, normally with UTC offsets; display them
in the user's timezone. IDs are opaque strings. Ordinary API successes return the payload
itself, not a `{data: ...}` wrapper.

## Login

1. Navigate the browser to `/auth/telegram`. The server returns a Telegram login-widget page
   and sets `__Host-sitg_login`: HTTP-only, Secure, SameSite=Lax, Path=/, lifetime five minutes.
2. Telegram redirects to `/auth/telegram/callback` with `state`, signed identity fields, and
   `hash`. The server verifies browser state, duplicate fields, signature, and timestamp.
   Identity fields are never trusted merely because the browser submitted them.
3. The server sets `__Host-sitg_session` and redirects to `/tournaments`, removing login
   credentials from the visible URL. The cookie is HTTP-only, Secure, SameSite=Strict, Path=/,
   has no Domain attribute, and normally expires after 15 minutes.
4. `POST /api/website/session` with JSON `{}` restores the session and obtains CSRF/viewer data.

Example session payload:

```json
{
  "csrf_token": "opaque-token",
  "expires_at": "2026-09-15T12:15:00+00:00",
  "locale": "en",
  "viewer": {
    "player_id": "00000000-0000-0000-0000-000000000005",
    "registration_status": "active",
    "is_admin": false,
    "is_manager": true
  }
}
```

Session restoration requires an explicit allowed Origin and `Content-Type: application/json`.
Browsers supply Origin automatically for the POST. It does not need a CSRF token because it
bootstraps that token. A 401 means anonymous browsing is available for public resources.
The client omits cookies on anonymous reads so expired cookies do not block public content.
New Telegram accounts may have `registration_status: "registration"`; complete registration
in the bot before using operations that require an active account.

The website never uses Telegram Mini App `initData`. `/api/miniapp/session` is reserved for
the Mini App domain and is rejected on website origins.

## Queries and writes

GET requests send `X-Correlation-ID`, preferably a fresh UUID. Signed-in requests use
`credentials: "include"`. POST mutations also send:

```http
Content-Type: application/json
X-CSRF-Token: <token from session bootstrap>
X-Idempotency-Key: <unique logical write identifier>
X-Correlation-ID: <request UUID>
```

Idempotency keys must be 8–200 characters. Reuse a key for a retry of the same logical
mutation with the same body; create a new key for a new action or changed body. The backend
records mutation outcomes. Do not blindly retry writes after an indeterminate result.

```ts
const result = await api.request(`/api/miniapp/tournaments/${id}/register`, {
  method: "POST",
  body: {},
});
```

For versioned edits, send the most recently projected `expected_version`. Version names
on resources vary (for example lobby `version`, tournament `settings_version`, or
`navigation_version`); follow the response types and the current screen's request builder.
On `stale_write`, reload and let the user review current values before saving again.

## Refresh and logout

`POST /api/miniapp/session/refresh` takes `{}` and normal mutation headers. It extends the
session and returns `csrf_token`, `expires_at`, and `locale`. Website CSRF tokens remain stable
across refreshes and tabs; the browser retains its current viewer projection. The API client
refreshes when less than a minute remains, or retries once following a 401.

If restoration fails after refresh, the client drops its identity and uses anonymous reads.
It never retries a mutation anonymously. `POST /api/website/logout` takes `{}` and normal
mutation headers, revokes the server session, deletes its cookie, and returns `{"ok":true}`.
`GET /auth/bot` redirects to the bot for registration, gameplay, or document delivery.

## Errors

```json
{"error":{"code":"stale_write","message_key":"...","retryable":false,"correlation_id":"..."}}
```

Adapter errors may omit `message_key` and `correlation_id`. Use `error.code` and localized
messages; never display raw exception text. Common statuses:

| Status/code | Handling |
| --- | --- |
| 401 `authentication_required` | Restore session or show login |
| 403 `origin_not_allowed` | Check website origin configuration and proxy Host preservation; signing in will not help |
| 403 `forbidden` | No permission or failed CSRF check |
| 404 `not_found` | Missing or inaccessible resource |
| 409 `stale_write` | Reload current version |
| 409 `idempotency_conflict` | Key was reused with different request data |
| 409 `request_in_progress` | Check/retry the same logical request as appropriate |
| 400 `validation_failed` | Correct inputs |
| Other stable codes | Follow `retryable`; show a localized error |

The server can map some gateway failures to 400 even when the code describes a server-side
problem. Interpret the stable code as well as the HTTP status. The client also synthesizes
`network` and `invalid_response` errors. An aborted request is not shown as an application error.

API responses use `Cache-Control: no-store`. Session credentials belong in memory/HTTP-only
cookies, never local storage. Do not log callback query strings, cookies, CSRF values,
real names, or private registration details. See [backend integration](backend-integration.md)
for domain and callback logging requirements.
