// @ts-nocheck
/**
 * InstancesService — manage Zeus instance registrations.
 *
 * Accessed as `sdk.instances`.
 *
 * A "instance" is a deployed Zeus app that phones home to the console for
 * licensing, heartbeats, and SSO. Each instance has a unique subdomain and a
 * license key used for server-to-server calls.
 *
 * Typical lifecycle:
 *   1. register()       — create a new instance record, receive a license key
 *   2. heartbeat()      — called periodically from within the running Zeus instance
 *   3. pushKeypair()    — register the instance's RSA public key for trust
 *   4. getSsoRedirect() — generate a login URL for SSO from the console to the instance
 *   5. resumePreview()/resume()/resumeConfirm() — customer re-enables their own instance
 *                         after a suspension (e.g. following an admin enableOrg()) and
 *                         resumes billing; resumeConfirm() finishes a 3DS-challenged
 *                         resume (invoice-based, distinct from confirmPayment()'s hold)
 *   6. delete()         — decommission when the instance is torn down
 */
export class InstancesService {
  constructor(sdk) { this.sdk = sdk; }

  /**
   * Register a new Zeus instance. Returns the license key that the instance
   * must use for all server-to-server SDK calls.
   *
   * Each instance gets its own subscription (per-instance billing). `planId` is now
   * REQUIRED. The free plan allows exactly one (non-deleted) instance per org — a
   * second attempt returns 400. The org's 30-day trial window starts on the org's
   * very first instance ever (any plan) and is shared/read-only after that (a Zeus
   * admin can extend it — see `sdk.internal.admin.updateOrg`).
   *
   * **Paid-plan payment contract:** payment is validated BEFORE anything is created —
   * this call never leaves compute/DB provisioned for an org that can't pay. If
   * `planId` resolves to a paid plan and the org has no valid payment method on file
   * (even while still inside its trial window — trial only defers the first charge,
   * it does not waive card validation), this call creates NOTHING and rejects with
   * HTTP 402 and body `{ error: string, needsPaymentMethod: true }`. Route the user to
   * add a card (`sdk.billing.createSetupIntent()` / the payment-methods flow) and
   * retry.
   *
   * If a valid payment method is on file, the instance is created and a real Stripe
   * subscription is set up per `billingChoice`. Use `sdk.instances.getBillingPreview()`
   * beforehand to show the user exactly what will happen — never guess the trial/charge
   * outcome client-side, the API computes it. Even after the payment-method check
   * passes, the actual CHARGE can still fail for an immediate-charge request
   * (`billingChoice: 'pay_now'`, or `'trial'` with no trial available) — this call
   * verifies the charge went through before returning, and creates NOTHING (no
   * instance, no subscription) if it didn't. There are two distinct non-success
   * outcomes, and the UI MUST tell them apart:
   *   - **Declined** — rejects with HTTP 402 and body
   *     `{ error: string, paymentFailed: true, declineCode?: string, errorCode?: string }`.
   *     Map `declineCode`/`errorCode` to human copy client-side (never show Stripe's
   *     raw error text) and let the user pick another card.
   *   - **Requires 3D Secure / SCA authentication** — NOT a decline, and NOT an error to
   *     surface as one. Resolves normally (200) with
   *     `{ requiresAction: true, clientSecret: string, holdId: string }` and creates
   *     NOTHING yet. Drive the cardholder through
   *     `stripe.handleNextAction({ clientSecret })` (or `confirmCardPayment`), then call
   *     `sdk.instances.confirmPayment({ holdId })` to finish creating the instance once
   *     the challenge succeeds. If the user never completes the challenge, nothing was
   *     ever created and the background cleanup job voids the still-open authorization
   *     hold (2026-07-14: instance creation authorizes a card hold and only captures it
   *     once the instance is actually built — see the API's authHold.js — so an
   *     abandoned challenge never charges the customer at all).
   *
   * @param {object} params
   * @param {string} params.name        - Human-readable name, e.g. "Production".
   * @param {string} params.subdomain   - URL-safe subdomain slug, e.g. "prod".
   * @param {string} params.planId      - ID of the billing plan to subscribe to ("pln_...").
   *   Required. Must be an active plan.
   * @param {'cloud'|'self'} [params.hostingMode] - Who runs the container. Defaults to 'cloud'.
   *   'self' is rejected (403) unless the org has `selfHostEnabled`.
   * @param {'trial'|'pay_now'} [params.billingChoice='trial'] - Only meaningful for paid
   *   plans. `'trial'` (default) defers the first charge to the org's trial window when
   *   one is available/active (see `getBillingPreview().trial`); `'pay_now'` charges
   *   immediately today and does NOT consume the org's trial — other instances can
   *   still use it. If no trial applies, `'trial'` and `'pay_now'` behave identically
   *   (charge immediately) — there's nothing to defer to.
   * @param {'monthly'|'annual'} [params.billingPeriod='monthly'] - Recurring billing
   *   period. `'annual'` requires the plan to have an annual price configured (see
   *   `getBillingPreview().plan.annualAvailable`).
   * @param {string} [params.paymentMethodId] - Use this specific saved card ("pm_...")
   *   instead of the org's Stripe default/first card. Must belong to the org's Stripe
   *   customer — rejected with HTTP 400 otherwise.
   * @returns {Promise<{
   *   id: string,          // "ins_..."
   *   name: string,
   *   subdomain: string,
   *   planId: string,
   *   hostingMode: 'cloud' | 'self',
   *   provisioningStatus: 'provisioning' | 'awaiting_install' | 'ready' | 'failed',
   *   createdAt: string,
   * }>}
   *   Does NOT include the license key — the console never returns it from a plain
   *   create/get/list response (ZC-SEC-01). For a self-hosted instance's connection env,
   *   call `getLicenseKey({ id })` (owner/admin only) once the instance exists, or use
   *   `getInstallCommand()` which already embeds it.
   *   On failure with a paid plan + no payment method: rejects with `err.status === 402`
   *   and `err.body.needsPaymentMethod === true`. On failure with a declined/failed
   *   charge: rejects with `err.status === 402` and `err.body.paymentFailed === true`
   *   (plus `err.body.declineCode` / `err.body.stripeMessage` when Stripe provided them).
   *
   * @example
   * const preview = await sdk.instances.getBillingPreview({ planId: 'pln_starter_abc123' });
   * // preview.charge.whenCreated: 'none' | 'immediate' | 'deferred'
   *
   * let instance;
   * try {
   *   instance = await sdk.instances.register({
   *     name: 'Production',
   *     subdomain: 'prod',
   *     planId: 'pln_starter_abc123',
   *     hostingMode: 'cloud',
   *     billingChoice: preview.canChooseTrialOrPayNow ? 'trial' : 'pay_now',
   *   });
   * } catch (err) {
   *   if (err.body?.needsPaymentMethod) {
   *     // Prompt the user to add a card, then retry register().
   *   } else if (err.body?.paymentFailed) {
   *     // Show err.body.stripeMessage inline, let the user pick another card.
   *   }
   *   throw err;
   * }
   * // Response has no license key — fetch it explicitly (owner/admin only) when needed:
   * const { licenseKey } = await sdk.instances.getLicenseKey({ id: instance.id });
   */
  register({ name, subdomain, planId, port, hostingMode, billingChoice, billingPeriod, paymentMethodId }) {
    return this.sdk._fetch('/instances', 'POST', {
      body: {
        name, subdomain, planId, port, hostingMode, billingChoice, billingPeriod, paymentMethodId,
      },
    });
  }

  /**
   * Finish creating an instance (or resume a retry — see `retryProvision()`) after a
   * `register()`/`retryProvision()` call came back with
   * `{ requiresAction: true, clientSecret, holdId }` and the cardholder has completed
   * the 3D Secure / SCA challenge (`stripe.handleNextAction({ clientSecret })`
   * client-side). Re-verifies with Stripe that the authorization is genuinely confirmed
   * (not yet charged — see `register()`'s doc) before creating anything — calling this
   * before the challenge completes just returns `{ requiresAction: true, ... }` again
   * (safe to poll/retry).
   *
   * @param {object} params
   * @param {string} params.holdId - the authorization-hold id from the `register()`/
   *   `retryProvision()` `requiresAction` response ("iah_...").
   * @returns {Promise<object>} the same instance shape `register()` resolves with, on
   *   success. On a still-pending challenge, resolves with
   *   `{ requiresAction: true, clientSecret, holdId }` again. On a genuine decline (the
   *   bank rejected the authorization even after the challenge), rejects with HTTP 402
   *   and body `{ error, paymentFailed: true, declineCode?, errorCode?, pendingPurchase?
   *   }` — same shape as `register()`'s decline case, nothing created and nothing
   *   charged. `pendingPurchase` (fresh-create holds only — never present for a retry-
   *   provision hold, since that instance already exists) is `{ name, subdomain,
   *   planId, billingPeriod, hostingMode, port }`, the original creation request —
   *   handed back exactly ONCE so the caller can re-open its create-instance UI
   *   pre-filled on the card step (a redirect-based 3DS decline lands the user back on
   *   a fresh page load with no in-memory wizard state left — see zeus-console-ui's
   *   CreateInstanceModal `resumePendingPurchase` prop). It's `null`/absent if the
   *   pending payload was already consumed or swept.
   */
  confirmPayment({ holdId }) {
    return this.sdk._fetch('/instances/confirm-payment', 'POST', { body: { holdId } });
  }

  /**
   * Preview the exact billing consequence of creating an instance on this plan for
   * the current org — computed entirely server-side (single source of truth). Call
   * this before `register()` and drive all charge/trial copy from the response;
   * never recompute trial/charge logic client-side.
   *
   * @param {object} params
   * @param {string} params.planId - ID of the billing plan being considered ("pln_...").
   * @param {'monthly'|'annual'} [params.billingPeriod='monthly'] - Which recurring
   *   period to preview. The response always includes both `plan.monthlyPriceCents`
   *   and `plan.annualTotalCents` (when available) so a period toggle can show both
   *   without a second round-trip; `charge`/`billingPeriod` reflect the requested one.
   * @returns {Promise<{
   *   plan: {
   *     id: string, name: string, isFree: boolean,
   *     monthlyPriceCents: number,
   *     annualMonthlyPriceCents: number | null,  // MONTHLY rate billed annually — not a total
   *     annualTotalCents: number | null,         // DERIVED yearly total — use this, never
   *                                               // annualMonthlyPriceCents * 12 yourself
   *     annualAvailable: boolean,
   *     annualSavingsPercent: number | null,
   *   },
   *   billingPeriod: 'monthly' | 'annual',
   *   trial: {
   *     available: boolean,
   *     active: boolean,
   *     expiresAt: string | null,
   *     daysRemaining: number | null,
   *     reason: 'available' | 'active' | 'expired',
   *   },
   *   charge: {
   *     whenCreated: 'none' | 'immediate' | 'deferred',
   *     amountCents: number,       // charged TODAY (0 for 'none'/'deferred')
   *     fullPeriodCents: number,   // the un-prorated STEADY-STATE recurring price
   *     prorated: boolean,         // true when the relevant charge is a partial period
   *     periodStart: string | null,
   *     periodEnd: string | null,        // MONTHLY: the billing anchor date (1st of the
   *                                       // month on/after trial end). ANNUAL (no anchor,
   *                                       // no proration — Cameron, 2026-07-13): the real
   *                                       // ANNIVERSARY instant, one year from periodStart.
   *     deferredChargeCents: number | undefined,  // ONLY on 'deferred': the REAL amount
   *       // Stripe will charge AT deferredUntil — live-verified against Stripe. MONTHLY:
   *       // possibly prorated (billing_cycle_anchor + 'create_prorations'). ANNUAL: the
   *       // FULL annual total, never prorated — this is charged automatically at
   *       // trial_end via Stripe's normal trial lifecycle.
   *     nextInvoiceDate: string | null,  // when the STEADY-STATE nextInvoiceCents begins
   *     nextInvoiceCents: number,        // the steady-state recurring price thereafter
   *     deferredUntil: string | null,    // trial end, when whenCreated === 'deferred'
   *   },
   *   alternateCharge: null | ( same shape as `charge` ),  // the honest pay-now number
   *     to show on the pay-now OPTION CARD when a trial is ALSO being offered (so both
   *     cards can quote real figures before the user picks) — null when there's nothing
   *     to alternate to (already immediate, or free).
   *   pricingSource: 'stripe' | 'estimated' | null,  // 'stripe' — every figure above
   *     came from Stripe's own invoice preview of the exact subscription about to be
   *     created (stripe.invoices.retrieveUpcoming — NOT locally-computed proration
   *     math, which was found to disagree with Stripe's second-based proration by
   *     tens of dollars for realistic, non-midnight timestamps). 'estimated' — Stripe
   *     is unconfigured server-side; these are local approximations only — creating
   *     the instance will fail until Stripe is configured. Show these figures as
   *     approximate, never as the exact charge. `null` — free plan, no money involved.
   *   paymentMethod: { onFile: boolean, brand?: string, last4?: string },
   *   canChooseTrialOrPayNow: boolean,
   * }>}
   *   `trial.reason`: `'available'` — the org has never used its trial (trialExpiresAt
   *   is null); creating this instance would START it, and `charge.deferredUntil`
   *   reflects the would-be end date. `'active'` — already in a trial window.
   *   `'expired'` — the trial ran out; paid plans charge immediately, no
   *   trial-vs-pay-now choice is offered (`canChooseTrialOrPayNow` is false).
   *
   *   `charge.amountCents` is always the REAL amount that will be charged TODAY.
   *   MONTHLY: real proration applied (server's calculateProration) — never the full
   *   price for a mid-period signup. ANNUAL (Cameron, 2026-07-13): NEVER prorated —
   *   `amountCents` for an immediate annual signup IS the full annual total, charged
   *   today, no anchor. For `whenCreated: 'deferred'`, nothing is charged today
   *   (`amountCents: 0`) — the first REAL charge is `deferredChargeCents` at
   *   `deferredUntil`. MONTHLY: possibly prorated when trial end doesn't land on a
   *   month boundary — live-verified against Stripe test mode, e.g. a $1,110.00/mo
   *   plan with a trial ending 12 Aug bills exactly $716.13 at trial end, not the full
   *   $1,110.00. ANNUAL: the full annual total, every time — no proration. After the
   *   first charge, billing settles into `nextInvoiceCents` on `nextInvoiceDate`
   *   (the anniversary, for annual) and every period following.
   *
   * @example
   * const preview = await sdk.instances.getBillingPreview({ planId: 'pln_starter_abc123' });
   * if (preview.charge.whenCreated === 'deferred') {
   *   console.log(`No charge today — $${preview.charge.deferredChargeCents / 100} on ${preview.charge.deferredUntil}, then $${preview.charge.nextInvoiceCents / 100}/period`);
   * } else if (preview.charge.whenCreated === 'immediate') {
   *   console.log(`$${preview.charge.amountCents / 100} today, then $${preview.charge.nextInvoiceCents / 100} on ${preview.charge.nextInvoiceDate}`);
   * }
   */
  getBillingPreview({ planId, billingPeriod }) {
    return this.sdk._fetch('/instances/billing-preview', 'GET', { query: { planId, billingPeriod } });
  }

  /**
   * List all instances belonging to the current organisation.
   *
   * @returns {Promise<Array<{
   *   id: string,
   *   name: string,
   *   subdomain: string,
   *   planId: string,
   *   healthy: boolean,
   *   lastHeartbeatAt: string | null,
   *   zeusVersion: string | null,
   *   clusterCount: number,
   *   vcpuAvg: number,
   *   enabled: boolean,
   *   currentImage: string | null,        // image ref this instance's container is running
   *   upgradeStatus: 'pending' | 'running' | 'aborted' | 'failed' | 'succeeded' | null,
   *   upgradeStep: string | null,         // short human string while upgradeStatus === 'running'
   *   upgradeError: string | null,        // set only when upgradeStatus === 'failed'
   *   upgradePendingUntil: string | null, // countdown deadline while upgradeStatus === 'pending'
   *                                       // (null until the instance acks a console/admin-
   *                                       // initiated upgrade — see `upgrade()`)
   *   upgradeInitiator: string | null,    // display name of whoever requested the upgrade
   *   upgradeAbortedBy: string | null,    // display name of whoever aborted the countdown
   *   lastUpgradeAt: string | null,
   *   createdAt: string,
   * }>>}
   *
   * @example
   * const instances = await sdk.instances.list();
   * for (const inst of instances) {
   *   console.log(inst.name, inst.healthy ? '✓' : '✗', inst.zeusVersion);
   * }
   */
  list() { return this.sdk._fetch('/instances', 'GET'); }

  /**
   * Get a single instance by ID.
   *
   * @param {object} params
   * @param {string} params.id - Instance ID ("ins_...").
   * @returns {Promise<{
   *   id: string,
   *   name: string,
   *   subdomain: string,
   *   planId: string,
   *   healthy: boolean,
   *   lastHeartbeatAt: string | null,
   *   zeusVersion: string | null,
   *   clusterCount: number,
   *   vcpuAvg: number,
   *   enabled: boolean,
   *   publicKey: string | null,
   *   currentImage: string | null,        // image ref this instance's container is running
   *   upgradeStatus: 'pending' | 'running' | 'aborted' | 'failed' | 'succeeded' | null,
   *   upgradeStep: string | null,         // short human string while upgradeStatus === 'running'
   *   upgradeError: string | null,        // set only when upgradeStatus === 'failed'
   *   upgradePendingUntil: string | null, // countdown deadline while upgradeStatus === 'pending'
   *   upgradeInitiator: string | null,    // display name of whoever requested the upgrade
   *   upgradeAbortedBy: string | null,    // display name of whoever aborted the countdown
   *   lastUpgradeAt: string | null,
   *   createdAt: string,
   * }>}
   *
   * @example
   * const inst = await sdk.instances.get({ id: 'ins_abc123' });
   * console.log('Last seen:', inst.lastHeartbeatAt);
   */
  get({ id }) { return this.sdk._fetch(`/instances/${id}`, 'GET'); }

  /**
   * Update mutable instance fields.
   *
   * @param {object} params
   * @param {string} params.id   - Instance ID ("ins_...").
   * @param {string} params.name - New display name.
   * @returns {Promise<{ id: string, name: string }>}
   *
   * @example
   * await sdk.instances.update({ id: 'ins_abc123', name: 'Production EU' });
   */
  update({ id, name, port }) { return this.sdk._fetch(`/instances/${id}`, 'PATCH', { body: { name, port } }); }

  /**
   * Delete (deregister) an instance. Does not affect the running deployment —
   * only removes the console record and invalidates the license key.
   *
   * @param {object} params
   * @param {string} params.id - Instance ID ("ins_...").
   * @returns {Promise<{ ok: true }>}
   *
   * @example
   * await sdk.instances.delete({ id: 'ins_abc123' });
   */
  delete({ id }) { return this.sdk._fetch(`/instances/${id}`, 'DELETE'); }

  /**
   * Get a ready-to-run curl command for testing this instance's API connectivity.
   * Useful for debugging firewall/network issues between the console and the instance.
   *
   * @param {object} params
   * @param {string} params.id - Instance ID ("ins_...").
   * @returns {Promise<{ command: string }>}
   *   `command` is a complete curl one-liner you can paste into a terminal.
   *
   * @example
   * const { command } = await sdk.instances.getCurlCommand({ id: 'ins_abc123' });
   * console.log(command);
   * // curl -H "X-License-Key: ins_..." https://prod.example.com/api/health
   */
  getCurlCommand({ id }) { return this.sdk._fetch(`/instances/${id}/curl-command`, 'GET'); }

  /**
   * Reveal an instance's license key (ZC-SEC-01). Owner/admin only — a plain org member
   * gets a 403. Every successful call is audit-logged on the console side, so treat this
   * as a deliberate, traceable action rather than something to call speculatively (e.g.
   * gate the UI behind an explicit "reveal" click, don't prefetch it into a list view).
   *
   * @param {object} params
   * @param {string} params.id - Instance ID ("ins_...").
   * @returns {Promise<{ licenseKey: string }>}
   *
   * @example
   * const { licenseKey } = await sdk.instances.getLicenseKey({ id: 'ins_abc123' });
   */
  getLicenseKey({ id }) { return this.sdk._fetch(`/instances/${id}/license-key`, 'GET'); }

  /**
   * Get a one-time SSO redirect URL to log into the instance's Zeus UI
   * directly from the console, without entering credentials again.
   *
   * The returned URL is short-lived (typically 60 seconds).
   *
   * @param {object} params
   * @param {string} params.id - Instance ID ("ins_...").
   * @returns {Promise<{ url: string }>}
   *
   * @example
   * const { url } = await sdk.instances.getSsoRedirect({ id: 'ins_abc123' });
   * window.open(url, '_blank');
   */
  getSsoRedirect({ id }) { return this.sdk._fetch(`/instances/${id}/sso-redirect`, 'GET'); }

  /**
   * Send a heartbeat from a running Zeus instance to the console.
   * Call this on a regular interval (default: every 60 seconds) from within
   * the Zeus process itself, using the instance's license key for auth.
   *
   * The console uses heartbeats to track health, version, and usage metrics.
   * Missing heartbeats will mark the instance as unhealthy after the grace period.
   *
   * @param {object} params
   * @param {string}  params.licenseKey    - The instance's own license key ("ins_...").
   * @param {string}  params.subdomain     - The instance's subdomain slug.
   * @param {number}  params.vcpuAvg       - Average vCPU usage across all clusters (float).
   * @param {number}  params.clusterCount  - Number of clusters currently managed.
   * @param {string}  params.zeusVersion   - Current Zeus version string, e.g. "1.4.2".
   * @param {boolean} params.healthy       - Whether the instance considers itself healthy.
   * @param {number|null} [params.dnsEndpointsActive] - Count of derived DNS records currently
   *   armed for external automation (publish.external.enabled && publish.external.automation).
   *   Null when the count couldn't be computed this cycle — omit reporting, don't fail the beat.
   * @returns {Promise<{ ok: true, upgrade_pending: { deadline: string, initiator: string | null, countdown_seconds: number } | null }>}
   *   `upgrade_pending` is non-null only while the instance has a `'pending'` upgrade
   *   countdown — this response IS one of the two ack points that stamps the deadline for
   *   a console/admin-initiated upgrade (the other is `getSelfUpgradeStatus()`), so
   *   `deadline` is always populated whenever this field is non-null.
   *
   * @example
   * // Called from within the Zeus process on an interval
   * setInterval(async () => {
   *   await sdk.instances.heartbeat({
   *     licenseKey: process.env.ZEUS_LICENSE_KEY,
   *     subdomain: 'prod',
   *     vcpuAvg: await getAverageVcpuUsage(),
   *     clusterCount: clusters.length,
   *     zeusVersion: '1.4.2',
   *     healthy: true,
   *     dnsEndpointsActive: await countAutomatedEndpoints(),
   *   });
   * }, 60_000);
   */
  heartbeat({ licenseKey, subdomain, vcpuAvg, clusterCount, zeusVersion, healthy, dnsEndpointsActive }) {
    return this.sdk._fetch('/heartbeat', 'POST', { body: { licenseKey, subdomain, vcpuAvg, clusterCount, zeusVersion, healthy, dnsEndpointsActive } });
  }

  /**
   * Force the console to re-fetch and cache the latest license state for this
   * instance (plan, limits, expiry). Useful after a plan change or credit
   * application takes effect — otherwise the instance waits for the next
   * heartbeat cycle to pick up the new entitlements.
   *
   * @param {object} params
   * @param {string} params.id - Instance ID ("ins_...").
   * @returns {Promise<{ ok: true }>}
   *
   * @example
   * await sdk.instances.syncLicense({ id: 'ins_abc123' });
   */
  syncLicense({ id }) { return this.sdk._fetch(`/instances/${id}/sync`, 'POST', { body: {} }); }

  /**
   * Register or replace the instance's RSA public key.
   * The console stores this key and uses it to verify signed payloads from the
   * instance (e.g. SSO assertions). Call this after generating a new keypair on
   * the instance side.
   *
   * @param {object} params
   * @param {string} params.id        - Instance ID ("ins_...").
   * @param {string} params.publicKey - PEM-encoded RSA public key.
   * @returns {Promise<{ ok: true }>}
   *
   * @example
   * const publicKey = fs.readFileSync('./keys/instance.pub', 'utf8');
   * await sdk.instances.pushKeypair({ id: 'ins_abc123', publicKey });
   */
  pushKeypair({ id, publicKey }) { return this.sdk._fetch(`/instances/${id}/keypair`, 'POST', { body: { publicKey } }); }

  /**
   * List the users with access (SSO) to this instance/cluster, plus seat usage.
   * Each live member counts toward the cluster's seat limit (null = unlimited).
   *
   * @param {object} params
   * @param {string} params.id - Instance ID ("ins_...").
   * @returns {Promise<{ members: Array<object>, seatUsed: number, seatLimit: number|null }>}
   *
   * @example
   * const { members, seatUsed, seatLimit } = await sdk.instances.listMembers({ id: 'ins_abc123' });
   */
  listMembers({ id }) { return this.sdk._fetch(`/instances/${id}/members`, 'GET'); }

  /**
   * Verify console→instance reachability using the nonce-challenge probe.
   * Called by the installer's Go binary (or manually) after the instance
   * reports its first heartbeat. Uses the instance's own license key
   * (X-License-Key auth) — NOT a session-authenticated call.
   *
   * @returns {Promise<{
   *   reachable: boolean,
   *   tls_ok: boolean,
   *   nonce_ok: boolean,
   *   last_heartbeat_at: string | null,
   *   detail: string | null,
   * }>}
   *
   * @example
   * // Called with an instance-scoped SDK (license key auth)
   * const result = await sdk.instances.verify();
   * if (result.reachable && result.tls_ok && result.nonce_ok) console.log('probe passed');
   */
  verify() { return this.sdk._fetch('/instances/verify', 'POST', { body: {} }); }

  /**
   * Report this instance's current public IPv4 address so the console can
   * provision (or update) the DNS record for its subdomain.
   * Callable by the instance itself (license key) or by a console session
   * user who owns the instance's org.
   *
   * @param {object} params
   * @param {string} params.id - Instance ID ("ins_...").
   * @param {string} params.ip - Public IPv4 address, e.g. "203.0.113.7".
   * @returns {Promise<{ dnsTarget: string, dnsProvisionedAt: string }>}
   *
   * @example
   * await sdk.instances.setDnsTarget({ id: 'ins_abc123', ip: '203.0.113.7' });
   */
  setDnsTarget({ id, ip }) { return this.sdk._fetch(`/instances/${id}/dns-target`, 'POST', { body: { ip } }); }

  /**
   * Get the full self-hosted install command for this instance — a
   * ready-to-run `curl … | bash` one-liner embedding the instance's license
   * key. Always fetch this rather than assembling it client-side.
   *
   * @param {object} params
   * @param {string} params.id - Instance ID ("ins_...").
   * @returns {Promise<{ command: string }>}
   *
   * @example
   * const { command } = await sdk.instances.getInstallCommand({ id: 'ins_abc123' });
   */
  getInstallCommand({ id }) { return this.sdk._fetch(`/instances/${id}/install-command`, 'GET'); }

  /**
   * Retry a failed cloud provisioning build.
   *
   * @param {object} params
   * @param {string} params.id - Instance ID ("ins_...").
   * @returns {Promise<{ ok: true }>}
   *
   * @example
   * await sdk.instances.retryProvision({ id: 'ins_abc123' });
   */
  retryProvision({ id }) { return this.sdk._fetch(`/instances/${id}/retry-provision`, 'POST', { body: {} }); }

  /**
   * Preview the exact billing consequence of resuming a suspended instance — call this
   * BEFORE `resume()` and show the customer the amount and the card that will be
   * charged. Read-only: never mutates anything in Stripe. This project's rule is that
   * a card charge is never a surprise — resuming a monthly instance mid-period can
   * charge a prorated fee for the remainder of the current term, and the customer must
   * see that figure and the payment method up front.
   *
   * @param {object} params
   * @param {string} params.id - Instance ID ("ins_...").
   * @returns {Promise<{
   *   resumable: boolean,
   *   purchaseRequired: boolean,   // annual subscription whose paid term lapsed while
   *                                 // suspended — resume() will 402; the customer must
   *                                 // purchase again instead.
   *   requiresPayment: boolean,    // true for a monthly instance resumed mid-period;
   *                                 // false for an annual instance still within its
   *                                 // already-paid term (resumes at no charge).
   *   amountDueCents: number,      // Stripe's figure for the partial period; 0 when
   *                                 // nothing is owed.
   *   currency: string,
   *   coverageStart: string,       // start of the partial window being charged for
   *   coverageEnd: string,         // end of that window, e.g. resuming Jun 20 on a
   *                                 // monthly plan covers Jun 20 -> Jun 30.
   *   nextInvoiceDate: string,     // when normal recurring billing resumes, e.g. Jul 1
   *   nextAmountCents: number,
   *   paymentMethod: { id: string, brand: string, last4: string, nickname: string | null } | null,
   * }>}
   *
   * @example
   * const preview = await sdk.instances.resumePreview({ id: 'ins_abc123' });
   * if (preview.purchaseRequired) {
   *   // Route to purchase-again flow, not resume().
   * } else if (preview.requiresPayment) {
   *   // Show `${preview.amountDueCents / 100}` charged to preview.paymentMethod, then resume().
   * } else {
   *   await sdk.instances.resume({ id: 'ins_abc123' });
   * }
   */
  resumePreview({ id }) { return this.sdk._fetch(`/instances/${id}/resume-preview`, 'GET'); }

  /**
   * Resume a suspended instance. Typically called by the customer after a Zeus admin
   * has re-enabled their org (see `sdk.internal.admin.enableOrg`) — an org enable does
   * NOT automatically resume instances, so the customer takes this action explicitly.
   *
   * Call `resumePreview()` first and show the customer the amount/card before calling
   * this — never charge a card as a surprise.
   *
   * Re-enables the instance, restarts its cloud container, and resumes billing:
   *   - Monthly subscription — un-pauses and resumes normal recurring billing. If
   *     resumed mid-period, this charges a prorated fee for the remainder of the
   *     current term (see `resumePreview().amountDueCents`) using `paymentMethodId`
   *     (or the org's default card if omitted).
   *   - Annual subscription still within its paid term — resumes at no charge for the
   *     remainder of the term.
   *   - Annual subscription whose paid term lapsed while suspended — rejects with HTTP
   *     402 and body `{ error: 'purchase_required' }`; the customer must purchase again
   *     (there is no partial-term proration path here, unlike `register()`'s payment
   *     flow).
   *
   * The instance is only re-enabled after payment actually succeeds. Like
   * `register()`, a charge may require 3D Secure / SCA — in that case this REJECTS
   * with `err.status === 402` and `err.body === { requiresAction: true, clientSecret,
   * invoiceId }` and does NOT re-enable the instance yet.
   *
   * IMPORTANT: this is a DIFFERENT continuation than the purchase flow. Resume collects
   * money via a Stripe INVOICE, not a payment-intent hold — there is no `holdId` here.
   * Do NOT call `confirmPayment({ holdId })` for a resume challenge; it will not work.
   * Drive the cardholder through `stripe.handleNextAction({ clientSecret })`, then call
   * `resumeConfirm({ id, invoiceId })` to finish resuming once the challenge succeeds.
   *
   * @param {object} params
   * @param {string} params.id - Instance ID ("ins_...").
   * @param {string} [params.paymentMethodId] - Use this specific saved card ("pm_...")
   *   for the prorated charge instead of the org's Stripe default/first card. Ignored
   *   when `resumePreview().requiresPayment` is false.
   * @returns {Promise<{ ok: true }>}
   *   On a lapsed annual term: rejects with `err.status === 402` and
   *   `err.body.error === 'purchase_required'`. On a charge requiring 3DS/SCA: rejects
   *   with `err.status === 402` and `err.body === { requiresAction: true, clientSecret,
   *   invoiceId }` — see `resumeConfirm()`. On a declined charge: rejects with
   *   `err.status === 402` and `err.body.paymentFailed === true`.
   *
   * @example
   * const preview = await sdk.instances.resumePreview({ id: 'ins_abc123' });
   * if (preview.purchaseRequired) {
   *   // route the customer to purchase again
   * } else {
   *   try {
   *     await sdk.instances.resume({ id: 'ins_abc123' });
   *   } catch (err) {
   *     if (err.body?.requiresAction) {
   *       await stripe.handleNextAction({ clientSecret: err.body.clientSecret });
   *       await sdk.instances.resumeConfirm({ id: 'ins_abc123', invoiceId: err.body.invoiceId });
   *     } else {
   *       throw err;
   *     }
   *   }
   * }
   */
  resume({ id, paymentMethodId }) { return this.sdk._fetch(`/instances/${id}/resume`, 'POST', { body: { paymentMethodId } }); }

  /**
   * Finish resuming an instance after `resume()` rejected with
   * `{ requiresAction: true, clientSecret, invoiceId }` and the cardholder has
   * completed the 3D Secure / SCA challenge (`stripe.handleNextAction({ clientSecret })`
   * client-side).
   *
   * This is the resume flow's OWN confirm step — resume collects money via a Stripe
   * INVOICE, not the payment-intent hold used by `register()`/`confirmPayment({
   * holdId })`. Do not mix the two: calling `confirmPayment({ holdId })` for a resume
   * challenge is wrong (there is no hold) and would leave the customer charged but
   * still suspended.
   *
   * Re-reads the invoice from Stripe itself (never trusts the client's word that
   * payment succeeded) and:
   *   - Invoice paid — the instance is enabled and its container started, ONLY at this
   *     point. Resolves `{ instance, billing: { charged: true, amountChargedCents,
   *     invoiceId } }`.
   *   - Still mid-challenge — nothing has changed yet. Resolves with the same
   *     `{ requiresAction: true, clientSecret, invoiceId }` shape again (safe to poll).
   *   - Payment genuinely failed — the subscription is put back to its paused state and
   *     the instance stays suspended (no free service). Rejects with
   *     `err.status === 402` and `err.body === { error, paymentFailed: true,
   *     declineCode?, errorCode? }`.
   *
   * Idempotent — safe to call more than once (e.g. the customer refreshed mid-challenge).
   *
   * @param {object} params
   * @param {string} params.id        - Instance ID ("ins_...").
   * @param {string} params.invoiceId - The Stripe invoice ID from `resume()`'s
   *   `requiresAction` response ("in_...").
   * @returns {Promise<
   *   { instance: object, billing: { charged: true, amountChargedCents: number, invoiceId: string } }
   *   | { requiresAction: true, clientSecret: string, invoiceId: string }
   * >}
   *
   * @example
   * try {
   *   await sdk.instances.resume({ id: 'ins_abc123' });
   * } catch (err) {
   *   if (err.body?.requiresAction) {
   *     await stripe.handleNextAction({ clientSecret: err.body.clientSecret });
   *     const result = await sdk.instances.resumeConfirm({ id: 'ins_abc123', invoiceId: err.body.invoiceId });
   *     if (result.requiresAction) {
   *       // challenge still not complete; re-prompt or poll
   *     }
   *   }
   * }
   */
  resumeConfirm({ id, invoiceId }) { return this.sdk._fetch(`/instances/${id}/resume-confirm`, 'POST', { body: { invoiceId } }); }

  /**
   * Check whether a subdomain slug is available for a new instance. Subdomains are
   * globally unique and permanent once an instance is created — use this to give
   * live feedback in the create-instance wizard before the user submits.
   *
   * @param {object} params
   * @param {string} params.subdomain - Candidate subdomain slug to check.
   * @returns {Promise<{ available: boolean, reason?: 'invalid' | 'taken' }>}
   *
   * @example
   * const { available, reason } = await sdk.instances.checkSubdomain({ subdomain: 'acme' });
   * if (!available) console.log(reason); // 'invalid' | 'taken'
   */
  checkSubdomain({ subdomain }) { return this.sdk._fetch('/instances/subdomain-available', 'GET', { query: { subdomain } }); }

  /**
   * Get the latest published Zeus release — used to show an "upgrade available" badge
   * before calling `upgrade()`. Session-authenticated; not scoped to any one instance.
   *
   * @returns {Promise<{ version: string | null, image: string | null, publishedAt: string | null, notes: string | null }>}
   *   All null if the release manifest couldn't be fetched right now — never rejects for that.
   *
   * @example
   * const latest = await sdk.instances.getLatestVersion();
   * if (latest.version && latest.version !== instance.zeusVersion) showUpgradeBadge();
   */
  getLatestVersion() { return this.sdk._fetch('/instances/latest-version', 'GET'); }

  /**
   * Upgrade a cloud-hosted instance in place to the latest published Zeus release.
   * Doesn't run immediately — enters a `'pending'` countdown (`countdownSeconds`, server-
   * owned) that ANY user of the instance can abort with `upgradeAbort()` before it
   * actually starts. Once the countdown elapses, the pipeline pulls the new image,
   * recreates the container (migrations auto-run on boot), and waits for it to come back
   * healthy — all in the background. Poll `get()`/`list()` (or subscribe to
   * `instance:<id>:upgrade` via `sdk.subscribe()` for `upgrade.pending`/`upgrade.aborted`/
   * `upgrade.step`/`upgrade.done`/`upgrade.failed`) for live status.
   *
   * Note: `deadline` may be `null` in the immediate response — this is a console/admin-
   * initiated upgrade, so the countdown doesn't start until the instance itself acks (via
   * its next heartbeat or self-upgrade-status poll); watch the SSE channel or re-poll
   * `get()` for the stamped `upgradePendingUntil`.
   *
   * @param {object} params
   * @param {string} params.id - Instance ID ("ins_...").
   * @returns {Promise<
   *   { started: true, pending: true, deadline: string | null, initiator: string | null, countdownSeconds: number }
   *   | { started: false, upToDate: true }
   * >}
   *   `upToDate: true` — the instance is already on the latest image; nothing was started.
   *   Rejects with HTTP 409 if an upgrade countdown/run is already in progress, or the
   *   instance isn't `hostingMode: 'cloud'` / `provisioningStatus: 'ready'`.
   *
   * @example
   * const result = await sdk.instances.upgrade({ id: 'ins_abc123' });
   * if (!result.started && result.upToDate) console.log('Already on the latest version');
   */
  upgrade({ id }) { return this.sdk._fetch(`/instances/${id}/upgrade`, 'POST', { body: {} }); }

  /**
   * Abort a pending upgrade countdown for an instance — session-authenticated,
   * organization-scoped. Only valid while the instance's `upgradeStatus === 'pending'`;
   * rejects with HTTP 409 otherwise.
   *
   * @param {object} params
   * @param {string} params.id - Instance ID ("ins_...").
   * @returns {Promise<{ aborted: true, abortedBy: string | null }>}
   *
   * @example
   * await sdk.instances.upgradeAbort({ id: 'ins_abc123' });
   */
  upgradeAbort({ id }) { return this.sdk._fetch(`/instances/${id}/upgrade/abort`, 'POST', { body: {} }); }

  /**
   * Instance-triggered self-upgrade — same as `upgrade()` but authenticated with the
   * instance's own license key (X-License-Key), for a Zeus instance to request its own
   * upgrade rather than waiting on a console session user. Unlike `upgrade()`, the
   * countdown deadline is stamped and returned immediately (this call itself is the ack —
   * the instance gets the response synchronously and broadcasts it to its own users right
   * away), so `deadline` is never `null` here.
   *
   * @param {object} [params]
   * @param {string} [params.initiator] - Display name of the instance user who requested
   *   the upgrade (e.g. "Cameron"), shown in the countdown UI everywhere. Optional.
   * @returns {Promise<
   *   { started: true, pending: true, deadline: string, initiator: string | null, countdownSeconds: number }
   *   | { started: false, upToDate: true }
   * >}
   *
   * @example
   * // Called with an instance-scoped SDK (license key auth)
   * await sdk.instances.selfUpgrade({ initiator: 'Cameron' });
   */
  selfUpgrade({ initiator } = {}) { return this.sdk._fetch('/instances/self-upgrade', 'POST', { body: { initiator } }); }

  /**
   * Abort this instance's own pending upgrade countdown — instance-authenticated (license
   * key), same auth as `selfUpgrade()`. Relayed from a local instance user aborting via
   * the in-app countdown. Only valid while `upgradeStatus === 'pending'`; rejects with
   * HTTP 409 otherwise.
   *
   * @param {object} [params]
   * @param {string} [params.abortedBy] - Display name of the instance user who aborted it.
   * @returns {Promise<{ aborted: true, abortedBy: string | null }>}
   *
   * @example
   * await sdk.instances.selfUpgradeAbort({ abortedBy: 'Cameron' });
   */
  selfUpgradeAbort({ abortedBy } = {}) { return this.sdk._fetch('/instances/self-upgrade/abort', 'POST', { body: { abortedBy } }); }

  /**
   * Poll this instance's own upgrade progress. Instance-authenticated (license key),
   * same auth as `selfUpgrade()`. If a console/admin-initiated upgrade is `'pending'` and
   * hasn't been acked yet, calling this STAMPS the countdown deadline (giving the full
   * countdown window starting from this call) and broadcasts it — this is one of the two
   * ack points (the other is the regular heartbeat's `upgrade_pending` field).
   *
   * @returns {Promise<{
   *   zeusVersion: string | null,
   *   currentImage: string | null,
   *   latestVersion: string | null,
   *   latestImage: string | null,
   *   upgradeStatus: 'pending' | 'running' | 'aborted' | 'failed' | 'succeeded' | null,
   *   upgradeStep: string | null,
   *   upgradeError: string | null,
   *   lastUpgradeAt: string | null,
   *   upgradePendingUntil: string | null,  // countdown deadline while upgradeStatus === 'pending'
   *   upgradeInitiator: string | null,     // display name of whoever requested the upgrade
   *   upgradeAbortedBy: string | null,     // display name of whoever aborted the countdown
   *   countdownSeconds: number,            // server-owned countdown length
   * }>}
   *
   * @example
   * const status = await sdk.instances.getSelfUpgradeStatus();
   */
  getSelfUpgradeStatus() { return this.sdk._fetch('/instances/self-upgrade/status', 'GET'); }
}
