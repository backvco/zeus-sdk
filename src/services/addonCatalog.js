// @ts-nocheck
/**
 * AddonCatalogService — the standard addon catalog the console publishes for Zeus
 * instances to sync down into their own config store (zeus_config_docs, container='',
 * kind='infrastructure', doc._origin='console').
 *
 * Accessed as `sdk.addonCatalog`.
 */
export class AddonCatalogService {
  constructor(sdk) { this.sdk = sdk; }

  /**
   * List the enabled standard addon catalog docs.
   *
   * @param {object} [opts]
   * @param {string} [opts.zeusVersion] - Caller's zeus_version, used to gate rows whose
   *                                      min_zeus_version is set. Omit to receive every
   *                                      enabled row regardless of version.
   * @returns {Promise<{ addons: Array<{ name: string, doc: object }> }>}
   *
   * @example
   *   const { addons } = await sdk.addonCatalog.list({ zeusVersion: '1.2.0' });
   */
  async list({ zeusVersion } = {}) {
    return this.sdk._fetch('/addon-catalog', 'GET', {
      query: zeusVersion ? { zeus_version: zeusVersion } : undefined,
    });
  }
}
