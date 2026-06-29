// @ts-nocheck
/**
 * HelpService — access to Zeus help documentation and full-text search.
 *
 * Accessed as `sdk.help`.
 *
 * Help docs are stored centrally in the Zeus Console and served to all
 * Zeus instances via license-key auth, ensuring every instance shows the
 * same up-to-date documentation.
 */
export class HelpService {
  constructor(sdk) { this.sdk = sdk; }

  /**
   * List all help docs (full content included — used to build the nav
   * tree and AI assistant corpus).
   *
   * @returns {Promise<{ docs: Array<{
   *   id: string,
   *   slug: string,
   *   section: string,
   *   title: string,
   *   summary: string,
   *   content: string,
   *   sortOrder: number,
   * }> }>}
   */
  list() { return this.sdk._fetch('/help-content/docs', 'GET'); }

  /**
   * Fetch a single doc by slug.
   *
   * @param {string} slug - e.g. "getting-started/first-steps"
   * @returns {Promise<{ doc: object }>}
   */
  get(slug) { return this.sdk._fetch(`/help-content/docs/${slug}`, 'GET'); }

  /**
   * Full-text search across all help docs.
   *
   * Returns up to 15 results ranked by relevance, each with a highlighted
   * snippet showing the matched text in context.
   *
   * @param {string} query - Natural language query string.
   * @returns {Promise<{ results: Array<{
   *   slug: string,
   *   section: string,
   *   title: string,
   *   summary: string,
   *   snippet: string,   // HTML with <mark> tags around matched terms
   *   rank: number,
   * }> }>}
   *
   * @example
   * const { results } = await sdk.help.search('vpn tunnel node group');
   * for (const r of results) {
   *   console.log(r.title, r.snippet);
   * }
   */
  search(query) { return this.sdk._fetch('/help-content/search', 'GET', { query: { q: query } }); }

  /**
   * Create or update a help doc (admin only).
   *
   * @param {object} doc
   * @param {string} doc.slug
   * @param {string} doc.section
   * @param {string} doc.title
   * @param {string} [doc.summary]
   * @param {string} doc.content      - Raw markdown (no frontmatter)
   * @param {number} [doc.sortOrder]
   * @param {'draft'|'published'} [doc.status] - Default 'published'
   * @returns {Promise<{ ok: true }>}
   */
  upsert(doc) { return this.sdk._fetch('/help-content/docs', 'POST', { body: doc }); }

  /**
   * Delete a help doc by slug (admin only).
   *
   * @param {string} slug
   * @returns {Promise<{ ok: true }>}
   */
  delete(slug) { return this.sdk._fetch(`/help-content/docs/${slug}`, 'DELETE'); }

  /**
   * Submit a change request / issue report for a help doc.
   * Works for both console users (session cookie) and zeus instances (license key).
   *
   * @param {object} params
   * @param {string} params.slug       - Doc slug the request is about.
   * @param {string} params.docTitle   - Human-readable doc title (for the admin inbox).
   * @param {string} params.note       - The user's message describing what's wrong or missing.
   * @param {string} [params.userName] - Optional display name (used when called from a zeus instance).
   * @returns {Promise<{ ok: true }>}
   */
  requestChange({ slug, docTitle, note, userName }) {
    return this.sdk._fetch('/help-content/change-requests', 'POST', { body: { slug, docTitle, note, userName } });
  }

  /**
   * List all doc change requests (console admin only).
   *
   * @param {{ status?: 'open' | 'resolved' }} [opts]
   * @returns {Promise<{ requests: Array<object> }>}
   */
  listChangeRequests({ status } = {}) {
    return this.sdk._fetch('/help-content/change-requests', 'GET', { query: status ? { status } : {} });
  }

  /**
   * Mark a change request as resolved (console admin only).
   *
   * @param {string} id - Change request ID.
   * @returns {Promise<{ ok: true }>}
   */
  resolveChangeRequest(id) {
    return this.sdk._fetch(`/help-content/change-requests/${id}/resolve`, 'POST', { body: {} });
  }
}
