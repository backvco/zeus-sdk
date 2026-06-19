// @ts-nocheck
// zeus-sdk/src/services/spam.js
export class SpamService {
  constructor(sdk) { this.sdk = sdk; }

  score({ email, ip, turnstileToken }) { return this.sdk._fetch('/spam/score', 'POST', { body: { email, ip, turnstileToken } }); }
}
