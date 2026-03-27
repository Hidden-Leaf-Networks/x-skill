# @hidden-leaf/x-skill

X (Twitter) bookmark intelligence skill for [Claude Code](https://claude.ai/claude-code). Turn your curated X bookmarks into structured research briefs.

## What It Does

Your X bookmarks are already categorized — AI Medicine, Robotics, Quantum Computing, LLMs, and more. This skill pulls those saved posts and synthesizes them into actionable research intelligence via Claude.

**v1 Commands:**
- `x bookmarks list` — List all bookmark folders
- `x bookmarks fetch --folder "Robotics"` — Pull raw posts from a folder
- `x bookmarks brief --folder "Robotics"` — Synthesize a research brief

## Install

```bash
npm install @hidden-leaf/x-skill
```

## Setup

1. Sign up for X Developer access at [developer.x.com](https://developer.x.com) (pay-per-use, ~$5-15/month)
2. Create an app and generate an OAuth 2.0 User Context token with scopes: `bookmark.read`, `tweet.read`, `users.read`
3. Add credentials to `.env`:

```env
X_BEARER_TOKEN=your-bearer-token
X_USER_ID=your-numeric-user-id
```

## Quick Start

```typescript
import { createBookmarksSkillFromEnv } from '@hidden-leaf/x-skill';

const skill = createBookmarksSkillFromEnv();

// List your bookmark folders
const { folders } = await skill.listFolders();

// Fetch posts from a folder
const result = await skill.fetchByFolderName('Robotics');
console.log(`${result.totalTweets} posts from ${result.uniqueAuthors} authors`);

// Generate a research brief
const { brief } = await skill.brief({
  folderName: 'AI MEDICINE',
  hlnContext: ['Applied AI Studio'],
});
console.log(brief.content);
```

Run with: `npx tsx script.ts`

## Cost

X API uses pay-per-use pricing (launched Feb 2026). Same post requested within a 24h UTC window counts as a single charge.

| Usage | Est. Monthly Cost |
|-------|------------------|
| 1,000 post reads | ~$5 |
| 5,000 post reads | ~$25 |
| 15,000 post reads | ~$75 |

For periodic bookmark synthesis: **~$5-15/month**.

## License

MIT — [Hidden Leaf Networks](https://github.com/Hidden-Leaf-Networks)
