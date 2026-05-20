/**
 * @hidden-leaf/x-skill
 *
 * X (Twitter) bookmark intelligence skill for Claude Code.
 * Turns curated X bookmarks into structured research briefs.
 *
 * v1: Bookmark intelligence (list, fetch, brief)
 * v1.1: Publish — tweet posting + media upload (OAuth 1.0a)
 * v2: Search, threads, profile (planned)
 * v3: Schedule, reply (planned)
 */

// ============================================================================
// Client
// ============================================================================

export { XClient, createXClientFromEnv, createOrgXClientFromEnv } from './clients/x-client.js';

// ============================================================================
// Client Types
// ============================================================================

export type {
  XAccountType,
  XAuthConfig,
  XApiResponse,
  XPaginationMeta,
  XApiError,
  XClientOptions,
  Tweet,
  TweetPublicMetrics,
  TweetEntities,
  TweetUrl,
  TweetMention,
  TweetHashtag,
  TweetAnnotation,
  ReferencedTweet,
  TweetAttachments,
  ContextAnnotation,
  NoteTweet,
  User,
  UserPublicMetrics,
  Media,
  XIncludes,
  BookmarkFolder,
  BookmarkListParams,
  BookmarkFolderListParams,
  BookmarkFolderTweetsParams,
  XOAuth1Config,
  TweetPostResult,
  MediaUploadResult,
} from './clients/types.js';

export {
  XApiRequestError,
  XAuthenticationError,
  XRateLimitError,
  XNotFoundError,
  DEFAULT_TWEET_FIELDS,
  DEFAULT_USER_FIELDS,
  DEFAULT_EXPANSIONS,
} from './clients/types.js';

// ============================================================================
// Bookmarks Skill
// ============================================================================

export { BookmarksSkill, createBookmarksSkillFromEnv } from './skills/bookmarks/index.js';
export { buildBriefPrompt, generateBrief } from './skills/bookmarks/synthesize.js';

// ============================================================================
// Cache
// ============================================================================

export { BookmarkStore, createStoreFromEnv } from './cache/store.js';

// ============================================================================
// Bookmark Types
// ============================================================================

export type {
  EnrichedBookmark,
  BookmarkFolderContents,
  BriefOptions,
  ResearchBrief,
  BookmarkListOutput,
  BookmarkFetchOutput,
  BookmarkBriefOutput,
  SyncResult,
} from './skills/bookmarks/types.js';

// ============================================================================
// Utilities
// ============================================================================

export { createLogger } from './utils/logger.js';

// ============================================================================
// Version
// ============================================================================

export const VERSION = '1.2.0';
