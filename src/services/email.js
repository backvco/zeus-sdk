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
}
