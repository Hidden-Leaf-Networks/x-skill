/**
 * X API v2 types for @hidden-leaf/x-skill
 */

// ============================================================================
// Auth
// ============================================================================

export interface XAuthConfig {
  /** OAuth 2.0 User Access Token (from OAuth flow, NOT the App Bearer token) */
  userAccessToken: string;
  /** Authenticated user ID (required for bookmark endpoints) */
  userId: string;
}

// ============================================================================
// API Response Envelope
// ============================================================================

export interface XApiResponse<T> {
  data: T;
  includes?: XIncludes;
  meta?: XPaginationMeta;
  errors?: XApiError[];
}

export interface XPaginationMeta {
  result_count: number;
  next_token?: string;
  previous_token?: string;
}

export interface XApiError {
  value?: string;
  detail: string;
  title: string;
  resource_type?: string;
  parameter?: string;
  type: string;
}

// ============================================================================
// Tweet
// ============================================================================

export interface Tweet {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
  conversation_id?: string;
  in_reply_to_user_id?: string;
  lang?: string;
  edit_history_tweet_ids?: string[];
  public_metrics?: TweetPublicMetrics;
  entities?: TweetEntities;
  referenced_tweets?: ReferencedTweet[];
  attachments?: TweetAttachments;
  context_annotations?: ContextAnnotation[];
  note_tweet?: NoteTweet;
}

export interface TweetPublicMetrics {
  retweet_count: number;
  reply_count: number;
  like_count: number;
  quote_count: number;
  bookmark_count: number;
  impression_count: number;
}

export interface TweetEntities {
  urls?: TweetUrl[];
  mentions?: TweetMention[];
  hashtags?: TweetHashtag[];
  annotations?: TweetAnnotation[];
}

export interface TweetUrl {
  start: number;
  end: number;
  url: string;
  expanded_url: string;
  display_url: string;
  title?: string;
  description?: string;
}

export interface TweetMention {
  start: number;
  end: number;
  username: string;
  id: string;
}

export interface TweetHashtag {
  start: number;
  end: number;
  tag: string;
}

export interface TweetAnnotation {
  start: number;
  end: number;
  probability: number;
  type: string;
  normalized_text: string;
}

export interface ReferencedTweet {
  type: 'retweeted' | 'quoted' | 'replied_to';
  id: string;
}

export interface TweetAttachments {
  media_keys?: string[];
  poll_ids?: string[];
}

export interface ContextAnnotation {
  domain: { id: string; name: string; description?: string };
  entity: { id: string; name: string; description?: string };
}

export interface NoteTweet {
  text: string;
  entities?: TweetEntities;
}

// ============================================================================
// User
// ============================================================================

export interface User {
  id: string;
  name: string;
  username: string;
  description?: string;
  profile_image_url?: string;
  verified?: boolean;
  public_metrics?: UserPublicMetrics;
  created_at?: string;
}

export interface UserPublicMetrics {
  followers_count: number;
  following_count: number;
  tweet_count: number;
  listed_count: number;
}

// ============================================================================
// Media
// ============================================================================

export interface Media {
  media_key: string;
  type: 'photo' | 'video' | 'animated_gif';
  url?: string;
  preview_image_url?: string;
  alt_text?: string;
  width?: number;
  height?: number;
}

// ============================================================================
// Includes (expansions)
// ============================================================================

export interface XIncludes {
  users?: User[];
  tweets?: Tweet[];
  media?: Media[];
}

// ============================================================================
// Bookmark Folders
// ============================================================================

export interface BookmarkFolder {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  tweet_count?: number;
}

// ============================================================================
// Client Options
// ============================================================================

export interface XClientOptions {
  /** Max retries on 5xx/network errors (default: 3) */
  maxRetries?: number;
  /** Base delay between retries in ms (default: 1000) */
  retryDelay?: number;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
}

// ============================================================================
// Request Params
// ============================================================================

/** Standard tweet fields to request */
export const DEFAULT_TWEET_FIELDS = [
  'author_id',
  'created_at',
  'conversation_id',
  'entities',
  'public_metrics',
  'referenced_tweets',
  'context_annotations',
  'lang',
  'note_tweet',
] as const;

/** Standard user fields to request */
export const DEFAULT_USER_FIELDS = [
  'name',
  'username',
  'description',
  'profile_image_url',
  'verified',
  'public_metrics',
  'created_at',
] as const;

/** Standard expansions for bookmark/tweet endpoints */
export const DEFAULT_EXPANSIONS = [
  'author_id',
  'referenced_tweets.id',
  'attachments.media_keys',
] as const;

export interface BookmarkListParams {
  /** Max results per page (1-100, default 100) */
  max_results?: number;
  /** Pagination token */
  pagination_token?: string;
  /** Tweet fields to include */
  tweet_fields?: string[];
  /** User fields to include */
  user_fields?: string[];
  /** Expansions */
  expansions?: string[];
}

export interface BookmarkFolderListParams {
  /** Max results per page */
  max_results?: number;
  /** Pagination token */
  pagination_token?: string;
}

export interface BookmarkFolderTweetsParams extends BookmarkListParams {
  /** Folder ID */
  folder_id: string;
}

// ============================================================================
// Errors
// ============================================================================

export class XApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly rateLimit?: {
      limit: number;
      remaining: number;
      reset: Date;
    },
  ) {
    super(message);
    this.name = 'XApiRequestError';
  }
}

export class XAuthenticationError extends XApiRequestError {
  constructor(message = 'X API authentication failed — check your Bearer token') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'XAuthenticationError';
  }
}

export class XRateLimitError extends XApiRequestError {
  constructor(
    public readonly retryAfter: number,
    rateLimit?: { limit: number; remaining: number; reset: Date },
  ) {
    super(`X API rate limit exceeded — retry after ${retryAfter}s`, 429, 'RATE_LIMIT', rateLimit);
    this.name = 'XRateLimitError';
  }
}

export class XNotFoundError extends XApiRequestError {
  constructor(message = 'X API resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'XNotFoundError';
  }
}
