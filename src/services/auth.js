// @ts-nocheck
// zeus-sdk/src/services/auth.js
export class AuthService {
  constructor(sdk) { this.sdk = sdk; }

  signup(body) { return this.sdk._fetch('/auth/signup', 'POST', { body }); }
  login({ email, password }) { return this.sdk._fetch('/auth/login', 'POST', { body: { email, password } }); }
  loginFirebase({ idToken }) { return this.sdk._fetch('/auth/login/firebase', 'POST', { body: { idToken } }); }
  logout() { return this.sdk._fetch('/auth/logout', 'POST', { body: {} }); }
  getSession() { return this.sdk._fetch('/auth/session', 'GET'); }
  verifyEmail({ code }) { return this.sdk._fetch('/auth/verify-email', 'POST', { body: { code } }); }
  resendVerification() { return this.sdk._fetch('/auth/verify-email/resend', 'POST', { body: {} }); }
  requestPasswordReset({ email }) { return this.sdk._fetch('/auth/password-reset/request', 'POST', { body: { email } }); }
  resetPassword({ token, password }) { return this.sdk._fetch('/auth/password-reset/confirm', 'POST', { body: { token, password } }); }
  setupMfa() { return this.sdk._fetch('/auth/mfa/setup', 'POST', { body: {} }); }
  verifyMfa({ code }) { return this.sdk._fetch('/auth/mfa/verify', 'POST', { body: { code } }); }
}
