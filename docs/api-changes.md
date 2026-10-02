# Backend contract additions since 2026-09-15

The bundled `api/http-routes.json` and `api/request-models.json` are separation-date
snapshots. These newer operations are used by this website and are implemented by the
shared SITG HTTP adapter. All use the website session and existing CSRF, idempotency,
correlation, and permission checks.

| HTTP operation | Website use |
| --- | --- |
| `GET /api/miniapp/routes/resolve?path=/tournaments/{id}` | `TournamentProfileResource`; public or authorized private profile |
| `GET /api/miniapp/routes/resolve?path=/chats/{id}/schedule` | `TournamentChatResource`; participant schedule |
| `GET /api/miniapp/routes/resolve?path=/authors/link` | `AuthorLinksResource`; own author link requests |
| `GET /api/miniapp/authors?query=...` | `AuthorSearchPage` for the author picker |
| `POST /api/miniapp/authors/link` | `author_id`, optional `note`; request an author link |
| `POST /api/miniapp/chats/{id}/game-time` | `planned_at` ISO timestamp or `null`; replace/remove shared advisory time |
| `POST /api/miniapp/manager/tournaments/{ref}/existing-packets/preview` | `packet_id`; preview another managed packet |
| `POST /api/miniapp/manager/tournaments/{ref}/existing-packets/add` | `packet_id`, `expected_version_id`; add the previewed version |
| `POST /api/miniapp/manager/tournaments/{ref}/packet-access` | `right: library_viewing_rule`, `library_viewing_rule: never|after-play|anytime`, `assignment_id`, `expected_version` |
| `POST /api/miniapp/admin/management/link_requests/{id}/{approve|reject}` | `approve` boolean; review an author link request |
| `POST /api/miniapp/admin/management/authors/{id}/merge` | `merge_author_id`, `confirm: true`; permanently join authors |

Route projection fields used by the UI are typed in [`src/api/types.ts`](../src/api/types.ts).
The existing settings POST also accepts `description` and the
`library_viewing_rule_default` policy descriptor. The packet theme editor accepts
`commentary`; player placement statistics can include fractional places.

## Verified additions — 2026-10-02

Checked against the current sister-project HTTP adapter, contracts, services, and Mini App.
The 2026-09-15 JSON snapshots remain historical; these notes extend them.

| Operation | Contract |
| --- | --- |
| Route resolution: `/authors` | Registered-player catalogue; `AuthorsResource`, public name and tournament/question counts |
| Route resolution: `/authors/{id}` | `AuthorProfileResource`, aggregate and per-value finalized SI statistics; no private author metadata |
| Route resolution: `/admin/management?section=ongoing_games` | Admin-only games in lobby/active status, host, participants, settings, and timing |
| `POST /api/miniapp/manager/tournaments/{ref}/subscriptions` | `expected_version`, `command`, `values`; returns authoritative management resource |
| `POST /api/miniapp/admin/management/tournaments/{id}/rating_weight` | `expected_version`, `weight` from 0.1 to 1; website slider step 0.05 and explicit save |

Subscription `create` values: `name`, positive integer `packet_count` or `null` for unlimited,
and `discoverable`, `readable`, `playable` as boolean or `null` for inherited defaults.
`assign` takes `card_id` and `player_id`; `revoke` takes `subscription_id`. Management
advertises the `subscriptions` section/action for Ladder. Revocation affects future packets;
ordinary library release, viewing rules, and exposure restrictions still apply.

Existing manager settings writes now include `organizer_contacts`, `channel`, and
`registration_requirements: [{kind, target_id, failure_message}]`. Requirement kinds are
`has-played-tournament`, `has-not-played-tournament`, and `has-not-seen-packet`. The entire
list is replaced atomically. Public tournament general details include contacts/channel.

Classic configuration accepts `stage_type: swiss`, `round_count`, and `players_per_game`
through the existing versioned `/classic` command. Swiss standings include
`opponent_place_sum`. Seeding accepts `mode: automatic` with `strategy: best` or `average`,
`mode: random`, or `mode: manual` with `seeds`. Scheme `opening_games` maps play-off seats.
CSV files are client-side previews only; manual saves use the same versioned operation.

Game settings support `theme_count: "max"`; Classic uses the entire assigned packet.
New policy descriptors include `packets_per_lobby`, `auto_approve_registrations`, and
`member_uploads`. Descriptors/capabilities remain authoritative. Packet questions can
include `rejected_answers: string[]` in the editor and reader; published changes require
an explicit correction/substitution classification. Library packets now expose
`fresh_play_unit_count` and `total_play_unit_count` for the current viewer.

Previously pending website fields are implemented by the current backend:

- **Directory ordering:** `supported_orders` advertises name, rating, and game-count ordering
  in both directions. Ordering happens before pagination on the complete filtered result.
- **SI aggregates:** optional `si_statistics` provides `average_normalized_score` and
  `buzz_times: [{value, average_seconds, samples}]` on canonical 10–50 values. Missing
  measurements remain unavailable; the website does not calculate them from recent games.
- **History packet names:** optional `packets` appears in recent games and game details.
  Null names are withheld, missing/null lists are unavailable, and an empty list means no
  packets. Labels grant no content access.
- **Historical participant ratings:** optional `global_rating_after` and
  `tournament_rating_after` are settlement snapshots, with tournament visibility enforced
  by the backend. Missing snapshots are never replaced with current ratings.

## Remaining backend limitation

Profiles expose recent `games` without history pagination. Website search/sort applies only
to returned entries. Full-history queries require a backend contract with stable pagination
and existing privacy projections. Game duration is unavailable; played time is a timestamp.
