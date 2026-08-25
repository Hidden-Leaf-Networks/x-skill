import axios from 'axios';
import {
  HermesTweetClient,
  createHermesTweetClientFromEnv,
} from '../clients/hermes-tweet-client';
import { XApiRequestError, XAuthenticationError } from '../clients/types';
import { resolveXSkillBackend } from '../clients/bookmark-client';

jest.mock('axios', () => {
  const request = jest.fn();
  return {
    __esModule: true,
    default: {
      create: jest.fn(() => ({ request })),
      isAxiosError: jest.fn((error: { isAxiosError?: boolean }) => Boolean(error.isAxiosError)),
    },
  };
});

const mockAxios = axios as jest.Mocked<typeof axios>;
const mockRequest = mockAxios.create().request as jest.Mock;

describe('HermesTweetClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('creates an API client with Xquik API key auth', () => {
    new HermesTweetClient('xq_test', {
      baseUrl: 'https://example.test',
      timeout: 5000,
    });

    expect(mockAxios.create).toHaveBeenCalledWith({
      baseURL: 'https://example.test/api/v1',
      timeout: 5000,
      headers: { 'x-api-key': 'xq_test' },
    });
  });

  it('normalizes bookmark pages and users', async () => {
    mockRequest
      .mockResolvedValueOnce({
        data: {
          data: {
            tweets: [
              {
                id: 't1',
                text: 'Saved robotics thread',
                author: { id: 'u1', name: 'Robotics Lab', username: 'robotics' },
                createdAt: '2026-05-23T09:00:00Z',
                metrics: { likes: 12, reposts: 3, replies: 2, quotes: 1 },
              },
            ],
            meta: { nextToken: 'page-2' },
          },
        },
      })
      .mockResolvedValueOnce({
        data: { data: { tweets: [] } },
      });

    const client = new HermesTweetClient('xq_test');
    const result = await client.getAllBookmarks();

    expect(result.tweets).toHaveLength(1);
    expect(result.tweets[0].id).toBe('t1');
    expect(result.tweets[0].author_id).toBe('u1');
    expect(result.tweets[0].public_metrics?.like_count).toBe(12);
    expect(result.users.get('u1')?.username).toBe('robotics');
    expect(mockRequest).toHaveBeenNthCalledWith(2, expect.objectContaining({
      params: { cursor: 'page-2' },
      url: '/x/bookmarks',
    }));
  });

  it('lists bookmark folders and gets folder tweet IDs', async () => {
    mockRequest
      .mockResolvedValueOnce({
        data: { folders: [{ id: 'f1', name: 'Robotics', tweetCount: 2 }] },
      })
      .mockResolvedValueOnce({
        data: {
          bookmarks: [
            { id: 't1', text: 'first', author: { username: 'a' } },
            { id: 't2', text: 'second', author: { username: 'b' } },
          ],
        },
      });

    const client = new HermesTweetClient('xq_test');

    await expect(client.getAllBookmarkFolders()).resolves.toEqual([
      { id: 'f1', name: 'Robotics', description: undefined, icon: undefined, tweet_count: 2 },
    ]);
    await expect(client.getBookmarkFolderTweetIds('f1')).resolves.toEqual(['t1', 't2']);
    expect(mockRequest).toHaveBeenLastCalledWith(expect.objectContaining({
      params: { folderId: 'f1' },
      url: '/x/bookmarks',
    }));
  });

  it('requires explicit opt-in before write actions', async () => {
    const client = new HermesTweetClient('xq_test');

    await expect(client.postTweet('hello')).rejects.toThrow(XApiRequestError);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('creates from env and selects backend aliases', () => {
    process.env.XQUIK_API_KEY = 'xq_test';
    process.env.X_SKILL_BACKEND = 'xquik';

    expect(createHermesTweetClientFromEnv()).toBeInstanceOf(HermesTweetClient);
    expect(resolveXSkillBackend()).toBe('hermes-tweet');
  });

  it('throws when XQUIK_API_KEY is missing', () => {
    expect(() => new HermesTweetClient('')).toThrow(XAuthenticationError);
  });
});
