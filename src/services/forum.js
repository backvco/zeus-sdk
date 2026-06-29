// @ts-nocheck
/**
 * ForumService — community Q&A forum for Zeus Console users.
 *
 * Accessed as `sdk.forum`.
 *
 * Users can browse categories, post questions, write answers, vote on both,
 * and accept an answer to their own question. Console admins can create/delete
 * categories, pin or lock posts, and remove any post or answer.
 */
export class ForumService {
  constructor(sdk) { this.sdk = sdk; }

  // ── Categories ──────────────────────────────────────────────────────────────

  /**
   * List all active forum categories, each with a `postCount`.
   * @returns {Promise<Array<{ id: string, name: string, slug: string, description: string|null, sortOrder: number, postCount: number, createdAt: string }>>}
   */
  listCategories() { return this.sdk._fetch('/forum/categories', 'GET'); }

  /**
   * Create a new category. Admin only.
   * @param {{ name: string, slug: string, description?: string, sortOrder?: number }} params
   * @returns {Promise<{ category: object }>}
   */
  createCategory({ name, slug, description, sortOrder } = {}) {
    return this.sdk._fetch('/forum/categories', 'POST', { body: { name, slug, description, sortOrder } });
  }

  /**
   * Update an existing category. Admin only.
   * @param {{ categoryId: string, name?: string, slug?: string, description?: string, sortOrder?: number }} params
   * @returns {Promise<{ category: object }>}
   */
  updateCategory({ categoryId, name, slug, description, sortOrder } = {}) {
    return this.sdk._fetch(`/forum/categories/${categoryId}`, 'PATCH', { body: { name, slug, description, sortOrder } });
  }

  /**
   * Soft-delete a category. Admin only.
   * @param {{ categoryId: string }} params
   * @returns {Promise<{ ok: true }>}
   */
  deleteCategory({ categoryId } = {}) {
    return this.sdk._fetch(`/forum/categories/${categoryId}`, 'DELETE', { body: {} });
  }

  // ── Posts ───────────────────────────────────────────────────────────────────

  /**
   * List forum posts with optional filters.
   * @param {{ categoryId?: string, search?: string, sort?: 'newest'|'top'|'unanswered', page?: number, limit?: number }} params
   * @returns {Promise<{ posts: object[], total: number, myVotes: Record<string, number> }>}
   */
  listPosts({ categoryId, search, sort, page, limit, following, viewerUserId } = {}) {
    return this.sdk._fetch('/forum/posts', 'GET', { query: { categoryId, search, sort, page, limit, following, viewerUserId } });
  }

  /**
   * Create a new forum post (question).
   * @param {{ categoryId: string, title: string, body: string }} params
   * @returns {Promise<{ post: object }>}
   */
  createPost({ categoryId, title, body, onBehalfOfUserId } = {}) {
    return this.sdk._fetch('/forum/posts', 'POST', { body: { categoryId, title, body, onBehalfOfUserId } });
  }

  /**
   * Get a single post with all its answers and the current user's votes.
   * @param {{ postId: string }} params
   * @returns {Promise<{ post: object, answers: object[], myPostVote: number, myAnswerVotes: Record<string, number> }>}
   */
  getPost({ postId, viewerUserId } = {}) {
    return this.sdk._fetch(`/forum/posts/${postId}`, 'GET', { query: { viewerUserId } });
  }

  /**
   * Soft-delete a post. Users can delete their own; admins can delete any.
   * @param {{ postId: string }} params
   * @returns {Promise<{ ok: true }>}
   */
  deletePost({ postId, onBehalfOfUserId } = {}) {
    return this.sdk._fetch(`/forum/posts/${postId}`, 'DELETE', { body: { onBehalfOfUserId } });
  }

  editPost({ postId, title, body, onBehalfOfUserId } = {}) {
    return this.sdk._fetch(`/forum/posts/${postId}/edit`, 'PATCH', { body: { title, body, onBehalfOfUserId } });
  }

  /**
   * Update post metadata (pin / lock). Admin only.
   * @param {{ postId: string, isPinned?: boolean, isLocked?: boolean }} params
   * @returns {Promise<{ post: object }>}
   */
  updatePost({ postId, isPinned, isLocked } = {}) {
    return this.sdk._fetch(`/forum/posts/${postId}`, 'PATCH', { body: { isPinned, isLocked } });
  }

  // ── Answers ─────────────────────────────────────────────────────────────────

  /**
   * Post an answer to a question.
   * @param {{ postId: string, body: string }} params
   * @returns {Promise<{ answer: object }>}
   */
  createAnswer({ postId, body, onBehalfOfUserId } = {}) {
    return this.sdk._fetch(`/forum/posts/${postId}/answers`, 'POST', { body: { body, onBehalfOfUserId } });
  }

  /**
   * Soft-delete an answer. Users can delete their own; admins can delete any.
   * @param {{ postId: string, answerId: string, onBehalfOfUserId?: string }} params
   * @returns {Promise<{ ok: true }>}
   */
  deleteAnswer({ postId, answerId, onBehalfOfUserId } = {}) {
    return this.sdk._fetch(`/forum/posts/${postId}/answers/${answerId}`, 'DELETE', { body: { onBehalfOfUserId } });
  }

  editAnswer({ postId, answerId, body, onBehalfOfUserId } = {}) {
    return this.sdk._fetch(`/forum/posts/${postId}/answers/${answerId}/edit`, 'PATCH', { body: { body, onBehalfOfUserId } });
  }

  /**
   * Mark an answer as accepted. Only the post's author (or admin) can do this.
   * Clears any previously accepted answer on the same post.
   * @param {{ postId: string, answerId: string }} params
   * @returns {Promise<{ ok: true }>}
   */
  acceptAnswer({ postId, answerId } = {}) {
    return this.sdk._fetch(`/forum/posts/${postId}/answers/${answerId}/accept`, 'PATCH', { body: {} });
  }

  // ── Subscriptions ───────────────────────────────────────────────────────────

  /**
   * Get the current user's subscription status for a post.
   * @param {{ postId: string }} params
   * @returns {Promise<{ subscribed: boolean }>}
   */
  getSubscription({ postId } = {}) {
    return this.sdk._fetch(`/forum/posts/${postId}/subscription`, 'GET');
  }

  /**
   * Subscribe to email notifications for a post.
   * @param {{ postId: string, onBehalfOfUserId?: string }} params
   * @returns {Promise<{ subscribed: true }>}
   */
  subscribePost({ postId, onBehalfOfUserId } = {}) {
    return this.sdk._fetch(`/forum/posts/${postId}/subscribe`, 'POST', { body: { onBehalfOfUserId } });
  }

  /**
   * Unsubscribe from email notifications for a post.
   * @param {{ postId: string, onBehalfOfUserId?: string }} params
   * @returns {Promise<{ subscribed: false }>}
   */
  unsubscribePost({ postId, onBehalfOfUserId } = {}) {
    return this.sdk._fetch(`/forum/posts/${postId}/unsubscribe`, 'POST', { body: { onBehalfOfUserId } });
  }

  // ── Votes ───────────────────────────────────────────────────────────────────

  /**
   * Vote on a post. Pass value 1 (upvote), -1 (downvote), or 0 (remove vote).
   * @param {{ postId: string, value: 1|-1|0 }} params
   * @returns {Promise<{ score: number, myVote: number }>}
   */
  votePost({ postId, value, onBehalfOfUserId } = {}) {
    return this.sdk._fetch(`/forum/posts/${postId}/vote`, 'POST', { body: { value, onBehalfOfUserId } });
  }

  /**
   * Vote on an answer. Pass value 1, -1, or 0.
   * @param {{ answerId: string, value: 1|-1|0, onBehalfOfUserId?: string }} params
   * @returns {Promise<{ score: number, myVote: number }>}
   */
  voteAnswer({ answerId, value, onBehalfOfUserId } = {}) {
    return this.sdk._fetch(`/forum/answers/${answerId}/vote`, 'POST', { body: { value, onBehalfOfUserId } });
  }
}
