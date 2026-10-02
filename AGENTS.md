# Website development

This is the independent SITG website frontend. Start with `README.md` and `docs/architecture.md`.
The `docs/` guides, `api/` snapshots, and `src/api/types.ts` document server communication locally.

- Keep this project independently buildable. Do not import frontend files from the bot or Mini App,
  add parent-directory symlinks, or add build steps that copy their code.
- Use relative HTTP API URLs through the website's own domain. `/api/miniapp/...` is a historical
  backend API prefix, not a dependency on Mini App UI.
- Keep credentials server-side and permissions authoritative on the backend. Preserve CSRF,
  idempotency, version checks, and fresh-content confirmations.
- Follow the existing TypeScript/DOM approach unless a redesign is explicitly requested.
- Keep documentation concise and update the local contract notes when changing integrations.
- Use apply_patch for edits. Run targeted tests first, then `npm run build` for frontend changes.
