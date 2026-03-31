import axios from 'axios';
import { XClient } from '../clients/x-client';
import {
  XRateLimitError,
  XNotFoundError,
  XApiRequestError,
} from '../clients/types';
import type { XAuthConfig } from '../clients/types';

// Mock axios
jest.mock('axios', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockAxios: Record<string, any> = {
    create: jest.fn(() => mockAxios),
    get: jest.fn(),
    post: jest.fn(),
    defaults: { headers: { common: {} } },
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  return {
    __esModule: true,
    default: mockAxios,
  };
});

jest.mock('axios-retry', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockAxios = axios as jest.Mocked<typeof axios>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAxiosInstance = mockAxios.create() as Record<string, any>;

const TEST_AUTH: XAuthConfig = {
  userAccessToken: 'test-access-token',
  userId: '123456789',
  refreshToken: 'test-refresh-token',
  consumerKey: 'test-consumer-key',
  consumerSecret: 'test-consumer-secret',
};

describe('XClient', () => {
  let client: XClient;
  let responseInterceptorSuccess: (response: unknown) => unknown;
  let responseInterceptorError: (error: unknown) => Promise<unknown>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Capture the response interceptor callbacks
    mockAxiosInstance.interceptors.response.use.mockImplementation(
      (onSuccess: (r: unknown) => unknown, onError: (e: unknown) => Promise<unknown>) => {
        responseInterceptorSuccess = onSuccess;
        responseInterceptorError = onError;
      },
    );

    client = new XClient(TEST_AUTH);
  });

  // ==========================================================================
  // Constructor
  // ==========================================================================

  describe('constructor', () => {
    it('creates axios instance with correct config', () => {
      expect(mockAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.x.com/2',
          timeout: 30000,
          headers: expect.objectContaining({
            Authorization: 'Bearer test-access-token',
          }),
        }),
      );
    });

    it('accepts custom options', () => {
      new XClient(TEST_AUTH, { timeout: 60000, maxRetries: 5 });
      expect(mockAxios.create).toHaveBeenCalled();
    });

    it('registers response interceptor', () => {
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // getBookmarks
  // ==========================================================================

  describe('getBookmarks', () => {
    it('calls correct endpoint with default params', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { data: [], meta: { result_count: 0 } },
      });

      await client.getBookmarks();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/users/123456789/bookmarks',
        expect.objectContaining({
          params: expect.objectContaining({
            max_results: 100,
          }),
        }),
      );
    });

    it('passes pagination token', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { data: [], meta: { result_count: 0 } },
      });

      await client.getBookmarks({ pagination_token: 'next_page' });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/users/123456789/bookmarks',
        expect.objectContaining({
          params: expect.objectContaining({
            pagination_token: 'next_page',
          }),
        }),
      );
    });
  });

  // ==========================================================================
  // getAllBookmarks
  // ==========================================================================

  describe('getAllBookmarks', () => {
    it('auto-paginates through all pages', async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({
          data: {
            data: [{ id: '1', text: 'first' }],
            includes: { users: [{ id: 'u1', name: 'User', username: 'user1' }] },
            meta: { result_count: 1, next_token: 'page2' },
          },
        })
        .mockResolvedValueOnce({
          data: {
            data: [{ id: '2', text: 'second' }],
            includes: { users: [{ id: 'u2', name: 'User2', username: 'user2' }] },
            meta: { result_count: 1 },
          },
        });

      const result = await client.getAllBookmarks();

      expect(result.tweets).toHaveLength(2);
      expect(result.users.size).toBe(2);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });

    it('handles empty response', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { data: null, meta: { result_count: 0 } },
      });

      const result = await client.getAllBookmarks();
      expect(result.tweets).toHaveLength(0);
      expect(result.users.size).toBe(0);
    });
  });

  // ==========================================================================
  // getBookmarkFolders
  // ==========================================================================

  describe('getBookmarkFolders', () => {
    it('calls correct endpoint', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { data: [{ id: 'f1', name: 'Robotics' }] },
      });

      const result = await client.getBookmarkFolders();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/users/123456789/bookmarks/folders',
        expect.anything(),
      );
      expect(result.data).toHaveLength(1);
    });
  });

  // ==========================================================================
  // getAllBookmarkFolders
  // ==========================================================================

  describe('getAllBookmarkFolders', () => {
    it('auto-paginates folders', async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({
          data: {
            data: [{ id: 'f1', name: 'Robotics' }],
            meta: { next_token: 'page2' },
          },
        })
        .mockResolvedValueOnce({
          data: {
            data: [{ id: 'f2', name: 'AI' }],
            meta: {},
          },
        });

      const folders = await client.getAllBookmarkFolders();
      expect(folders).toHaveLength(2);
    });
  });

  // ==========================================================================
  // getBookmarkFolderTweetIds
  // ==========================================================================

  describe('getBookmarkFolderTweetIds', () => {
    it('returns tweet IDs from folder endpoint', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          data: [{ id: 't1' }, { id: 't2' }, { id: 't3' }],
          meta: {},
        },
      });

      const ids = await client.getBookmarkFolderTweetIds('folder_1');
      expect(ids).toEqual(['t1', 't2', 't3']);
    });

    it('auto-paginates folder tweet IDs', async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({
          data: {
            data: [{ id: 't1' }],
            meta: { next_token: 'page2' },
          },
        })
        .mockResolvedValueOnce({
          data: {
            data: [{ id: 't2' }],
            meta: {},
          },
        });

      const ids = await client.getBookmarkFolderTweetIds('folder_1');
      expect(ids).toEqual(['t1', 't2']);
    });
  });

  // ==========================================================================
  // getTweetsByIds
  // ==========================================================================

  describe('getTweetsByIds', () => {
    it('fetches tweets by ID', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          data: [
            { id: 't1', text: 'tweet 1' },
            { id: 't2', text: 'tweet 2' },
          ],
          includes: {
            users: [{ id: 'u1', name: 'User', username: 'user1' }],
          },
        },
      });

      const result = await client.getTweetsByIds(['t1', 't2']);
      expect(result.tweets).toHaveLength(2);
      expect(result.users.size).toBe(1);
    });

    it('batches in chunks of 100', async () => {
      const ids = Array.from({ length: 150 }, (_, i) => `t${i}`);

      mockAxiosInstance.get.mockResolvedValue({
        data: { data: [], includes: {} },
      });

      await client.getTweetsByIds(ids);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });

    it('handles empty data response', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { data: null },
      });

      const result = await client.getTweetsByIds(['t1']);
      expect(result.tweets).toHaveLength(0);
    });
  });

  // ==========================================================================
  // getMe
  // ==========================================================================

  describe('getMe', () => {
    it('calls /users/me with user fields', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { data: { id: '123', name: 'Test', username: 'test' } },
      });

      const result = await client.getMe();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/users/me', expect.anything());
      expect(result.data.username).toBe('test');
    });
  });

  // ==========================================================================
  // Error Interceptor
  // ==========================================================================

  describe('error handling (interceptor)', () => {
    it('passes successful responses through', () => {
      const response = { data: { ok: true } };
      expect(responseInterceptorSuccess(response)).toBe(response);
    });

    it('throws XApiRequestError on network error', async () => {
      const error = { message: 'ECONNREFUSED', response: undefined };
      await expect(responseInterceptorError(error)).rejects.toThrow(XApiRequestError);
    });

    it('throws XAuthenticationError on 401 without refresh capability', async () => {
      // Create client without refresh tokens (registers new interceptor)
      new XClient({
        userAccessToken: 'token',
        userId: '123',
      });

      const error = {
        response: { status: 401, headers: {}, data: {} },
        config: { headers: {} },
      };

      // Get the interceptor from the latest client creation
      const latestInterceptorError = mockAxiosInstance.interceptors.response.use.mock.calls.at(-1)?.[1];
      await expect(latestInterceptorError(error)).rejects.toThrow('authentication');
    });

    it('throws XNotFoundError on 404', async () => {
      const error = {
        response: { status: 404, headers: {}, data: {} },
        config: { headers: {} },
      };
      await expect(responseInterceptorError(error)).rejects.toThrow(XNotFoundError);
    });

    it('throws XRateLimitError on 429 with retry-after', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 60;
      const error = {
        response: {
          status: 429,
          headers: { 'x-rate-limit-reset': String(resetTime) },
          data: {},
        },
        config: { headers: {} },
      };
      await expect(responseInterceptorError(error)).rejects.toThrow(XRateLimitError);
    });

    it('throws XApiRequestError on other status codes', async () => {
      const error = {
        response: { status: 500, headers: {}, data: { error: 'internal' } },
        config: { headers: {} },
      };
      await expect(responseInterceptorError(error)).rejects.toThrow(XApiRequestError);
    });
  });

  // ==========================================================================
  // Factory
  // ==========================================================================

  describe('createXClientFromEnv', () => {
    it('is exported from the module', async () => {
      const { createXClientFromEnv } = await import('../clients/x-client');
      expect(typeof createXClientFromEnv).toBe('function');
    });

    it('throws XAuthenticationError when X_USER_ACCESS_TOKEN is not set', async () => {
      const origToken = process.env.X_USER_ACCESS_TOKEN;
      const origId = process.env.X_USER_ID;
      delete process.env.X_USER_ACCESS_TOKEN;
      delete process.env.X_USER_ID;

      const { createXClientFromEnv } = await import('../clients/x-client');
      expect(() => createXClientFromEnv()).toThrow('X_USER_ACCESS_TOKEN');

      // Restore
      if (origToken) process.env.X_USER_ACCESS_TOKEN = origToken;
      if (origId) process.env.X_USER_ID = origId;
    });
  });
});
