# @hidden-leaf/x-skill

**Turn your X bookmarks into structured research intelligence.**

[![CI](https://github.com/Hidden-Leaf-Networks/x-skill/actions/workflows/ci.yml/badge.svg)](https://github.com/Hidden-Leaf-Networks/x-skill/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@hidden-leaf/x-skill.svg)](https://www.npmjs.com/package/@hidden-leaf/x-skill)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)

---

A TypeScript skill for [Claude Code](https://claude.ai/claude-code) that syncs your X (Twitter) bookmark folders into a local SQLite cache and synthesizes them into actionable research briefs. Sync once, read forever.

```
X Bookmarks  -->  Sync (API)  -->  SQLite Cache  -->  Research Briefs
   folders         pennies          local/free         themes, voices,
   posts           per sync         offline            signal, actions
```

## Why

Your X bookmarks are a curated research goldmine — AI papers, robotics threads, crypto analysis, medicine breakthroughs — organized into folders. But they're trapped in the app with no way to search, analyze, or act on them programmatically.

x-skill fixes that. Pull your folders, cache locally, synthesize into structured intelligence. The cache-first architecture means you pay for the sync (~$5-15/month), but every read, brief, and analysis after that is **completely free**.

## Install

```bash
npm install @hidden-leaf/x-skill
```

## Setup

### 1. Get X API Access

Sign up at [developer.x.com](https://developer.x.com) for pay-per-use API access.

Create an app with these OAuth 2.0 scopes:
- `bookmark.read`
- `tweet.read`
- `users.read`
- `offline.access`

### 2. Run the OAuth Flow

```bash
npx tsx node_modules/@hidden-leaf/x-skill/scripts/oauth-flow.ts
```

This opens your browser, authenticates via PKCE, and prints your credentials.

### 3. Configure Environment

Add the output to your `.env`:

```env
X_CONSUMER_KEY=your-consumer-key
X_CONSUMER_SECRET=your-consumer-secret
X_USER_ACCESS_TOKEN=your-access-token
X_REFRESH_TOKEN=your-refresh-token
X_USER_ID=your-numeric-user-id
```

Tokens auto-refresh on expiry — set it up once, runs forever.

## Quick Start

```typescript
import { createBookmarksSkillFromEnv } from '@hidden-leaf/x-skill';

const skill = createBookmarksSkillFromEnv();

// Sync bookmarks from X API into local cache (costs money)
const sync = await skill.syncAll();
console.log(`Synced ${sync.totalTweets} posts across ${sync.totalFolders} folders`);

// List your bookmark folders (free — reads from cache)
const { folders } = skill.listFolders();
folders.forEach(f => console.log(`${f.name} (${f.tweet_count} posts)`));

// Fetch posts from a folder (free)
const result = skill.fetchByFolderName('Robotics');
console.log(`${result.totalTweets} posts from ${result.uniqueAuthors} authors`);

// Generate a research brief (free)
const { brief } = await skill.brief({
  folderName: 'AI Medicine',
  hlnContext: ['Applied AI Studio'],
});
console.log(brief.content);
```

Run with: `npx tsx script.ts`

## API Reference

### Sync Commands (hit X API — cost money)

| Method | Description |
|--------|-------------|
| `syncAll()` | Pull all bookmark folders and tweets into cache |
| `syncFolder(name)` | Sync a single folder by name (case-insensitive) |

### Read Commands (from cache — free)

| Method | Description |
|--------|-------------|
| `listFolders()` | List all cached bookmark folders |
| `fetchByFolderName(name)` | Get enriched bookmarks from a folder |
| `fetchByFolderId(id)` | Get enriched bookmarks by folder ID |
| `fetchAll()` | Get all cached bookmarks |
| `stats()` | Cache statistics (folder/tweet/user counts, last sync) |
| `close()` | Close database connection |

### Synthesis (from cache — free)

| Method | Description |
|--------|-------------|
| `brief(options?)` | Generate a research brief with themes, notable voices, signal scoring |
| `buildBriefPrompt(bookmarks, options)` | Build the raw synthesis prompt for custom use |

### Brief Options

```typescript
interface BriefOptions {
  folderName?: string;    // Scope to a specific folder
  folderId?: string;      // Or use folder ID directly
  maxTweets?: number;     // Max tweets to analyze (default: 50)
  customPrompt?: string;  // Append custom instructions
  hlnContext?: string[];  // Relate to specific ventures/initiatives
}
```

### Research Brief Output

Each brief includes:
- **Key Themes** — 3-7 major trends with evidence citations
- **Notable Voices** — Most influential accounts, ranked by engagement
- **Signal vs. Noise** — Quality score (1-10), high-signal vs low-signal posts
- **Actionable Intelligence** — What to act on, emerging opportunities and risks
- **HLN Relevance** — How findings connect to your ventures and initiatives

## Architecture

```
@hidden-leaf/x-skill
├── src/
│   ├── clients/
│   │   ├── x-client.ts      # X API v2 HTTP client, OAuth 2.0, auto-refresh
│   │   └── types.ts          # Full X API v2 type definitions, error classes
│   ├── cache/
│   │   └── store.ts          # SQLite cache — WAL mode, upserts, 5-table schema
│   ├── skills/
│   │   └── bookmarks/
│   │       ├── index.ts      # BookmarksSkill — sync, list, fetch, brief
│   │       ├── synthesize.ts # Prompt builder, theme/voice extraction
│   │       └── types.ts      # EnrichedBookmark, ResearchBrief, outputs
│   └── utils/
│       └── logger.ts         # Structured logger with levels
├── scripts/
│   └── oauth-flow.ts         # OAuth 2.0 PKCE setup flow
├── SKILL.md                  # Full API reference for Claude Code
└── CLAUDE.snippet.md         # Auto-injected into consuming projects
```

### Design Principles

- **Sync-then-read** — API calls only during sync. All reads hit local SQLite. You only pay when you pull new data
- **Cache-first** — SQLite with WAL mode for fast reads and crash-safe writes. Cross-session data access for downstream consumers
- **No Claude API dependency** — Brief synthesis builds prompts for Claude Code to execute inline. No separate API key required
- **Factory pattern** — `create*FromEnv()` functions for all major classes. Configuration via environment variables
- **Minimal API calls** — Smart hydration: fetch folder IDs (cheap), then hydrate only missing tweets via batch lookup (100 per call)

## Cost

X API uses pay-per-use pricing (launched Feb 2026). Same post requested within a 24h UTC window counts as a single charge.

| Usage Pattern | Est. Monthly Cost |
|---------------|-------------------|
| Weekly sync, 5 folders | ~$5 |
| Daily sync, 10 folders | ~$15 |
| Multiple daily syncs, 20+ folders | ~$25-50 |

**After sync, everything is free.** Briefs, fetches, searches, exports — zero API calls.

## Development

```bash
git clone https://github.com/Hidden-Leaf-Networks/x-skill.git
cd x-skill
npm install

npm run build       # Compile TypeScript
npm run lint        # ESLint
npm test            # Jest test suite
npm run watch       # TypeScript watch mode
```

## Downstream Integration

x-skill is designed as an intelligence primitive that feeds into larger systems:

- **Jira/Confluence** — Create research tickets from briefs via `@hidden-leaf/atlassian-skill`
- **Training data** — Feed curated posts into fine-tuning pipelines
- **Planning context** — Ambient research input for AI assistants
- **Client research** — Structured deliverables from bookmark analysis

## Roadmap

| Version | Focus |
|---------|-------|
| **1.0.0** | Bookmark intelligence — sync, cache, list, fetch, brief |
| **1.1** | OAuth flow polish, error recovery improvements |
| **2.0** | Search skill, thread parsing, profile management |
| **3.0** | Publish, schedule, reply (write operations) |

## License

MIT — [Hidden Leaf Networks](https://github.com/Hidden-Leaf-Networks)
