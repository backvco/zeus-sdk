// @ts-nocheck
// zeus-sdk/src/index.js
import { BaseSDK } from './base.js';
import { AuthService } from './services/auth.js';
import { InstancesService } from './services/instances.js';
import { OrgsService } from './services/orgs.js';
import { BillingService } from './services/billing.js';
import { UsersService } from './services/users.js';
import { SupportService } from './services/support.js';
import { AuditService } from './services/audit.js';
import { NoticesService } from './services/notices.js';
import { AdminService } from './services/admin.js';
import { SpamService } from './services/spam.js';

export { generateId, ENTITY } from './generateId.js';
export { BaseSDK } from './base.js';

export class ZeusConsoleSDK extends BaseSDK {
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
    this.admin = new AdminService(this);
    this.spam = new SpamService(this);
  }
}
