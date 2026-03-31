import { BookmarkStore } from '../cache/store';
import type { Tweet, User, BookmarkFolder } from '../clients/types';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

// Use a temp directory for test databases
const TEST_DB_DIR = path.join(os.tmpdir(), 'x-skill-test');

function createTestStore(): { store: BookmarkStore; dbPath: string } {
  const dbPath = path.join(TEST_DB_DIR, `test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  const store = new BookmarkStore(dbPath);
  return { store, dbPath };
}

function makeTweet(overrides: Partial<Tweet> = {}): Tweet {
  return {
    id: '1234567890',
    text: 'Test tweet content',
    author_id: 'user_1',
    created_at: '2026-03-01T12:00:00.000Z',
    lang: 'en',
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
    id: 'user_1',
    name: 'Test User',
    username: 'testuser',
    description: 'A test user',
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
    id: 'folder_1',
    name: 'Robotics',
    description: 'Robotics research',
    tweet_count: 5,
    ...overrides,
  };
}

beforeAll(() => {
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }
});

afterAll(() => {
  // Clean up test databases
  if (fs.existsSync(TEST_DB_DIR)) {
    fs.rmSync(TEST_DB_DIR, { recursive: true, force: true });
  }
});

describe('BookmarkStore', () => {
  let store: BookmarkStore;
  let dbPath: string;

  beforeEach(() => {
    ({ store, dbPath } = createTestStore());
  });

  afterEach(() => {
    store.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  // ==========================================================================
  // Schema / Init
  // ==========================================================================

  describe('initialization', () => {
    it('creates database with all required tables', () => {
      const stats = store.getStats();
      expect(stats).toEqual({
        folders: 0,
        tweets: 0,
        users: 0,
        lastSync: null,
      });
    });

    it('creates directory if it does not exist', () => {
      const nestedPath = path.join(TEST_DB_DIR, 'nested', 'deep', `test-${Date.now()}.db`);
      const nestedStore = new BookmarkStore(nestedPath);
      expect(fs.existsSync(path.dirname(nestedPath))).toBe(true);
      nestedStore.close();
      fs.rmSync(path.join(TEST_DB_DIR, 'nested'), { recursive: true, force: true });
    });
  });

  // ==========================================================================
  // Upsert Operations
  // ==========================================================================

  describe('upsertFolder', () => {
    it('inserts a new folder', () => {
      store.upsertFolder(makeFolder());
      const folders = store.getFolders();
      expect(folders).toHaveLength(1);
      expect(folders[0].name).toBe('Robotics');
      expect(folders[0].id).toBe('folder_1');
    });

    it('updates existing folder on conflict', () => {
      store.upsertFolder(makeFolder());
      store.upsertFolder(makeFolder({ name: 'Robotics Updated' }));
      const folders = store.getFolders();
      expect(folders).toHaveLength(1);
      expect(folders[0].name).toBe('Robotics Updated');
    });
  });

  describe('upsertUser', () => {
    it('inserts a new user', () => {
      store.upsertUser(makeUser());
      const stats = store.getStats();
      expect(stats.users).toBe(1);
    });

    it('updates existing user on conflict', () => {
      store.upsertUser(makeUser());
      store.upsertUser(makeUser({ name: 'Updated Name' }));
      const stats = store.getStats();
      expect(stats.users).toBe(1);
    });

    it('handles user without public_metrics', () => {
      store.upsertUser(makeUser({ public_metrics: undefined }));
      const stats = store.getStats();
      expect(stats.users).toBe(1);
    });
  });

  describe('upsertTweet', () => {
    it('inserts a new tweet', () => {
      store.upsertUser(makeUser());
      store.upsertTweet(makeTweet());
      const stats = store.getStats();
      expect(stats.tweets).toBe(1);
    });

    it('updates existing tweet on conflict', () => {
      store.upsertUser(makeUser());
      store.upsertTweet(makeTweet());
      store.upsertTweet(makeTweet({ text: 'Updated text' }));
      const stats = store.getStats();
      expect(stats.tweets).toBe(1);
    });

    it('stores entities as JSON', () => {
      store.upsertUser(makeUser());
      store.upsertTweet(makeTweet({
        entities: {
          hashtags: [{ start: 0, end: 5, tag: 'AI' }],
          urls: [{ start: 6, end: 20, url: 'https://t.co/x', expanded_url: 'https://example.com', display_url: 'example.com' }],
        },
      }));
      const stats = store.getStats();
      expect(stats.tweets).toBe(1);
    });

    it('stores note_tweet text', () => {
      store.upsertUser(makeUser());
      store.upsertTweet(makeTweet({ note_tweet: { text: 'Long form content here' } }));
      const stats = store.getStats();
      expect(stats.tweets).toBe(1);
    });

    it('handles tweet without optional fields', () => {
      store.upsertTweet(makeTweet({
        author_id: undefined,
        created_at: undefined,
        public_metrics: undefined,
        entities: undefined,
        context_annotations: undefined,
      }));
      const stats = store.getStats();
      expect(stats.tweets).toBe(1);
    });
  });

  describe('linkTweetToFolder', () => {
    it('links a tweet to a folder with position', () => {
      store.upsertUser(makeUser());
      store.upsertFolder(makeFolder());
      store.upsertTweet(makeTweet());
      store.linkTweetToFolder('folder_1', '1234567890', 0);

      const tweets = store.getTweetsByFolder('folder_1');
      expect(tweets).toHaveLength(1);
      expect(tweets[0].tweet.id).toBe('1234567890');
    });

    it('updates position on conflict', () => {
      store.upsertUser(makeUser());
      store.upsertFolder(makeFolder());
      store.upsertTweet(makeTweet());
      store.linkTweetToFolder('folder_1', '1234567890', 0);
      store.linkTweetToFolder('folder_1', '1234567890', 5);

      const tweets = store.getTweetsByFolder('folder_1');
      expect(tweets).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Batch Sync
  // ==========================================================================

  describe('syncFolderData', () => {
    it('upserts folder, users, and tweets in a single transaction', () => {
      const folder = makeFolder();
      const users = new Map<string, User>();
      users.set('user_1', makeUser());
      users.set('user_2', makeUser({ id: 'user_2', username: 'user2', name: 'User Two' }));

      const tweets = [
        makeTweet({ id: 'tweet_1', author_id: 'user_1' }),
        makeTweet({ id: 'tweet_2', author_id: 'user_2' }),
      ];

      store.syncFolderData(folder, tweets, users);

      const stats = store.getStats();
      expect(stats.folders).toBe(1);
      expect(stats.users).toBe(2);
      expect(stats.tweets).toBe(2);

      const folderTweets = store.getTweetsByFolder('folder_1');
      expect(folderTweets).toHaveLength(2);
    });
  });

  // ==========================================================================
  // Read Operations
  // ==========================================================================

  describe('getFolders', () => {
    it('returns folders sorted by name', () => {
      store.upsertFolder(makeFolder({ id: 'f1', name: 'Zebra' }));
      store.upsertFolder(makeFolder({ id: 'f2', name: 'Alpha' }));
      store.upsertFolder(makeFolder({ id: 'f3', name: 'Middle' }));

      const folders = store.getFolders();
      expect(folders.map((f) => f.name)).toEqual(['Alpha', 'Middle', 'Zebra']);
    });

    it('returns empty array when no folders', () => {
      expect(store.getFolders()).toEqual([]);
    });
  });

  describe('getFolderByName', () => {
    it('finds folder by case-insensitive name', () => {
      store.upsertFolder(makeFolder({ name: 'AI Medicine' }));
      const folder = store.getFolderByName('ai medicine');
      expect(folder).toBeDefined();
      expect(folder!.name).toBe('AI Medicine');
    });

    it('returns undefined for non-existent folder', () => {
      expect(store.getFolderByName('nonexistent')).toBeUndefined();
    });
  });

  describe('getTweetsByFolder', () => {
    it('returns tweets with author data ordered by position', () => {
      store.upsertUser(makeUser({ id: 'u1', username: 'first' }));
      store.upsertUser(makeUser({ id: 'u2', username: 'second' }));
      store.upsertFolder(makeFolder());
      store.upsertTweet(makeTweet({ id: 't1', author_id: 'u1', text: 'First' }));
      store.upsertTweet(makeTweet({ id: 't2', author_id: 'u2', text: 'Second' }));
      store.linkTweetToFolder('folder_1', 't2', 0);
      store.linkTweetToFolder('folder_1', 't1', 1);

      const results = store.getTweetsByFolder('folder_1');
      expect(results).toHaveLength(2);
      expect(results[0].tweet.id).toBe('t2');
      expect(results[0].author?.username).toBe('second');
      expect(results[1].tweet.id).toBe('t1');
      expect(results[1].author?.username).toBe('first');
    });

    it('returns tweet without author when author not in DB', () => {
      store.upsertFolder(makeFolder());
      store.upsertTweet(makeTweet({ id: 't1', author_id: undefined }));
      store.linkTweetToFolder('folder_1', 't1', 0);

      const results = store.getTweetsByFolder('folder_1');
      expect(results).toHaveLength(1);
      expect(results[0].author).toBeUndefined();
    });

    it('returns empty array for folder with no tweets', () => {
      store.upsertFolder(makeFolder());
      expect(store.getTweetsByFolder('folder_1')).toEqual([]);
    });

    it('reconstructs entities from JSON', () => {
      store.upsertUser(makeUser());
      store.upsertFolder(makeFolder());
      const tweet = makeTweet({
        entities: {
          hashtags: [{ start: 0, end: 3, tag: 'AI' }],
        },
        context_annotations: [
          { domain: { id: '1', name: 'Tech' }, entity: { id: '2', name: 'AI' } },
        ],
        note_tweet: { text: 'Long form' },
      });
      store.upsertTweet(tweet);
      store.linkTweetToFolder('folder_1', tweet.id, 0);

      const results = store.getTweetsByFolder('folder_1');
      expect(results[0].tweet.entities?.hashtags).toEqual([{ start: 0, end: 3, tag: 'AI' }]);
      expect(results[0].tweet.context_annotations).toHaveLength(1);
      expect(results[0].tweet.note_tweet?.text).toBe('Long form');
    });
  });

  describe('getAllTweets', () => {
    it('returns all tweets ordered by created_at DESC', () => {
      store.upsertUser(makeUser());
      store.upsertTweet(makeTweet({ id: 't1', created_at: '2026-01-01T00:00:00Z' }));
      store.upsertTweet(makeTweet({ id: 't2', created_at: '2026-03-01T00:00:00Z' }));
      store.upsertTweet(makeTweet({ id: 't3', created_at: '2026-02-01T00:00:00Z' }));

      const results = store.getAllTweets();
      expect(results.map((r) => r.tweet.id)).toEqual(['t2', 't3', 't1']);
    });
  });

  // ==========================================================================
  // Sync Log
  // ==========================================================================

  describe('sync log', () => {
    it('logs sync start, complete, and error', () => {
      const logId = store.logSyncStart('all');
      expect(logId).toBeGreaterThan(0);

      store.logSyncComplete(logId, 42);
      // No throw = success

      const logId2 = store.logSyncStart('folder', 'folder_1');
      store.logSyncError(logId2, 'Something went wrong');
      // No throw = success
    });
  });

  // ==========================================================================
  // Stats
  // ==========================================================================

  describe('getStats', () => {
    it('returns accurate counts', () => {
      store.upsertUser(makeUser({ id: 'u1' }));
      store.upsertUser(makeUser({ id: 'u2' }));
      store.upsertFolder(makeFolder({ id: 'f1' }));
      store.upsertTweet(makeTweet({ id: 't1', author_id: 'u1' }));
      store.upsertTweet(makeTweet({ id: 't2', author_id: 'u1' }));
      store.upsertTweet(makeTweet({ id: 't3', author_id: 'u2' }));

      const stats = store.getStats();
      expect(stats.folders).toBe(1);
      expect(stats.tweets).toBe(3);
      expect(stats.users).toBe(2);
      expect(stats.lastSync).toBeTruthy();
    });
  });

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  describe('close', () => {
    it('closes without error', () => {
      expect(() => store.close()).not.toThrow();
    });
  });
});
