// @ts-nocheck
export class ConsoleTokensService {
  constructor(sdk) { this.sdk = sdk; }

  /** List the org's live (non-revoked) console API tokens, each with its role and role name. */
  async list() { return this.sdk._fetch('/tokens', 'GET'); }

  /**
   * Create a console API token. The plaintext value is returned exactly once, on this
   * call — it is never retrievable again.
   * @param {object} args
   * @param {string} args.name
   * @param {string} [args.permissionRoleId] - the single IAM role this token carries. Omit for no role (default deny).
   * @param {string[]} [args.instanceIds] - instances this token may act on, granted at creation time.
   */
  async create({ name, permissionRoleId, instanceIds } = {}) {
    return this.sdk._fetch('/tokens', 'POST', { body: { name, permissionRoleId, instanceIds } });
  }

  async revoke({ id }) { return this.sdk._fetch(`/tokens/${id}`, 'DELETE'); }

  /** Set (or replace) the token's single permission role. */
  async setRole({ tokenId, roleId }) { return this.sdk._fetch(`/tokens/${tokenId}/role/${roleId}`, 'PUT'); }

  /** Instances this token may act on. */
  async listInstances({ tokenId }) { return this.sdk._fetch(`/tokens/${tokenId}/instances`, 'GET'); }

  async addInstance({ tokenId, instanceId }) { return this.sdk._fetch(`/tokens/${tokenId}/instances/${instanceId}`, 'PUT'); }

  async removeInstance({ tokenId, instanceId }) { return this.sdk._fetch(`/tokens/${tokenId}/instances/${instanceId}`, 'DELETE'); }

  // Superseded by setRole — kept for the (unused, unremoved) direct policy-attachment
  // surface. Do not build new UI against these.
  async attachPolicy({ tokenId, policyId }) { return this.sdk._fetch(`/tokens/${tokenId}/policies/${policyId}`, 'PUT'); }
  async detachPolicy({ tokenId, policyId }) { return this.sdk._fetch(`/tokens/${tokenId}/policies/${policyId}`, 'DELETE'); }
}
