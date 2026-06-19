// @ts-nocheck
// zeus-sdk/src/services/audit.js
//
// AuditService. Used by the console UI (browser) and by Zeus instances (Node.js).
// In Node it keeps a local JSONL cache so events survive a console outage: a failed
// submit appends to ~/.zeus-audit-cache.jsonl, and the next successful call flushes
// the cache first via submitBatch. In the browser there is no filesystem, so the
// cache is silently skipped (the error still propagates to the caller).

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

  async _appendCache(events) {
    const env = await nodeFs();
    if (!env) return;
    const lines = events.map((e) => JSON.stringify(e)).join('\n') + '\n';
    env.fs.appendFileSync(env.path, lines, 'utf8');
  }

  async _flushCache() {
    const env = await nodeFs();
    if (!env || !env.fs.existsSync(env.path)) return;
    const raw = env.fs.readFileSync(env.path, 'utf8').trim();
    if (!raw) { env.fs.unlinkSync(env.path); return; }
    const events = raw.split('\n').filter(Boolean).map((l) => JSON.parse(l));
    await this.sdk._fetch('/audit/events', 'POST', { body: { events } });
    env.fs.unlinkSync(env.path);
  }

  // Single event — flush any cached events first, then send.
  async submitEvent(event) {
    return this.submitBatch([event]);
  }

  // Real HTTP POST of a batch. On failure, cache locally (Node only) and rethrow.
  async submitBatch(events) {
    try {
      await this._flushCache();
      return await this.sdk._fetch('/audit/events', 'POST', { body: { events } });
    } catch (err) {
      await this._appendCache(events);
      throw err;
    }
  }

  query({ orgId, eventType, from, to, page, limit } = {}) {
    return this.sdk._fetch('/audit/events', 'GET', { query: clean({ orgId, eventType, from, to, page, limit }) });
  }
  exportCsv({ orgId, from, to } = {}) {
    return this.sdk._fetch('/audit/export', 'GET', { query: clean({ orgId, from, to, format: 'csv' }) });
  }
  exportJson({ orgId, from, to } = {}) {
    return this.sdk._fetch('/audit/export', 'GET', { query: clean({ orgId, from, to, format: 'json' }) });
  }
}

function clean(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null) out[k] = v;
  return out;
}
