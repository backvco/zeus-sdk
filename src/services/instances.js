// @ts-nocheck
// zeus-sdk/src/services/instances.js
export class InstancesService {
  constructor(sdk) { this.sdk = sdk; }

  register({ name, subdomain, planId }) { return this.sdk._fetch('/instances', 'POST', { body: { name, subdomain, planId } }); }
  list() { return this.sdk._fetch('/instances', 'GET'); }
  get({ id }) { return this.sdk._fetch(`/instances/${id}`, 'GET'); }
  update({ id, name }) { return this.sdk._fetch(`/instances/${id}`, 'PATCH', { body: { name } }); }
  delete({ id }) { return this.sdk._fetch(`/instances/${id}`, 'DELETE'); }
  getCurlCommand({ id }) { return this.sdk._fetch(`/instances/${id}/curl-command`, 'GET'); }
  getSsoRedirect({ id }) { return this.sdk._fetch(`/instances/${id}/sso-redirect`, 'GET'); }
  heartbeat({ licenseKey, subdomain, vcpuAvg, clusterCount, zeusVersion, healthy }) {
    return this.sdk._fetch('/heartbeat', 'POST', { body: { licenseKey, subdomain, vcpuAvg, clusterCount, zeusVersion, healthy } });
  }
  syncLicense({ id }) { return this.sdk._fetch(`/instances/${id}/sync`, 'POST', { body: {} }); }
  pushKeypair({ id, publicKey }) { return this.sdk._fetch(`/instances/${id}/keypair`, 'POST', { body: { publicKey } }); }
}
