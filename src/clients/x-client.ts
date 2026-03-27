/**
 * X API v2 client with OAuth 2.0 User Context auth.
 *
 * Bookmarks require User Context (not App-only Bearer token).
 * Uses pay-per-use pricing (launched Feb 2026).
 * Deduplication: same post requested within a 24h UTC window = single charge.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import * as dotenv from 'dotenv';
import {
  XAuthConfig,
  XClientOptions,
  XApiResponse,
  XApiRequestError,
  XAuthenticationError,
  XRateLimitError,
  XNotFoundError,
  Tweet,
  User,
  BookmarkFolder,
  BookmarkListParams,
  BookmarkFolderListParams,
  DEFAULT_TWEET_FIELDS,
  DEFAULT_USER_FIELDS,
  DEFAULT_EXPANSIONS,
} from './types.js';

dotenv.config();

const X_API_BASE = 'https://api.x.com/2';

export class XClient {
  private readonly http: AxiosInstance;
  private readonly userId: string;

  constructor(auth: XAuthConfig, options: XClientOptions = {}) {
    const { maxRetries = 3, retryDelay = 1000, timeout = 30000 } = options;

    this.userId = auth.userId;

    this.http = axios.create({
      baseURL: X_API_BASE,
      timeout,
      headers: {
        Authorization: `Bearer ${auth.userAccessToken}`,
        'Content-Type': 'application/json',
      },
    });

    axiosRetry(this.http, {
      retries: maxRetries,
      retryDelay: (retryCount) => retryCount * retryDelay,
      retryCondition: (error: AxiosError) => {
        const status = error.response?.status;
        // Retry on 5xx and network errors, not on 4xx (except 429 handled separately)
        return !status || status >= 500;
      },
    });

    // Response interceptor for error normalization
    this.http.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (!error.response) {
          throw new XApiRequestError(
            `Network error: ${error.message}`,
            0,
            'NETWORK_ERROR',
          );
        }

        const { status, headers } = error.response;
        const rateLimit = this.parseRateLimit(headers as Record<string, string>);

        switch (status) {
          case 401:
            throw new XAuthenticationError();
          case 403:
            throw new XApiRequestError(
              'X API forbidden — endpoint may require elevated access or OAuth 2.0 User Context',
              403,
              'FORBIDDEN',
              rateLimit,
            );
          case 404:
            throw new XNotFoundError();
          case 429: {
            const resetHeader = headers?.['x-rate-limit-reset'];
            const resetEpoch = resetHeader ? Number(resetHeader) : 0;
            const retryAfter = Math.max(1, resetEpoch - Math.floor(Date.now() / 1000));
            throw new XRateLimitError(retryAfter, rateLimit);
          }
          default:
            throw new XApiRequestError(
              `X API error ${status}: ${JSON.stringify(error.response.data)}`,
              status,
              undefined,
              rateLimit,
            );
        }
      },
    );
  }

  // ==========================================================================
  // Bookmarks
  // ==========================================================================

  /**
   * Get all bookmarked tweets for the authenticated user.
   * Endpoint: GET /2/users/:id/bookmarks
   * Requires OAuth 2.0 User Context with bookmark.read scope.
   */
  async getBookmarks(params: BookmarkListParams = {}): Promise<XApiResponse<Tweet[]>> {
    const {
      max_results = 100,
      pagination_token,
      tweet_fields = [...DEFAULT_TWEET_FIELDS],
      user_fields = [...DEFAULT_USER_FIELDS],
      expansions = [...DEFAULT_EXPANSIONS],
    } = params;

    const response = await this.http.get(`/users/${this.userId}/bookmarks`, {
      params: {
        max_results,
        pagination_token,
        'tweet.fields': tweet_fields.join(','),
        'user.fields': user_fields.join(','),
        expansions: expansions.join(','),
      },
    });

    return response.data;
  }

  /**
   * Get all bookmarked tweets, auto-paginating through all pages.
   * Caution: each page is a separate API call (pay-per-use charge).
   */
  async getAllBookmarks(params: Omit<BookmarkListParams, 'pagination_token'> = {}): Promise<{
    tweets: Tweet[];
    users: Map<string, User>;
  }> {
    const tweets: Tweet[] = [];
    const users = new Map<string, User>();
    let nextToken: string | undefined;

    do {
      const response = await this.getBookmarks({
        ...params,
        pagination_token: nextToken,
      });

      if (response.data) {
        tweets.push(...response.data);
      }
      if (response.includes?.users) {
        for (const user of response.includes.users) {
          users.set(user.id, user);
        }
      }

      nextToken = response.meta?.next_token;
    } while (nextToken);

    return { tweets, users };
  }

  /**
   * List bookmark folders for the authenticated user.
   * Endpoint: GET /2/users/:id/bookmark_folders
   */
  async getBookmarkFolders(params: BookmarkFolderListParams = {}): Promise<XApiResponse<BookmarkFolder[]>> {
    const response = await this.http.get(`/users/${this.userId}/bookmarks/folders`, {
      params: {
        max_results: params.max_results,
        pagination_token: params.pagination_token,
      },
    });

    return response.data;
  }

  /**
   * Get all bookmark folders, auto-paginating.
   */
  async getAllBookmarkFolders(): Promise<BookmarkFolder[]> {
    const folders: BookmarkFolder[] = [];
    let nextToken: string | undefined;

    do {
      const response = await this.getBookmarkFolders({
        pagination_token: nextToken,
      });

      if (response.data) {
        folders.push(...response.data);
      }

      nextToken = response.meta?.next_token;
    } while (nextToken);

    return folders;
  }

  /**
   * Get tweet IDs from a specific bookmark folder.
   * Endpoint: GET /2/users/:id/bookmarks/folders/:folder_id
   * Note: This endpoint only returns tweet IDs — no text, metrics, or expansions.
   * Use getAllBookmarks() for full tweet data, then cross-reference by ID.
   */
  async getBookmarkFolderTweetIds(folderId: string): Promise<string[]> {
    const ids: string[] = [];
    let nextToken: string | undefined;

    do {
      const response = await this.http.get(
        `/users/${this.userId}/bookmarks/folders/${folderId}`,
        {
          params: {
            ...(nextToken ? { pagination_token: nextToken } : {}),
          },
        },
      );

      const data = response.data as XApiResponse<Array<{ id: string }>>;
      if (data.data) {
        ids.push(...data.data.map((t) => t.id));
      }
      nextToken = data.meta?.next_token;
    } while (nextToken);

    return ids;
  }

  /**
   * Get full bookmark data with folder membership resolved.
   *
   * Strategy:
   *   1. Fetch all folders (cheap — just names/IDs)
   *   2. Fetch tweet IDs per folder (cheap — just IDs)
   *   3. Fetch all bookmarks with full data from main endpoint (one paginated call)
   *   4. Cross-reference to build folder→tweet mappings
   *
   * This minimizes API cost while getting complete data.
   */
  async getBookmarksWithFolders(): Promise<{
    tweets: Tweet[];
    users: Map<string, User>;
    folders: BookmarkFolder[];
    folderTweetIds: Map<string, string[]>;
  }> {
    // Step 1: Get folders
    const folders = await this.getAllBookmarkFolders();

    // Step 2: Get tweet IDs per folder
    const folderTweetIds = new Map<string, string[]>();
    for (const folder of folders) {
      const ids = await this.getBookmarkFolderTweetIds(folder.id);
      folderTweetIds.set(folder.id, ids);
    }

    // Step 3: Get all bookmarks with full data
    const { tweets, users } = await this.getAllBookmarks();

    return { tweets, users, folders, folderTweetIds };
  }

  // ==========================================================================
  // Tweet Lookup (hydration)
  // ==========================================================================

  /**
   * Look up tweets by ID with full data.
   * Endpoint: GET /2/tweets?ids=...
   * Accepts up to 100 IDs per call.
   */
  async getTweetsByIds(ids: string[]): Promise<{ tweets: Tweet[]; users: Map<string, User> }> {
    const tweets: Tweet[] = [];
    const users = new Map<string, User>();

    // Batch in chunks of 100
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);

      const response = await this.http.get('/tweets', {
        params: {
          ids: batch.join(','),
          'tweet.fields': [...DEFAULT_TWEET_FIELDS].join(','),
          'user.fields': [...DEFAULT_USER_FIELDS].join(','),
          expansions: [...DEFAULT_EXPANSIONS].join(','),
        },
      });

      const data = response.data as XApiResponse<Tweet[]>;
      if (data.data) {
        tweets.push(...data.data);
      }
      if (data.includes?.users) {
        for (const user of data.includes.users) {
          users.set(user.id, user);
        }
      }
    }

    return { tweets, users };
  }

  // ==========================================================================
  // User Lookup
  // ==========================================================================

  /**
   * Get the authenticated user's profile.
   * Endpoint: GET /2/users/me
   */
  async getMe(): Promise<XApiResponse<User>> {
    const response = await this.http.get('/users/me', {
      params: {
        'user.fields': [...DEFAULT_USER_FIELDS].join(','),
      },
    });

    return response.data;
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  private parseRateLimit(headers: Record<string, string>) {
    const limit = Number(headers['x-rate-limit-limit']);
    const remaining = Number(headers['x-rate-limit-remaining']);
    const reset = new Date(Number(headers['x-rate-limit-reset']) * 1000);

    if (isNaN(limit)) return undefined;

    return { limit, remaining, reset };
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create an XClient from environment variables.
 *
 * Required env vars:
 *   X_USER_ACCESS_TOKEN — OAuth 2.0 User Access Token (from OAuth flow)
 *   X_USER_ID           — Authenticated user's numeric ID
 *
 * Optional env vars:
 *   X_MAX_RETRIES  — Max retries on 5xx (default: 3)
 *   X_TIMEOUT      — Request timeout in ms (default: 30000)
 */
export function createXClientFromEnv(options: XClientOptions = {}): XClient {
  const userAccessToken = process.env.X_USER_ACCESS_TOKEN;
  const userId = process.env.X_USER_ID;

  if (!userAccessToken) {
    throw new XAuthenticationError(
      'X_USER_ACCESS_TOKEN not set — run `npx tsx scripts/oauth-flow.ts` to generate one',
    );
  }
  if (!userId) {
    throw new XAuthenticationError(
      'X_USER_ID not set — run `npx tsx scripts/oauth-flow.ts` to get your user ID',
    );
  }

  return new XClient(
    { userAccessToken, userId },
    {
      maxRetries: Number(process.env.X_MAX_RETRIES) || options.maxRetries,
      timeout: Number(process.env.X_TIMEOUT) || options.timeout,
      ...options,
    },
  );
}
