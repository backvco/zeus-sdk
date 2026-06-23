// @ts-nocheck
// Cross-environment CSPRNG: Web Crypto exists in browsers and in Node 19+
// (globalThis.crypto). The SDK runs in both the browser (UI) and Node (API),
// so we must NOT import the Node-only "crypto" module — Vite externalizes it
// and accessing it in the browser throws.
function randomBytes(n) {
  const arr = new Uint8Array(n);
  globalThis.crypto.getRandomValues(arr);
  return arr;
}

/**
 * ENTITY — canonical 3-letter prefixes for every persisted entity type.
 *
 * Pass an ENTITY value to generateId() to produce a typed, human-readable ID:
 *   generateId(ENTITY.USER)  →  "usr_a7k3mxqpn2..."
 *
 * Prefixes let you identify what a random ID belongs to at a glance — useful
 * when debugging logs, DB rows, or API payloads that mix many ID types.
 *
 * @example
 * import { generateId, ENTITY } from 'zeus-sdk';
 *
 * const orgId      = generateId(ENTITY.ORG);           // "org_..."
 * const userId     = generateId(ENTITY.USER);          // "usr_..."
 * const instanceId = generateId(ENTITY.INSTANCE);      // "ins_..."
 * const planId     = generateId(ENTITY.PLAN);          // "pln_..."
 * const auditId    = generateId(ENTITY.AUDIT_LOG);     // "aud_..."
 */
export const ENTITY = {
  // Auth / identity
  ORG:                  'org',   // Organisation account
  USER:                 'usr',   // User within an org
  ORG_USER:             'oru',   // Join table: org ↔ user membership
  INVITE_TOKEN:         'inv',   // Pending team invite
  SESSION:              'ses',   // Auth session (cookie)
  MFA_PENDING:          'mfa',   // Pending MFA challenge
  PASSWORD_HISTORY:     'pwh',   // Historic hashed password (prevents reuse)
  IP_ALLOWLIST:         'ipl',   // Allowed IP/CIDR for login

  // Instances
  INSTANCE:             'ins',   // A deployed Zeus instance
  INSTANCE_KEYPAIR:     'kpr',   // RSA keypair for instance↔console trust

  // Billing
  PLAN:                 'pln',   // Subscription plan (e.g. "Starter", "Pro")
  PLAN_VERSION:         'plv',   // Immutable snapshot of a plan's pricing
  SUBSCRIPTION:         'sub',   // An org's active plan subscription
  ORG_PRICING:          'opr',   // Custom per-org pricing override
  VCPU_PRICING_TIER:    'vpt',   // vCPU price tier (usage-based plans)

  DISCOUNT_CODE:        'dsc',   // Promotional discount code
  DISCOUNT_REDEMPTION:  'dsr',   // Record of a code being redeemed
  ACCOUNT_CREDIT:       'crd',   // Account credit (dollar value)
  REFERRAL:             'ref',   // Referral relationship

  // Metrics
  HEARTBEAT_LOG:        'hbl',   // Instance heartbeat telemetry entry
  VCPU_MONTH_PEAK:      'vmp',   // Peak vCPU usage for a billing month

  // Notices
  NOTICE:               'ntc',   // System-wide notice/announcement
  NOTICE_DISMISSAL:     'ndi',   // Record that a user dismissed a notice

  // Support
  SUPPORT_GRANT:        'sgr',   // Temporary support access grant
  SUPPORT_SESSION:      'sss',   // Active support session

  // Audit
  AUDIT_LOG:            'aud',   // Immutable audit event record

  // Spam / trust
  SPAM_REVIEW:          'spq',   // Queued spam review entry
  BLOCKLIST:            'blk',   // Blocked email/domain/IP entry

  // Email
  SMTP_CONFIG:          'smt',   // Outbound SMTP configuration
  EMAIL_LOG:            'eml',   // Sent email record
};

/**
 * Generate a cryptographically secure, URL-safe, typed ID.
 *
 * Format:  `<prefix>_<20-char alphanumeric suffix>`
 * Example: `usr_a7k3mxqpn2bf9yt1cswz`
 *
 * The suffix is 20 random bytes mapped to [a-z0-9] via CSPRNG, giving
 * 36^20 ≈ 1.3 × 10^31 combinations — collision probability is negligible.
 *
 * Works in browsers (Web Crypto API) and Node.js 19+ (globalThis.crypto).
 * Does NOT require any native addons or Node-only imports.
 *
 * @param {string} entity - An ENTITY constant value (the 3-letter prefix string).
 * @returns {string} Typed ID string.
 *
 * @example
 * import { generateId, ENTITY } from 'zeus-sdk';
 *
 * // Generate IDs before inserting records
 * const id = generateId(ENTITY.INSTANCE);   // "ins_k7p2mqxnb3..."
 * const id = generateId(ENTITY.ORG);        // "org_a9fwltczxm..."
 *
 * // You can also pass the raw prefix string directly
 * const id = generateId('usr');             // "usr_..."
 */
export function generateId(entity) {
  const bytes = randomBytes(20);
  const suffix = Array.from(bytes, b => CHARS[b % CHARS.length]).join('');
  return `${entity}_${suffix}`;
}

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
