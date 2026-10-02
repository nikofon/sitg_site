# Mutation API

All paths below are prefixed by `/api/miniapp` unless stated otherwise. Use POST JSON with
the session cookie, CSRF, idempotency, and correlation headers described in
[Communication](communication.md). Authentication endpoints are documented there separately.

The 2026-09-15 validation models are bundled in [`api/request-models.json`](../api/request-models.json);
newer operations are recorded in [contract additions](api-changes.md).
Each entry under `models` is an independent JSON Schema. For an operation referenced below,
omit `action` and IDs supplied by the URL when building the HTTP JSON body. Those fields are
assigned by the adapter. Never send a gateway `metadata` or `operation` wrapper to an HTTP
endpoint. Required fields, enums, numeric bounds, defaults, and nested structures are in
the schemas; response shapes used by screens are in [`src/api/types.ts`](../src/api/types.ts).

## Registration and navigation

| POST path | JSON body / operation |
| --- | --- |
| `/tournaments/{id}/register` | `{}`; `TournamentRegisterOperation` |
| `/tournaments/{id}/select` | `mode: player|manager`, `expected_version`; `NavigationTournamentSetOperation` |
| `/ongoing/lobbies/join` | `invitation_code`, optional `role: player|observer`, `confirm_fresh`; `LobbyJoinOperation` |
| `/ongoing/games/{id}/observe` | Optional `confirm_fresh`; `GameObserveOperation` |

Registration returns `TournamentRegistrationPayload`: inspect `accepted` and `reasons`,
not just the HTTP status. Selecting a tournament changes the user's Telegram context and
can notify the bot; use the listing's `navigation_version`. The website's Manage button
opens its management page directly instead of performing a Telegram context change.

Join/observe operations recheck participation and packet exposure. Successful gameplay
handoffs navigate to `/auth/bot`; the bot handles game interaction and durable replay.

## Tournament management

The common prefix here is `/manager/tournaments/{ref}`. `{ref}` can be a tournament UUID
for website navigation or an existing actor-bound manager launch reference. Every operation
still checks the current manager role for that tournament.

| POST suffix | Body and validation model |
| --- | --- |
| `/settings` | `TournamentManagerSettingsUpdateOperation` without `action`/`tournament_id` |
| `/authors` | `first_name`, `surname`; optional `second_name`, `telegram_link`; `TournamentAuthorCreateOperation` |
| `/finalize` | `expected_version`; `TournamentFinalizeOperation` |
| `/registration-availability` | `expected_version`, `registration_open`; `TournamentRegistrationOverrideOperation` |
| `/registrations/{player_id}` | `decision: approve|reject`; `TournamentRegistrationDecideOperation` |
| `/packet-access` | `assignment_id`, optional `player_id`, `right`; `enabled` for read/play/discovery rights or `library_viewing_rule: never|after-play|anytime`; `TournamentPacketAccessUpdateOperation` |
| `/existing-packets/preview` | `packet_id`; preview metadata before adding |
| `/existing-packets/add` | `packet_id`, `expected_version_id`; add the previewed version |
| `/start` | `expected_version`; `TournamentStartOperation` |
| `/complete` | `expected_version`; `TournamentCompleteOperation` |
| `/classic` | `expected_version`, `command`, `kind`, optional `values`; `TournamentClassicUpdateOperation` |
| `/subscriptions` | `expected_version`, `command` (`create`, `assign`, `revoke`), `values`; see [current contract notes](api-changes.md) |

Settings saves send the full typed form: name, slug, description, type/ruleset keys, visibility, language,
payment type, pricing plans, registration controls/dates, authors, defaults, mutability,
policies, and `expected_version`. The schema marks required fields. Do not invent policy
keys or change protected rating weights; use the returned descriptors and existing editors.
Date strings must include timezone information. `/authors?return_author=true` asks for the
created author projection so an editor can add it to its selection.

Packet rights are `playable`, `discoverable`, or `readable`. A null/omitted `player_id` applies
the corresponding assignment default for all players. Per-player overrides use a UUID.
Classic stage controls and mutability depend on the tournament's state. Use the `command`,
`kind`, and nested `values` definitions in the schema rather than sending arbitrary JSON.
The library viewing rule applies only to readable, released packets; it does not affect
playability. Its policy default applies to future uploads.

Example finalization:

```ts
await api.request(`/api/miniapp/manager/tournaments/${tournamentId}/finalize`, {
  method: "POST",
  body: { expected_version: settings.settings_version },
});
```

Reload management/settings after success. Ask the user to confirm impactful operations
such as finalization, completion, stage starts, and changes that affect existing players.

## Managed packets and drafts

For published tournament packets, prefix paths with
`/manager/tournaments/{ref}/packets/{assignment_id}`:

| POST suffix | Body |
| --- | --- |
| `/save` | `expected_version`, `content`, `changes`, `field_author_ids`; `PacketManagementUpdateOperation` |
| `/delete` | `expected_version`; `PacketManagementActionOperation` |
| `/release` | `expected_version`; `PacketManagementActionOperation` |

Published content uses revisions and classified edits. The `changes` and author mappings
are validated atomically by the backend. Delete retires the tournament assignment according
to current policy; do not assume it destroys the globally shared packet.

Draft paths use `/manager/packets/{launch_ref}`. Draft references are opaque and actor-bound:

| POST suffix | Body |
| --- | --- |
| No suffix | `expected_version`, `content`; optional `author_bindings`, `lead_author_id`; `PacketDraftUpdateOperation` |
| `/authors` | `first_name`, `surname`; optional `second_name`, `telegram_link`; `PacketDraftAuthorCreateOperation` |
| `/publish` or `/reject` | `{}`; `PacketDraftDecisionOperation` |

There is no browser packet-upload endpoint in this HTTP contract. The existing editor opens
drafts that have already been created through supported backend/bot workflows.

## Library and exposure confirmation

`POST /library/{version_id}/view` and `/download` accept `{ "confirm": false }`
(`LibraryAccessOperation`). A response with `confirmation_required: true` is an intermediate
result: explain that reading permanently consumes fresh content eligibility and ask for consent.
Only then send a new request with `confirm: true` and a new idempotency key.

View returns `LibraryAccess` reader data with ruleset-defined pages. Download returns
`queued: true`; it queues a DOCX to the signed-in user's Telegram account. It does not stream
a file to the browser. Both commands recheck access on every request.

## Lobbies

All lobby mutation URLs are `/lobbies/{launch_ref}/{command}`. Every body includes the current
`expected_version` from `LobbyResource.version`:

| Command | Additional body fields / model |
| --- | --- |
| `ready` | `ready`; `LobbyReadyUpdateOperation` |
| `role` | `role`, optional `confirm_fresh`; `LobbyRoleUpdateOperation` |
| `settings` | `changes`; `LobbySettingsUpdateOperation` |
| `packet-select`, `packet-remove` | `packet_id`; `LobbyPacketOperation` |
| `leave`, `cancel`, `start`, `search-start`, `search-cancel` | None; `LobbySimpleMutationOperation` |

Use `available_actions` and `mutable_parameters` from the current lobby projection. On a
successful write, reload the lobby; on stale version, discard the stale form and reload.
Leave/cancel/start may change the user's Telegram context or transition to native gameplay.

## Administration

Only an active platform administrator may call these endpoints. Prefix the table paths with
`/admin/management`:

| POST suffix | Body / validation model |
| --- | --- |
| `/tournaments/{id}/{halt|resume|abolish}` | `expected_version`, `confirm`; `AdminTournamentModerateOperation` |
| `/tournaments/{id}/rating_weight` | `expected_version`, `weight` (0.1–1); `AdminTournamentRatingWeightOperation` |
| `/authors/{id}/link` | `target` (player UUID or `@username`); `AdminAuthorLinkOperation` |
| `/authors/{id}/merge` | `merge_author_id`, `confirm: true`; `AdminAuthorMergeOperation` |
| `/link_requests/{id}/{approve|reject}` | `approve: boolean`; `AuthorLinkAdminDecideOperation` |
| `/players/{id}/ban` | Optional `reason`; `PlayerBanOperation` |
| `/players/{id}/unban` | `{}`; `PlayerUnbanOperation` |
| `/packets/{version_id}/{view|download}` | Optional `confirm`; `AdminPacketAccessOperation` |

`POST /admin/suspicion/ledger/{player_id}/clear` accepts `note` and uses
`AdminSuspicionClearOperation`. Inspection and a review note precede clearance; history remains
in the ledger. Administrator packet reads bypass normal library restrictions but still require
fresh-content confirmation and can permanently affect that administrator's eligibility.

Use explicit confirmation and warning/danger styling for restrictive or destructive actions.
Admin projections contain sensitive data; keep them out of public state, analytics, and logs.
