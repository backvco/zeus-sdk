// @ts-nocheck
/**
 * UsersService — team member management, invitations, and role changes.
 *
 * Accessed as `sdk.users`.
 *
 * Users belong to an organisation. Every org has at least one admin (the owner).
 * Additional members can be invited by email; they accept via a token link.
 *
 * Roles:
 *   "admin"  — full access including billing, team management, and admin settings
 *   "member" — can use instances and view resources; cannot change org settings
 *
 * Typical invite flow:
 *   1. invite()         — send invite email; returns the inviteId
 *   2. (user clicks link in email)
 *   3. acceptInvite()   — user sets their name/password and joins the org
 */
export class UsersService {
  constructor(sdk) { this.sdk = sdk; }

  /**
   * Get the currently authenticated user's profile.
   *
   * @returns {Promise<{
   *   id: string,              // "usr_..."
   *   email: string,
   *   name: string,
   *   avatarUrl: string | null,
   *   role: 'admin' | 'member',
   *   emailVerified: boolean,
   *   mfaEnabled: boolean,
   *   preferences: {
   *     timeFormat: '12h' | '24h',
   *     dateFormat: string,    // e.g. "MM/DD/YYYY"
   *     locale: string,        // e.g. "en-US"
   *   },
   *   createdAt: string,
   * }>}
   *
   * @example
   * const me = await sdk.users.me();
   * console.log('Hello,', me.name, `(${me.role})`);
   */
  me() { return this.sdk._fetch('/users/me', 'GET'); }

  /**
   * Update display preferences for the current user.
   * All fields are optional — only provided fields are changed.
   *
   * @param {object} params
   * @param {string}  [params.timeFormat]        - "12h" or "24h".
   * @param {string}  [params.dateFormat]        - Date format string, e.g. "MM/DD/YYYY".
   * @param {string}  [params.locale]            - BCP 47 locale tag, e.g. "en-US", "de-DE".
   * @param {boolean} [params.welcomeDismissed]  - true once the user has dismissed the welcome modal.
   * @returns {Promise<{ timeFormat: string, dateFormat: string, locale: string, welcomeDismissed: boolean }>}
   *
   * @example
   * await sdk.users.updatePreferences({ timeFormat: '24h', locale: 'en-GB' });
   */
  updatePreferences({ timeFormat, dateFormat, locale, welcomeDismissed }) { return this.sdk._fetch('/users/me/preferences', 'PATCH', { body: { timeFormat, dateFormat, locale, welcomeDismissed } }); }

  /**
   * List all users in the current organisation.
   *
   * @returns {Promise<Array<{
   *   id: string,              // "usr_..."
   *   email: string,
   *   name: string,
   *   avatarUrl: string | null,
   *   role: 'admin' | 'member',
   *   emailVerified: boolean,
   *   createdAt: string,
   * }>>}
   *
   * @example
   * const users = await sdk.users.list();
   * const admins = users.filter(u => u.role === 'admin');
   * console.log(`${users.length} users, ${admins.length} admins`);
   */
  list() { return this.sdk._fetch('/users', 'GET'); }

  /**
   * Invite a new member to the organisation by email.
   * Sends an invitation email with an accept link containing a short-lived token.
   *
   * @param {object} params
   * @param {string} params.email               - Email address to invite.
   * @param {string} [params.name]              - Pre-fill the invitee's display name.
   * @param {string} [params.avatarUrl]         - Pre-fill avatar URL.
   * @param {'admin'|'member'} [params.role]    - Role to grant on accept. Defaults to "member".
   * @returns {Promise<{ inviteId: string, email: string, role: string, expiresAt: string }>}
   *
   * @example
   * const invite = await sdk.users.invite({
   *   email: 'bob@example.com',
   *   name: 'Bob',
   *   role: 'member',
   * });
   * console.log('Invite sent, expires:', invite.expiresAt);
   */
  invite({ email, name, avatarUrl, role }) { return this.sdk._fetch('/users/invite', 'POST', { body: { email, name, avatarUrl, role } }); }

  /**
   * Revoke a pending invite before the recipient accepts it.
   * Has no effect if the invite has already been accepted.
   *
   * @param {object} params
   * @param {string} params.inviteId - Invite ID ("inv_...") from invite().
   * @returns {Promise<{ ok: true }>}
   *
   * @example
   * await sdk.users.revokeInvite({ inviteId: 'inv_xyz' });
   */
  revokeInvite({ inviteId }) { return this.sdk._fetch(`/users/invite/${inviteId}`, 'DELETE'); }

  /**
   * Accept an organisation invite and create the user account.
   * The `token` comes from the `?token=` query param in the invite email link.
   *
   * If the invitee already has an account in a different org, they should log in
   * first and accept via the UI — this endpoint is for new-account creation only.
   *
   * @param {object} params
   * @param {string} params.token    - Invite token from the email link.
   * @param {string} params.name     - The new user's display name.
   * @param {string} params.password - Password to set for the new account.
   * @returns {Promise<{ userId: string, orgId: string, role: string }>}
   *
   * @example
   * const token = new URLSearchParams(window.location.search).get('token');
   * const session = await sdk.users.acceptInvite({
   *   token,
   *   name: 'Bob Smith',
   *   password: 'secure-pass-1!',
   * });
   * // User is now logged in; session.role tells you their role
   */
  acceptInvite({ token, name, password }) { return this.sdk._fetch('/users/invite/accept', 'POST', { body: { token, name, password } }); }

  /**
   * Change a user's role. You must be an admin to call this.
   * An admin cannot downgrade their own role (prevents lockout).
   *
   * @param {object} params
   * @param {string} params.userId            - Target user ID ("usr_...").
   * @param {'admin'|'member'} params.role    - New role.
   * @returns {Promise<{ userId: string, role: string }>}
   *
   * @example
   * await sdk.users.updateRole({ userId: 'usr_bob', role: 'admin' });
   */
  updateRole({ userId, role }) { return this.sdk._fetch(`/users/${userId}/role`, 'PATCH', { body: { role } }); }

  /**
   * Remove a user from the organisation. The user's account is not deleted —
   * they lose access to this org but can still log in if invited elsewhere.
   * You cannot remove yourself.
   *
   * @param {object} params
   * @param {string} params.userId - User ID to remove ("usr_...").
   * @returns {Promise<{ ok: true }>}
   *
   * @example
   * await sdk.users.remove({ userId: 'usr_bob' });
   */
  remove({ userId }) { return this.sdk._fetch(`/users/${userId}`, 'DELETE'); }

  /**
   * Force a user to reset their password on next login.
   * Their current session remains active until they log out or the session expires.
   * Useful after a suspected credential compromise.
   *
   * @param {object} params
   * @param {string} params.userId - Target user ID ("usr_...").
   * @returns {Promise<{ ok: true }>}
   *
   * @example
   * await sdk.users.forcePasswordReset({ userId: 'usr_bob' });
   */
  forcePasswordReset({ userId }) { return this.sdk._fetch(`/users/${userId}/force-reset`, 'POST', { body: {} }); }

  /**
   * Directly create a user with a temporary password (owner/admin only).
   * Console users are free — no email round-trip. When you don't pass a password,
   * the API generates one and returns it ONCE (so an admin can relay it).
   *
   * @param {object} params
   * @param {string}  params.email      - New user's email.
   * @param {string}  params.name       - Display name.
   * @param {string} [params.role]      - 'owner' | 'admin' | 'member' (default 'member').
   * @param {string} [params.password]  - Optional explicit password (>= 8 chars).
   * @returns {Promise<{ user: object, tempPassword: string|null }>}
   *
   * @example
   * const { user, tempPassword } = await sdk.users.create({ email: 'bob@acme.com', name: 'Bob' });
   */
  create({ email, name, role, password }) { return this.sdk._fetch('/users', 'POST', { body: { email, name, role, password } }); }

  /**
   * List the instances/clusters a user can access (their cluster-access grants).
   *
   * @param {object} params
   * @param {string} params.userId - User ID ("usr_...").
   * @returns {Promise<{ instances: Array<object> }>}
   *
   * @example
   * const { instances } = await sdk.users.listInstances({ userId: 'usr_bob' });
   */
  listInstances({ userId }) { return this.sdk._fetch(`/users/${userId}/instances`, 'GET'); }

  /**
   * Grant a user access (SSO) to an instance/cluster (owner/admin only).
   * Enforces the cluster seat limit when adding a genuinely new link.
   *
   * @param {object} params
   * @param {string}  params.userId     - User ID ("usr_...").
   * @param {string}  params.instanceId - Instance ID ("ins_...").
   * @param {string} [params.role]      - Cluster role: 'admin' | 'member' (default 'member').
   * @returns {Promise<{ link: object }>}
   *
   * @example
   * await sdk.users.linkInstance({ userId: 'usr_bob', instanceId: 'ins_abc', role: 'member' });
   */
  linkInstance({ userId, instanceId, role }) { return this.sdk._fetch(`/users/${userId}/instances`, 'POST', { body: { instanceId, role } }); }

  /**
   * Change a user's role within an instance/cluster (owner/admin only).
   *
   * @param {object} params
   * @param {string} params.userId     - User ID ("usr_...").
   * @param {string} params.instanceId - Instance ID ("ins_...").
   * @param {string} params.role       - Cluster role: 'admin' | 'member'.
   * @returns {Promise<{ link: object }>}
   *
   * @example
   * await sdk.users.setInstanceRole({ userId: 'usr_bob', instanceId: 'ins_abc', role: 'admin' });
   */
  setInstanceRole({ userId, instanceId, role }) { return this.sdk._fetch(`/users/${userId}/instances/${instanceId}`, 'PATCH', { body: { role } }); }

  /**
   * Revoke a user's access to an instance/cluster (owner/admin only).
   *
   * @param {object} params
   * @param {string} params.userId     - User ID ("usr_...").
   * @param {string} params.instanceId - Instance ID ("ins_...").
   * @returns {Promise<{ ok: true }>}
   *
   * @example
   * await sdk.users.unlinkInstance({ userId: 'usr_bob', instanceId: 'ins_abc' });
   */
  unlinkInstance({ userId, instanceId }) { return this.sdk._fetch(`/users/${userId}/instances/${instanceId}`, 'DELETE'); }
}
