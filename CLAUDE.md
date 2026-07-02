# CLAUDE.md — zeus-sdk

Public JS client for the Zeus Console API, published as `@zeusk8s/sdk`. Works in the browser
(session-cookie auth) and Node.js (license-key auth, `X-License-Key`). Consumed by
`zeus-console-ui`, `zeus-console-api`, and Zeus instances via `file:../sdks/zeus-sdk` in dev.
Read `/workspace/code/zeus-project/CLAUDE.md` first. Branch from `dev`.

## Shape

```
src/
  index.js       — ZeusConsoleSDK: constructs one service per surface, sets baseURL/token/privateKey
  base.js        — BaseSDK: _fetch() (only transport), setToken(), debug(), subscribe() (SSE)
  generateId.js  — prefixed IDs via Web Crypto (browser + Node 19+)
  services/      — auth, instances, orgs, billing, users, support, audit, notices, sso, email,
                   cors, permissions, consoletokens, help, forum
```

No build step, no test runner (`npm test` is a stub), no lint config. Validate with `node --check`.

## Shared code — extend, don't duplicate

- **Transport:** all requests MUST go through `BaseSDK._fetch()` in `src/base.js`. Never call
  `fetch` directly from a service.
- **IDs:** use `generateId()` / `ENTITY` from `src/generateId.js`, not ad hoc prefixes.
- **SSE:** `sdk.subscribe(channel, handler)` in `base.js` is the one realtime primitive; add new
  event types to its listener list, don't build a second EventSource path.
- **Request signing:** instance→console signed requests go through `_resolveKey()`/`_sign()` in
  `base.js` (RS256, `X-Zeus-Signature`). Don't reimplement signing in a service.

## Adding / changing a method

- One service class per API prefix; methods are thin wrappers:
  ```js
  async list({ status } = {}) { return this.sdk._fetch('/instances', 'GET', { query: { status } }); }
  async get({ id })           { return this.sdk._fetch(`/instances/${id}`, 'GET'); }
  ```
- Method name + endpoint must match the API route 1:1. Add the route in `zeus-console-api` first.
- New service → register the import + constructor line in `src/index.js` (both the JSDoc
  "Services" list near the top and the class body) and add its file under `src/services/`.
- **Keep the JSDoc** — it's the package's only docs (params, return shape, `@example`).
- Admin/spam/platform-ops surfaces do NOT go here — they live in `@zeusk8s/sdk-internal`
  (`sdk.internal.*`), never distributed to customers.
- Files carry `// @ts-nocheck`; keep it.
- `file:`-linked in dev — changes are live in the UI/API immediately, no publish needed.

## Gotchas

- Errors from `_fetch` are enriched, not just thrown strings: `err.status`, `err.body`,
  `err.endpoint`. Preserve this shape in any new transport-level code.
- `credentials: 'include'` is always set — this is what makes browser cookie auth work. Don't
  strip it when customizing fetch options.
- Query params with `null`/`undefined` values are filtered out automatically in `_fetch`; don't
  pre-filter in service methods.
