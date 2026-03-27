# X Bookmark Intelligence (Library-Based Skill)

This project uses `@hidden-leaf/x-skill` — a TypeScript library for X (Twitter) bookmark intelligence.
This is NOT an MCP tool or registered skill. To use it, write a TypeScript script and execute it with `npx tsx <script>.ts`.

## Setup
- Credentials are in `.env` (see `node_modules/@hidden-leaf/x-skill/.env.example`)
- Required: `X_BEARER_TOKEN`, `X_USER_ID`

## Usage
When the user asks about X bookmarks, bookmark folders, research briefs from saved posts, or wants to analyze their X content — use this skill.
Read node_modules/@hidden-leaf/x-skill/SKILL.md for the full API before using.

## How to Use
Write a .ts script, then run it with `npx tsx <script>.ts`:
```typescript
import { createBookmarksSkillFromEnv } from '@hidden-leaf/x-skill';

const skill = createBookmarksSkillFromEnv();

// List folders
const { folders } = await skill.listFolders();

// Fetch posts from a folder
const result = await skill.fetchByFolderName('Robotics');

// Generate a research brief
const { brief } = await skill.brief({
  folderName: 'AI MEDICINE',
  hlnContext: ['Applied AI Studio'],
});
console.log(brief.content);
```
Then execute: `npx tsx <script>.ts`
