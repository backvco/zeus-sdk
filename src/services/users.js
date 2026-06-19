// @ts-nocheck
// zeus-sdk/src/services/users.js
export class UsersService {
  constructor(sdk) { this.sdk = sdk; }

  me() { return this.sdk._fetch('/users/me', 'GET'); }
  updatePreferences({ timeFormat, dateFormat, locale }) { return this.sdk._fetch('/users/me/preferences', 'PATCH', { body: { timeFormat, dateFormat, locale } }); }
  list() { return this.sdk._fetch('/users', 'GET'); }
  invite({ email, name, avatarUrl, role }) { return this.sdk._fetch('/users/invite', 'POST', { body: { email, name, avatarUrl, role } }); }
  revokeInvite({ inviteId }) { return this.sdk._fetch(`/users/invite/${inviteId}`, 'DELETE'); }
  acceptInvite({ token, name, password }) { return this.sdk._fetch('/users/invite/accept', 'POST', { body: { token, name, password } }); }
  updateRole({ userId, role }) { return this.sdk._fetch(`/users/${userId}/role`, 'PATCH', { body: { role } }); }
  remove({ userId }) { return this.sdk._fetch(`/users/${userId}`, 'DELETE'); }
  forcePasswordReset({ userId }) { return this.sdk._fetch(`/users/${userId}/force-reset`, 'POST', { body: {} }); }
}
