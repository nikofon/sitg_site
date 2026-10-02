# Backend integration

The website is an independent frontend for the shared SITG backend. It has no separate
database or embedded server. Its static assets and the Telegram Mini App's assets belong
to separate hostnames; both clients can use the same backend listener and data.

## Domain boundaries

The website serves its own `dist/` and forwards `/api/` and `/auth/` to the SITG HTTP listener.
Those paths must reach the backend rather than the website's `index.html` fallback.
The [proxy example](../deploy/nginx.conf.example) illustrates this split.

The backend distinguishes the clients through `WEBSITE_ALLOWED_ORIGINS` and
`MINI_APP_ALLOWED_ORIGINS`. These contain exact origins, including scheme and port, as JSON
arrays or comma-separated lists. Website login is disabled if its allowlist is empty.
The hostname sets must not overlap, even on different ports: cookies are host-only,
while sessions are bound to the exact origin. There is no cross-domain single sign-on.

Proxies must preserve Origin and the public Host, including its port. Same-origin GETs
may omit Origin and Referer, so rewriting Host can cause `403 origin_not_allowed` even
for public pages. The Vite proxy likewise uses `changeOrigin: false`; its backend target
is controlled by `SITG_WEBSITE_API_TARGET`.

`MINI_APP_WEB_DIST` identifies the backend's Mini App assets, never the website build.
The backend refuses to serve those assets when addressed using a configured website Host.
Historical `/api/miniapp/...` endpoint names still serve website requests; they do not imply
a dependency on the Mini App frontend.

## Telegram authentication and handoffs

Telegram's login widget uses the website domain registered with the bot through BotFather's
`/setdomain`. The bot's `MINI_APP_BASE_URL` remains on the separate Mini App domain.
`/auth/telegram` and `/auth/telegram/callback` are backend routes under the website's Host.
End-to-end Telegram login requires a configured HTTPS website domain.

The server obtains the bot username and verifies Telegram identity. Bot tokens, signing keys,
database credentials, and internal transport credentials remain server-side. Callback query
strings contain authentication data and must not appear in proxy access logs.

`/auth/bot` hands users back to Telegram for gameplay, account registration completion,
and document delivery. The website does not use Mini App `initData`.
See [authentication and requests](communication.md) for the session lifecycle.
