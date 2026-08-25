/**
 * Hermes Tweet/Xquik-compatible client for bookmark sync.
 *
 * This backend lets x-skill reuse its local cache and research brief pipeline
 * while routing X reads through Hermes Tweet's Xquik API surface.
 */

import axios, { AxiosError, AxiosInstance } from 'axios';
import {
  BookmarkFolder,
  BookmarkFolderListParams,
  BookmarkListParams,
  Tweet,
  TweetPostResult,
  User,
  XApiRequestError,
  XApiResponse,
  XAuthenticationError,
  XBookmarkClient,
  XClientOptions,
  XNotFoundError,
  XRateLimitError,
} from './types.js';

const DEFAULT_XQUIK_BASE_URL = 'https://xquik.com/api/v1';

type UnknownRecord = Record<string, unknown>;

export class HermesTweetClient implements XBookmarkClient {
  private readonly http: AxiosInstance;

  constructor(apiKey: string, options: XClientOptions = {}) {
    if (!apiKey) {
      throw new XAuthenticationError('XQUIK_API_KEY not set for Hermes Tweet backend');
    }

    const baseURL = normalizeBaseUrl(
      options.baseUrl ?? process.env.XQUIK_BASE_URL ?? DEFAULT_XQUIK_BASE_URL,
    );
    const headers: Record<string, string> = {};
    if (apiKey.startsWith('xq_')) {
      headers['x-api-key'] = apiKey;
    } else {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    this.http = axios.create({
      baseURL,
      timeout: options.timeout ?? (Number(process.env.X_TIMEOUT) || 30000),
      headers,
    });
  }

  async getBookmarks(params: BookmarkListParams = {}): Promise<XApiResponse<Tweet[]>> {
    const payload = await this.request('GET', '/x/bookmarks', {
      folderId: params.folderId,
      cursor: params.pagination_token,
    });
    return this.normalizeTweetResponse(payload);
  }

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

  async getBookmarkFolders(
    _params: BookmarkFolderListParams = {},
  ): Promise<XApiResponse<BookmarkFolder[]>> {
    const payload = await this.request('GET', '/x/bookmarks/folders');
    const folders = extractArray(payload, ['folders', 'items', 'data']).map((item, index) =>
      toFolder(asRecord(item), index),
    );
    return {
      data: folders,
      meta: { result_count: folders.length },
    };
  }

  async getAllBookmarkFolders(): Promise<BookmarkFolder[]> {
    const response = await this.getBookmarkFolders();
    return response.data ?? [];
  }

  async getBookmarkFolderTweetIds(folderId: string): Promise<string[]> {
    const { tweets } = await this.getAllBookmarks({ folderId });
    return tweets.map((tweet) => tweet.id);
  }

  async getBookmarksWithFolders(): Promise<{
    tweets: Tweet[];
    users: Map<string, User>;
    folders: BookmarkFolder[];
    folderTweetIds: Map<string, string[]>;
  }> {
    const folders = await this.getAllBookmarkFolders();
    const folderTweetIds = new Map<string, string[]>();
    for (const folder of folders) {
      folderTweetIds.set(folder.id, await this.getBookmarkFolderTweetIds(folder.id));
    }

    const { tweets, users } = await this.getAllBookmarks();
    return { tweets, users, folders, folderTweetIds };
  }

  async getTweetsByIds(ids: string[]): Promise<{ tweets: Tweet[]; users: Map<string, User> }> {
    const tweets: Tweet[] = [];
    const users = new Map<string, User>();

    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      if (batch.length === 0) continue;
      const payload = await this.request('GET', '/x/tweets', {
        ids: batch.join(','),
      });
      const response = this.normalizeTweetResponse(payload);
      tweets.push(...(response.data ?? []));
      for (const user of response.includes?.users ?? []) {
        users.set(user.id, user);
      }
    }

    return { tweets, users };
  }

  async getMe(): Promise<XApiResponse<User>> {
    const payload = asRecord(await this.request('GET', '/account'));
    const account = asRecord(payload?.data) ?? payload;
    return {
      data: {
        id: stringValue(account?.id ?? account?.userId ?? account?.username ?? 'xquik-account'),
        name: stringValue(account?.name ?? account?.username ?? 'Xquik Account'),
        username: stringValue(account?.username ?? account?.handle ?? 'xquik'),
      },
    };
  }

  async postTweet(text: string, options?: { mediaIds?: string[] }): Promise<TweetPostResult> {
    ensureActionsEnabled();
    const account = requiredAccount();
    const payload = asRecord(await this.request('POST', '/x/tweets', undefined, {
      account,
      text,
      media: options?.mediaIds,
    }));
    const data = asRecord(payload?.data) ?? payload;
    const id = stringValue(data?.id ?? data?.tweetId);
    return {
      id,
      text: stringValue(data?.text ?? text),
      url: stringValue(data?.url ?? `https://x.com/i/status/${id}`),
    };
  }

  async deleteTweet(tweetId: string): Promise<boolean> {
    ensureActionsEnabled();
    const account = requiredAccount();
    const payload = asRecord(await this.request('DELETE', `/x/tweets/${tweetId}`, undefined, {
      account,
    }));
    const data = asRecord(payload?.data) ?? payload;
    return data?.deleted === true || data?.success === true;
  }

  private async request(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    params?: Record<string, string | undefined>,
    data?: UnknownRecord,
  ): Promise<unknown> {
    try {
      const response = await this.http.request({
        method,
        url: path,
        params: pruneUndefined(params),
        data,
      });
      return response.data;
    } catch (error) {
      throw normalizeError(error);
    }
  }

  private normalizeTweetResponse(payload: unknown): XApiResponse<Tweet[]> {
    const records = extractArray(payload, ['tweets', 'bookmarks', 'items', 'results', 'data']);
    const users = new Map<string, User>();
    const tweets = records
      .map((item) => this.toTweet(asRecord(item), users))
      .filter((tweet): tweet is Tweet => tweet !== undefined);

    for (const user of extractUsers(payload)) {
      users.set(user.id, user);
    }

    return {
      data: tweets,
      includes: { users: [...users.values()] },
      meta: {
        result_count: tweets.length,
        next_token: nextCursor(payload),
      },
    };
  }

  private toTweet(record: UnknownRecord | undefined, users: Map<string, User>): Tweet | undefined {
    if (!record) return undefined;
    const tweetRecord = asRecord(record.tweet) ?? record;
    const id = stringValue(tweetRecord.id ?? tweetRecord.tweetId ?? tweetRecord.tweet_id);
    const text = stringValue(tweetRecord.text ?? tweetRecord.fullText ?? tweetRecord.full_text);
    if (!id || !text) return undefined;

    const author = toUser(asRecord(tweetRecord.author) ?? asRecord(tweetRecord.user));
    if (author) users.set(author.id, author);

    return {
      id,
      text,
      author_id: stringValue(tweetRecord.author_id ?? tweetRecord.authorId ?? author?.id) || undefined,
      created_at: stringValue(tweetRecord.created_at ?? tweetRecord.createdAt ?? tweetRecord.date) || undefined,
      conversation_id: stringValue(tweetRecord.conversation_id ?? tweetRecord.conversationId) || undefined,
      lang: stringValue(tweetRecord.lang) || undefined,
      public_metrics: toMetrics(tweetRecord),
      entities: asRecord(tweetRecord.entities) as Tweet['entities'],
      referenced_tweets: Array.isArray(tweetRecord.referenced_tweets)
        ? (tweetRecord.referenced_tweets as Tweet['referenced_tweets'])
        : undefined,
      note_tweet: toNoteTweet(tweetRecord),
    };
  }
}

export function createHermesTweetClientFromEnv(options: XClientOptions = {}): HermesTweetClient {
  return new HermesTweetClient(process.env.XQUIK_API_KEY ?? '', options);
}

function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.replace(/\/+$/, '');
  return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
}

function pruneUndefined(params?: Record<string, string | undefined>): Record<string, string> | undefined {
  if (!params) return undefined;
  const entries = Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1]));
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function asRecord(value: unknown): UnknownRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function numberValue(...values: unknown[]): number {
  for (const value of values) {
    if (value == null) continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return 0;
}

function extractArray(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  if (!record) return [];
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  const data = asRecord(record.data);
  if (!data) return [];
  for (const key of keys) {
    const value = data[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function nextCursor(payload: unknown): string | undefined {
  const record = asRecord(payload);
  const data = asRecord(record?.data);
  const meta = asRecord(record?.meta) ?? asRecord(data?.meta);
  return stringValue(
    meta?.next_token ??
      meta?.nextToken ??
      meta?.next_cursor ??
      meta?.nextCursor ??
      record?.nextCursor ??
      data?.nextCursor,
  ) || undefined;
}

function toFolder(record: UnknownRecord | undefined, index: number): BookmarkFolder {
  return {
    id: stringValue(record?.id ?? record?.folderId ?? `folder-${index + 1}`),
    name: stringValue(record?.name ?? record?.title ?? `Folder ${index + 1}`),
    description: stringValue(record?.description) || undefined,
    icon: stringValue(record?.icon) || undefined,
    tweet_count: numberValue(record?.tweet_count ?? record?.tweetCount ?? record?.count),
  };
}

function toUser(record: UnknownRecord | undefined): User | undefined {
  if (!record) return undefined;
  const id = stringValue(record.id ?? record.userId ?? record.rest_id ?? record.username);
  const username = stringValue(record.username ?? record.screen_name ?? record.handle).replace(/^@/, '');
  if (!id && !username) return undefined;
  const metrics = asRecord(record.public_metrics ?? record.metrics);
  return {
    id: id || username,
    name: stringValue(record.name ?? username),
    username,
    description: stringValue(record.description) || undefined,
    profile_image_url: stringValue(record.profile_image_url ?? record.profileImageUrl) || undefined,
    verified: Boolean(record.verified),
    public_metrics: metrics
      ? {
          followers_count: numberValue(metrics.followers_count ?? metrics.followers),
          following_count: numberValue(metrics.following_count ?? metrics.following),
          tweet_count: numberValue(metrics.tweet_count ?? metrics.tweets),
          listed_count: numberValue(metrics.listed_count ?? metrics.listed),
        }
      : undefined,
    created_at: stringValue(record.created_at ?? record.createdAt) || undefined,
  };
}

function extractUsers(payload: unknown): User[] {
  const record = asRecord(payload);
  const data = asRecord(record?.data);
  const includes = asRecord(record?.includes) ?? asRecord(data?.includes);
  return extractArray(includes, ['users'])
    .map((item) => toUser(asRecord(item)))
    .filter((user): user is User => user !== undefined);
}

function toMetrics(record: UnknownRecord): Tweet['public_metrics'] {
  const metrics = asRecord(record.public_metrics ?? record.metrics) ?? record;
  return {
    retweet_count: numberValue(metrics.retweet_count ?? metrics.retweets ?? metrics.reposts ?? metrics.repostCount),
    reply_count: numberValue(metrics.reply_count ?? metrics.replies ?? metrics.replyCount),
    like_count: numberValue(metrics.like_count ?? metrics.likes ?? metrics.likeCount),
    quote_count: numberValue(metrics.quote_count ?? metrics.quotes ?? metrics.quoteCount),
    bookmark_count: numberValue(metrics.bookmark_count ?? metrics.bookmarks ?? metrics.bookmarkCount),
    impression_count: numberValue(metrics.impression_count ?? metrics.impressions ?? metrics.viewCount),
  };
}

function toNoteTweet(record: UnknownRecord): Tweet['note_tweet'] {
  const note = asRecord(record.note_tweet ?? record.noteTweet);
  const text = stringValue(note?.text ?? record.fullText ?? record.full_text);
  return text && text !== stringValue(record.text) ? { text } : undefined;
}

function ensureActionsEnabled(): void {
  if (process.env.HERMES_TWEET_ENABLE_ACTIONS?.toLowerCase() !== 'true') {
    throw new XApiRequestError(
      'Hermes Tweet actions are disabled. Set HERMES_TWEET_ENABLE_ACTIONS=true to enable writes.',
      403,
      'ACTIONS_DISABLED',
    );
  }
}

function requiredAccount(): string {
  const account = process.env.XQUIK_ACCOUNT;
  if (!account) {
    throw new XAuthenticationError('XQUIK_ACCOUNT is required for Hermes Tweet write actions');
  }
  return account;
}

function normalizeError(error: unknown): Error {
  if (!axios.isAxiosError(error)) return error instanceof Error ? error : new Error(String(error));

  const axiosError = error as AxiosError;
  const status = axiosError.response?.status ?? 0;
  if (!status) {
    return new XApiRequestError(`Network error: ${axiosError.message}`, 0, 'NETWORK_ERROR');
  }
  if (status === 401 || status === 403) return new XAuthenticationError('Hermes Tweet authentication failed');
  if (status === 404) return new XNotFoundError('Hermes Tweet resource not found');
  if (status === 429) return new XRateLimitError(60);
  return new XApiRequestError(
    `Hermes Tweet API error ${status}: ${JSON.stringify(axiosError.response?.data)}`,
    status,
  );
}
