/**
 * @hidden-leaf/x-skill
 *
 * X (Twitter) bookmark intelligence skill for Claude Code.
 * Turns curated X bookmarks into structured research briefs.
 *
 * v1: Bookmark intelligence (list, fetch, brief)
 * v2: Search, threads, profile (planned)
 * v3: Publish, schedule, reply (planned)
 */

// ============================================================================
// Client
// ============================================================================

export { XClient, createXClientFromEnv } from './clients/x-client.js';

// ============================================================================
// Client Types
// ============================================================================

export type {
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

export const VERSION = '0.1.0';
