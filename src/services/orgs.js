// @ts-nocheck
// zeus-sdk/src/services/orgs.js
export class OrgsService {
  constructor(sdk) { this.sdk = sdk; }

  get() { return this.sdk._fetch('/orgs/me', 'GET'); }
  update({ name }) { return this.sdk._fetch('/orgs/me', 'PATCH', { body: { name } }); }
}
