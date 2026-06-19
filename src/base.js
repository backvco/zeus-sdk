// @ts-nocheck
// zeus-sdk/src/base.js
export class BaseSDK {
  constructor({ baseURL, token } = {}) {
    this.baseURL = (baseURL || '').replace(/\/$/, '');
    this.token = token || null;
    this.debugMode = false;
  }

  setToken(token) { this.token = token; }
  debug(on = true) { this.debugMode = on; return this; }

  async _fetch(endpoint, method, { body, query, headers = {} } = {}) {
    let url = `${this.baseURL}${endpoint}`;
    if (query && Object.keys(query).length) {
      url += `?${new URLSearchParams(query).toString()}`;
    }

    const h = { ...headers };
    const hasBody = body !== undefined && method.toUpperCase() !== 'GET';
    if (hasBody && !h['Content-Type'] && !h['content-type']) {
      h['Content-Type'] = 'application/json';
    }
    // Instance/server auth: license key as X-License-Key. Browser auth is the
    // session cookie via credentials:'include' (no token set in the browser).
    if (this.token) h['X-License-Key'] = this.token;

    const opts = { method, headers: h, credentials: 'include' };
    if (hasBody) opts.body = typeof body === 'string' ? body : JSON.stringify(body);

    const res = await fetch(url, opts);
    const ct = res.headers.get('content-type') || '';
    const parse = async () =>
      ct.includes('application/json') ? res.json().catch(() => ({})) : res.text();

    if (!res.ok) {
      const errBody = await parse();
      const err = new Error(
        (errBody && (errBody.error || errBody.message)) || `HTTP ${res.status}`,
      );
      err.status = res.status;
      err.body = errBody;
      err.endpoint = endpoint;
      throw err;
    }
    return parse();
  }
}
