# Feature review — 2026-10-02

Compared `../SITGBot/docs/mini-app.md`, `tournaments.md`, `packet-administration.md`,
and `data-and-statistics.md` with the current Mini App source and HTTP adapter.
The website owns the adapted implementation; building it requires no sister-project files.

| Added here | Desktop presentation |
| --- | --- |
| Registered-player author catalogue and aggregate SI statistics | Sidebar entry, searchable/sortable cards, identity and statistics columns, scrollable per-value table |
| Ladder subscription templates, assignment, remaining allowances, revocation | Creation, existing templates, and participant management in responsive columns |
| Swiss configuration and opponent-place tie breaker | Round count/game size controls and standings columns |
| Classic automatic strategies, manual seat swapping, CSV import/export | All groups visible by default; optional group filter; searchable seat picker; import previews before explicit save |
| Organizer contacts, channel, registration requirements | Typed settings and public profile details |
| Categorized game settings, all-themes selection, newer policy labels | Settings categories in columns; existing message previews retained |
| Admin ongoing games and global rating-weight updates | Searchable cards with profile links and explicit slider save |
| Packet freshness sorting and unaccepted answers | Wide card grids, selected lobby packets first; reader/editor support for rejected-answer lists |

Existing website-specific player directory, profile sections, all-theme result tables,
browser authentication, and direct tournament profile links remain in place. Mutations use
the existing session, CSRF, idempotency, permissions, and authoritative versions. Fresh-content
confirmation remains required for library reads/downloads and observing games.

The current backend now supplies directory rating/game ordering, optional SI aggregates,
authorized history packet names, and settlement rating snapshots. These were already handled
by the website but incorrectly documented as pending; see [contract notes](api-changes.md).

Native gameplay, registration completion, packet uploads initiated through Telegram, and
queued DOCX delivery remain Telegram workflows. Shared placeholder routes do not gain new
behavior from this update. Complete player-history pagination still lacks a backend contract.
