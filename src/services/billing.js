// @ts-nocheck
// zeus-sdk/src/services/billing.js
export class BillingService {
  constructor(sdk) { this.sdk = sdk; }

  getSubscription({ instanceId }) { return this.sdk._fetch(`/billing/subscriptions/${instanceId}`, 'GET'); }
  createCheckout({ instanceId, planId, billingPeriod }) { return this.sdk._fetch('/billing/checkout', 'POST', { body: { instanceId, planId, billingPeriod } }); }
  getPortalUrl() { return this.sdk._fetch('/billing/portal', 'POST', { body: {} }); }
  listInvoices({ instanceId }) { return this.sdk._fetch(`/billing/invoices/${instanceId}`, 'GET'); }
  applyDiscountCode({ code, instanceId }) { return this.sdk._fetch('/billing/discount', 'POST', { body: { code, instanceId } }); }
  issueCredit({ orgId, type, amountCents, note }) { return this.sdk._fetch('/billing/credits', 'POST', { body: { orgId, type, amountCents, note } }); }
  listCredits({ orgId }) { return this.sdk._fetch(`/billing/credits/${orgId}`, 'GET'); }
  issueRefund({ invoiceId, amountCents, reason }) { return this.sdk._fetch('/billing/refunds', 'POST', { body: { invoiceId, amountCents, reason } }); }
  retryPayment({ subscriptionId }) { return this.sdk._fetch('/billing/retry', 'POST', { body: { subscriptionId } }); }
}
