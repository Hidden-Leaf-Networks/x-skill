# Changelog

All notable changes to `@hidden-leaf/x-skill` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-03-31

### Added

- **X API v2 Client** — Full OAuth 2.0 User Context authentication with PKCE flow, auto-refresh on 401/403, rotating token persistence to `.env`
- **Bookmark Endpoints** — `getBookmarks`, `getAllBookmarks`, `getBookmarkFolders`, `getAllBookmarkFolders`, `getBookmarkFolderTweetIds`, `getBookmarksWithFolders`, `getTweetsByIds`, `getMe` — all with auto-pagination
- **SQLite Cache Layer** — Local `better-sqlite3` store with WAL mode, 5-table schema (folders, users, tweets, folder_tweets, sync_log), upsert operations, batch transaction sync
- **BookmarksSkill API** — `syncAll()`, `syncFolder(name)`, `listFolders()`, `fetchByFolderName(name)`, `fetchByFolderId(id)`, `fetchAll()`, `brief(options)`, `stats()`
- **Research Brief Synthesis** — `buildBriefPrompt()` generates structured analysis prompts; `generateBrief()` extracts notable voices and themes from bookmark metadata
- **Smart Hydration Strategy** — Minimizes API calls by fetching folder IDs first, then hydrating only missing tweets via batch lookup (100 per call)
- **Error Types** — `XApiRequestError`, `XAuthenticationError`, `XRateLimitError`, `XNotFoundError` with rate limit tracking
- **Structured Logger** — Level-filtered logger (debug/info/warn/error) with timestamps and module context
- **OAuth Setup Script** — `scripts/oauth-flow.ts` with PKCE code challenge, local callback server, and token exchange
- **CI/CD Pipeline** — GitHub Actions with Node 18/20 matrix, lint, build, and test
- **Unit Test Suite** — Jest + ts-jest tests for BookmarkStore, XClient, BookmarksSkill, synthesize, and logger
- **Claude Code Integration** — `SKILL.md` reference doc, `CLAUDE.snippet.md` auto-injected via `postinstall` hook
- **Documentation** — README with quickstart, SKILL.md API reference, CLAUDE.md development guide

### Architecture Decisions

- **Sync-then-read pattern** — API calls only during sync; all reads hit local SQLite cache. Keeps costs predictable on X's pay-per-use pricing
- **No direct Claude API dependency** — Brief synthesis builds prompts for Claude Code to execute inline, avoiding separate API key requirements
- **Factory pattern** — `create*FromEnv()` functions for all major classes, reading configuration from environment variables
- **Cache-first design** — SQLite chosen over stateless fetch to minimize API costs and enable cross-session data access for downstream consumers (ARIA, Scroll, Jira)

[Unreleased]: https://github.com/Hidden-Leaf-Networks/x-skill/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Hidden-Leaf-Networks/x-skill/releases/tag/v1.0.0
