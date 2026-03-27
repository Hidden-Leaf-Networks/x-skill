/**
 * SQLite-backed local cache for X bookmark data.
 *
 * Pattern: sync pulls from X API → upserts into local DB.
 * All reads (list, fetch, brief) hit the cache, not the API.
 * You only pay when you sync.
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import type { Tweet, User, BookmarkFolder } from '../clients/types.js';

const DEFAULT_DB_DIR = path.join(os.homedir(), '.x-skill');
const DEFAULT_DB_PATH = path.join(DEFAULT_DB_DIR, 'bookmarks.db');

export class BookmarkStore {
  private readonly db: Database.Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath ?? process.env.X_CACHE_DB_PATH ?? DEFAULT_DB_PATH;

    // Ensure directory exists
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }

  // ==========================================================================
  // Schema
  // ==========================================================================

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        tweet_count INTEGER,
        synced_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        username TEXT NOT NULL,
        description TEXT,
        profile_image_url TEXT,
        verified INTEGER DEFAULT 0,
        followers_count INTEGER,
        following_count INTEGER,
        tweet_count INTEGER,
        listed_count INTEGER,
        created_at TEXT,
        synced_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tweets (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        author_id TEXT,
        created_at TEXT,
        conversation_id TEXT,
        lang TEXT,
        like_count INTEGER DEFAULT 0,
        retweet_count INTEGER DEFAULT 0,
        reply_count INTEGER DEFAULT 0,
        quote_count INTEGER DEFAULT 0,
        bookmark_count INTEGER DEFAULT 0,
        impression_count INTEGER DEFAULT 0,
        entities_json TEXT,
        context_annotations_json TEXT,
        referenced_tweets_json TEXT,
        note_tweet_text TEXT,
        synced_at TEXT NOT NULL,
        FOREIGN KEY (author_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS folder_tweets (
        folder_id TEXT NOT NULL,
        tweet_id TEXT NOT NULL,
        position INTEGER,
        synced_at TEXT NOT NULL,
        PRIMARY KEY (folder_id, tweet_id),
        FOREIGN KEY (folder_id) REFERENCES folders(id),
        FOREIGN KEY (tweet_id) REFERENCES tweets(id)
      );

      CREATE TABLE IF NOT EXISTS sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scope TEXT NOT NULL,
        folder_id TEXT,
        tweet_count INTEGER,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        status TEXT DEFAULT 'running'
      );

      CREATE INDEX IF NOT EXISTS idx_tweets_author ON tweets(author_id);
      CREATE INDEX IF NOT EXISTS idx_tweets_created ON tweets(created_at);
      CREATE INDEX IF NOT EXISTS idx_folder_tweets_folder ON folder_tweets(folder_id);
    `);
  }

  // ==========================================================================
  // Upsert Operations (called during sync)
  // ==========================================================================

  upsertFolder(folder: BookmarkFolder): void {
    const stmt = this.db.prepare(`
      INSERT INTO folders (id, name, description, icon, tweet_count, synced_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        icon = excluded.icon,
        tweet_count = excluded.tweet_count,
        synced_at = excluded.synced_at
    `);

    stmt.run(
      folder.id,
      folder.name,
      folder.description ?? null,
      folder.icon ?? null,
      folder.tweet_count ?? null,
      new Date().toISOString(),
    );
  }

  upsertUser(user: User): void {
    const stmt = this.db.prepare(`
      INSERT INTO users (id, name, username, description, profile_image_url, verified,
        followers_count, following_count, tweet_count, listed_count, created_at, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        username = excluded.username,
        description = excluded.description,
        profile_image_url = excluded.profile_image_url,
        verified = excluded.verified,
        followers_count = excluded.followers_count,
        following_count = excluded.following_count,
        tweet_count = excluded.tweet_count,
        listed_count = excluded.listed_count,
        synced_at = excluded.synced_at
    `);

    stmt.run(
      user.id,
      user.name,
      user.username,
      user.description ?? null,
      user.profile_image_url ?? null,
      user.verified ? 1 : 0,
      user.public_metrics?.followers_count ?? null,
      user.public_metrics?.following_count ?? null,
      user.public_metrics?.tweet_count ?? null,
      user.public_metrics?.listed_count ?? null,
      user.created_at ?? null,
      new Date().toISOString(),
    );
  }

  upsertTweet(tweet: Tweet): void {
    const stmt = this.db.prepare(`
      INSERT INTO tweets (id, text, author_id, created_at, conversation_id, lang,
        like_count, retweet_count, reply_count, quote_count, bookmark_count, impression_count,
        entities_json, context_annotations_json, referenced_tweets_json, note_tweet_text, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        text = excluded.text,
        like_count = excluded.like_count,
        retweet_count = excluded.retweet_count,
        reply_count = excluded.reply_count,
        quote_count = excluded.quote_count,
        bookmark_count = excluded.bookmark_count,
        impression_count = excluded.impression_count,
        entities_json = excluded.entities_json,
        context_annotations_json = excluded.context_annotations_json,
        note_tweet_text = excluded.note_tweet_text,
        synced_at = excluded.synced_at
    `);

    stmt.run(
      tweet.id,
      tweet.text,
      tweet.author_id ?? null,
      tweet.created_at ?? null,
      tweet.conversation_id ?? null,
      tweet.lang ?? null,
      tweet.public_metrics?.like_count ?? 0,
      tweet.public_metrics?.retweet_count ?? 0,
      tweet.public_metrics?.reply_count ?? 0,
      tweet.public_metrics?.quote_count ?? 0,
      tweet.public_metrics?.bookmark_count ?? 0,
      tweet.public_metrics?.impression_count ?? 0,
      tweet.entities ? JSON.stringify(tweet.entities) : null,
      tweet.context_annotations ? JSON.stringify(tweet.context_annotations) : null,
      tweet.referenced_tweets ? JSON.stringify(tweet.referenced_tweets) : null,
      tweet.note_tweet?.text ?? null,
      new Date().toISOString(),
    );
  }

  linkTweetToFolder(folderId: string, tweetId: string, position: number): void {
    const stmt = this.db.prepare(`
      INSERT INTO folder_tweets (folder_id, tweet_id, position, synced_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(folder_id, tweet_id) DO UPDATE SET
        position = excluded.position,
        synced_at = excluded.synced_at
    `);

    stmt.run(folderId, tweetId, position, new Date().toISOString());
  }

  // ==========================================================================
  // Batch Sync Helper
  // ==========================================================================

  /**
   * Upsert a full folder sync result in a single transaction.
   */
  syncFolderData(
    folder: BookmarkFolder,
    tweets: Tweet[],
    users: Map<string, User>,
  ): void {
    const transaction = this.db.transaction(() => {
      this.upsertFolder(folder);

      for (const user of users.values()) {
        this.upsertUser(user);
      }

      for (let i = 0; i < tweets.length; i++) {
        this.upsertTweet(tweets[i]);
        this.linkTweetToFolder(folder.id, tweets[i].id, i);
      }
    });

    transaction();
  }

  // ==========================================================================
  // Read Operations (called by skill)
  // ==========================================================================

  getFolders(): BookmarkFolder[] {
    const rows = this.db.prepare('SELECT * FROM folders ORDER BY name').all() as Array<{
      id: string; name: string; description: string | null; icon: string | null; tweet_count: number | null;
    }>;

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? undefined,
      icon: r.icon ?? undefined,
      tweet_count: r.tweet_count ?? undefined,
    }));
  }

  getFolderByName(name: string): BookmarkFolder | undefined {
    const row = this.db.prepare(
      'SELECT * FROM folders WHERE LOWER(name) = LOWER(?)',
    ).get(name) as { id: string; name: string; description: string | null; icon: string | null; tweet_count: number | null } | undefined;

    if (!row) return undefined;

    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      icon: row.icon ?? undefined,
      tweet_count: row.tweet_count ?? undefined,
    };
  }

  getTweetsByFolder(folderId: string): { tweet: Tweet; author: User | undefined }[] {
    const rows = this.db.prepare(`
      SELECT t.*, ft.position,
        u.name as u_name, u.username as u_username, u.description as u_description,
        u.profile_image_url as u_profile_image_url, u.verified as u_verified,
        u.followers_count as u_followers, u.following_count as u_following,
        u.tweet_count as u_tweets, u.listed_count as u_listed, u.created_at as u_created
      FROM tweets t
      JOIN folder_tweets ft ON ft.tweet_id = t.id
      LEFT JOIN users u ON u.id = t.author_id
      WHERE ft.folder_id = ?
      ORDER BY ft.position ASC
    `).all(folderId) as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      tweet: this.rowToTweet(r),
      author: r.u_username ? this.rowToUser(r) : undefined,
    }));
  }

  getAllTweets(): { tweet: Tweet; author: User | undefined }[] {
    const rows = this.db.prepare(`
      SELECT t.*,
        u.name as u_name, u.username as u_username, u.description as u_description,
        u.profile_image_url as u_profile_image_url, u.verified as u_verified,
        u.followers_count as u_followers, u.following_count as u_following,
        u.tweet_count as u_tweets, u.listed_count as u_listed, u.created_at as u_created
      FROM tweets t
      LEFT JOIN users u ON u.id = t.author_id
      ORDER BY t.created_at DESC
    `).all() as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      tweet: this.rowToTweet(r),
      author: r.u_username ? this.rowToUser(r) : undefined,
    }));
  }

  getStats(): { folders: number; tweets: number; users: number; lastSync: string | null } {
    const folders = (this.db.prepare('SELECT COUNT(*) as c FROM folders').get() as { c: number }).c;
    const tweets = (this.db.prepare('SELECT COUNT(*) as c FROM tweets').get() as { c: number }).c;
    const users = (this.db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
    const lastSync = (this.db.prepare(
      "SELECT MAX(synced_at) as s FROM folders",
    ).get() as { s: string | null }).s;

    return { folders, tweets, users, lastSync };
  }

  // ==========================================================================
  // Sync Log
  // ==========================================================================

  logSyncStart(scope: string, folderId?: string): number {
    const result = this.db.prepare(`
      INSERT INTO sync_log (scope, folder_id, started_at, status)
      VALUES (?, ?, ?, 'running')
    `).run(scope, folderId ?? null, new Date().toISOString());

    return Number(result.lastInsertRowid);
  }

  logSyncComplete(logId: number, tweetCount: number): void {
    this.db.prepare(`
      UPDATE sync_log SET completed_at = ?, tweet_count = ?, status = 'completed'
      WHERE id = ?
    `).run(new Date().toISOString(), tweetCount, logId);
  }

  logSyncError(logId: number, _error: string): void {
    this.db.prepare(`
      UPDATE sync_log SET completed_at = ?, status = 'error'
      WHERE id = ?
    `).run(new Date().toISOString(), logId);
  }

  // ==========================================================================
  // Row Mapping
  // ==========================================================================

  private rowToTweet(r: Record<string, unknown>): Tweet {
    const tweet: Tweet = {
      id: r.id as string,
      text: r.text as string,
      author_id: r.author_id as string | undefined,
      created_at: r.created_at as string | undefined,
      conversation_id: r.conversation_id as string | undefined,
      lang: r.lang as string | undefined,
      public_metrics: {
        like_count: r.like_count as number,
        retweet_count: r.retweet_count as number,
        reply_count: r.reply_count as number,
        quote_count: r.quote_count as number,
        bookmark_count: r.bookmark_count as number,
        impression_count: r.impression_count as number,
      },
    };

    if (r.entities_json) {
      tweet.entities = JSON.parse(r.entities_json as string);
    }
    if (r.context_annotations_json) {
      tweet.context_annotations = JSON.parse(r.context_annotations_json as string);
    }
    if (r.referenced_tweets_json) {
      tweet.referenced_tweets = JSON.parse(r.referenced_tweets_json as string);
    }
    if (r.note_tweet_text) {
      tweet.note_tweet = { text: r.note_tweet_text as string };
    }

    return tweet;
  }

  private rowToUser(r: Record<string, unknown>): User {
    return {
      id: r.author_id as string,
      name: r.u_name as string,
      username: r.u_username as string,
      description: r.u_description as string | undefined,
      profile_image_url: r.u_profile_image_url as string | undefined,
      verified: r.u_verified === 1,
      public_metrics: {
        followers_count: r.u_followers as number,
        following_count: r.u_following as number,
        tweet_count: r.u_tweets as number,
        listed_count: r.u_listed as number,
      },
      created_at: r.u_created as string | undefined,
    };
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  close(): void {
    this.db.close();
  }
}

/**
 * Create a BookmarkStore with default or env-configured path.
 */
export function createStoreFromEnv(): BookmarkStore {
  return new BookmarkStore(process.env.X_CACHE_DB_PATH);
}
