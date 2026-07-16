// @ts-nocheck
/**
 * LegalService — court-defensible clickwrap acceptance of the MSA, Abuse Policy, and
 * Privacy Policy.
 *
 * Accessed as `sdk.legal`.
 *
 * getDocuments()/getDocument() are PUBLIC (no session needed) — the signup and
 * invite-accept pages call them before an account exists. getAcceptances()/accept()
 * require a session and back the post-login "please re-accept" gate
 * (session.legal_acceptance_required).
 */
export class LegalService {
  constructor(sdk) { this.sdk = sdk; }

  /**
   * List the current version of every legal document. Public — no auth required.
   *
   * @returns {Promise<{ documents: Array<{
   *   id: string,             // "ldc_..."
   *   docType: 'msa' | 'abuse-policy' | 'privacy-policy',
   *   version: string,
   *   title: string,
   *   effectiveAt: string | null,
   *   sha256: string,
   * }>}>}
   *
   * @example
   * const { documents } = await sdk.legal.getDocuments();
   */
  getDocuments() { return this.sdk._fetch('/legal/documents', 'GET'); }

  /**
   * Get the full text of the current version of one legal document. Public — no
   * auth required.
   *
   * @param {string} docType - 'msa' | 'abuse-policy' | 'privacy-policy'.
   * @returns {Promise<{ document: {
   *   id: string, docType: string, version: string, title: string,
   *   effectiveAt: string | null, sha256: string, content: string,
   * } }>}
   *
   * @example
   * const { document } = await sdk.legal.getDocument('msa');
   * console.log(document.title, document.version);
   */
  getDocument(docType) { return this.sdk._fetch(`/legal/documents/${docType}`, 'GET'); }

  /**
   * Check the current session user's legal acceptance status.
   *
   * @returns {Promise<{
   *   required: boolean,
   *   current: Array<{ docType: string, version: string }>,
   *   acceptances: Array<{ docType: string, docVersion: string, acceptedAt: string }>,
   * }>}
   *
   * @example
   * const { required } = await sdk.legal.getAcceptances();
   * if (required) { // show the re-accept modal }
   */
  getAcceptances() { return this.sdk._fetch('/legal/acceptances', 'GET'); }

  /**
   * Record acceptance of every current legal document for the session user.
   * Idempotent — already-accepted documents are skipped.
   *
   * @returns {Promise<{ accepted: true }>}
   *
   * @example
   * await sdk.legal.accept();
   */
  accept() { return this.sdk._fetch('/legal/accept', 'POST', { body: {} }); }
}
