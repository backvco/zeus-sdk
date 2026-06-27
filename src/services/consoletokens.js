// @ts-nocheck
export class ConsoleTokensService {
  constructor(sdk) { this.sdk = sdk; }

  async list() { return this.sdk._fetch('/tokens', 'GET'); }
  async create({ name }) { return this.sdk._fetch('/tokens', 'POST', { body: { name } }); }
  async revoke({ id }) { return this.sdk._fetch(`/tokens/${id}`, 'DELETE'); }
  async attachPolicy({ tokenId, policyId }) { return this.sdk._fetch(`/tokens/${tokenId}/policies/${policyId}`, 'PUT'); }
  async detachPolicy({ tokenId, policyId }) { return this.sdk._fetch(`/tokens/${tokenId}/policies/${policyId}`, 'DELETE'); }
}
