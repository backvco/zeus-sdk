// @ts-nocheck
/**
 * NoticesService — system-wide announcements and maintenance notices.
 *
 * Accessed as `sdk.notices`.
 *
 * Notices are broadcast by the Zeus Console team to all users. Each user can
 * dismiss a notice independently — dismissal is per-user, not per-org.
 * Dismissed notices are excluded from future list() responses.
 *
 * Typical UI pattern: on page load, call list() and render any returned notices
 * in a banner or notification area. Show a dismiss button for each; on click,
 * call dismiss() and remove the notice from the UI.
 */
export class NoticesService {
  constructor(sdk) { this.sdk = sdk; }

  /**
   * List all active, undismissed notices for the current user.
   *
   * @returns {Promise<Array<{
   *   id: string,         // "ntc_..."
   *   title: string,
   *   body: string,       // Plain text or simple markdown
   *   severity: 'info' | 'warning' | 'critical',
   *   url: string | null, // Optional link for more details
   *   createdAt: string,
   *   expiresAt: string | null,
   * }>>}
   *
   * @example
   * const notices = await sdk.notices.list();
   * for (const notice of notices) {
   *   console.log(`[${notice.severity.toUpperCase()}] ${notice.title}`);
   * }
   */
  list() { return this.sdk._fetch('/notices', 'GET'); }

  /**
   * Dismiss a notice for the current user. The notice will no longer appear
   * in list() responses for this user. Other users are not affected.
   *
   * @param {object} params
   * @param {string} params.noticeId - Notice ID ("ntc_...") from list().
   * @returns {Promise<{ ok: true }>}
   *
   * @example
   * await sdk.notices.dismiss({ noticeId: 'ntc_abc123' });
   */
  dismiss({ noticeId }) { return this.sdk._fetch(`/notices/${noticeId}/dismiss`, 'POST', { body: {} }); }
}
