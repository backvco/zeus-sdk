// @ts-nocheck
export class PermissionsService {
  constructor(sdk) { this.sdk = sdk; }

  async listPolicies() { return this.sdk._fetch('/permissions/policies', 'GET'); }
  async getPolicy({ id }) { return this.sdk._fetch(`/permissions/policies/${id}`, 'GET'); }
  async createPolicy({ name, description, document }) { return this.sdk._fetch('/permissions/policies', 'POST', { body: { name, description, document } }); }
  async updatePolicy({ id, name, description, document }) { return this.sdk._fetch(`/permissions/policies/${id}`, 'PATCH', { body: { name, description, document } }); }
  async deletePolicy({ id }) { return this.sdk._fetch(`/permissions/policies/${id}`, 'DELETE'); }

  async listRoles() { return this.sdk._fetch('/permissions/roles', 'GET'); }
  async getRole({ id }) { return this.sdk._fetch(`/permissions/roles/${id}`, 'GET'); }
  async createRole({ name, description }) { return this.sdk._fetch('/permissions/roles', 'POST', { body: { name, description } }); }
  async updateRole({ id, name, description }) { return this.sdk._fetch(`/permissions/roles/${id}`, 'PATCH', { body: { name, description } }); }
  async deleteRole({ id }) { return this.sdk._fetch(`/permissions/roles/${id}`, 'DELETE'); }

  async attachRolePolicy({ roleId, policyId }) { return this.sdk._fetch(`/permissions/roles/${roleId}/policies/${policyId}`, 'PUT'); }
  async detachRolePolicy({ roleId, policyId }) { return this.sdk._fetch(`/permissions/roles/${roleId}/policies/${policyId}`, 'DELETE'); }

  async addRoleMember({ roleId, userId }) { return this.sdk._fetch(`/permissions/roles/${roleId}/members/${userId}`, 'PUT'); }
  async removeRoleMember({ roleId, userId }) { return this.sdk._fetch(`/permissions/roles/${roleId}/members/${userId}`, 'DELETE'); }

  async attachUserPolicy({ userId, policyId }) { return this.sdk._fetch(`/permissions/users/${userId}/policies/${policyId}`, 'PUT'); }
  async detachUserPolicy({ userId, policyId }) { return this.sdk._fetch(`/permissions/users/${userId}/policies/${policyId}`, 'DELETE'); }

  async getEffective({ userId }) { return this.sdk._fetch(`/permissions/users/${userId}/effective`, 'GET'); }
}
