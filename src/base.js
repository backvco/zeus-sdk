// @ts-nocheck
/**
 * BaseSDK — low-level HTTP transport used by every service class.
 *
 * You normally don't instantiate this directly; use ZeusConsoleSDK instead.
 * It is exported so you can extend it if you need a custom client.
 *
 * Authentication modes:
 *   Browser  — no token needed; the browser automatically sends the session
 *              cookie via `credentials: 'include'`.
 *   Server   — pass `token` (a license key) to the constructor or call
 *              `setToken()` later. Sent as the `X-License-Key` header.
 *
 * @example
 * // Direct use (uncommon — prefer ZeusConsoleSDK)
 * import { BaseSDK } from '@zeusk8s/sdk';
 * const client = new BaseSDK({ baseURL: 'https://console.example.com/api', token: 'ins_abc123...' });
 * const data = await client._fetch('/instances', 'GET');
 */
export class BaseSDK {
  /**
   * @param {object} [opts]
   * @param {string} [opts.baseURL]  - API origin + prefix, e.g. "https://console.example.com/api".
   *                                   Trailing slash is stripped automatically.
   * @param {string} [opts.token]    - License key for server-to-server calls (X-License-Key header).
   *                                   Omit when running in the browser — session cookie handles auth.
   */
  constructor({ baseURL, token } = {}) {
    this.baseURL = (baseURL || '').replace(/\/$/, '');
    this.token = token || null;
    this.debugMode = false;
  }

  /**
   * Replace the license key at runtime (e.g. after the user logs in and you
   * receive a key from the API).
   *
   * @param {string} token - New license key.
   * @example
   * sdk.setToken('ins_newkey...');
   */
  setToken(token) { this.token = token; }

  /**
   * Toggle debug mode. When on, nothing extra is logged by the SDK itself, but
   * you can subclass and inspect `this.debugMode` in overridden `_fetch` calls.
   *
   * @param {boolean} [on=true]
   * @returns {this} - Chainable.
   * @example
   * sdk.debug().instances.list();   // enable then call
   * sdk.debug(false);               // disable
   */
  debug(on = true) { this.debugMode = on; return this; }

  /**
   * Core HTTP request. All service methods call this.
   *
   * On HTTP 4xx/5xx the method throws an enriched Error:
   *   err.status   {number}  — HTTP status code
   *   err.body     {*}       — parsed response body (object or string)
   *   err.endpoint {string}  — the endpoint path that failed, for logging
   *
   * @param {string} endpoint  - Path relative to baseURL, e.g. "/instances".
   * @param {string} method    - HTTP verb: "GET" | "POST" | "PATCH" | "PUT" | "DELETE".
   * @param {object} [opts]
   * @param {*}      [opts.body]    - Request body — serialised to JSON automatically.
   * @param {object} [opts.query]   - Key/value pairs appended as query string.
   * @param {object} [opts.headers] - Additional headers merged on top of defaults.
   * @returns {Promise<*>} - Parsed JSON response, or raw text if the server doesn't
   *                         return application/json.
   *
   * @example
   * // GET with query params
   * const result = await sdk._fetch('/admin/orgs', 'GET', { query: { page: 2, limit: 25 } });
   *
   * // POST with JSON body
   * const org = await sdk._fetch('/orgs/me', 'PATCH', { body: { name: 'Acme Corp' } });
   *
   * // Error handling
   * try {
   *   await sdk._fetch('/instances/ins_bad', 'GET');
   * } catch (err) {
   *   console.error(err.status, err.body.error, err.endpoint);
   *   // e.g. 404  "Instance not found"  "/instances/ins_bad"
   * }
   */
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
