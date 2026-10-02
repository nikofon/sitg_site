# Read API and resource projections

All API URLs below use the website's own origin. The `/api/miniapp` prefix is a retained
server API name, independent of frontend ownership. Response fields are defined locally in
[`src/api/types.ts`](../src/api/types.ts). The [HTTP inventory](../api/http-routes.json)
lists registered paths; [request schemas](../api/request-models.json) describe validation.

## Route resolver

`GET /api/miniapp/routes/resolve?path=<encoded path including query>` returns a projection.
The `path` parameter is a relative server resource-route identifier, not an arbitrary URL.
Always encode the entire nested path once:

```ts
const path = "/players?ruleset=si&search=Alice&order=name_asc&limit=20";
const payload = await api.request<RoutePayload>(
  `/api/miniapp/routes/resolve?path=${encodeURIComponent(path)}`,
);
```

Envelope:

```json
{
  "locale": "en",
  "authorization": {"allowed": true},
  "resource": {"kind": "players", "state": "ready", "items": []},
  "pagination": {}
}
```

This is a shortened example: fields depend on `resource.kind`. Check `authorization.allowed`
even for a successful HTTP status. Unknown routes may return an envelope with
`allowed: false`, `reason_code: "not_found"`, and an empty resource.

| Nested route | Resource type / access |
| --- | --- |
| `/players` | `PlayersResource`; public |
| `/players/{player_id}` | `PlayerProfileResource`; public with viewer-dependent identity |
| `/players/{player_id}/games/{game_id}` | `PlayerGameResource`; public result grid |
| `/tournaments` | `TournamentRouteResource`; public/membership/management discovery |
| `/tournaments/{tournament_id}` | `TournamentProfileResource`; permission-aware details, registrations, Classic participants, games, leaders |
| `/chats/{chat_id}/schedule` | `TournamentChatResource`; chat participants |
| `/authors/link` | `AuthorLinksResource`; the signed-in player's requests |
| `/authors` | `AuthorsResource`; registered-player catalogue with public counts |
| `/authors/{author_id}` | `AuthorProfileResource`; registered-player aggregate question statistics |
| `/library` or `/library/{version_id}` | `LibraryResource`; login required; opening a reader uses a separate POST |
| `/ongoing` | `OngoingResource`; active membership/manager scope |
| `/lobbies/{launch_ref}` | `LobbyResource`; actor-bound reference and current permissions |
| `/manager/tournaments/{ref}/settings` | `TournamentManagerSettingsResource`; manager |
| `/manager/tournaments/{ref}/management` | `TournamentManagerManagementResource`; manager |
| `/manager/packets/{launch_ref}/edit` | `PacketDraftResource`; authorized packet editor |
| `/admin/management?section=tournaments` | `AdminManagementResource`; administrator |
| `/admin/suspicion` | `AdminSuspicionLedgerResource`; administrator |

Website `/` maps to `/tournaments`. Legacy client routes `/history`,
`/reports/{ref}`, and `/manager/appeals` are not implemented by the current HTTP resolver;
do not advertise them as working features. UI paths can evolve independently as long as
the client requests supported server resource identifiers.

## Player directory and profiles

Directory query fields:

| Field | Contract |
| --- | --- |
| `ruleset` | Ruleset key; defaults to `si` if registered, otherwise the first registered key |
| `search` | Public-name substring, case-insensitive; max 200 characters |
| `order` | `name_asc` (default), `name_desc`, `rating_asc`, `rating_desc`, `games_asc`, `games_desc`; use advertised `supported_orders` |
| `offset` | Integer 0–1,000,000; default 0 |
| `limit` | Integer 1–100; default 20 |

`PlayersResource` contains `rulesets: [{key,name}]`, `ruleset_key`, `total`, `next_offset`,
and `items: [{id,label,rating,games}]`. Only active accounts with a public name and more than
one settled game in the selected ruleset appear. Counts span versions of the same ruleset
key. Rating is the global rating for that key, with the server's default if no rating row exists.
Search never searches private identity fields. Unknown ruleset keys return validation errors.

Use `next_offset` to advance; reset the offset after changing ruleset, search, or ordering.
The player profile accepts `ruleset` too. Link to the same selected ruleset when opening a
directory player. Profile ruleset choices contain only keys with at least one settled result.

Direct GET alternatives return the unwrapped resource data without `kind`/`state`:

- `/api/miniapp/players/{player_id}?ruleset=si`
- `/api/miniapp/players/{player_id}/games/{game_id}`

Public profiles include nickname, rating/history, aggregate statistics, and recent game cards.
Real name and non-public Telegram username appear only for self/admin viewers. Private
tournament names are suppressed without membership, manager, or admin access. Game grids
show answer outcomes and values, never question text, answers, or theme names.

The website splits profiles into General and Game history (`?section=general|history`).
History search matches tournament names only; a separate player-count filter offers
Any, 1, 2, 3, 4, and 5+. Filters and ordering apply to the returned recent games only.
Cards and game results display packet names when supplied; cards show participants'
post-game global and applicable tournament ratings. The current backend supplies these
optional history fields and SI aggregates; older responses retain unavailable-state fallbacks.
Game results display all numbered themes in a single scrollable table.
See [verified additions](api-changes.md#verified-additions--2026-10-02) for field semantics.

## Tournaments

Directory fields map to `TournamentListOperation` in the schema snapshot:

| Query | Values/default |
| --- | --- |
| `role` | `player` (default), `manager`, `admin`; never a permission grant |
| `include_managed_public` | Boolean; website sends `true` to include its managed public tournaments |
| `phase` | `upcoming`/`future`, `ongoing`, `past` |
| `relationship` | `discoverable`, `registered`, `approved`, `participating`, `managed` |
| `registration` | `open`, `closed` |
| `type`, `ruleset`, `language` | Optional keys (HTTP names differ from schema `type_key`/`ruleset_key`) |
| `search` | Tournament name/slug; max 200 characters |
| `order` | `starts_asc` (default), `starts_desc`, `name_asc`, `name_desc` |
| `cursor`, `limit` | Opaque cursor; page size 1–100, default 20 |

The resolver returns `pagination.next` when another page exists. Do not parse or manufacture
cursors; reset them when filters change. Guest discovery includes finalized public tournaments
and offers only information actions. Signed-in discovery applies membership and manager scope.

Tournament cards open `/tournaments/{id}` through route resolution. That projection includes
the sections shown by the website; Classic groups and rounds are all rendered on the page.
My tournaments uses `/tournaments?role=manager`.

Manager website URLs use a tournament UUID as `{ref}`. The backend also accepts existing
opaque actor-bound Mini App references. Lobby and draft refs remain opaque, actor-bound,
expiring references; do not substitute their raw resource UUIDs.

## Library, ongoing games, and administration

Library discovery returns readable packet versions and managed tournament packets. Existing
name/author/year filters and freshness sorting apply locally to projected cards. Viewer-specific
fresh/total theme counts come from the backend. Reading/downloading
content is a POST because it can permanently consume fresh-content eligibility.

Ongoing projections provide lobbies and observable games in the viewer's participant/manager
tournaments. There is no browser gameplay WebSocket. Lobby refresh uses
`GET /api/miniapp/lobbies/{ref}/events?after=<sequence>`; use the returned ordered events to
refresh projections. Native gameplay and replay remain in Telegram.

Admin management supports `section=tournaments|authors|players|packets|link_requests|ongoing_games`. Card search/sort is
local to the returned section. Privileged projections can include private identities and
moderation data; do not reuse them in public views or caches.

Additional direct GETs:

- `/api/miniapp/authors?query=...` (author search)
- `/api/miniapp/admin/suspicion/ledger?limit=50`
- `/api/miniapp/admin/suspicion/ledger/{player_id}/events`
- `/api/miniapp/manager/tournaments/{ref}/authors?query=...` (up to 20 results)
- `/api/miniapp/manager/packets/{ref}/authors?query=...` (up to 20 results)
- `/api/miniapp/manager/packets/{ref}` (draft data)
- `/api/miniapp/manager/tournaments/{ref}/packets/{assignment_id}` (managed packet data)

Render current `available_actions`, setting descriptors, and section lists from the server.
Unauthorized reads can return either forbidden or not-found responses to preserve privacy.
