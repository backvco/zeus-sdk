// @ts-nocheck
// zeus-sdk/src/services/support.js
export class SupportService {
  constructor(sdk) { this.sdk = sdk; }

  grantAccess({ durationHours }) { return this.sdk._fetch('/support/grant', 'POST', { body: { durationHours } }); }
  revokeGrant({ grantId }) { return this.sdk._fetch(`/support/grant/${grantId}`, 'DELETE'); }
  listMyGrants() { return this.sdk._fetch('/support/grants', 'GET'); }
  endSession({ sessionId }) { return this.sdk._fetch(`/support/sessions/${sessionId}/end`, 'POST', { body: {} }); }
}
