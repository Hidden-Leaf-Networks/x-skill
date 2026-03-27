/**
 * Bookmark intelligence types
 */

import type { Tweet, User, BookmarkFolder } from '../../clients/types.js';

// ============================================================================
// Enriched Bookmark Data
// ============================================================================

/** A tweet with its author resolved from includes */
export interface EnrichedBookmark {
  tweet: Tweet;
  author: User | undefined;
  /** Formatted display: "@username: text (likes, retweets)" */
  formatted: string;
}

/** A folder with its tweets fetched and enriched */
export interface BookmarkFolderContents {
  folder: BookmarkFolder;
  bookmarks: EnrichedBookmark[];
  fetchedAt: string;
}

// ============================================================================
// Brief Generation
// ============================================================================

export interface BriefOptions {
  /** Folder name to scope the brief (if not provided, uses all bookmarks) */
  folderName?: string;
  /** Folder ID (resolved from folderName if not provided) */
  folderId?: string;
  /** Maximum tweets to include in the brief context (default: 50) */
  maxTweets?: number;
  /** Custom prompt to append to the brief generation */
  customPrompt?: string;
  /** HLN venture context — which venture(s) this research relates to */
  hlnContext?: string[];
}

export interface ResearchBrief {
  /** Folder or category this brief covers */
  topic: string;
  /** ISO timestamp of generation */
  generatedAt: string;
  /** Number of tweets analyzed */
  tweetCount: number;
  /** The synthesized markdown brief */
  content: string;
  /** Notable accounts referenced */
  notableVoices: string[];
  /** Key themes extracted */
  themes: string[];
  /** HLN relevance notes (which ventures/initiatives) */
  hlnRelevance: string[];
}

// ============================================================================
// Command Outputs
// ============================================================================

export interface BookmarkListOutput {
  folders: BookmarkFolder[];
  totalFolders: number;
}

export interface BookmarkFetchOutput {
  folder: string;
  bookmarks: EnrichedBookmark[];
  totalTweets: number;
  uniqueAuthors: number;
}

export interface BookmarkBriefOutput {
  brief: ResearchBrief;
  /** Raw enriched bookmarks used as input */
  sourceBookmarks: EnrichedBookmark[];
}

// ============================================================================
// Sync
// ============================================================================

export interface SyncResult {
  syncedAt: string;
  totalFolders: number;
  totalTweets: number;
  folders: Array<{
    name: string;
    id: string;
    tweetCount: number;
  }>;
}
