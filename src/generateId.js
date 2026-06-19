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

export const ENTITY = {
  ORG:                  'org',
  USER:                 'usr',
  ORG_USER:             'oru',
  INVITE_TOKEN:         'inv',
  SESSION:              'ses',
  MFA_PENDING:          'mfa',
  PASSWORD_HISTORY:     'pwh',
  IP_ALLOWLIST:         'ipl',

  INSTANCE:             'ins',
  INSTANCE_KEYPAIR:     'kpr',

  PLAN:                 'pln',
  PLAN_VERSION:         'plv',
  SUBSCRIPTION:         'sub',
  ORG_PRICING:          'opr',
  VCPU_PRICING_TIER:    'vpt',

  DISCOUNT_CODE:        'dsc',
  DISCOUNT_REDEMPTION:  'dsr',
  ACCOUNT_CREDIT:       'crd',
  REFERRAL:             'ref',

  HEARTBEAT_LOG:        'hbl',
  VCPU_MONTH_PEAK:      'vmp',

  NOTICE:               'ntc',
  NOTICE_DISMISSAL:     'ndi',

  SUPPORT_GRANT:        'sgr',
  SUPPORT_SESSION:      'sss',

  AUDIT_LOG:            'aud',

  SPAM_REVIEW:          'spq',
  BLOCKLIST:            'blk',

  SMTP_CONFIG:          'smt',
  EMAIL_LOG:            'eml',
};

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function generateId(entity) {
  const bytes = randomBytes(20);
  const suffix = Array.from(bytes, b => CHARS[b % CHARS.length]).join('');
  return `${entity}_${suffix}`;
}
