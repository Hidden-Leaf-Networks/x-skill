import { BookmarksSkill } from '../skills/bookmarks/index';
import type { XClient } from '../clients/x-client';
import type { BookmarkStore } from '../cache/store';
import type { Tweet, User, BookmarkFolder } from '../clients/types';

// ==========================================================================
// Test Fixtures
// ==========================================================================

function makeTweet(overrides: Partial<Tweet> = {}): Tweet {
  return {
    id: 't1',
    text: 'Test tweet',
    author_id: 'u1',
    created_at: '2026-03-01T12:00:00Z',
    public_metrics: {
      like_count: 10,
      retweet_count: 5,
      reply_count: 2,
      quote_count: 1,
      bookmark_count: 3,
      impression_count: 1000,
    },
    ...overrides,
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    name: 'Test User',
    username: 'testuser',
    verified: false,
    public_metrics: {
      followers_count: 100,
      following_count: 50,
      tweet_count: 500,
      listed_count: 10,
    },
    ...overrides,
  };
}

function makeFolder(overrides: Partial<BookmarkFolder> = {}): BookmarkFolder {
  return {
    id: 'f1',
    name: 'Robotics',
    tweet_count: 2,
    ...overrides,
  };
}

// ==========================================================================
// Mock Store
// ==========================================================================

function createMockStore(): jest.Mocked<BookmarkStore> {
  return {
    getFolders: jest.fn().mockReturnValue([]),
    getFolderByName: jest.fn().mockReturnValue(undefined),
    getTweetsByFolder: jest.fn().mockReturnValue([]),
    getAllTweets: jest.fn().mockReturnValue([]),
    getStats: jest.fn().mockReturnValue({ folders: 0, tweets: 0, users: 0, lastSync: null }),
    upsertFolder: jest.fn(),
    upsertUser: jest.fn(),
    upsertTweet: jest.fn(),
    linkTweetToFolder: jest.fn(),
    syncFolderData: jest.fn(),
    logSyncStart: jest.fn().mockReturnValue(1),
    logSyncComplete: jest.fn(),
    logSyncError: jest.fn(),
    close: jest.fn(),
  } as any;
}

// ==========================================================================
// Mock Client
// ==========================================================================

function createMockClient(): jest.Mocked<XClient> {
  return {
    getBookmarks: jest.fn(),
    getAllBookmarks: jest.fn(),
    getBookmarkFolders: jest.fn(),
    getAllBookmarkFolders: jest.fn(),
    getBookmarkFolderTweetIds: jest.fn(),
    getBookmarksWithFolders: jest.fn(),
    getTweetsByIds: jest.fn(),
    getMe: jest.fn(),
  } as any;
}

describe('BookmarksSkill', () => {
  let skill: BookmarksSkill;
  let mockClient: jest.Mocked<XClient>;
  let mockStore: jest.Mocked<BookmarkStore>;

  beforeEach(() => {
    mockClient = createMockClient();
    mockStore = createMockStore();
    skill = new BookmarksSkill(mockClient, mockStore);
  });

  // ==========================================================================
  // listFolders
  // ==========================================================================

  describe('listFolders', () => {
    it('returns folders from cache', () => {
      const folders = [makeFolder(), makeFolder({ id: 'f2', name: 'AI' })];
      mockStore.getFolders.mockReturnValue(folders);

      const result = skill.listFolders();

      expect(result.totalFolders).toBe(2);
      expect(result.folders).toEqual(folders);
      expect(mockStore.getFolders).toHaveBeenCalledTimes(1);
    });

    it('returns empty list when no folders cached', () => {
      const result = skill.listFolders();
      expect(result.totalFolders).toBe(0);
      expect(result.folders).toEqual([]);
    });
  });

  // ==========================================================================
  // fetchByFolderName
  // ==========================================================================

  describe('fetchByFolderName', () => {
    it('fetches bookmarks by folder name', () => {
      const folder = makeFolder();
      const tweet = makeTweet();
      const user = makeUser();

      mockStore.getFolderByName.mockReturnValue(folder);
      mockStore.getTweetsByFolder.mockReturnValue([{ tweet, author: user }]);

      const result = skill.fetchByFolderName('Robotics');

      expect(result.folder).toBe('Robotics');
      expect(result.totalTweets).toBe(1);
      expect(result.uniqueAuthors).toBe(1);
      expect(result.bookmarks[0].tweet.id).toBe('t1');
      expect(result.bookmarks[0].author?.username).toBe('testuser');
    });

    it('throws when folder not found', () => {
      mockStore.getFolderByName.mockReturnValue(undefined);
      mockStore.getFolders.mockReturnValue([makeFolder({ name: 'AI' })]);

      expect(() => skill.fetchByFolderName('Nonexistent')).toThrow('not found in cache');
    });

    it('includes available folders in error message', () => {
      mockStore.getFolderByName.mockReturnValue(undefined);
      mockStore.getFolders.mockReturnValue([
        makeFolder({ name: 'AI' }),
        makeFolder({ id: 'f2', name: 'Robotics' }),
      ]);

      expect(() => skill.fetchByFolderName('Missing')).toThrow('AI, Robotics');
    });
  });

  // ==========================================================================
  // fetchByFolderId
  // ==========================================================================

  describe('fetchByFolderId', () => {
    it('fetches by folder ID', () => {
      mockStore.getTweetsByFolder.mockReturnValue([
        { tweet: makeTweet(), author: makeUser() },
      ]);

      const result = skill.fetchByFolderId('f1', 'Robotics');
      expect(result.folder).toBe('Robotics');
      expect(result.totalTweets).toBe(1);
    });

    it('uses folder ID as name when name not provided', () => {
      mockStore.getTweetsByFolder.mockReturnValue([]);
      const result = skill.fetchByFolderId('f1');
      expect(result.folder).toBe('f1');
    });
  });

  // ==========================================================================
  // fetchAll
  // ==========================================================================

  describe('fetchAll', () => {
    it('fetches all cached bookmarks', () => {
      mockStore.getAllTweets.mockReturnValue([
        { tweet: makeTweet({ id: 't1' }), author: makeUser({ id: 'u1', username: 'a' }) },
        { tweet: makeTweet({ id: 't2' }), author: makeUser({ id: 'u2', username: 'b' }) },
        { tweet: makeTweet({ id: 't3' }), author: makeUser({ id: 'u1', username: 'a' }) },
      ]);

      const result = skill.fetchAll();
      expect(result.folder).toBe('All Bookmarks');
      expect(result.totalTweets).toBe(3);
      expect(result.uniqueAuthors).toBe(2);
    });
  });

  // ==========================================================================
  // syncAll
  // ==========================================================================

  describe('syncAll', () => {
    it('syncs all folders and tweets from API into cache', async () => {
      const folders = [makeFolder()];
      const tweets = [makeTweet()];
      const users = new Map<string, User>([['u1', makeUser()]]);
      const folderTweetIds = new Map<string, string[]>([['f1', ['t1']]]);

      mockClient.getBookmarksWithFolders.mockResolvedValue({
        tweets,
        users,
        folders,
        folderTweetIds,
      });

      const result = await skill.syncAll();

      expect(result.totalFolders).toBe(1);
      expect(result.totalTweets).toBe(1);
      expect(result.folders[0].name).toBe('Robotics');
      expect(result.syncedAt).toBeTruthy();
      expect(mockStore.upsertUser).toHaveBeenCalledTimes(1);
      expect(mockStore.upsertTweet).toHaveBeenCalledTimes(1);
      expect(mockStore.upsertFolder).toHaveBeenCalledTimes(1);
      expect(mockStore.linkTweetToFolder).toHaveBeenCalledWith('f1', 't1', 0);
      expect(mockStore.logSyncStart).toHaveBeenCalledWith('all');
      expect(mockStore.logSyncComplete).toHaveBeenCalled();
    });

    it('hydrates missing tweets from folder IDs', async () => {
      const folders = [makeFolder()];
      const tweets = [makeTweet({ id: 't1' })];
      const users = new Map<string, User>([['u1', makeUser()]]);
      // Folder references t1 (in main bookmarks) AND t2 (missing, needs hydration)
      const folderTweetIds = new Map<string, string[]>([['f1', ['t1', 't2']]]);

      mockClient.getBookmarksWithFolders.mockResolvedValue({
        tweets,
        users,
        folders,
        folderTweetIds,
      });

      const hydratedTweet = makeTweet({ id: 't2', author_id: 'u2' });
      const hydratedUser = makeUser({ id: 'u2', username: 'hydrated' });
      mockClient.getTweetsByIds.mockResolvedValue({
        tweets: [hydratedTweet],
        users: new Map([['u2', hydratedUser]]),
      });

      const result = await skill.syncAll();

      expect(mockClient.getTweetsByIds).toHaveBeenCalledWith(['t2']);
      expect(result.totalTweets).toBe(2);
      expect(mockStore.upsertUser).toHaveBeenCalledTimes(2);
    });

    it('logs error and rethrows on failure', async () => {
      mockClient.getBookmarksWithFolders.mockRejectedValue(new Error('API down'));

      await expect(skill.syncAll()).rejects.toThrow('API down');
      expect(mockStore.logSyncError).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // syncFolder
  // ==========================================================================

  describe('syncFolder', () => {
    it('syncs a single folder by name (case-insensitive)', async () => {
      const folders = [makeFolder({ id: 'f1', name: 'Robotics' })];
      mockClient.getAllBookmarkFolders.mockResolvedValue(folders);
      mockClient.getBookmarkFolderTweetIds.mockResolvedValue(['t1']);
      mockClient.getTweetsByIds.mockResolvedValue({
        tweets: [makeTweet()],
        users: new Map([['u1', makeUser()]]),
      });

      const result = await skill.syncFolder('robotics');

      expect(result.totalFolders).toBe(1);
      expect(result.totalTweets).toBe(1);
      expect(result.folders[0].name).toBe('Robotics');
    });

    it('throws when folder not found', async () => {
      mockClient.getAllBookmarkFolders.mockResolvedValue([
        makeFolder({ name: 'AI' }),
      ]);

      await expect(skill.syncFolder('Nonexistent')).rejects.toThrow('not found');
      expect(mockStore.logSyncError).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // brief
  // ==========================================================================

  describe('brief', () => {
    it('generates a brief from folder bookmarks', async () => {
      const folder = makeFolder();
      const tweet = makeTweet();
      const user = makeUser();

      mockStore.getFolderByName.mockReturnValue(folder);
      mockStore.getTweetsByFolder.mockReturnValue([{ tweet, author: user }]);

      const result = await skill.brief({ folderName: 'Robotics' });

      expect(result.brief.topic).toBe('Robotics');
      expect(result.brief.tweetCount).toBe(1);
      expect(result.sourceBookmarks).toHaveLength(1);
    });

    it('uses folderId when provided', async () => {
      mockStore.getTweetsByFolder.mockReturnValue([
        { tweet: makeTweet(), author: makeUser() },
      ]);

      const result = await skill.brief({ folderId: 'f1', folderName: 'Test' });
      expect(result.brief.topic).toBe('Test');
    });

    it('uses all bookmarks when no folder specified', async () => {
      mockStore.getAllTweets.mockReturnValue([
        { tweet: makeTweet(), author: makeUser() },
      ]);

      const result = await skill.brief();
      expect(result.brief.topic).toBe('All Bookmarks');
    });

    it('throws when no bookmarks in cache', async () => {
      mockStore.getFolderByName.mockReturnValue(makeFolder());
      mockStore.getTweetsByFolder.mockReturnValue([]);

      await expect(skill.brief({ folderName: 'Empty' })).rejects.toThrow('No bookmarks found');
    });

    it('respects maxTweets limit', async () => {
      const manyTweets = Array.from({ length: 100 }, (_, i) => ({
        tweet: makeTweet({ id: `t${i}` }),
        author: makeUser(),
      }));

      mockStore.getAllTweets.mockReturnValue(manyTweets);

      const result = await skill.brief({ maxTweets: 5 });
      expect(result.sourceBookmarks).toHaveLength(5);
    });
  });

  // ==========================================================================
  // stats
  // ==========================================================================

  describe('stats', () => {
    it('returns cache stats from store', () => {
      const expected = { folders: 5, tweets: 100, users: 30, lastSync: '2026-03-01T00:00:00Z' };
      mockStore.getStats.mockReturnValue(expected);

      expect(skill.stats()).toEqual(expected);
    });
  });

  // ==========================================================================
  // close
  // ==========================================================================

  describe('close', () => {
    it('closes the store', () => {
      skill.close();
      expect(mockStore.close).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // EnrichedBookmark formatting
  // ==========================================================================

  describe('enriched bookmark formatting', () => {
    it('formats with author handle and metrics', () => {
      mockStore.getFolderByName.mockReturnValue(makeFolder());
      mockStore.getTweetsByFolder.mockReturnValue([
        { tweet: makeTweet({ text: 'Hello world' }), author: makeUser({ username: 'tre' }) },
      ]);

      const result = skill.fetchByFolderName('Robotics');
      expect(result.bookmarks[0].formatted).toContain('@tre');
      expect(result.bookmarks[0].formatted).toContain('Hello world');
      expect(result.bookmarks[0].formatted).toContain('10 likes');
    });

    it('uses note_tweet text when available', () => {
      mockStore.getFolderByName.mockReturnValue(makeFolder());
      mockStore.getTweetsByFolder.mockReturnValue([
        {
          tweet: makeTweet({
            text: 'Truncated...',
            note_tweet: { text: 'Full long-form content here' },
          }),
          author: makeUser(),
        },
      ]);

      const result = skill.fetchByFolderName('Robotics');
      expect(result.bookmarks[0].formatted).toContain('Full long-form content here');
      expect(result.bookmarks[0].formatted).not.toContain('Truncated...');
    });

    it('handles missing author', () => {
      mockStore.getFolderByName.mockReturnValue(makeFolder());
      mockStore.getTweetsByFolder.mockReturnValue([
        { tweet: makeTweet(), author: undefined },
      ]);

      const result = skill.fetchByFolderName('Robotics');
      expect(result.bookmarks[0].formatted).toContain('unknown');
    });
  });
});
