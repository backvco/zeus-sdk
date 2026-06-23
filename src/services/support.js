// @ts-nocheck
/**
 * SupportService — temporary support access grants for the console team.
 *
 * Accessed as `sdk.support`.
 *
 * A "support grant" lets a Zeus Console support agent access your org for a
 * limited time window without knowing your credentials. You create the grant,
 * the agent redeems it (via sdk.admin.redeemSupportCode), and you can revoke
 * it at any time before it expires.
 *
 * Typical flow:
 *   1. grantAccess()   — create a time-limited grant, get a shareable code
 *   2. (share code with support agent — e.g. paste in a ticket)
 *   3. listMyGrants()  — monitor active grants
 *   4. revokeGrant()   — revoke early if the issue is resolved
 *   5. endSession()    — end a specific active support session (if already redeemed)
 */
export class SupportService {
  constructor(sdk) { this.sdk = sdk; }

  /**
   * Create a temporary support access grant. Returns a short code that a
   * support agent can redeem to access your org for the specified duration.
   *
   * @param {object} params
   * @param {number} params.durationHours - How long the grant is valid (e.g. 24).
   * @returns {Promise<{
   *   grantId: string,    // "sgr_..." — use this to revoke early
   *   code: string,       // Short alphanumeric code to share with support
   *   expiresAt: string,  // ISO 8601
   * }>}
   *
   * @example
   * const grant = await sdk.support.grantAccess({ durationHours: 24 });
   * console.log('Share this code with support:', grant.code);
   * console.log('Expires:', grant.expiresAt);
   */
  grantAccess({ durationHours }) { return this.sdk._fetch('/support/grant', 'POST', { body: { durationHours } }); }

  /**
   * Revoke an active support grant before it expires.
   * Any active support sessions created from this grant will be ended immediately.
   *
   * @param {object} params
   * @param {string} params.grantId - Grant ID ("sgr_...") from grantAccess().
   * @returns {Promise<{ ok: true }>}
   *
   * @example
   * await sdk.support.revokeGrant({ grantId: 'sgr_abc123' });
   */
  revokeGrant({ grantId }) { return this.sdk._fetch(`/support/grant/${grantId}`, 'DELETE'); }

  /**
   * List all active (non-expired, non-revoked) support grants for your org.
   *
   * @returns {Promise<Array<{
   *   grantId: string,
   *   code: string,
   *   durationHours: number,
   *   expiresAt: string,
   *   redeemedAt: string | null,   // null if not yet redeemed
   *   sessionId: string | null,    // "sss_..." if an active session exists
   *   createdAt: string,
   * }>>}
   *
   * @example
   * const grants = await sdk.support.listMyGrants();
   * for (const g of grants) {
   *   console.log(g.code, g.redeemedAt ? '(active)' : '(unredeemed)', 'expires', g.expiresAt);
   * }
   */
  listMyGrants() { return this.sdk._fetch('/support/grants', 'GET'); }

  /**
   * End a specific support session early. Use this if a support agent is
   * done working and you want to immediately terminate their access, or if
   * a session was opened erroneously.
   *
   * @param {object} params
   * @param {string} params.sessionId - Support session ID ("sss_...").
   * @returns {Promise<{ ok: true }>}
   *
   * @example
   * await sdk.support.endSession({ sessionId: 'sss_xyz' });
   */
  endSession({ sessionId }) { return this.sdk._fetch(`/support/sessions/${sessionId}/end`, 'POST', { body: {} }); }
}
