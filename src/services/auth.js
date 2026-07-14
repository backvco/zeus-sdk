// @ts-nocheck
/**
 * AuthService — user authentication and session management.
 *
 * Accessed as `sdk.auth`.
 *
 * All methods that set/clear a session do so via an HttpOnly cookie — you don't
 * need to store or forward a token yourself in the browser.
 *
 * Typical login flow:
 *   1. signup()         — create account (sends verification email)
 *   2. verifyEmail()    — confirm the emailed code
 *   3. login()          — start a session (sets cookie)
 *   3a. verifyCard()    — if the response has `card_verification_required: true`, place
 *                         a $1 pre-auth to verify the card before continuing (spam gate;
 *                         the customer is never charged)
 *   4. getSession()     — check who's logged in on any page load
 *   5. logout()         — clear the session cookie
 *
 * MFA flow (after a login that returns `{ mfaRequired: true }`):
 *   1. login()          — returns { mfaRequired: true, mfaPendingId: 'mfa_...' }
 *   2. verifyMfa()      — submit TOTP code to complete the login
 *
 * Password reset flow:
 *   1. requestPasswordReset() — sends reset link to email
 *   2. resetPassword()        — use the token from the link to set a new password
 */
export class AuthService {
  constructor(sdk) { this.sdk = sdk; }

  /**
   * Create a new user account and organisation.
   * Sends a verification email — the user must call verifyEmail() before logging in.
   *
   * Statuses:
   *   'created'        — account created, verification code emailed.
   *   'resumed'        — an unfinished signup (email never verified) already existed for
   *                      this address; its credentials were replaced with this attempt's
   *                      and a fresh code was emailed. Continue exactly like 'created'.
   *   'pending_review' — registration held for manual review (no account yet).
   * A VERIFIED account with this email is a hard conflict — throws HTTP 409.
   *
   * @param {object} body
   * @param {string} body.email
   * @param {string} body.password     - Min 8 characters.
   * @param {string} [body.name]       - Display name.
   * @param {string} [body.orgName]    - Company/organisation name (falls back to the
   *                                     email domain when omitted). On a 'resumed'
   *                                     signup it also renames the existing org.
   * @param {string} [body.referralCode] - Referral code from a ?ref= signup link.
   * @returns {Promise<{ status: 'created' | 'resumed' | 'pending_review' }>}
   *
   * @example
   * const { userId, orgId } = await sdk.auth.signup({
   *   email: 'alice@example.com',
   *   password: 'hunter2!',
   *   name: 'Alice',
   *   orgName: 'Acme Corp',
   * });
   */
  signup(body) { return this.sdk._fetch('/auth/signup', 'POST', { body }); }

  /**
   * Log in with email and password. Sets a session cookie on success.
   *
   * If the account has MFA enabled, the response will include `mfaRequired: true`
   * instead of creating a full session — follow up with verifyMfa().
   *
   * @param {object} params
   * @param {string} params.email
   * @param {string} params.password
   * @returns {Promise<
   *   { userId: string, orgId: string, role: string } |
   *   { mfaRequired: true, mfaPendingId: string }
   * >}
   *
   * @example
   * const result = await sdk.auth.login({ email: 'alice@example.com', password: 'hunter2!' });
   * if (result.mfaRequired) {
   *   // Prompt user for TOTP code, then call sdk.auth.verifyMfa({ code })
   * } else {
   *   // result.userId, result.role, etc.
   * }
   */
  login({ email, password }) { return this.sdk._fetch('/auth/login', 'POST', { body: { email, password } }); }

  /**
   * Log in using a Firebase ID token (Google / GitHub social login).
   * The console exchanges the token for a session cookie — you don't need to
   * pass the Firebase token to any other call.
   *
   * @param {object} params
   * @param {string} params.idToken - Firebase ID token from the client SDK.
   * @returns {Promise<{ userId: string, orgId: string, role: string, isNew: boolean }>}
   *   `isNew: true` means the account was just created via social login.
   *
   * @example
   * import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
   * const { user } = await signInWithPopup(getAuth(), new GoogleAuthProvider());
   * const idToken = await user.getIdToken();
   * const session = await sdk.auth.loginFirebase({ idToken });
   */
  loginFirebase({ idToken }) { return this.sdk._fetch('/auth/login/firebase', 'POST', { body: { idToken } }); }

  /**
   * Log out the current user. Clears the session cookie.
   *
   * @returns {Promise<{ ok: true }>}
   *
   * @example
   * await sdk.auth.logout();
   * // Redirect to /login
   */
  logout() { return this.sdk._fetch('/auth/logout', 'POST', { body: {} }); }

  /**
   * Return the currently authenticated user's session data.
   * Use this on page load to check auth state without redirecting.
   * Throws HTTP 401 if no session exists.
   *
   * @returns {Promise<{
   *   userId: string,
   *   orgId: string,
   *   email: string,
   *   name: string,
   *   role: 'admin' | 'member',
   *   emailVerified: boolean,
   *   mfaEnabled: boolean,
   * }>}
   *
   * @example
   * try {
   *   const session = await sdk.auth.getSession();
   *   console.log('Logged in as', session.email);
   * } catch (err) {
   *   if (err.status === 401) redirect('/login');
   * }
   */
  getSession() { return this.sdk._fetch('/auth/session', 'GET'); }

  /**
   * Verify an email address with the 6-digit code from the verification email.
   * When called without a session (e.g. the public /verify-email page), pass
   * `email` so the API can locate the account; with a session it's optional.
   *
   * @param {object} params
   * @param {string} params.code    - 6-digit verification code from the email.
   * @param {string} [params.email] - Account email (required when unauthenticated).
   * @returns {Promise<{ ok: true }>}
   *
   * @example
   * await sdk.auth.verifyEmail({ email: 'alice@example.com', code: '847291' });
   */
  verifyEmail({ code, email }) { return this.sdk._fetch('/auth/verify-email', 'POST', { body: { code, email } }); }

  /**
   * Resend the email verification code. Uses the current session's address, or
   * pass `email` when unauthenticated. Rate-limited — call only in response to
   * a user "Resend" action.
   *
   * @param {object} [params]
   * @param {string} [params.email] - Account email (required when unauthenticated).
   * @returns {Promise<{ ok: true }>}
   *
   * @example
   * await sdk.auth.resendVerification();
   */
  resendVerification({ email } = {}) { return this.sdk._fetch('/auth/verify-email/resend', 'POST', { body: { email } }); }

  /**
   * Send a password-reset email. The email contains a single-use token link.
   * Safe to call even if the email doesn't exist (no enumeration).
   *
   * @param {object} params
   * @param {string} params.email
   * @returns {Promise<{ ok: true }>}
   *
   * @example
   * await sdk.auth.requestPasswordReset({ email: 'alice@example.com' });
   */
  requestPasswordReset({ email }) { return this.sdk._fetch('/auth/password-reset/request', 'POST', { body: { email } }); }

  /**
   * Set a new password using the token from the reset email link.
   *
   * @param {object} params
   * @param {string} params.token    - Token extracted from the reset link query string.
   * @param {string} params.password - New password (min 8 characters).
   * @returns {Promise<{ ok: true }>}
   *
   * @example
   * const token = new URLSearchParams(window.location.search).get('token');
   * await sdk.auth.resetPassword({ token, password: 'newSecurePass1!' });
   */
  resetPassword({ token, password }) { return this.sdk._fetch('/auth/password-reset/confirm', 'POST', { body: { token, password } }); }

  /**
   * Begin MFA (TOTP) setup for the current user.
   * Returns a TOTP secret and QR code URI to display to the user.
   * MFA is not active until the user calls verifyMfa() with a valid code.
   *
   * @returns {Promise<{ secret: string, qrUri: string }>}
   *   `qrUri` is an otpauth:// URI — pass it to a QR library to render a
   *   scannable code for authenticator apps (Google Authenticator, 1Password, etc).
   *
   * @example
   * const { secret, qrUri } = await sdk.auth.setupMfa();
   * // Render qrUri as a QR code, show secret as fallback text
   * // Then prompt the user to enter the 6-digit code from their app
   */
  setupMfa() { return this.sdk._fetch('/auth/mfa/setup', 'POST', { body: {} }); }

  /**
   * Verify a TOTP code. Used in two contexts:
   *   1. During MFA setup — activates MFA on the account.
   *   2. After login() returns { mfaRequired: true } — completes the login.
   *
   * @param {object} params
   * @param {string} params.code - 6-digit TOTP code from the authenticator app.
   * @returns {Promise<{ ok: true } | { userId: string, orgId: string, role: string }>}
   *   During login completion, returns the full session (same shape as login()).
   *
   * @example
   * // After setup
   * await sdk.auth.verifyMfa({ code: '123456' });
   *
   * // After login with MFA required
   * const session = await sdk.auth.verifyMfa({ code: '123456' });
   * // session.userId, session.role, etc.
   */
  verifyMfa({ code }) { return this.sdk._fetch('/auth/mfa/verify', 'POST', { body: { code } }); }

  /**
   * Signup card verification (spam gate) — places a temporary $1 authorization on the
   * given card to prove it's real, then releases it immediately. The customer is
   * NEVER charged. login()/getSession()/loginFirebase() report whether this is still
   * needed via `card_verification_required: true`.
   *
   * @param {object} params
   * @param {string} params.paymentMethodId - A Stripe PaymentMethod id (create it
   *   client-side with Stripe.js/Elements first — no raw card data touches our server).
   * @returns {Promise<
   *   { ok: true, alreadyVerified?: true } |
   *   { requiresAction: true, clientSecret: string, paymentIntentId: string } |
   *   { paymentFailed: true, declineCode: string|null, errorCode: string|null }
   * >}
   *   `requiresAction` means the card needs 3D Secure — complete it client-side with
   *   Stripe.js's `handleNextAction(clientSecret)`, then call confirmCardVerification()
   *   with the same `paymentIntentId`.
   * @throws {Error} 503 if Stripe is not configured — the UI should skip this step.
   *
   * @example
   * const result = await sdk.auth.verifyCard({ paymentMethodId: 'pm_...' });
   * if (result.requiresAction) {
   *   await stripe.handleNextAction({ clientSecret: result.clientSecret });
   *   const confirmed = await sdk.auth.confirmCardVerification({ paymentIntentId: result.paymentIntentId });
   * }
   */
  verifyCard({ paymentMethodId }) { return this.sdk._fetch('/auth/verify-card', 'POST', { body: { paymentMethodId } }); }

  /**
   * Re-check a card verification PaymentIntent after the cardholder completes a 3D
   * Secure challenge (follow-up to verifyCard()'s `requiresAction` response).
   *
   * @param {object} params
   * @param {string} params.paymentIntentId - The id returned by verifyCard().
   * @returns {Promise<
   *   { ok: true, alreadyVerified?: true } |
   *   { requiresAction: true, clientSecret: string, paymentIntentId: string } |
   *   { paymentFailed: true, declineCode: string|null, errorCode: string|null }
   * >}
   * @throws {Error} 503 if Stripe is not configured.
   *
   * @example
   * const confirmed = await sdk.auth.confirmCardVerification({ paymentIntentId: 'pi_...' });
   */
  confirmCardVerification({ paymentIntentId }) { return this.sdk._fetch('/auth/verify-card/confirm', 'POST', { body: { paymentIntentId } }); }
}
