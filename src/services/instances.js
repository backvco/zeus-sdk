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
 *   5. delete()         — decommission when the instance is torn down
 */
export class InstancesService {
  constructor(sdk) { this.sdk = sdk; }

  /**
   * Register a new Zeus instance. Returns the license key that the instance
   * must use for all server-to-server SDK calls.
   *
   * @param {object} params
   * @param {string} params.name      - Human-readable name, e.g. "Production".
   * @param {string} params.subdomain - URL-safe subdomain slug, e.g. "prod".
   * @param {string} params.planId    - ID of the billing plan to subscribe to ("pln_...").
   * @returns {Promise<{
   *   id: string,          // "ins_..."
   *   name: string,
   *   subdomain: string,
   *   licenseKey: string,  // "ins_..." key — store securely, shown only once
   *   planId: string,
   *   createdAt: string,
   * }>}
   *
   * @example
   * const instance = await sdk.instances.register({
   *   name: 'Production',
   *   subdomain: 'prod',
   *   planId: 'pln_starter_abc123',
   * });
   * // Store instance.licenseKey in your deployment secrets
   * console.log('License key:', instance.licenseKey);
   */
  register({ name, subdomain, planId, port }) { return this.sdk._fetch('/instances', 'POST', { body: { name, subdomain, planId, port } }); }

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
   * @returns {Promise<{ ok: true }>}
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
   *   });
   * }, 60_000);
   */
  heartbeat({ licenseKey, subdomain, vcpuAvg, clusterCount, zeusVersion, healthy }) {
    return this.sdk._fetch('/heartbeat', 'POST', { body: { licenseKey, subdomain, vcpuAvg, clusterCount, zeusVersion, healthy } });
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
}
