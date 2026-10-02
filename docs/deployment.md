# Deployment and domains

## Production layout

Use two different hostnames, for example:

| Host | Serves |
| --- | --- |
| `website.example.com` | This project's `dist/`; proxies `/api/` and `/auth/` to the backend |
| `mini-app.example.com` | Mini App assets and HTTP API from the backend |
| `127.0.0.1:8080` | Private SITG HTTP listener behind the reverse proxy |

The website's static assets are deployed independently. Do not point its document root at
the Mini App's `web/dist`. The backend refuses to serve Mini App static files when addressed
using a configured website Host. Both frontends can share the same backend listener and data.
There is no separate website database.

`deploy/nginx.conf.example` contains the two virtual hosts. Replace the hostnames, certificate
paths, and website document root before use. Provision DNS and valid TLS certificates separately.
Copy the website `dist/` contents into the configured document root.

```bash
npm ci
npm test
npm run build
```

Publish new hashed assets before replacing `index.html`; retain previous assets long enough
for open browser sessions. HTML should revalidate; hashed assets can be cached immutably.
Never use the SPA fallback for unknown `/api/` or `/auth/` requests.

## Backend configuration

The backend release must include website login and separate-domain configuration. Configure
these in the **backend process environment**, not in this project's Vite environment:

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | Backend PostgreSQL SQLAlchemy/asyncpg connection URL |
| `BOT_TOKEN` | Existing Telegram bot token; server-only secret |
| `APPLICATION_SECURITY_KEY` | At least 32 characters; signs sessions and launch references |
| `SITG_APPLICATION_CLIENT_TOKEN` | Shared bot/server transport credential; server-only |
| `TELEGRAM_ENVIRONMENT` | `production` or `test`, matching the bot |
| `MINI_APP_HOST` | HTTP bind address, normally `127.0.0.1` |
| `MINI_APP_PORT` | HTTP listener port, normally `8080`; enables the HTTP adapter |
| `MINI_APP_ALLOWED_ORIGINS` | Exact Mini App origins, e.g. `["https://mini-app.example.com"]` |
| `WEBSITE_ALLOWED_ORIGINS` | Exact website origins, e.g. `["https://website.example.com"]` |
| `MINI_APP_WEB_DIST` | Backend's Mini App asset directory, never this website's `dist/` |
| `MINI_APP_BASE_URL` | Bot's Mini App launch URL on the Mini App domain |

The origin settings accept JSON arrays or comma-separated lists. Website login is disabled
when `WEBSITE_ALLOWED_ORIGINS` is empty. Website and Mini App hostname sets must not overlap,
even if their ports differ: cookies are scoped by host, not port. Sessions also enforce exact
scheme/host/port binding. Neither proxy should rewrite Origin to bypass these checks.

The backend CLI supports the equivalent options:

```bash
sitg-server --mini-app-port 8080 \
  --mini-app-allowed-origins '["https://mini-app.example.com"]' \
  --website-allowed-origins '["https://website.example.com"]'
```

`sitg-server` reads exported environment variables and does not automatically load `.env`.
Its database, migrations, bot process, and durable delivery workers must be provisioned by
the backend operator. This frontend does not install or migrate the server.

## Telegram login

Link **the website domain** to the existing bot with BotFather's `/setdomain` command for
the Telegram login widget. Keep the bot's Mini App URL on the separate Mini App domain.
The login page is served from `/auth/telegram`, and the callback from `/auth/telegram/callback`.
Both paths must reach the backend under the original website Host, including any nonstandard
port. The server obtains the bot username itself; no token belongs in this repository.

After deployment, verify sign-in on the real HTTPS domain, page reload/session restoration,
logout, public browsing, and a manager-only page. Signing into the website must not sign into
the Mini App automatically. Do not record callback query strings in proxy access logs.

## Local development

Use `http://localhost:5174` for this website and `http://127.0.0.1:5173` for Mini App development
if running both. These use different cookie hostnames. The website preview origin is
`http://localhost:4174`. Add the relevant exact origins to their respective backend settings.

Only `SITG_WEBSITE_API_TARGET` belongs in the website's optional `.env.local`:

```dotenv
SITG_WEBSITE_API_TARGET=http://127.0.0.1:8080
```

Both Vite servers proxy `/api` and `/auth`, preserving Host. Non-local authentication origins
require HTTPS. Local HTTP preview can browse public data; use a real configured HTTPS domain
for end-to-end Telegram sign-in. Do not put Telegram `initData`, a bot token, signing keys,
or database credentials in browser configuration.

## Troubleshooting

- **Network error / proxy refused:** start the backend HTTP listener and check the proxy target.
- **401 on session bootstrap:** expected for a guest.
- **403 `origin_not_allowed`:** verify the running backend's website origins and ensure the
  proxy preserves Host, including its port. Same-origin GETs may omit Origin and Referer.
- **Login appears but callback fails:** verify BotFather domain, HTTPS cookies, exact Host,
  callback routing, and the backend's bot token/environment.
- **Website shows Mini App UI:** the website virtual host is serving the wrong asset directory.
- **403 on an action:** check the account's current permissions and CSRF token; a manager URL
  or visible button cannot grant access.
- **Refresh of a nested page returns 404:** configure the static SPA fallback to `index.html`.
