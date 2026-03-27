# @hidden-leaf/x-skill — Claude Code Skill Reference

> **When to use this skill:** When the user mentions X bookmarks, Twitter bookmarks, bookmark folders, research briefs from X, or wants to analyze saved posts from X/Twitter.

## Architecture: Sync + Cache

This skill uses a **sync-then-read** pattern:
- **`sync`** pulls data from the X API into a local SQLite cache (`~/.x-skill/bookmarks.db`). This is the only operation that costs money.
- **`list`**, **`fetch`**, **`brief`**, **`stats`** all read from the local cache — free, instant, offline-capable.

Always run `sync` first before reading. After that, reads are unlimited.

## Setup

### Required Environment Variables

```
X_BEARER_TOKEN=<OAuth 2.0 User Context Bearer token>
X_USER_ID=<your numeric X user ID>
```

### Optional

```
X_CACHE_DB_PATH=<custom path to SQLite DB, default: ~/.x-skill/bookmarks.db>
```

### How to Get Credentials

1. **X Developer Account:** Sign up at [developer.x.com](https://developer.x.com) (pay-per-use pricing, ~$5-15/month for bookmark reads)
2. **Bearer Token:** Create an app in the Developer Portal → generate OAuth 2.0 User Context token with `bookmark.read`, `tweet.read`, `users.read` scopes
3. **User ID:** Use [tweeterid.com](https://tweeterid.com) or call `GET /2/users/me` with your token

## API Reference

### BookmarksSkill

The primary v1 skill. All methods use the `BookmarksSkill` class.

#### Create Instance

```typescript
import { createBookmarksSkillFromEnv } from '@hidden-leaf/x-skill';
const bookmarks = createBookmarksSkillFromEnv();
```

#### Sync All (hits X API — costs money)

Pull all bookmark folders and their tweets into the local cache.

```typescript
const result = await bookmarks.syncAll();
// result.totalFolders: number
// result.totalTweets: number
// result.folders: [{ name, id, tweetCount }]
// result.syncedAt: ISO string
```

#### Sync Single Folder (hits X API — costs money)

```typescript
const result = await bookmarks.syncFolder('Robotics');
```

#### List Folders (from cache — free)

```typescript
const { folders, totalFolders } = bookmarks.listFolders();
// folders: [{ id, name, description?, tweet_count? }]
```

#### Fetch by Folder Name (from cache — free)

```typescript
const result = bookmarks.fetchByFolderName('Robotics');
// result.bookmarks: [{ tweet, author, formatted }]
// result.totalTweets: number
// result.uniqueAuthors: number
```

#### Fetch by Folder ID (from cache — free)

```typescript
const result = bookmarks.fetchByFolderId('folder-id-here');
```

#### Fetch All Bookmarks (from cache — free)

```typescript
const result = bookmarks.fetchAll();
```

#### Generate Research Brief (from cache — free)

Synthesize a research brief from cached bookmarks. Builds a structured prompt that Claude analyzes.

```typescript
const { brief, sourceBookmarks } = await bookmarks.brief({
  folderName: 'Robotics',
  maxTweets: 50,
  hlnContext: ['HLOS', 'Asimov', 'Applied AI Studio'],
  customPrompt: 'Focus on humanoid robotics breakthroughs',
});

// brief.topic: 'Robotics'
// brief.content: <synthesis prompt for Claude>
// brief.notableVoices: ['@user1', '@user2', ...]
// brief.themes: ['humanoid robotics', '#AI', ...]
// brief.hlnRelevance: ['HLOS', 'Asimov', 'Applied AI Studio']
```

#### Cache Stats (free)

```typescript
const stats = bookmarks.stats();
// { folders: 8, tweets: 342, users: 89, lastSync: '2026-03-27T...' }
```

#### Cleanup

```typescript
bookmarks.close(); // Close SQLite connection
```

### XClient (Low-Level)

Direct X API v2 access — bypasses cache, hits API directly.

```typescript
import { createXClientFromEnv } from '@hidden-leaf/x-skill';
const x = createXClientFromEnv();

// Get bookmarks (paginated)
const page = await x.getBookmarks({ max_results: 100 });

// Get all bookmarks (auto-paginate)
const { tweets, users } = await x.getAllBookmarks();

// List bookmark folders
const folders = await x.getAllBookmarkFolders();

// Get tweets from a folder
const folderTweets = await x.getAllBookmarkFolderTweets('folder-id');

// Get authenticated user profile
const me = await x.getMe();
```

### BookmarkStore (Low-Level Cache)

Direct SQLite access for advanced queries.

```typescript
import { createStoreFromEnv } from '@hidden-leaf/x-skill';
const store = createStoreFromEnv();

const folders = store.getFolders();
const tweets = store.getTweetsByFolder('folder-id');
const stats = store.getStats();
store.close();
```

### Build Brief Prompt (Standalone)

Build the synthesis prompt without calling the API — useful for custom pipelines.

```typescript
import { buildBriefPrompt } from '@hidden-leaf/x-skill';

const prompt = buildBriefPrompt(enrichedBookmarks, {
  topic: 'AI Medicine',
  hlnContext: ['Applied AI Studio'],
});
// Send this prompt to Claude API yourself
```

## Usage Patterns

### "Sync my bookmarks then list folders"
```typescript
import { createBookmarksSkillFromEnv } from '@hidden-leaf/x-skill';
const skill = createBookmarksSkillFromEnv();

// First sync (hits API, costs money)
await skill.syncAll();

// Then list from cache (free)
const { folders } = skill.listFolders();
for (const f of folders) {
  console.log(`${f.name} (${f.tweet_count ?? '?'} posts)`);
}

skill.close();
```

### "Give me a research brief on my AI Medicine bookmarks"
```typescript
import { createBookmarksSkillFromEnv } from '@hidden-leaf/x-skill';
const skill = createBookmarksSkillFromEnv();
const { brief } = await skill.brief({
  folderName: 'AI MEDICINE',
  hlnContext: ['Applied AI Studio', 'Orvex'],
});
console.log(brief.content);
skill.close();
```

### "What's trending in my Quantum Computing saves?"
```typescript
import { createBookmarksSkillFromEnv } from '@hidden-leaf/x-skill';
const skill = createBookmarksSkillFromEnv();
const result = skill.fetchByFolderName('Quantum Computing');
console.log(`${result.totalTweets} posts from ${result.uniqueAuthors} authors`);
for (const b of result.bookmarks.slice(0, 10)) {
  console.log(b.formatted);
}
skill.close();
```

### "Create a Jira ticket from bookmark research" (with atlassian-skill)
```typescript
import { createBookmarksSkillFromEnv } from '@hidden-leaf/x-skill';
import { createJiraClientFromEnv, adf, text } from '@hidden-leaf/atlassian-skill';

const skill = createBookmarksSkillFromEnv();
const jira = createJiraClientFromEnv();

const { brief } = await skill.brief({ folderName: 'CHIPS' });

await jira.createIssue({
  project: 'HLN',
  issuetype: 'Task',
  summary: `Research Brief: ${brief.topic} (${brief.tweetCount} posts)`,
  description: adf().paragraph(text().text(brief.content)).build(),
  labels: ['research', 'x-skill', 'auto-generated'],
});

skill.close();
```

## Error Handling

| Error | Cause | Recovery |
|-------|-------|----------|
| `XAuthenticationError` | Invalid/expired Bearer token | Regenerate token at developer.x.com |
| `XRateLimitError` | Rate limit hit | Wait `retryAfter` seconds, then retry |
| `XNotFoundError` | Endpoint or resource not found | Check user ID and folder IDs |
| `XApiRequestError` (403) | Missing OAuth scope or access level | Ensure `bookmark.read` scope |
| `"not found in cache"` | Cache empty for folder | Run `syncAll()` or `syncFolder()` first |

## Cost Notes

- X API uses pay-per-use pricing (Feb 2026+)
- **Sync is the only paid operation** — all reads hit the local SQLite cache for free
- Same post requested within 24h UTC window = single charge (deduplication)
- Estimated cost: ~$5-15/month for periodic syncs
- Recommend syncing once daily or on-demand, not continuously

## Downstream Consumers

Brief output is structured for ingestion by:
- **Jira tickets** via `@hidden-leaf/atlassian-skill`
- **ARIA v4** planning context and ambient research
- **Scroll** training data corpus
- **Applied AI Studio** client research deliverables
