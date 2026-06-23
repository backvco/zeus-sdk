// @ts-nocheck
/**
 * AuditService — submit and query immutable audit log events.
 *
 * Accessed as `sdk.audit`.
 *
 * Audit events are append-only records of significant actions in the system
 * (logins, instance creates, plan changes, etc.). They are used for compliance,
 * debugging, and customer visibility.
 *
 * ─── Offline resilience (Node.js only) ───────────────────────────────────────
 *
 * When running in Node.js (e.g. inside a Zeus instance), failed submissions are
 * cached locally in ~/.zeus-audit-cache.jsonl. On the next successful call,
 * the cache is flushed first so no events are lost during a console outage.
 *
 * In the browser there is no filesystem, so the cache is skipped — the error
 * still propagates to the caller so you can handle it in your UI.
 *
 * @example
 * // Submit a single event
 * await sdk.audit.submitEvent({
 *   eventType: 'cluster.created',
 *   userId: 'usr_abc',
 *   orgId: 'org_xyz',
 *   meta: { clusterName: 'prod-us-east-1', provider: 'aws' },
 * });
 *
 * // Query recent events
 * const { events, total } = await sdk.audit.query({
 *   orgId: 'org_xyz',
 *   eventType: 'cluster.created',
 *   from: '2024-01-01T00:00:00Z',
 *   limit: 50,
 * });
 */

const CACHE_FILE = '.zeus-audit-cache.jsonl';

async function nodeFs() {
  // Only resolves in a Node runtime; in the browser the dynamic import rejects and
  // we treat the environment as "no local cache available".
  if (typeof process === 'undefined' || !process.versions?.node) return null;
  try {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    return { fs, path: path.join(os.homedir(), CACHE_FILE) };
  } catch {
    return null;
  }
}

export class AuditService {
  constructor(sdk) { this.sdk = sdk; }

  // Append events to the local JSONL cache (Node.js only). One JSON object per line.
  async _appendCache(events) {
    const env = await nodeFs();
    if (!env) return;
    const lines = events.map((e) => JSON.stringify(e)).join('\n') + '\n';
    env.fs.appendFileSync(env.path, lines, 'utf8');
  }

  // Read and POST the cached events, then delete the cache file.
  async _flushCache() {
    const env = await nodeFs();
    if (!env || !env.fs.existsSync(env.path)) return;
    const raw = env.fs.readFileSync(env.path, 'utf8').trim();
    if (!raw) { env.fs.unlinkSync(env.path); return; }
    const events = raw.split('\n').filter(Boolean).map((l) => JSON.parse(l));
    await this.sdk._fetch('/audit/events', 'POST', { body: { events } });
    env.fs.unlinkSync(env.path);
  }

  /**
   * Submit a single audit event. Internally calls submitBatch with one event.
   * In Node.js, flushes any locally cached events first, then sends this one.
   * On failure in Node.js, appends to the local cache and rethrows.
   *
   * @param {object} event
   * @param {string}  event.eventType  - Dot-namespaced action, e.g. "cluster.created".
   * @param {string}  [event.userId]   - "usr_..." of the acting user.
   * @param {string}  [event.orgId]    - "org_..." of the org this event belongs to.
   * @param {object}  [event.meta]     - Arbitrary key-value metadata for the event.
   * @returns {Promise<{ ok: true }>}
   *
   * @example
   * await sdk.audit.submitEvent({
   *   eventType: 'instance.deleted',
   *   userId: 'usr_abc',
   *   orgId: 'org_xyz',
   *   meta: { instanceId: 'ins_old', instanceName: 'Staging' },
   * });
   */
  async submitEvent(event) {
    return this.submitBatch([event]);
  }

  /**
   * Submit multiple audit events in a single request.
   * In Node.js, flushes any locally cached events first.
   * On failure in Node.js, all events are appended to the local cache and
   * the error is rethrown — they will be retried on the next submitEvent/submitBatch call.
   *
   * @param {Array<{
   *   eventType: string,
   *   userId?: string,
   *   orgId?: string,
   *   meta?: object,
   * }>} events - Array of event objects.
   * @returns {Promise<{ ok: true, count: number }>}
   *
   * @example
   * await sdk.audit.submitBatch([
   *   { eventType: 'node.drained',   orgId: 'org_xyz', meta: { node: 'node-1' } },
   *   { eventType: 'node.cordoned',  orgId: 'org_xyz', meta: { node: 'node-1' } },
   * ]);
   */
  async submitBatch(events) {
    try {
      await this._flushCache();
      return await this.sdk._fetch('/audit/events', 'POST', { body: { events } });
    } catch (err) {
      await this._appendCache(events);
      throw err;
    }
  }

  /**
   * Query the audit log with optional filters. Returns a paginated list of events.
   *
   * @param {object} [params]
   * @param {string} [params.orgId]      - Filter to a specific org ("org_...").
   * @param {string} [params.eventType]  - Filter by event type, e.g. "cluster.created".
   * @param {string} [params.from]       - ISO 8601 start of time range.
   * @param {string} [params.to]         - ISO 8601 end of time range.
   * @param {number} [params.page]       - Page number (1-indexed). Default: 1.
   * @param {number} [params.limit]      - Events per page. Default: 50, max: 500.
   * @returns {Promise<{
   *   events: Array<{
   *     id: string,          // "aud_..."
   *     eventType: string,
   *     userId: string | null,
   *     orgId: string | null,
   *     meta: object,
   *     createdAt: string,
   *   }>,
   *   total: number,
   *   page: number,
   *   limit: number,
   * }>}
   *
   * @example
   * const { events, total } = await sdk.audit.query({
   *   orgId: 'org_xyz',
   *   from: '2024-06-01T00:00:00Z',
   *   to:   '2024-06-30T23:59:59Z',
   *   limit: 100,
   * });
   * console.log(`${total} events in June`);
   */
  query({ orgId, eventType, from, to, page, limit } = {}) {
    return this.sdk._fetch('/audit/events', 'GET', { query: clean({ orgId, eventType, from, to, page, limit }) });
  }

  /**
   * Export audit events as a CSV file. Returns raw CSV text.
   * Useful for feeding into spreadsheets or compliance reporting tools.
   *
   * @param {object} [params]
   * @param {string} [params.orgId]  - Filter to a specific org.
   * @param {string} [params.from]   - ISO 8601 start of time range.
   * @param {string} [params.to]     - ISO 8601 end of time range.
   * @returns {Promise<string>} Raw CSV text (not parsed — write directly to a file or Blob).
   *
   * @example
   * const csv = await sdk.audit.exportCsv({
   *   orgId: 'org_xyz',
   *   from: '2024-01-01T00:00:00Z',
   *   to:   '2024-12-31T23:59:59Z',
   * });
   * fs.writeFileSync('audit-2024.csv', csv);
   */
  exportCsv({ orgId, from, to } = {}) {
    return this.sdk._fetch('/audit/export', 'GET', { query: clean({ orgId, from, to, format: 'csv' }) });
  }

  /**
   * Export audit events as a JSON file. Returns a JSON string (not parsed).
   * Useful when you need the full structured data without an API pagination loop.
   *
   * @param {object} [params]
   * @param {string} [params.orgId]  - Filter to a specific org.
   * @param {string} [params.from]   - ISO 8601 start of time range.
   * @param {string} [params.to]     - ISO 8601 end of time range.
   * @returns {Promise<string>} Raw JSON text string.
   *
   * @example
   * const json = await sdk.audit.exportJson({
   *   orgId: 'org_xyz',
   *   from: '2024-06-01T00:00:00Z',
   * });
   * const events = JSON.parse(json);
   */
  exportJson({ orgId, from, to } = {}) {
    return this.sdk._fetch('/audit/export', 'GET', { query: clean({ orgId, from, to, format: 'json' }) });
  }
}

function clean(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null) out[k] = v;
  return out;
}
