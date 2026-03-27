/**
 * Bookmarks skill — sync, list, fetch, brief.
 *
 * Architecture: sync pulls from X API → upserts into SQLite cache.
 * All reads (list, fetch, brief) hit the cache, not the API.
 * You only pay when you sync.
 *
 * v1 commands:
 *   x bookmarks sync                         → pull latest from X API into cache
 *   x bookmarks sync --folder "Robotics"     → sync a single folder
 *   x bookmarks list                         → list all bookmark folders (from cache)
 *   x bookmarks fetch --folder "Robotics"    → pull cached posts from a folder
 *   x bookmarks brief --folder "Robotics"    → synthesize a research brief (from cache)
 */

import { XClient, createXClientFromEnv } from '../../clients/x-client.js';
import { BookmarkStore, createStoreFromEnv } from '../../cache/store.js';
import type { Tweet, User } from '../../clients/types.js';
import type {
  EnrichedBookmark,
  BookmarkListOutput,
  BookmarkFetchOutput,
  BriefOptions,
  BookmarkBriefOutput,
  SyncResult,
} from './types.js';
import { generateBrief } from './synthesize.js';

export class BookmarksSkill {
  private readonly store: BookmarkStore;

  constructor(
    private readonly client: XClient,
    store?: BookmarkStore,
  ) {
    this.store = store ?? createStoreFromEnv();
  }

  // ==========================================================================
  // x bookmarks sync
  // ==========================================================================

  /**
   * Sync all bookmark folders and their tweets from X API into local cache.
   * This is the only command that hits the X API and costs money.
   *
   * Strategy (minimizes API calls):
   *   1. Fetch folder list + tweet IDs per folder (lightweight, IDs only)
   *   2. Fetch ALL bookmarks with full data from main endpoint (paginated)
   *   3. Hydrate any missing tweets via GET /2/tweets lookup (100 per call)
   *   4. Cross-reference IDs to assign tweets to folders in the cache
   */
  async syncAll(): Promise<SyncResult> {
    const logId = this.store.logSyncStart('all');

    try {
      const { tweets, users, folders, folderTweetIds } =
        await this.client.getBookmarksWithFolders();

      // Build a tweet lookup map from main bookmarks endpoint
      const tweetMap = new Map(tweets.map((t) => [t.id, t]));

      // Collect all folder tweet IDs that are NOT in the main bookmarks response
      const allFolderIds = new Set<string>();
      for (const ids of folderTweetIds.values()) {
        for (const id of ids) {
          allFolderIds.add(id);
        }
      }
      const missingIds = [...allFolderIds].filter((id) => !tweetMap.has(id));

      // Hydrate missing tweets via lookup endpoint
      if (missingIds.length > 0) {
        const { tweets: hydrated, users: hydratedUsers } =
          await this.client.getTweetsByIds(missingIds);

        for (const tweet of hydrated) {
          tweetMap.set(tweet.id, tweet);
        }
        for (const [id, user] of hydratedUsers) {
          users.set(id, user);
        }
      }

      // Upsert all users
      for (const user of users.values()) {
        this.store.upsertUser(user);
      }

      // Upsert all tweets
      for (const tweet of tweetMap.values()) {
        this.store.upsertTweet(tweet);
      }

      // Upsert folders and link tweets
      const folderResults: SyncResult['folders'] = [];
      for (const folder of folders) {
        const tweetIds = folderTweetIds.get(folder.id) ?? [];
        this.store.upsertFolder({ ...folder, tweet_count: tweetIds.length });

        // Link tweets to folder (only those we have data for)
        let linkedCount = 0;
        for (let i = 0; i < tweetIds.length; i++) {
          if (tweetMap.has(tweetIds[i])) {
            this.store.linkTweetToFolder(folder.id, tweetIds[i], i);
            linkedCount++;
          }
        }

        folderResults.push({
          name: folder.name,
          id: folder.id,
          tweetCount: linkedCount,
        });
      }

      const totalTweets = tweetMap.size;
      this.store.logSyncComplete(logId, totalTweets);

      return {
        syncedAt: new Date().toISOString(),
        totalFolders: folders.length,
        totalTweets,
        folders: folderResults,
      };
    } catch (error) {
      this.store.logSyncError(logId, String(error));
      throw error;
    }
  }

  /**
   * Sync a single folder by name.
   * Fetches folder IDs, then hydrates via tweet lookup.
   */
  async syncFolder(folderName: string): Promise<SyncResult> {
    const logId = this.store.logSyncStart('folder');

    try {
      const folders = await this.client.getAllBookmarkFolders();
      const normalizedName = folderName.toLowerCase().trim();
      const folder = folders.find(
        (f) => f.name.toLowerCase().trim() === normalizedName,
      );

      if (!folder) {
        const available = folders.map((f) => f.name).join(', ');
        throw new Error(
          `Bookmark folder "${folderName}" not found. Available: ${available}`,
        );
      }

      // Get IDs for this folder
      const tweetIds = await this.client.getBookmarkFolderTweetIds(folder.id);

      // Hydrate all via tweet lookup (full data, 100 per call)
      const { tweets, users } = await this.client.getTweetsByIds(tweetIds);
      const tweetMap = new Map(tweets.map((t) => [t.id, t]));

      // Upsert users + tweets
      for (const user of users.values()) {
        this.store.upsertUser(user);
      }
      for (const tweet of tweets) {
        this.store.upsertTweet(tweet);
      }

      // Upsert all folders (keeps list current) + link target folder tweets
      for (const f of folders) {
        this.store.upsertFolder(f);
      }
      this.store.upsertFolder({ ...folder, tweet_count: tweetIds.length });

      let linkedCount = 0;
      for (let i = 0; i < tweetIds.length; i++) {
        if (tweetMap.has(tweetIds[i])) {
          this.store.linkTweetToFolder(folder.id, tweetIds[i], i);
          linkedCount++;
        }
      }

      this.store.logSyncComplete(logId, linkedCount);

      return {
        syncedAt: new Date().toISOString(),
        totalFolders: 1,
        totalTweets: linkedCount,
        folders: [{ name: folder.name, id: folder.id, tweetCount: linkedCount }],
      };
    } catch (error) {
      this.store.logSyncError(logId, String(error));
      throw error;
    }
  }

  // ==========================================================================
  // x bookmarks list (reads from cache)
  // ==========================================================================

  /**
   * List all bookmark folders from local cache.
   * Run `sync` first if cache is empty.
   */
  listFolders(): BookmarkListOutput {
    const folders = this.store.getFolders();

    return {
      folders,
      totalFolders: folders.length,
    };
  }

  // ==========================================================================
  // x bookmarks fetch (reads from cache)
  // ==========================================================================

  /**
   * Fetch cached bookmarked tweets from a folder by name.
   */
  fetchByFolderName(folderName: string): BookmarkFetchOutput {
    const folder = this.store.getFolderByName(folderName);

    if (!folder) {
      const available = this.store.getFolders().map((f) => f.name).join(', ');
      throw new Error(
        `Folder "${folderName}" not found in cache. Available: ${available || 'none (run sync first)'}`,
      );
    }

    return this.fetchByFolderId(folder.id, folder.name);
  }

  /**
   * Fetch cached bookmarked tweets from a folder by ID.
   */
  fetchByFolderId(folderId: string, folderName?: string): BookmarkFetchOutput {
    const rows = this.store.getTweetsByFolder(folderId);
    const bookmarks = rows.map((r) => this.toEnrichedBookmark(r.tweet, r.author));

    const uniqueAuthors = new Set(
      bookmarks.map((b) => b.author?.username).filter(Boolean),
    );

    return {
      folder: folderName ?? folderId,
      bookmarks,
      totalTweets: bookmarks.length,
      uniqueAuthors: uniqueAuthors.size,
    };
  }

  /**
   * Fetch ALL cached bookmarks across all folders.
   */
  fetchAll(): BookmarkFetchOutput {
    const rows = this.store.getAllTweets();
    const bookmarks = rows.map((r) => this.toEnrichedBookmark(r.tweet, r.author));

    const uniqueAuthors = new Set(
      bookmarks.map((b) => b.author?.username).filter(Boolean),
    );

    return {
      folder: 'All Bookmarks',
      bookmarks,
      totalTweets: bookmarks.length,
      uniqueAuthors: uniqueAuthors.size,
    };
  }

  // ==========================================================================
  // x bookmarks brief (reads from cache)
  // ==========================================================================

  /**
   * Generate a research brief from cached bookmarks.
   */
  async brief(options: BriefOptions = {}): Promise<BookmarkBriefOutput> {
    let fetchResult: BookmarkFetchOutput;

    if (options.folderId) {
      fetchResult = this.fetchByFolderId(options.folderId, options.folderName);
    } else if (options.folderName) {
      fetchResult = this.fetchByFolderName(options.folderName);
    } else {
      fetchResult = this.fetchAll();
    }

    if (fetchResult.totalTweets === 0) {
      throw new Error(
        `No bookmarks found in cache for "${options.folderName ?? 'all'}". Run sync first.`,
      );
    }

    const maxTweets = options.maxTweets ?? 50;
    const sourceTweets = fetchResult.bookmarks.slice(0, maxTweets);

    const brief = await generateBrief(sourceTweets, {
      topic: fetchResult.folder,
      customPrompt: options.customPrompt,
      hlnContext: options.hlnContext,
    });

    return {
      brief,
      sourceBookmarks: sourceTweets,
    };
  }

  // ==========================================================================
  // x bookmarks stats
  // ==========================================================================

  /**
   * Get cache statistics.
   */
  stats(): { folders: number; tweets: number; users: number; lastSync: string | null } {
    return this.store.getStats();
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private toEnrichedBookmark(tweet: Tweet, author: User | undefined): EnrichedBookmark {
    const metrics = tweet.public_metrics;
    const handle = author ? `@${author.username}` : 'unknown';
    const stats = metrics
      ? ` (${metrics.like_count} likes, ${metrics.retweet_count} RTs)`
      : '';
    const text = tweet.note_tweet?.text ?? tweet.text;
    const formatted = `${handle}: ${text}${stats}`;

    return { tweet, author, formatted };
  }

  /**
   * Close the underlying database connection.
   */
  close(): void {
    this.store.close();
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a BookmarksSkill from environment variables.
 * Reads X_BEARER_TOKEN, X_USER_ID, and optionally X_CACHE_DB_PATH from .env.
 */
export function createBookmarksSkillFromEnv(): BookmarksSkill {
  const client = createXClientFromEnv();
  const store = createStoreFromEnv();
  return new BookmarksSkill(client, store);
}
