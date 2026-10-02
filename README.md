# SITG website

An independent browser frontend for SITG. This project owns its entry point, navigation,
styles, translations, API client, tests, and build. It has no runtime imports, symlinks,
workspace dependencies, or Telegram Mini App SDK dependency on the bot project.
The initial feature screens were copied when the frontends were separated; future changes
to either frontend do not automatically change the other.

## Run locally

Install Node.js and npm, then run from this folder:

```bash
npm ci
npm run dev
```

Open **http://localhost:5174**. The Vite server proxies `/api` and `/auth` to
`http://127.0.0.1:8080`. Set `SITG_WEBSITE_API_TARGET` in `.env.local` if the backend
listens elsewhere. The frontend does not start or embed the backend.

The backend operator must add `http://localhost:5174` to `WEBSITE_ALLOWED_ORIGINS`.
If opening `http://127.0.0.1:5174`, add that exact origin too. Restart the backend
with the updated environment; an unlisted origin returns `403 origin_not_allowed` even for
public pages. The proxy must preserve Host, including its port, because same-origin GETs
may omit Origin and Referer. Vite's string proxy shorthand rewrites Host; use
`{ target, changeOrigin: false }` for both `/api` and `/auth`.
Without the backend, the shell can load but data requests cannot succeed.
Public Players and Tournaments work without signing in. Telegram login requires a
deployed HTTPS website domain linked to the bot; localhost preview is for public browsing.

```bash
npm test
npm run build
npm run preview
```

Preview serves the production build at **http://localhost:4174**, with the same API proxy.
Add that origin to the backend allowlist when using preview. `dist/` is the production
artifact; do not deploy the Vite development or preview server as the public service.

## Features

- Sidebar buttons for Players, Tournaments, and Library; login/logout at the top right.
- Players filtered by ruleset, public name, and ordering, with pagination. Only players
  with at least two settled games in that ruleset appear. Cards show rating and game count.
- Public profiles and results, personal profile, private tournament access after login.
- Full-width layout and tournament section buttons for Classic groups/rounds, standings, and registrations.
- Player General/History sections; search and sort the available recent games.
- Compact game results with every theme in one horizontally scrollable table.
- Library reader, tournament registration, lobby views, and ongoing games.
- Author link requests and participant chat scheduling for signed-in users.
- Permission-checked tournament settings, registrations, packets, Classic stages, and administration.
- Author catalogue and performance statistics; Ladder subscription creation, assignment, and revocation.
- Swiss stages and desktop seeding across groups, with player search and CSV import/export.
- Admin ongoing-game monitoring and explicit rating-weight saves; packet freshness sorting.
- Russian and English rendering, based on the server's locale projection.

Gameplay, account registration completion, and queued DOCX downloads still use Telegram.
Some legacy route identifiers are placeholders; the route inventory documents their status.

## Documentation

- [Architecture and development](docs/architecture.md): ownership, code map, feature workflow.
- [Deployment](docs/deployment.md): independent domains, backend configuration, reverse proxy.
- [Communication and authentication](docs/communication.md): cookies, CSRF, errors, retries.
- [Read API](docs/api-reads.md): routes, filters, response shapes, privacy.
- [Mutation API](docs/api-mutations.md): request bodies, commands, versions, confirmation.
- [HTTP route inventory](api/http-routes.json): backend routes at the 2026-09-15 snapshot.
- [Request schemas](api/request-models.json): server validation models at that snapshot.
- [Response types](src/api/types.ts): local TypeScript payload definitions used by this client.
- [Contract additions](docs/api-changes.md): backend operations added after the 2026-09-15 snapshots.
- [Feature comparison](docs/feature-parity.md): 2026-10-02 backend/Mini App review and desktop adaptations.

These documents and snapshots are self-contained. You do not need the bot project's
documentation to work on the website. API snapshots describe the backend contract at
separation, dated **2026-09-15**; coordinate contract changes with the backend owner.
