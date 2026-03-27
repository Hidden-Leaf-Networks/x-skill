# @hidden-leaf/x-skill

## Project Overview
X (Twitter) bookmark intelligence skill for Claude Code. Turns curated X bookmarks into structured research briefs for the HLN stack.

## Architecture
- `src/clients/` — X API v2 HTTP client, OAuth 2.0 Bearer auth, error handling, types
- `src/skills/bookmarks/` — v1 skill: list folders, fetch posts, synthesize briefs
- `src/utils/` — Structured logger

### Planned (v2+)
- `src/skills/search/` — Query X for topics/keywords
- `src/skills/threads/` — Fetch + parse thread context
- `src/skills/profile/` — Account/list management
- `src/skills/publish/` — Post, schedule, reply (v3)

## Development
- **Build:** `npm run build`
- **Test:** `npm test` (jest + ts-jest)
- **Lint:** `npm run lint`
- **Run scripts:** `npx tsx <script>.ts`
- **Publish:** `npm publish --access public`

## Conventions
- TypeScript strict mode, ES2022 target, NodeNext modules
- All clients use factory pattern: `create*FromEnv()` reads from env vars
- Errors: `XApiRequestError`, `XAuthenticationError`, `XRateLimitError`, `XNotFoundError`
- X API v2 base URL: `https://api.x.com/2`
- Pay-per-use pricing — design for minimal API calls (auto-paginate but cache when possible)
- 24h UTC deduplication window — same post re-fetched within window = free

## Skill Reference
See [SKILL.md](./SKILL.md) for the full API reference that Claude Code uses when this package is installed in other projects.

<!-- @hidden-leaf/atlassian-skill -->
## Atlassian Integration (Library-Based Skill)

This project uses `@hidden-leaf/atlassian-skill` — a TypeScript library for Jira, Confluence, and Bitbucket.
This is NOT an MCP tool or registered skill. To use it, write a TypeScript script and execute it with `npx tsx <script>.ts`.

**Setup:** Credentials in `.env` — needs `ATLASSIAN_CLOUD_ID`, `ATLASSIAN_SITE_URL`, `ATLASSIAN_USER_EMAIL`, `ATLASSIAN_API_TOKEN`.
See node_modules/@hidden-leaf/atlassian-skill/.env.example for all options.

**Skill reference:** Read node_modules/@hidden-leaf/atlassian-skill/SKILL.md for the full API before using.

**How to use:** Write a .ts script, then run it:
```typescript
import { createJiraClientFromEnv, jql, adf, text } from '@hidden-leaf/atlassian-skill';
const jira = createJiraClientFromEnv();

// Search: jira.searchIssues({ jql: jql().equals('project', 'PROJ').build() })
// Create: jira.createIssue({ project: 'PROJ', issuetype: 'Task', summary: '...' })
// Transition: jira.transitionIssue('PROJ-123', { transitionId: '...' })
// Comment: jira.addComment('PROJ-123', { body: adf().paragraph('text').build() })
```
Then execute: `npx tsx <script>.ts`
<!-- /@hidden-leaf/atlassian-skill -->
