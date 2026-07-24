// @ts-nocheck
/**
 * ProberService — instance-facing surface of the Zeus prober fleet feature.
 *
 * Accessed as `sdk.prober`. Both methods use instance auth (X-License-Key) — this
 * is what a Zeus instance calls to (a) submit the set of externally-published
 * records/targets it wants vantage-point health checked, and (b) explicitly pull
 * the latest signed verdicts (in addition to the piggybacked copy already carried
 * on every heartbeat response's `prober.verdicts` field).
 *
 * Fleet-node-facing routes (enroll, heartbeat, manifest fetch, SSE, observations,
 * region IPs) are called directly by the Go fleet binary's own HTTP client and are
 * intentionally NOT wrapped here.
 *
 * See CONTRACT.md §2.6/§2.7 for the full wire contract.
 */
export class ProberService {
  constructor(sdk) { this.sdk = sdk; }

  /**
   * Submit this instance's manifest of probe targets — the full desired set,
   * replacing whatever was previously accepted for this instance.
   *
   * @param {object} params
   * @param {number} params.manifestVersion - Monotonically increasing version for this instance's manifest.
   * @param {Array<{
   *   recordKey: string,
   *   target: string,
   *   probeType?: 'http' | 'https',
   *   port?: number | null,
   *   path?: string,
   *   timeoutMs?: number,
   *   intervalSec: number,
   *   failureThreshold?: number,
   *   recoveryThreshold?: number,
   *   regions: string[],
   * }>} params.entries - One entry per monitored record; regions is a list of `prober_regions.code`.
   *
   * @returns {Promise<{
   *   accepted: boolean,
   *   manifestVersion?: number,
   *   contentHash?: string,
   *   recordCount?: number,
   *   regionsAssigned?: Record<string, string[]>,
   *   reason?: string,
   *   error?: string,
   *   details?: object,
   * }>}
   *
   * @example
   * const result = await sdk.prober.submitManifest({
   *   manifestVersion: 7,
   *   entries: [{
   *     recordKey: 'myapp',
   *     target: 'myapp-z01.prod.acme.z-01.zeusk8s.com',
   *     probeType: 'https',
   *     port: 443,
   *     path: '/',
   *     timeoutMs: 5000,
   *     intervalSec: 15,
   *     regions: ['us-east', 'eu-west', 'ap-south'],
   *   }],
   * });
   */
  submitManifest({ manifestVersion, entries }) {
    return this.sdk._fetch('/prober/manifest', 'POST', { body: { manifestVersion, entries } });
  }

  /**
   * Explicitly pull all non-expired signed verdicts for this instance. Used on
   * cold boot (before the first heartbeat interval elapses) or to recover a
   * verdict the instance suspects it missed via the heartbeat piggyback.
   *
   * @returns {Promise<{
   *   verdicts: Array<{
   *     recordKey: string,
   *     payloadCanonical: string,
   *     signature: string,
   *     alg: 'ed25519',
   *     keyId: string,
   *   }>,
   * }>}
   *
   * @example
   * const { verdicts } = await sdk.prober.getVerdicts();
   */
  getVerdicts() {
    return this.sdk._fetch('/prober/verdicts', 'GET');
  }

  /**
   * Pull the most recent raw health-check results (probe observations) the fleet
   * recorded for ONE of this instance's own endpoints — the per-check detail
   * behind a verdict, including the error text on a failed check. Rows are kept
   * for ~48h console-side and are hard-scoped to the calling instance.
   *
   * @param {object} params
   * @param {string} params.endpoint - Record key, e.g. 'derived:app1:dev-d00:socket'.
   * @param {number} [params.limit=20] - Max rows, newest first (console clamps to its own ceiling).
   *
   * @returns {Promise<{
   *   observations: Array<{
   *     region: string,
   *     target: string,
   *     outcome: 'ok' | 'fail' | 'timeout',
   *     latencyMs: number | null,
   *     error: string | null,
   *     observedAt: string,
   *   }>,
   * }>}
   *
   * @example
   * const { observations } = await sdk.prober.getObservations({
   *   endpoint: 'derived:app1:dev-d00:socket',
   *   limit: 20,
   * });
   */
  getObservations({ endpoint, limit = 20 }) {
    return this.sdk._fetch('/prober/observations', 'GET', { query: { endpoint, limit } });
  }
}
