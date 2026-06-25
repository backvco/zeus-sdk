// @ts-nocheck
/**
 * SsoService — instance-initiated SSO nonce validation.
 *
 * Accessed as `sdk.sso`.
 *
 * Used by a Zeus instance to validate a one-time SSO nonce that was issued by
 * the console (via `sdk.instances.getSsoRedirect()`). The instance calls
 * `validate()` to exchange the nonce for the user's identity so it can create
 * a local session without the user re-entering credentials.
 *
 * Requests to this endpoint must be signed with the instance's private key
 * (X-Zeus-Signature) — pass `privateKey` when constructing the SDK.
 *
 * @example
 * import { ZeusConsoleSDK } from 'zeus-sdk';
 *
 * const sdk = new ZeusConsoleSDK({
 *   baseURL: 'https://console.example.com/api',
 *   token: process.env.ZEUS_LICENSE_KEY,
 *   privateKey: process.env.ZEUS_PRIVATE_KEY,  // PEM string or CryptoKey
 * });
 *
 * // In the SSO callback handler on the instance:
 * const user = await sdk.sso.validate({
 *   nonceId: searchParams.get('nonce'),
 *   instanceId: 'ins_abc123',
 * });
 * // user → { user_id, email, name, role, org_role, ... }
 */
export class SsoService {
  constructor(sdk) { this.sdk = sdk; }

  /**
   * Validate a one-time SSO nonce issued by the console and return the
   * associated user's identity. The nonce is consumed on use — it cannot
   * be replayed.
   *
   * The request must be signed with the instance's RS256 private key
   * (configure via `privateKey` on the SDK constructor).
   *
   * @param {object} params
   * @param {string} params.nonceId    - The one-time nonce from the SSO redirect URL.
   * @param {string} params.instanceId - The calling instance's ID ("ins_...").
   * @returns {Promise<{
   *   user_id:  string,
   *   email:    string,
   *   name:     string,
   *   role:     'admin' | 'member',
   *   org_role: string,
   * }>}
   *
   * @example
   * const user = await sdk.sso.validate({
   *   nonceId:    searchParams.get('nonce'),
   *   instanceId: 'ins_abc123',
   * });
   * // Create a local session for user.email / user.role
   */
  validate({ nonceId, instanceId }) {
    return this.sdk._fetch('/sso/validate', 'POST', { body: { nonceId, instanceId } });
  }
}
