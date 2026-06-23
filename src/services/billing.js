// @ts-nocheck
/**
 * BillingService — subscriptions, invoices, credits, and discounts.
 *
 * Accessed as `sdk.billing`.
 *
 * Billing is per-instance: each instance has its own subscription and invoice
 * history. Credits and discounts apply at the org level and are consumed by
 * the next invoice.
 *
 * Typical checkout flow:
 *   1. createCheckout() — get a Stripe checkout URL for a plan upgrade/signup
 *   2. (user completes payment on Stripe)
 *   3. getSubscription() — poll to confirm the subscription is active
 *
 * For existing customers managing their payment method or viewing past invoices:
 *   - getPortalUrl()  — redirect to the Stripe customer portal
 *   - listInvoices()  — fetch invoice history programmatically
 */
export class BillingService {
  constructor(sdk) { this.sdk = sdk; }

  /**
   * Get the active subscription for an instance.
   *
   * @param {object} params
   * @param {string} params.instanceId - Instance ID ("ins_...").
   * @returns {Promise<{
   *   id: string,             // "sub_..."
   *   instanceId: string,
   *   planId: string,
   *   planName: string,
   *   status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid',
   *   billingPeriod: 'monthly' | 'annual',
   *   currentPeriodStart: string,
   *   currentPeriodEnd: string,
   *   cancelAtPeriodEnd: boolean,
   *   trialEnd: string | null,
   * }>}
   *
   * @example
   * const sub = await sdk.billing.getSubscription({ instanceId: 'ins_abc123' });
   * if (sub.status === 'past_due') {
   *   console.warn('Payment required — instance may be suspended soon');
   * }
   */
  getSubscription({ instanceId }) { return this.sdk._fetch(`/billing/subscriptions/${instanceId}`, 'GET'); }

  /**
   * Create a Stripe Checkout session to subscribe or upgrade a plan.
   * Redirect the user to the returned `url` to complete payment.
   * After payment, Stripe redirects back and the subscription becomes active.
   *
   * @param {object} params
   * @param {string} params.instanceId    - Instance ID ("ins_...").
   * @param {string} params.planId        - Target plan ID ("pln_...").
   * @param {string} params.billingPeriod - "monthly" or "annual".
   * @returns {Promise<{ url: string }>}  - Stripe Checkout URL.
   *
   * @example
   * const { url } = await sdk.billing.createCheckout({
   *   instanceId: 'ins_abc123',
   *   planId: 'pln_pro_xyz',
   *   billingPeriod: 'annual',
   * });
   * window.location.href = url;  // redirect to Stripe
   */
  createCheckout({ instanceId, planId, billingPeriod }) { return this.sdk._fetch('/billing/checkout', 'POST', { body: { instanceId, planId, billingPeriod } }); }

  /**
   * Get a Stripe Customer Portal URL for managing payment methods,
   * viewing billing history, or cancelling a subscription.
   * Redirect the user to the returned `url`.
   *
   * @returns {Promise<{ url: string }>}  - Stripe portal URL (short-lived).
   *
   * @example
   * const { url } = await sdk.billing.getPortalUrl();
   * window.location.href = url;
   */
  getPortalUrl() { return this.sdk._fetch('/billing/portal', 'POST', { body: {} }); }

  /**
   * List all invoices for an instance, newest first.
   *
   * @param {object} params
   * @param {string} params.instanceId - Instance ID ("ins_...").
   * @returns {Promise<Array<{
   *   id: string,
   *   number: string,         // Human-readable invoice number, e.g. "INV-0042"
   *   status: 'paid' | 'open' | 'void' | 'uncollectible',
   *   amountDue: number,      // In cents
   *   amountPaid: number,     // In cents
   *   currency: string,       // ISO 4217, e.g. "usd"
   *   periodStart: string,
   *   periodEnd: string,
   *   pdfUrl: string | null,
   *   createdAt: string,
   * }>>}
   *
   * @example
   * const invoices = await sdk.billing.listInvoices({ instanceId: 'ins_abc123' });
   * for (const inv of invoices) {
   *   const dollars = (inv.amountPaid / 100).toFixed(2);
   *   console.log(inv.number, inv.status, `$${dollars}`);
   * }
   */
  listInvoices({ instanceId }) { return this.sdk._fetch(`/billing/invoices/${instanceId}`, 'GET'); }

  /**
   * Apply a discount/promo code to an instance's subscription.
   * The discount takes effect on the next invoice.
   *
   * @param {object} params
   * @param {string} params.code        - Promo code string, e.g. "LAUNCH50".
   * @param {string} params.instanceId  - Instance ID ("ins_...").
   * @returns {Promise<{
   *   discountId: string,       // "dsc_..."
   *   percentOff: number | null,
   *   amountOff: number | null, // In cents
   *   duration: 'once' | 'repeating' | 'forever',
   *   durationMonths: number | null,
   * }>}
   *
   * @example
   * const discount = await sdk.billing.applyDiscountCode({
   *   code: 'LAUNCH50',
   *   instanceId: 'ins_abc123',
   * });
   * console.log(`${discount.percentOff}% off — ${discount.duration}`);
   */
  applyDiscountCode({ code, instanceId }) { return this.sdk._fetch('/billing/discount', 'POST', { body: { code, instanceId } }); }

  /**
   * Issue an account credit to an org. Credits are automatically applied to
   * future invoices before charging the payment method.
   * (Admin or internal use only — requires elevated permissions.)
   *
   * @param {object} params
   * @param {string} params.orgId        - Org ID ("org_...").
   * @param {string} params.type         - Credit type, e.g. "goodwill" | "referral" | "manual".
   * @param {number} params.amountCents  - Credit amount in cents (e.g. 5000 = $50.00).
   * @param {string} [params.note]       - Internal note explaining the reason.
   * @returns {Promise<{ id: string, orgId: string, amountCents: number, type: string, createdAt: string }>}
   *
   * @example
   * await sdk.billing.issueCredit({
   *   orgId: 'org_xyz',
   *   type: 'goodwill',
   *   amountCents: 2000,   // $20.00
   *   note: 'Compensation for outage on 2024-03-15',
   * });
   */
  issueCredit({ orgId, type, amountCents, note }) { return this.sdk._fetch('/billing/credits', 'POST', { body: { orgId, type, amountCents, note } }); }

  /**
   * List all account credits for an org.
   *
   * @param {object} params
   * @param {string} params.orgId - Org ID ("org_...").
   * @returns {Promise<Array<{
   *   id: string,          // "crd_..."
   *   amountCents: number,
   *   type: string,
   *   note: string | null,
   *   appliedAt: string | null,  // null if not yet applied to an invoice
   *   createdAt: string,
   * }>>}
   *
   * @example
   * const credits = await sdk.billing.listCredits({ orgId: 'org_xyz' });
   * const pending = credits.filter(c => !c.appliedAt);
   * const totalPendingCents = pending.reduce((sum, c) => sum + c.amountCents, 0);
   * console.log(`$${(totalPendingCents / 100).toFixed(2)} in unused credits`);
   */
  listCredits({ orgId }) { return this.sdk._fetch(`/billing/credits/${orgId}`, 'GET'); }

  /**
   * Issue a refund for a specific invoice.
   * (Admin or internal use only — requires elevated permissions.)
   *
   * @param {object} params
   * @param {string} params.invoiceId    - Invoice ID (Stripe invoice ID or internal ID).
   * @param {number} params.amountCents  - Amount to refund in cents. Must not exceed
   *                                       the amount paid on the invoice.
   * @param {string} [params.reason]     - Reason string for Stripe: "duplicate" |
   *                                       "fraudulent" | "requested_by_customer".
   * @returns {Promise<{ ok: true, refundId: string }>}
   *
   * @example
   * await sdk.billing.issueRefund({
   *   invoiceId: 'in_stripe_abc',
   *   amountCents: 9900,  // $99.00 partial refund
   *   reason: 'requested_by_customer',
   * });
   */
  issueRefund({ invoiceId, amountCents, reason }) { return this.sdk._fetch('/billing/refunds', 'POST', { body: { invoiceId, amountCents, reason } }); }

  /**
   * Retry a failed payment on a past_due or unpaid subscription.
   * Triggers an immediate charge attempt against the saved payment method.
   *
   * @param {object} params
   * @param {string} params.subscriptionId - Subscription ID ("sub_...").
   * @returns {Promise<{ ok: true, status: string }>}
   *   `status` reflects the subscription status after the retry attempt.
   *
   * @example
   * const result = await sdk.billing.retryPayment({ subscriptionId: 'sub_abc123' });
   * console.log('Status after retry:', result.status);
   */
  retryPayment({ subscriptionId }) { return this.sdk._fetch('/billing/retry', 'POST', { body: { subscriptionId } }); }
}
