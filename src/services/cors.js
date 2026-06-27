// @ts-nocheck
/**
 * CorsService — manage CORS origin groups for Zeus instances.
 *
 * Accessed as `sdk.cors`.
 *
 * Groups are defined at the org level (a named set of allowed origins) and then
 * assigned to one or more instances. On each heartbeat the console delivers the
 * unioned origin list to the instance, which hot-reloads its CORS middleware —
 * no container restart required.
 *
 * Origins must be `https://hostname` strings or `"*"` (wildcard).
 * The console UI origin is always allowed by the instance regardless of groups.
 */
export class CorsService {
  constructor(sdk) { this.sdk = sdk; }

  /**
   * List all CORS groups for the current org.
   *
   * @returns {Promise<{ groups: Array<{ id: string, name: string, origins: string[] }> }>}
   */
  listGroups() { return this.sdk._fetch('/cors/groups', 'GET'); }

  /**
   * Create a new CORS group.
   *
   * @param {object}   params
   * @param {string}   params.name    - Human-readable label, e.g. "Customer Portal".
   * @param {string[]} params.origins - Allowed origin strings, e.g. ["https://app.acme.com"] or ["*"].
   * @returns {Promise<{ group: { id: string, name: string, origins: string[] } }>}
   */
  createGroup({ name, origins }) { return this.sdk._fetch('/cors/groups', 'POST', { body: { name, origins } }); }

  /**
   * Update a CORS group's name and/or origins.
   *
   * @param {object}    params
   * @param {string}    params.id      - Group ID ("cgrp_...").
   * @param {string}    [params.name]
   * @param {string[]}  [params.origins]
   * @returns {Promise<{ group: { id: string, name: string, origins: string[] } }>}
   */
  updateGroup({ id, name, origins }) { return this.sdk._fetch(`/cors/groups/${id}`, 'PATCH', { body: { name, origins } }); }

  /**
   * Delete a CORS group. Instances that had this group assigned will stop allowing
   * its origins on the next heartbeat.
   *
   * @param {object} params
   * @param {string} params.id - Group ID ("cgrp_...").
   * @returns {Promise<{ ok: true }>}
   */
  deleteGroup({ id }) { return this.sdk._fetch(`/cors/groups/${id}`, 'DELETE'); }

  /**
   * Get the CORS groups currently assigned to an instance, plus the effective
   * (unioned) origin list.
   *
   * @param {object} params
   * @param {string} params.instanceId
   * @returns {Promise<{ groups: Array<object>, effectiveOrigins: string[] }>}
   */
  getInstanceGroups({ instanceId }) { return this.sdk._fetch(`/cors/instance/${instanceId}`, 'GET'); }

  /**
   * Replace the set of CORS groups assigned to an instance.
   * Pass an empty array to remove all groups.
   *
   * @param {object}   params
   * @param {string}   params.instanceId
   * @param {string[]} params.groupIds - Array of group IDs ("cgrp_...").
   * @returns {Promise<{ groups: Array<object>, effectiveOrigins: string[] }>}
   */
  setInstanceGroups({ instanceId, groupIds }) {
    return this.sdk._fetch(`/cors/instance/${instanceId}`, 'PUT', { body: { groupIds } });
  }
}
