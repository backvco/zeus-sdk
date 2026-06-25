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
 *   Instance — pass `privateKey` (CryptoKey or PEM string) to sign request
 *              bodies with RS256. Sets `X-Zeus-Signature` on every request
 *              that has a body. Compatible with `token` — both headers are sent.
 *
 * @example
 * // Direct use (uncommon — prefer ZeusConsoleSDK)
 * import { BaseSDK } from 'zeus-sdk';
 * const client = new BaseSDK({ baseURL: 'https://console.example.com/api', token: 'ins_abc123...' });
 * const data = await client._fetch('/instances', 'GET');
 */
export class BaseSDK {
  /**
   * @param {object}              [opts]
   * @param {string}              [opts.baseURL]    - API origin + prefix, e.g. "https://console.example.com/api".
   *                                                  Trailing slash is stripped automatically.
   * @param {string}              [opts.token]      - License key for server-to-server calls (X-License-Key header).
   *                                                  Omit when running in the browser — session cookie handles auth.
   * @param {CryptoKey|string}    [opts.privateKey] - RS256 private key for instance→console request signing.
   *                                                  Pass a CryptoKey (RSASSA-PKCS1-v1_5 / SHA-256) or a
   *                                                  PKCS#8 PEM string — imported lazily on first signed request.
   *                                                  When set, every request with a body gets an X-Zeus-Signature
   *                                                  header (base64url RS256 signature over the raw JSON body).
   */
  constructor({ baseURL, token, privateKey } = {}) {
    this.baseURL = (baseURL || '').replace(/\/$/, '');
    this.token = token || null;
    this.privateKey = privateKey || null;
    this._cryptoKey = null;
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

  // Resolve this.privateKey to a CryptoKey, importing from PEM on first call.
  async _resolveKey() {
    if (this._cryptoKey) return this._cryptoKey;
    if (this.privateKey && typeof this.privateKey === 'object') {
      this._cryptoKey = this.privateKey;
      return this._cryptoKey;
    }
    // PEM → PKCS#8 DER → CryptoKey
    const pem = this.privateKey;
    const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
    const der = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    this._cryptoKey = await globalThis.crypto.subtle.importKey(
      'pkcs8', der.buffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['sign'],
    );
    return this._cryptoKey;
  }

  // Sign bodyStr with RS256, return base64url-encoded signature.
  async _sign(bodyStr) {
    const key = await this._resolveKey();
    const data = new TextEncoder().encode(bodyStr);
    const sig = await globalThis.crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, data);
    return btoa(String.fromCharCode(...new Uint8Array(sig)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

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
    if (hasBody) {
      const serialized = typeof body === 'string' ? body : JSON.stringify(body);
      if (this.privateKey) h['X-Zeus-Signature'] = await this._sign(serialized);
      opts.body = serialized;
    }

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
