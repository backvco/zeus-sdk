# CLAUDE.md — zeus-sdk

Public JavaScript client for the Zeus Console API. Works in the browser (session-cookie auth) and
Node.js (license-key auth). Consumed by the UI, the API, and Zeus instances via `file:../zeus-sdk`.
Read `/docker/zeus-console/CLAUDE.md` first. Branch from `dev`.

## Shape

```
src/
  index.js       — ZeusConsoleSDK: constructs one service per surface, sets baseURL/token
  base.js        — BaseSDK._fetch(endpoint, method, { body, query, headers }) — the only transport
  generateId.js  — prefixed IDs (Web Crypto — works in browser AND Node 19+)
  services/      — auth, instances, orgs, billing, users, support, audit, notices
```

- **Browser:** no token; the session cookie is sent via `credentials: 'include'`.
- **Server / instance:** pass `token` (license key) → sent as `X-License-Key`.
- Errors throw enriched: `err.status`, `err.body`, `err.endpoint`.

## Adding / changing a method

- One service class per API prefix; methods are thin wrappers:
  ```js
  async list({ status } = {}) { return this.sdk._fetch('/instances', 'GET', { query: { status } }); }
  async get({ id })           { return this.sdk._fetch(`/instances/${id}`, 'GET'); }
  ```
- Method name + endpoint must match the API route 1:1. Add the route in `zeus-console-api` first.
- **Keep the JSDoc** — it documents params/return shape and is this package's only docs.
- Admin/spam surfaces do NOT go here — they live in `zeus-sdk-internal` (`sdk.internal.*`).
- Files carry `// @ts-nocheck`; keep it.
- `file:`-linked, so changes are live in the UI/API immediately — no publish needed in dev.
