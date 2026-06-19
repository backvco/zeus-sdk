// @ts-nocheck
// zeus-sdk/src/services/admin.js
function clean(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null) out[k] = v;
  return out;
}

export class AdminService {
  constructor(sdk) { this.sdk = sdk; }

  // Orgs
  listOrgs({ page, limit, search } = {}) { return this.sdk._fetch('/admin/orgs', 'GET', { query: clean({ page, limit, search }) }); }
  getOrg({ orgId }) { return this.sdk._fetch(`/admin/orgs/${orgId}`, 'GET'); }
  updateOrg({ orgId, ...fields }) { return this.sdk._fetch(`/admin/orgs/${orgId}`, 'PATCH', { body: fields }); }
  blockPurge({ orgId, note }) { return this.sdk._fetch(`/admin/orgs/${orgId}/block-purge`, 'POST', { body: { note } }); }
  unblockPurge({ orgId }) { return this.sdk._fetch(`/admin/orgs/${orgId}/block-purge`, 'DELETE'); }

  // Billing
  getRevenue() { return this.sdk._fetch('/admin/billing/revenue', 'GET'); }
  listInvoices({ status, search, from, to, limit, startingAfter } = {}) {
    return this.sdk._fetch('/admin/billing/invoices', 'GET', { query: clean({ status, search, from, to, limit, startingAfter }) });
  }

  // Instances
  listInstances({ page, limit } = {}) { return this.sdk._fetch('/admin/instances', 'GET', { query: clean({ page, limit }) }); }
  getInstance({ instanceId }) { return this.sdk._fetch(`/admin/instances/${instanceId}`, 'GET'); }
  enableInstance({ instanceId }) { return this.sdk._fetch(`/admin/instances/${instanceId}/enable`, 'POST', { body: {} }); }
  disableInstance({ instanceId }) { return this.sdk._fetch(`/admin/instances/${instanceId}/disable`, 'POST', { body: {} }); }
  updateInstanceConfig({ instanceId, heartbeatIntervalSec, gracePeriodSec }) { return this.sdk._fetch(`/admin/instances/${instanceId}/config`, 'PATCH', { body: { heartbeatIntervalSec, gracePeriodSec } }); }
  rotateKeypair({ instanceId }) { return this.sdk._fetch(`/admin/instances/${instanceId}/rotate-keypair`, 'POST', { body: {} }); }

  // Plans
  listPlans() { return this.sdk._fetch('/admin/plans', 'GET'); }
  createPlan({ name, ...fields }) { return this.sdk._fetch('/admin/plans', 'POST', { body: { name, ...fields } }); }
  updatePlan({ planId, ...fields }) { return this.sdk._fetch(`/admin/plans/${planId}`, 'PATCH', { body: fields }); }
  createPlanVersion({ planId, ...fields }) { return this.sdk._fetch(`/admin/plans/${planId}/versions`, 'POST', { body: fields }); }
  migrateSubscribers({ planId, versionId, sendEmail, message }) { return this.sdk._fetch(`/admin/plans/${planId}/migrate`, 'POST', { body: { versionId, sendEmail, message } }); }
  setPricing({ orgId, ...overrides }) { return this.sdk._fetch(`/admin/orgs/${orgId}/pricing`, 'PUT', { body: overrides }); }

  // Spam
  listSpamQueue({ status, page } = {}) { return this.sdk._fetch('/admin/spam/queue', 'GET', { query: clean({ status, page }) }); }
  reviewSpamEntry({ entryId, action, note }) { return this.sdk._fetch(`/admin/spam/queue/${entryId}/review`, 'POST', { body: { action, note } }); }
  getBlocklist() { return this.sdk._fetch('/admin/spam/blocklist', 'GET'); }
  addBlocklistEntry({ type, value, note }) { return this.sdk._fetch('/admin/spam/blocklist', 'POST', { body: { type, value, note } }); }
  removeBlocklistEntry({ entryId }) { return this.sdk._fetch(`/admin/spam/blocklist/${entryId}`, 'DELETE'); }
  getSpamConfig() { return this.sdk._fetch('/admin/spam/config', 'GET'); }
  updateSpamConfig({ signals, thresholds }) { return this.sdk._fetch('/admin/spam/config', 'PUT', { body: { signals, thresholds } }); }

  // SMTP
  getSmtpConfig() { return this.sdk._fetch('/admin/smtp', 'GET'); }
  updateSmtpConfig({ host, port, username, password, fromAddress, fromName }) { return this.sdk._fetch('/admin/smtp', 'PUT', { body: { host, port, username, password, fromAddress, fromName } }); }
  testSmtp({ to }) { return this.sdk._fetch('/admin/smtp/test', 'POST', { body: { to } }); }

  // Support
  listSupportSessions({ page, limit } = {}) { return this.sdk._fetch('/admin/support/sessions', 'GET', { query: clean({ page, limit }) }); }
  redeemSupportCode({ code }) { return this.sdk._fetch('/admin/support/redeem', 'POST', { body: { code } }); }

  // Audit + permissions
  getAdminAuditLog({ page, limit, orgId, eventType, from, to } = {}) { return this.sdk._fetch('/admin/audit', 'GET', { query: clean({ page, limit, orgId, eventType, from, to }) }); }
  updateAdminPermissions({ userId, permissions }) { return this.sdk._fetch(`/admin/users/${userId}/permissions`, 'PUT', { body: { permissions } }); }
}
