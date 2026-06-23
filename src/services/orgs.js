// @ts-nocheck
/**
 * OrgsService — read and update the current organisation.
 *
 * Accessed as `sdk.orgs`.
 *
 * An "org" is the top-level account that owns instances, billing, and users.
 * The API always operates on the org associated with the active session —
 * there are no multi-org admin methods here (those live in sdk.admin).
 */
export class OrgsService {
  constructor(sdk) { this.sdk = sdk; }

  /**
   * Get the current organisation's details.
   *
   * @returns {Promise<{
   *   id: string,       // "org_..."
   *   name: string,
   *   createdAt: string,
   * }>}
   *
   * @example
   * const org = await sdk.orgs.get();
   * console.log('Org:', org.name, org.id);
   */
  get() { return this.sdk._fetch('/orgs/me', 'GET'); }

  /**
   * Update the organisation's display name.
   *
   * @param {object} params
   * @param {string} params.name - New organisation name.
   * @returns {Promise<{ id: string, name: string }>}
   *
   * @example
   * const org = await sdk.orgs.update({ name: 'Acme Corp' });
   * console.log('Updated:', org.name);
   */
  update({ name }) { return this.sdk._fetch('/orgs/me', 'PATCH', { body: { name } }); }
}
