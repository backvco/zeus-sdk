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
   * Send a console-rendered account-lifecycle email — for Zeus-native local users, who
   * have no console user row and so can never pass `sdk.email.send()`'s in-org
   * recipient check. The CONSOLE renders the body from its own fixed template for
   * `event` (a hard four-item allowlist server-side; anything else 400s) — there is no
   * `html` field on this route at all, which is exactly what lets `to` be any address
   * without reopening the platform's SMTP identity as a relay. Instance (license-key)
   * auth only.
   *
   * `data.link` / `data.loginUrl`, when present, must be an `https:` URL whose host is
   * this instance's own subdomain host — the console rejects a mismatch (403) rather
   * than send a genuine-looking email pointing at an attacker's domain.
   *
   * @param {object} params
   * @param {'user.invited'|'user.password_reset'|'user.welcomed'|'user.approved'} params.event
   *   - Must be one of these four; any other value is rejected.
   * @param {string} params.to    - Recipient address. Any address is accepted (console-rendered body).
   * @param {object} [params.data] - Template variables: `name`, `link`, `username`, `loginUrl`, `password`.
   * @returns {Promise<{ sent: boolean, reason?: string, messageId?: string }>}
   *
   * @example
   * await sdk.email.sendLifecycle({
   *   event: 'user.password_reset',
   *   to: user.email,
   *   data: { name: user.fullName, link: `${origin}/reset?token=${token}` },
   * });
   */
  sendLifecycle({ event, to, data }) {
    return this.sdk._fetch('/email/lifecycle', 'POST', { body: { event, to, data } });
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

  /**
   * Read-only check: is this address verified at the console? Org-scoped;
   * lets an instance clear its "unverified" warning as soon as the user
   * verifies on the console UI. Instance (license-key) auth only.
   *
   * @param {object} params
   * @param {string} params.email - The user's email address.
   * @returns {Promise<{ exists: boolean, verified: boolean }>}
   *
   * @example
   * const { verified } = await sdk.email.verificationStatus({ email: 'cameron@backv.co' });
   */
  verificationStatus({ email }) {
    return this.sdk._fetch('/email/verification/status', 'GET', { query: { email } });
  }
}
