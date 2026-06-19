// @ts-nocheck
// zeus-sdk/src/services/notices.js
export class NoticesService {
  constructor(sdk) { this.sdk = sdk; }

  list() { return this.sdk._fetch('/notices', 'GET'); }
  dismiss({ noticeId }) { return this.sdk._fetch(`/notices/${noticeId}/dismiss`, 'POST', { body: {} }); }
}
