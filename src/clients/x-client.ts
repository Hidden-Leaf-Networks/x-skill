/**
 * X API v2 client with OAuth 2.0 User Context auth.
 *
 * Bookmarks require User Context (not App-only Bearer token).
 * Uses pay-per-use pricing (launched Feb 2026).
 * Deduplication: same post requested within a 24h UTC window = single charge.
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import {
  XAuthConfig,
  XClientOptions,
  XApiResponse,
  XApiRequestError,
  XAuthenticationError,
  XRateLimitError,
  XNotFoundError,
  XAccountType,
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
const TOKEN_URL = 'https://api.x.com/2/oauth2/token';

export class XClient {
  private readonly http: AxiosInstance;
  private readonly userId: string;
  private refreshToken?: string;
  private readonly consumerKey?: string;
  private readonly consumerSecret?: string;
  private readonly accountType: XAccountType;
  private isRefreshing = false;

  constructor(auth: XAuthConfig, options: XClientOptions = {}) {
    const { maxRetries = 3, retryDelay = 1000, timeout = 30000 } = options;

    this.userId = auth.userId;
    this.refreshToken = auth.refreshToken;
    this.consumerKey = auth.consumerKey;
    this.consumerSecret = auth.consumerSecret;
    this.accountType = auth.accountType ?? 'personal';

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
        // Retry on 5xx and network errors, not on 4xx
        return !status || status >= 500;
      },
    });

    // Response interceptor: auto-refresh on 401, normalize other errors
    this.http.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (!error.response) {
          throw new XApiRequestError(
            `Network error: ${error.message}`,
            0,
            'NETWORK_ERROR',
          );
        }

        const { status, headers } = error.response;
        const rateLimit = this.parseRateLimit(headers as Record<string, string>);
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retried?: boolean };

        // Auto-refresh on 401 or 403 if we have a refresh token
        // X returns 403 (not 401) for expired/invalid OAuth user tokens
        if ((status === 401 || status === 403) && this.canRefresh() && !originalRequest._retried) {
          originalRequest._retried = true;

          try {
            const newToken = await this.refreshAccessToken();
            // Update default header for future requests
            this.http.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            // Update this request's header and retry
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            return this.http(originalRequest);
          } catch (refreshError) {
            throw new XAuthenticationError(
              'Token refresh failed — run `npx tsx scripts/oauth-flow.ts` to re-authenticate',
            );
          }
        }

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
  // Token Refresh
  // ==========================================================================

  private canRefresh(): boolean {
    return !this.isRefreshing && !!this.refreshToken && !!this.consumerKey && !!this.consumerSecret;
  }

  /**
   * Exchange refresh token for a new access token.
   * Updates .env file with new tokens so they persist across runs.
   */
  private async refreshAccessToken(): Promise<string> {
    this.isRefreshing = true;

    try {
      const basicAuth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');

      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken!,
        client_id: this.consumerKey!,
      });

      const response = await axios.post(TOKEN_URL, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
      });

      const { access_token, refresh_token: newRefreshToken } = response.data;

      // Update .env file so new tokens persist
      this.updateEnvFile(access_token, newRefreshToken);

      // Update in-memory env vars (account-aware)
      const prefix = this.accountType === 'org' ? 'X_ORG' : 'X_USER';
      process.env[`${prefix}_ACCESS_TOKEN`] = access_token;
      if (newRefreshToken) {
        const refreshKey = this.accountType === 'org' ? 'X_ORG_REFRESH_TOKEN' : 'X_REFRESH_TOKEN';
        process.env[refreshKey] = newRefreshToken;
        // X uses rotating refresh tokens — the old one is now invalid
        this.refreshToken = newRefreshToken;
      }

      console.info('[@hidden-leaf/x-skill] Access token refreshed successfully');
      return access_token;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Update .env file with new token values.
   * Preserves all other env vars and comments.
   */
  private updateEnvFile(accessToken: string, refreshToken?: string): void {
    const envPath = path.resolve(process.cwd(), '.env');

    try {
      if (!fs.existsSync(envPath)) return;

      let content = fs.readFileSync(envPath, 'utf8');

      // Account-aware env var names
      const accessKey = this.accountType === 'org' ? 'X_ORG_ACCESS_TOKEN' : 'X_USER_ACCESS_TOKEN';
      const refreshKey = this.accountType === 'org' ? 'X_ORG_REFRESH_TOKEN' : 'X_REFRESH_TOKEN';

      // Replace access token
      content = content.replace(
        new RegExp(`^${accessKey}=.*`, 'm'),
        `${accessKey}=${accessToken}`,
      );

      // Replace refresh token if we got a new one (rotating tokens)
      if (refreshToken) {
        content = content.replace(
          new RegExp(`^${refreshKey}=.*`, 'm'),
          `${refreshKey}=${refreshToken}`,
        );
      }

      fs.writeFileSync(envPath, content, 'utf8');
    } catch {
      // Non-fatal — tokens still work in memory for this session
    }
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

  // ==========================================================================
  // Publishing (requires OAuth 1.0a for media upload)
  // ==========================================================================

  /**
   * Upload an image for use in tweets.
   * Uses OAuth 1.0a signed multipart upload to v1.1 endpoint.
   * Requires X_ORG_OAUTH1_* env vars and Read+Write app permissions.
   */
  async uploadMedia(
    imageData: Buffer,
    oauth1: import('./types').XOAuth1Config,
  ): Promise<import('./types').MediaUploadResult> {
    const crypto = await import('crypto');
    const base64 = imageData.toString('base64');
    const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';

    const pEnc = (s: string) =>
      encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

    const oauthParams: Record<string, string> = {
      oauth_consumer_key: oauth1.consumerKey,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: oauth1.accessToken,
      oauth_version: '1.0',
    };

    // Sign (multipart: body params excluded from signature)
    const sorted = Object.keys(oauthParams)
      .sort()
      .map((k) => pEnc(k) + '=' + pEnc(oauthParams[k]))
      .join('&');
    const baseString = 'POST&' + pEnc(uploadUrl) + '&' + pEnc(sorted);
    const signingKey = pEnc(oauth1.consumerSecret) + '&' + pEnc(oauth1.accessTokenSecret);
    oauthParams.oauth_signature = crypto
      .createHmac('sha1', signingKey)
      .update(baseString)
      .digest('base64');

    const authHeader =
      'OAuth ' +
      Object.keys(oauthParams)
        .sort()
        .map((k) => pEnc(k) + '="' + pEnc(oauthParams[k]) + '"')
        .join(', ');

    const form = new FormData();
    form.append('media_data', base64);
    form.append('media_category', 'tweet_image');

    const resp = await fetch(uploadUrl, {
      method: 'POST',
      headers: { Authorization: authHeader },
      body: form,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Media upload failed (${resp.status}): ${text}`);
    }

    const data = (await resp.json()) as { media_id_string: string; size: number; expires_after_secs: number };
    return {
      mediaId: data.media_id_string,
      size: data.size,
      expiresAfterSecs: data.expires_after_secs,
    };
  }

  /**
   * Post a tweet, optionally with media.
   * Uses OAuth 2.0 Bearer token for the v2 tweets endpoint.
   */
  async postTweet(
    text: string,
    options?: { mediaIds?: string[] },
  ): Promise<import('./types').TweetPostResult> {
    const body: Record<string, unknown> = { text };
    if (options?.mediaIds?.length) {
      body.media = { media_ids: options.mediaIds };
    }

    const resp = await this.http.post('/tweets', body);
    const data = resp.data?.data;
    if (!data?.id) {
      throw new Error('Tweet post failed: ' + JSON.stringify(resp.data));
    }

    // Derive URL from user ID (screen_name not available here)
    return {
      id: data.id,
      text: data.text,
      url: `https://x.com/i/status/${data.id}`,
    };
  }

  /**
   * Delete a tweet by ID.
   */
  async deleteTweet(tweetId: string): Promise<boolean> {
    const resp = await this.http.delete(`/tweets/${tweetId}`);
    return resp.data?.data?.deleted === true;
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
 * @param account — 'personal' (default) reads X_USER_* vars, 'org' reads X_ORG_* vars
 *
 * Personal env vars:
 *   X_USER_ACCESS_TOKEN — OAuth 2.0 User Access Token
 *   X_USER_ID           — User's numeric ID
 *   X_REFRESH_TOKEN     — Refresh token
 *   X_CONSUMER_KEY      — App consumer key (client ID)
 *   X_CONSUMER_SECRET   — App consumer secret
 *
 * Org env vars:
 *   X_ORG_ACCESS_TOKEN  — OAuth 2.0 User Access Token for org account
 *   X_ORG_USER_ID       — Org account's numeric ID
 *   X_ORG_REFRESH_TOKEN — Refresh token for org account
 *   X_ORG_CONSUMER_KEY  — App consumer key (or falls back to X_CONSUMER_KEY)
 *   X_ORG_CONSUMER_SECRET — App consumer secret (or falls back to X_CONSUMER_SECRET)
 */
export function createXClientFromEnv(
  accountOrOptions: XAccountType | XClientOptions = 'personal',
  options: XClientOptions = {},
): XClient {
  // Support old signature: createXClientFromEnv(options) and new: createXClientFromEnv('org', options)
  let account: XAccountType;
  if (typeof accountOrOptions === 'string') {
    account = accountOrOptions;
  } else {
    account = 'personal';
    options = accountOrOptions;
  }

  let userAccessToken: string | undefined;
  let userId: string | undefined;
  let refreshToken: string | undefined;
  let consumerKey: string | undefined;
  let consumerSecret: string | undefined;

  if (account === 'org') {
    userAccessToken = process.env.X_ORG_ACCESS_TOKEN;
    userId = process.env.X_ORG_USER_ID;
    refreshToken = process.env.X_ORG_REFRESH_TOKEN;
    consumerKey = process.env.X_ORG_CONSUMER_KEY ?? process.env.X_CONSUMER_KEY;
    consumerSecret = process.env.X_ORG_CONSUMER_SECRET ?? process.env.X_CONSUMER_SECRET;
  } else {
    userAccessToken = process.env.X_USER_ACCESS_TOKEN;
    userId = process.env.X_USER_ID;
    refreshToken = process.env.X_REFRESH_TOKEN;
    consumerKey = process.env.X_CONSUMER_KEY;
    consumerSecret = process.env.X_CONSUMER_SECRET;
  }

  const label = account === 'org' ? 'X_ORG' : 'X_USER';

  if (!userAccessToken) {
    throw new XAuthenticationError(
      `${label}_ACCESS_TOKEN not set — run \`npx tsx scripts/oauth-flow.ts\` to generate one`,
    );
  }
  if (!userId) {
    throw new XAuthenticationError(
      `${label}_USER_ID (or ${label}_ID) not set — run \`npx tsx scripts/oauth-flow.ts\` to get your user ID`,
    );
  }

  return new XClient(
    {
      userAccessToken,
      userId,
      refreshToken,
      consumerKey,
      consumerSecret,
      accountType: account,
    },
    {
      maxRetries: Number(process.env.X_MAX_RETRIES) || options.maxRetries,
      timeout: Number(process.env.X_TIMEOUT) || options.timeout,
      ...options,
    },
  );
}

/**
 * Convenience: create an XClient for the org account (@HiddenLeafHQ).
 * Reads X_ORG_* env vars.
 */
export function createOrgXClientFromEnv(options: XClientOptions = {}): XClient {
  return createXClientFromEnv('org', options);
}
