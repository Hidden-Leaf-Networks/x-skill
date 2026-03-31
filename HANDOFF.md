# x-skill Marketing Handoff

> Product context and positioning for marketing planning. Written for GPT or any LLM assisting with go-to-market strategy.

---

## Product Identity

| Field | Value |
|-------|-------|
| **Package name** | `@hidden-leaf/x-skill` |
| **Version** | 1.0.0 (initial public release) |
| **Tagline** | Turn X bookmarks into structured research intelligence |
| **One-liner** | An open-source TypeScript skill that syncs your X (Twitter) bookmark folders into a local SQLite cache and synthesizes them into actionable research briefs — built for Claude Code |
| **License** | MIT |
| **Registry** | npm (`npm install @hidden-leaf/x-skill`) |
| **Repo** | github.com/Hidden-Leaf-Networks/x-skill |
| **Author** | Hidden Leaf Networks (HLN) |
| **Creator** | Trevyon Snowchild — founder of HLN, AI engineer |

---

## What It Does (Plain English)

Most power users of X have hundreds or thousands of bookmarked posts organized into folders — AI research, robotics, crypto, medicine, etc. Those bookmarks are trapped in the X app with no way to search, analyze, or act on them.

**x-skill** pulls those bookmarks via the X API, stores them locally in SQLite, and generates structured research briefs through Claude Code. It turns passive content curation into active research intelligence.

**The key insight:** Sync once (costs pennies), read forever (free). Every read, analysis, and brief after the initial sync is completely free — no API calls, no rate limits.

---

## Target Audiences

### Primary: AI-native developers and researchers
- Build with Claude Code daily
- Curate X bookmarks as a research workflow
- Want programmatic access to their saved content
- Value open-source, composable tools

### Secondary: Knowledge workers and content strategists
- Use X as a primary research source
- Need to synthesize large volumes of bookmarked content
- Want structured output (briefs, themes, notable voices)

### Tertiary: Developer tool builders
- Building on top of Claude Code's skill ecosystem
- Looking for reference implementations of Claude Code skills
- Interested in X API v2 OAuth 2.0 patterns

---

## Competitive Positioning

### What exists today
- **X's native bookmarks** — No search, no export, no analysis. Purely passive storage
- **Readwise / Pocket / Raindrop** — General-purpose read-later tools. Don't understand X's data model (threads, metrics, context annotations). No AI synthesis
- **Tweet archiving tools** — Export to CSV/JSON. No intelligence layer, no local cache strategy, no brief generation
- **Custom scripts** — Scattered GitHub repos that hit the API and dump JSON. No cache, no cost optimization, no downstream integration

### What x-skill does differently
1. **Cache-first architecture** — Sync once, read free. Designed for X's pay-per-use pricing model
2. **Folder-aware** — Respects your existing bookmark folder organization. Most tools ignore folders entirely
3. **Claude Code native** — Not a standalone CLI or web app. It's a *skill* — it lives inside your AI coding environment and feeds into your workflow
4. **Research brief synthesis** — Not just data extraction. Produces structured analysis with themes, notable voices, signal-vs-noise scoring, and actionable intelligence
5. **Composable** — Feeds into Jira tickets, training data pipelines, planning contexts. It's an intelligence *primitive*, not an end product

---

## Key Features (for marketing copy)

### Headline Features
- **Bookmark Sync** — Pull all your X bookmark folders and posts into a local SQLite database with a single command
- **Research Briefs** — Generate structured intelligence reports from any bookmark folder: key themes, notable voices, signal vs noise, actionable insights
- **Cost-Optimized** — Smart hydration strategy minimizes X API calls. Same post within 24h = single charge. ~$5-15/month for periodic syncs
- **OAuth 2.0 PKCE** — Secure authentication with auto-token refresh. Set up once, runs forever
- **Claude Code Skill** — Installs as a skill in Claude Code. Auto-injects reference docs. Works inline with your dev workflow

### Technical Differentiators
- TypeScript strict mode, ES2022, full type exports
- SQLite with WAL mode — fast reads, crash-safe writes
- 40+ public API exports — fully composable
- Zero runtime dependencies beyond axios and better-sqlite3
- GitHub Actions CI with Node 18/20 matrix

---

## Pricing & Cost Model

x-skill itself is **free and open source** (MIT).

The only cost is X API usage (pay-per-use, launched Feb 2026):

| Usage Pattern | Est. Monthly Cost |
|---------------|-------------------|
| Light (weekly sync, 5 folders) | ~$5 |
| Moderate (daily sync, 10 folders) | ~$15 |
| Heavy (multiple daily syncs, 20+ folders) | ~$25-50 |

**Key selling point:** After the initial sync, *all reads are free*. Briefs, searches, exports — zero API calls. You only pay when you pull new data.

---

## Brand Context

### Hidden Leaf Networks (HLN)
- AI studio building tools, platforms, and research infrastructure
- Named after the Hidden Leaf Village from Naruto — themes of growth, mastery, and building something from nothing
- Other HLN projects: ARIA (AI assistant), Scroll (LLM fine-tuning), Konoha Engine (orchestration), Asimov (robotics), EmLink (civic infrastructure)
- x-skill is the first public open-source release from HLN

### Tone & Voice
- Technical but accessible. Not corporate
- Builder energy — "we made this because we needed it"
- Confident but not arrogant. Show the work
- Anime-inspired naming is authentic to the brand, not a gimmick

---

## Launch Channels & Strategy Considerations

### Organic (recommended first)
- **X/Twitter** — Post thread from @hlntre showing the tool in action. Bookmark-to-brief demo. Tag Claude Code
- **npm** — `npm publish --access public`. Keywords: x, twitter, bookmarks, claude-code, skill, research, intelligence
- **GitHub** — Clean README, MIT license, CI badges. Star-worthy repo presentation
- **Dev communities** — Hacker News (Show HN), Reddit r/programming, Claude Code community

### Content Ideas
- "I built a tool that turns my X bookmarks into research briefs" — personal narrative thread
- "How I use Claude Code skills to automate my research workflow" — tutorial angle
- Demo video: bookmark folder → sync → brief → Jira ticket (end-to-end)
- Cost comparison: "I replaced a $50/month tool with $5/month and 2000 lines of TypeScript"

### Partnerships / Amplification
- Anthropic / Claude Code team — reference skill implementation
- X Developer community — novel use of bookmark folders API
- TypeScript / Node.js communities — clean open-source reference

---

## Technical Specs (for landing page / docs)

```
Language:       TypeScript (strict mode)
Runtime:        Node.js >= 18
Database:       SQLite (better-sqlite3, WAL mode)
Auth:           OAuth 2.0 User Context with PKCE
API:            X API v2 (pay-per-use)
Test Framework: Jest + ts-jest
CI:             GitHub Actions (Node 18/20)
License:        MIT
Package Size:   ~2,000 lines of source
Dependencies:   3 runtime (axios, axios-retry, better-sqlite3)
```

---

## v1 API Surface (for technical marketing)

```typescript
// Sync (hits API, costs money)
await skill.syncAll();
await skill.syncFolder('Robotics');

// Read (from cache, free)
skill.listFolders();
skill.fetchByFolderName('AI Medicine');
skill.fetchAll();
skill.stats();

// Synthesize (from cache, free)
await skill.brief({ folderName: 'Robotics', hlnContext: ['ARIA'] });
```

---

## Roadmap (for "what's next" messaging)

| Version | Focus | Timeline |
|---------|-------|----------|
| v1.0.0 | Bookmark intelligence (current) | Now |
| v1.1 | OAuth flow polish, error recovery, docs | Next |
| v2.0 | Search skill, thread parsing, profile management | Q2 2026 |
| v3.0 | Publish, schedule, reply (write operations) | Q3 2026 |

---

## Key Metrics & Proof Points

- **2,036 lines** of strict TypeScript
- **5 test suites** covering cache, client, skill, synthesis, logger
- **40+ public exports** — fully composable API
- **7 X API endpoints** integrated with auto-pagination
- **5-table SQLite schema** with foreign keys and WAL mode
- **OAuth 2.0 PKCE** with rotating token auto-refresh
- First open-source package from Hidden Leaf Networks

---

## Sample Marketing Copy

### Short (tweet-length)
> Sync your X bookmarks into SQLite. Generate research briefs with Claude Code. Open source, ~$5/month. `npm install @hidden-leaf/x-skill`

### Medium (newsletter/blog intro)
> Your X bookmarks are a goldmine of curated research — but they're trapped in the app with no way to search, analyze, or act on them. @hidden-leaf/x-skill pulls your bookmark folders into a local SQLite cache and synthesizes them into structured research briefs through Claude Code. Sync once, read forever. MIT licensed, ~$5/month in API costs.

### Long (Show HN / launch post)
> I've been bookmarking posts on X for years — AI papers, robotics threads, crypto analysis, medicine breakthroughs. Organized into 20+ folders. But I could never *do* anything with them programmatically.
>
> So I built x-skill: a TypeScript package that syncs your X bookmark folders into a local SQLite database and generates structured research briefs through Claude Code. Key themes, notable voices, signal vs noise, actionable intelligence — all from your curated bookmarks.
>
> The architecture is sync-then-read: you pay for the sync (~$5-15/month on X's pay-per-use API), but every read, brief, and analysis after that is completely free. No API calls, no rate limits.
>
> It's MIT licensed, 2,000 lines of strict TypeScript, and the first open-source release from Hidden Leaf Networks.
>
> `npm install @hidden-leaf/x-skill`
