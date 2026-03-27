/**
 * Create XSKILL 1.0 roadmap tickets in Jira.
 */
import * as dotenv from 'dotenv';
dotenv.config();
import { createJiraClientFromEnv, adf, text } from '@hidden-leaf/atlassian-skill';

interface TicketDef {
  summary: string;
  type: string;
  description: string;
  labels: string[];
}

const tickets: TicketDef[] = [
  // ========== DONE (log what we built) ==========
  {
    summary: 'Scaffold x-skill package with TypeScript, ESLint, Jest, CI',
    type: 'Task',
    description: 'Initial project scaffold following atlassian-skill template pattern. package.json, tsconfig (strict, ES2022, NodeNext), eslint, jest, GitHub Actions CI on Node 18+20. DONE.',
    labels: ['done', 'scaffold'],
  },
  {
    summary: 'Implement X API v2 client with OAuth 2.0 User Context',
    type: 'Task',
    description: 'XClient with OAuth 2.0 Bearer auth (User Context, not App-only). Endpoints: GET /bookmarks, GET /bookmarks/folders, GET /bookmarks/folders/:id, GET /tweets (lookup), GET /users/me. Auto-pagination, retry with axios-retry, error normalization (XApiRequestError, XAuthenticationError, XRateLimitError, XNotFoundError). DONE.',
    labels: ['done', 'client'],
  },
  {
    summary: 'Implement SQLite cache layer (sync-then-read architecture)',
    type: 'Task',
    description: 'BookmarkStore using better-sqlite3. Schema: folders, tweets, users, folder_tweets (junction), sync_log. WAL mode, foreign keys. Upsert operations, batch sync transactions, read operations for all skill commands. Cache at ~/.x-skill/bookmarks.db. DONE.',
    labels: ['done', 'cache'],
  },
  {
    summary: 'Implement BookmarksSkill: sync, list, fetch, brief, stats',
    type: 'Task',
    description: 'BookmarksSkill class with sync-then-read pattern. syncAll() and syncFolder() hit X API and populate cache. listFolders(), fetchByFolderName(), fetchByFolderId(), fetchAll(), brief(), stats() all read from cache (free, instant, offline). DONE.',
    labels: ['done', 'skill'],
  },
  {
    summary: 'Implement tweet hydration via GET /2/tweets lookup',
    type: 'Task',
    description: 'Folder endpoint returns only tweet IDs (no text/metrics). Added getTweetsByIds() to hydrate missing tweets in batches of 100 via GET /2/tweets. Sync now cross-references: main bookmarks (paginated, full data) + folder IDs + hydration. Result: 334 tweets, 269 users, 20 folders fully cached. DONE.',
    labels: ['done', 'hydration'],
  },
  {
    summary: 'Implement brief prompt builder for Claude synthesis',
    type: 'Task',
    description: 'buildBriefPrompt() generates structured research analyst prompt from enriched bookmarks. Sections: Key Themes, Notable Voices, Signal vs Noise, Actionable Intelligence, HLN Relevance. extractNotableVoices() ranks by engagement, extractThemes() uses context annotations + hashtags. DONE.',
    labels: ['done', 'brief'],
  },
  {
    summary: 'Write SKILL.md, CLAUDE.md, postinstall, OAuth flow script',
    type: 'Task',
    description: 'SKILL.md (full API reference for Claude Code), CLAUDE.md (dev guide), CLAUDE.snippet.md (auto-injected into consumers), postinstall.js (walks up from node_modules to find project root), oauth-flow.ts (PKCE flow, local callback server, prints token + user ID). DONE.',
    labels: ['done', 'docs'],
  },
  {
    summary: 'Create private GitHub repo and XSKILL Jira project',
    type: 'Task',
    description: 'Hidden-Leaf-Networks/x-skill (private until 1.0). XSKILL Jira project created with Scrum template. DONE.',
    labels: ['done', 'infra'],
  },

  // ========== TODO for 1.0 ==========
  {
    summary: 'Auto-refresh expired OAuth access tokens using refresh token',
    type: 'Task',
    description: 'X OAuth 2.0 access tokens expire after ~2 hours. The refresh token (X_REFRESH_TOKEN) is long-lived. Add auto-refresh logic to XClient: detect 401, exchange refresh token for new access token via POST /2/oauth2/token, update .env or in-memory config, retry the failed request. Without this, users must re-run oauth-flow.ts every 2 hours.',
    labels: ['auth', 'v1', 'must-have'],
  },
  {
    summary: 'Client-side folder inference for unlinked tweets',
    type: 'Task',
    description: 'X API caps folder endpoint at 20 tweet IDs per folder (no pagination). Tweets beyond the cap are in the cache but not linked to a folder. Build a classifier that uses context_annotations, hashtags, entities, and keyword matching to infer folder membership for unlinked tweets. Match against existing folder names. This ensures fetchByFolderName() returns complete results even past the 20-ID API cap.',
    labels: ['intelligence', 'v1', 'must-have'],
  },
  {
    summary: 'Write unit tests for XClient, BookmarkStore, and BookmarksSkill',
    type: 'Task',
    description: 'Jest + ts-jest configured but no tests yet. Need: XClient tests (mock axios, verify endpoint URLs, error handling, pagination), BookmarkStore tests (in-memory SQLite, upsert/read/sync operations), BookmarksSkill tests (mock client + store, verify sync-then-read flow). Target: 80%+ coverage on core modules.',
    labels: ['testing', 'v1', 'must-have'],
  },
  {
    summary: 'Deep pagination on main /bookmarks endpoint',
    type: 'Task',
    description: 'getAllBookmarks() paginates via next_token but should verify it actually exhausts all pages. Add logging to show page count and total during sync. Confirm we get ALL bookmarks, not just the first 100. Add a max_pages safety limit to prevent runaway pagination on large accounts.',
    labels: ['sync', 'v1'],
  },
  {
    summary: 'Polish README for public 1.0 launch',
    type: 'Task',
    description: 'Current README is functional but needs: badges (npm version, CI status, license), GIF/screenshot of sync + brief output, architecture diagram (sync → cache → brief → downstream), contributing section, changelog. Should match atlassian-skill README quality.',
    labels: ['docs', 'v1'],
  },
  {
    summary: 'Add token refresh script for manual re-auth',
    type: 'Task',
    description: 'Companion to auto-refresh. A standalone script (scripts/refresh-token.ts) that reads X_REFRESH_TOKEN from .env, exchanges it for a new access token, and prints the updated values. Useful when auto-refresh fails or for manual recovery.',
    labels: ['auth', 'v1'],
  },
  {
    summary: 'Publish v1.0.0 to npm as @hidden-leaf/x-skill (public)',
    type: 'Task',
    description: 'Final 1.0 checklist: all tests pass, README polished, CHANGELOG written, version bumped to 1.0.0, npm publish --access public. Switch GitHub repo from private to public. Announce on X from @hlntre.',
    labels: ['release', 'v1', 'milestone'],
  },
  {
    summary: 'Brief output: pipe through Claude API for direct synthesis',
    type: 'Story',
    description: 'Currently buildBriefPrompt() generates the prompt and the caller (Claude Code) does the synthesis. For programmatic use outside Claude Code, add an option to call Claude API directly from the brief() method. Requires ANTHROPIC_API_KEY in .env. Should be optional — default behavior stays as prompt-only for Claude Code usage.',
    labels: ['brief', 'v1', 'nice-to-have'],
  },
  {
    summary: 'Add cache expiry and selective re-sync',
    type: 'Story',
    description: 'Add sync staleness tracking: show how old each folder\'s cache is, warn if >24h stale, offer selective re-sync (only folders that changed). Reduces API cost for frequent users. Consider a --force flag to bypass staleness checks.',
    labels: ['cache', 'v1', 'nice-to-have'],
  },
];

async function main() {
  const jira = createJiraClientFromEnv();

  console.log(`Creating ${tickets.length} XSKILL tickets...\n`);

  for (const ticket of tickets) {
    const issue = await jira.createIssue({
      project: 'XSKILL',
      issuetype: ticket.type,
      summary: ticket.summary,
      description: adf()
        .paragraph(text().text(ticket.description))
        .build(),
      labels: ticket.labels,
    });

    const isDone = ticket.labels.includes('done');
    console.log(`  ${issue.key} ${isDone ? '[DONE]' : '[TODO]'} ${ticket.summary}`);
  }

  console.log('\nDone! All tickets created in XSKILL project.');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
  process.exit(1);
});
