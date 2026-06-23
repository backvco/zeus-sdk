# @zeusk8s/sdk

Official JavaScript client for the **Zeus Console API** — the SaaS control plane for Zeus
(account management, billing, licensing, instances, orgs, users, support, audit).

Works in the browser (session-cookie auth) and Node.js (license-key auth).

## Install

```sh
npm install @zeusk8s/sdk
```

## Usage

```js
import { ZeusConsoleSDK } from '@zeusk8s/sdk';

// Browser — session cookie sent automatically
const sdk = new ZeusConsoleSDK({ baseURL: '/api' });
await sdk.instances.list();

// Node / instance — license key
const sdk = new ZeusConsoleSDK({ baseURL: 'https://api.example.com/api', token: LICENSE_KEY });
await sdk.instances.get({ id });
```

Service surfaces: `auth`, `instances`, `orgs`, `billing`, `users`, `support`, `audit`, `notices`.

Errors throw enriched with `err.status`, `err.body`, `err.endpoint`.

Admin/spam surfaces are not in this package — they live in the private
`@zeusk8s/sdk-internal` extension (`sdk.internal.*`).
