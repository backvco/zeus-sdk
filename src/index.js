// @ts-nocheck
/**
 * zeus-sdk — JavaScript client for the Zeus Console API.
 *
 * Works in browsers (session-cookie auth) and Node.js (license-key auth).
 * Every API surface is namespaced under a service property on the SDK instance.
 *
 * ─── Quick start ──────────────────────────────────────────────────────────────
 *
 * Browser (SvelteKit / React / vanilla — session cookie handles auth):
 *
 *   import { ZeusConsoleSDK } from '@zeusk8s/sdk';
 *   const sdk = new ZeusConsoleSDK({ baseURL: '/api' });
 *
 *   await sdk.auth.login({ email: 'alice@example.com', password: 'hunter2' });
 *   const session = await sdk.auth.getSession();
 *   // session → { userId: 'usr_...', orgId: 'org_...', role: 'admin', ... }
 *
 *   const instances = await sdk.instances.list();
 *   // instances → [{ id: 'ins_...', name: 'Production', subdomain: 'prod', ... }]
 *
 * Node.js / server-to-server (license key):
 *
 *   import { ZeusConsoleSDK } from '@zeusk8s/sdk';
 *   const sdk = new ZeusConsoleSDK({
 *     baseURL: 'https://console.example.com/api',
 *     token: process.env.ZEUS_LICENSE_KEY,   // "ins_..." key from the console
 *   });
 *
 *   // Send a heartbeat from within a Zeus instance
 *   await sdk.instances.heartbeat({
 *     licenseKey: process.env.ZEUS_LICENSE_KEY,
 *     subdomain: 'prod',
 *     vcpuAvg: 3.2,
 *     clusterCount: 5,
 *     zeusVersion: '1.4.0',
 *     healthy: true,
 *   });
 *
 * ─── Error handling ───────────────────────────────────────────────────────────
 *
 * All methods throw on HTTP errors. The error has extra properties:
 *
 *   try {
 *     await sdk.instances.get({ id: 'ins_bad' });
 *   } catch (err) {
 *     err.status   // 404
 *     err.body     // { error: 'Instance not found' }
 *     err.endpoint // '/instances/ins_bad'
 *   }
 *
 * ─── Services ─────────────────────────────────────────────────────────────────
 *
 *   sdk.auth        — login, logout, session, email verify, MFA, password reset
 *   sdk.instances   — register, list, get, update, delete, heartbeat, SSO
 *   sdk.orgs        — get / update the current org
 *   sdk.billing     — subscriptions, checkout, invoices, credits, discounts
 *   sdk.users       — team members, invites, roles
 *   sdk.support     — temporary support access grants and sessions
 *   sdk.audit       — submit and query audit log events
 *   sdk.notices     — system notices and dismissals
 *   sdk.sso         — instance-initiated SSO nonce validation
 *   sdk.email       — proxy transactional email through the console (instance-to-console)
 *
 * Admin and platform-operations surfaces (org management, plans, spam config,
 * SMTP, instance enable/disable) live in the separate zeus-sdk-internal package,
 * which is not distributed to customers.
 */

import { BaseSDK } from './base.js';
import { AuthService } from './services/auth.js';
import { InstancesService } from './services/instances.js';
import { OrgsService } from './services/orgs.js';
import { BillingService } from './services/billing.js';
import { UsersService } from './services/users.js';
import { SupportService } from './services/support.js';
import { AuditService } from './services/audit.js';
import { NoticesService } from './services/notices.js';
import { SsoService } from './services/sso.js';
import { EmailService } from './services/email.js';
import { CorsService } from './services/cors.js';
import { PermissionsService } from './services/permissions.js';
import { ConsoleTokensService } from './services/consoletokens.js';
import { HelpService } from './services/help.js';
import { ForumService } from './services/forum.js';

export { generateId, ENTITY } from './generateId.js';
export { BaseSDK } from './base.js';

export class ZeusConsoleSDK extends BaseSDK {
  /**
   * @param {object}           [opts]
   * @param {string}           [opts.baseURL]    - API base URL, e.g. "/api" or "https://console.example.com/api".
   * @param {string}           [opts.token]      - License key for server-to-server auth ("ins_..." prefix).
   *                                               Omit in the browser — the session cookie is used automatically.
   * @param {CryptoKey|string} [opts.privateKey] - RS256 private key for instance→console request signing.
   *                                               Pass a CryptoKey or PKCS#8 PEM string. When set, every
   *                                               request with a body receives an X-Zeus-Signature header.
   */
  constructor(opts = {}) {
    super(opts);
    this.auth = new AuthService(this);
    this.instances = new InstancesService(this);
    this.orgs = new OrgsService(this);
    this.billing = new BillingService(this);
    this.users = new UsersService(this);
    this.support = new SupportService(this);
    this.audit = new AuditService(this);
    this.notices = new NoticesService(this);
    this.sso = new SsoService(this);
    this.email = new EmailService(this);
    this.cors = new CorsService(this);
    this.permissions = new PermissionsService(this);
    this.consoleTokens = new ConsoleTokensService(this);
    this.help = new HelpService(this);
    this.forum = new ForumService(this);
  }
}
