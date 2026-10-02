# SITG website

[Русский](README.md)

The SITG web interface for players, authors, and tournament organizers.

## Features

- Player search, ratings, statistics, and game results.
- Tournament discovery, registration, schedules, and standings.
- Author catalogue and question performance statistics.
- Question packet library and reader for accessible content.
- Management of tournaments, participants, packets, stages, and subscriptions.
- Tournament, player, and author administration.

The website supports Russian and English. Public player and tournament pages are available
without signing in; personal actions require Telegram login and the appropriate permissions.
Gameplay, account registration completion, and DOCX delivery take place in Telegram.

## Documentation

- [Feature guide](docs/features.md) (Russian) — website sections, access, and limitations.
- [Architecture](docs/architecture.md) — project structure and responsibilities.
- [Backend integration](docs/backend-integration.md) — domains and Telegram integration.
- [Authentication and requests](docs/communication.md) — sessions, permissions, and errors.
- [Read API](docs/api-reads.md) and [Mutation API](docs/api-mutations.md) — API reference.
- [API contract additions](docs/api-changes.md) — changes since the original schema snapshots.

The feature guide is in Russian; technical documentation is in English.
