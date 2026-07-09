// @ts-nocheck
/**
 * EmailService — proxy transactional email through the console (`sdk.email`).
 *
 * Zeus instances render email HTML locally (via their event registry) and ship
 * the rendered payload here. The console's SMTP config does the actual sending,
 * so instances require no email credentials of their own.
 *
 * Accessed as `sdk.email` from within a Zeus instance (license-key auth).
 */
export class EmailService {
  constructor(sdk) { this.sdk = sdk; }

  /**
   * Send a transactional email via the console's SMTP configuration.
   * Returns `{ sent: false }` if the console has no SMTP configured — never throws
   * for SMTP unavailability. Throws only on auth or network errors.
   *
   * @param {object} params
   * @param {string|string[]} params.to       - Recipient address(es).
   * @param {string}          params.subject  - Email subject line.
   * @param {string}          params.html     - Rendered HTML body.
   * @param {string}          [params.text]   - Plain-text fallback body.
   * @param {string}          [params.event]  - Event key for log grouping, e.g. 'user.invited'.
   * @returns {Promise<{ sent: boolean, reason?: string, messageId?: string }>}
   *
   * @example
   * const result = await sdk.email.send({
   *   to: 'alice@example.com',
   *   subject: 'Welcome to Zeus',
   *   html: '<p>Hi Alice</p>',
   *   event: 'user.welcomed',
   * });
   * if (!result.sent) console.warn('Email not sent:', result.reason);
   */
  send({ to, subject, html, text, event }) {
    return this.sdk._fetch('/email/send', 'POST', { body: { to, subject, html, text, event } });
  }

  /**
   * Report an alert-class email; the CONSOLE resolves the recipients (verified,
   * opted-in admins of the calling instance — future: per-user subscriptions).
   * The instance never names recipients for alerts. Instance (license-key)
   * auth only.
   *
   * @param {object} params
   * @param {string} params.alertType  - Stable alert/event key, e.g. 'alert.cluster_unhealthy'.
   * @param {string} [params.severity] - 'critical' | 'warning' | ... (audit metadata).
   * @param {string} params.subject    - Email subject line.
   * @param {string} params.html       - Rendered HTML body.
   * @param {string} [params.text]     - Plain-text fallback body.
   * @returns {Promise<{ sent: boolean, reason?: string, recipients: number, skipped: Array<{email: string, reason: string}> }>}
   *
   * @example
   * await sdk.email.sendAlert({ alertType: 'alert.cluster_unhealthy', severity: 'critical', subject, html, text });
   */
  sendAlert({ alertType, severity, subject, html, text }) {
    return this.sdk._fetch('/email/alert', 'POST', { body: { alertType, severity, subject, html, text } });
  }

  /**
   * Ask the console to send its email-verification message to a console user
   * of the instance's org (the emailed link/code lands on the console UI).
   * Instance (license-key) auth only. 404 if no console user in the org has
   * that email.
   *
   * @param {object} params
   * @param {string} params.email - The user's email address.
   * @returns {Promise<{ ok: true, sent?: boolean, alreadyVerified?: boolean }>}
   *
   * @example
   * await sdk.email.requestVerification({ email: 'cameron@backv.co' });
   */
  requestVerification({ email }) {
    return this.sdk._fetch('/email/verification/request', 'POST', { body: { email } });
  }
}
