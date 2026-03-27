/**
 * Create XSKILL launch plan + v2/v3 roadmap tickets.
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
  // ========== LAUNCH PLAN ==========
  {
    summary: 'Write launch thread for @hlntre X announcement',
    type: 'Task',
    description:
      'Write a launch thread for @hlntre announcing x-skill publicly. ' +
      'Hook: quote-reply the original @lexi_labs thread ("X content is consumable, it sinks once posted") ' +
      'with "I said I\'d build the open-source tooling. Here it is." ' +
      'Thread structure:\n' +
      '1. Quote-reply @lexi_labs with the hook\n' +
      '2. What x-skill does (bookmark folders → structured research briefs via Claude)\n' +
      '3. Demo GIF or screenshot showing sync + brief output\n' +
      '4. Install command: npm install @hidden-leaf/x-skill\n' +
      '5. Link to GitHub repo\n' +
      '6. Tag @AnthropicAI @claudecode — this is a Claude Code skill\n' +
      '7. Call to action: "What folders would you build briefs from?"\n\n' +
      'Precedent: baoyu-youtube-transcript skill went viral with 1.9K likes, 521 RTs from a similar format post.',
    labels: ['launch', 'marketing', 'v1'],
  },
  {
    summary: 'Create demo GIF/video: sync → cache → brief pipeline',
    type: 'Task',
    description:
      'Record a terminal demo showing the full x-skill pipeline:\n' +
      '1. npx tsx sync.ts — folders populate with tweet counts\n' +
      '2. npx tsx fetch.ts --folder "Robotics" — shows enriched posts\n' +
      '3. npx tsx brief.ts --folder "Robotics" — Claude generates research brief\n' +
      'Keep it under 30 seconds. Use asciinema or screen recording. ' +
      'This is the centerpiece of the launch thread and README.',
    labels: ['launch', 'marketing', 'v1'],
  },
  {
    summary: 'Submit x-skill to Claude Code community skill directories',
    type: 'Task',
    description:
      'After public launch, submit x-skill to:\n' +
      '- Anthropic\'s Claude Code skill/extension listings (if any official directory exists)\n' +
      '- The "Agentic Skills" community on X (where baoyu-youtube-transcript was featured)\n' +
      '- awesome-claude-code or similar GitHub lists\n' +
      '- npm package discovery (keywords already set)\n' +
      'The baoyu skill got featured on X\'s "Agentic Skills" trending page — aim for the same.',
    labels: ['launch', 'marketing', 'v1'],
  },
  {
    summary: 'Cross-post launch to LinkedIn and dev communities',
    type: 'Task',
    description:
      'Adapt the X launch thread for:\n' +
      '- LinkedIn post (Tre\'s profile + HLN company page)\n' +
      '- Reddit: r/ClaudeAI, r/artificial\n' +
      '- Dev.to or Hashnode blog post: "I turned my X bookmarks into a research pipeline"\n' +
      'Position as: open-source, bootstrapped, built in a day with Claude Code.',
    labels: ['launch', 'marketing', 'v1'],
  },
  {
    summary: 'Add Applied AI Studio branding to x-skill as showcase project',
    type: 'Task',
    description:
      'x-skill is a showcase for what Applied AI Studio (post-MDAI) can build. ' +
      'Add "Built by Applied AI Studio" to README footer. ' +
      'Reference in studio portfolio/case studies. ' +
      'This demonstrates the studio\'s capability: shipped an open-source npm package from concept to cache-backed intelligence pipeline in one session.',
    labels: ['launch', 'branding', 'v1'],
  },

  // ========== v2: SEARCH, THREADS, PROFILE ==========
  {
    summary: '[v2] Search skill — query X for topics and keywords',
    type: 'Story',
    description:
      'New sub-skill: src/skills/search/\n' +
      'Commands:\n' +
      '  x search query "humanoid robotics" --limit 50\n' +
      '  x search recent "Claude Code" --since 7d\n\n' +
      'Uses GET /2/tweets/search/recent (pay-per-use).\n' +
      'Cache results in SQLite like bookmarks.\n' +
      'Enables research beyond what the user has bookmarked — discover new signals.\n' +
      'Brief command should work on search results too, not just bookmarks.',
    labels: ['v2', 'search', 'planned'],
  },
  {
    summary: '[v2] Threads skill — fetch and parse full thread context',
    type: 'Story',
    description:
      'New sub-skill: src/skills/threads/\n' +
      'Commands:\n' +
      '  x threads fetch <tweet_url_or_id>\n' +
      '  x threads brief <tweet_url_or_id>\n\n' +
      'Uses conversation_id to reconstruct full threads.\n' +
      'Many bookmarked posts are part of longer threads — the single tweet loses context.\n' +
      'Thread-aware briefs will produce much higher quality intelligence.\n' +
      'Store thread relationships in cache (parent/child tweet links).',
    labels: ['v2', 'threads', 'planned'],
  },
  {
    summary: '[v2] Profile skill — account and list management',
    type: 'Story',
    description:
      'New sub-skill: src/skills/profile/\n' +
      'Commands:\n' +
      '  x profile info @username\n' +
      '  x profile followers --notable\n' +
      '  x lists show\n' +
      '  x lists members "AI Researchers"\n\n' +
      'Enables: "Who are the top voices in my Robotics bookmarks?" → profile lookup → follow recommendations.\n' +
      'List management ties into curation workflow.',
    labels: ['v2', 'profile', 'planned'],
  },
  {
    summary: '[v2] Cross-folder intelligence and trend analysis',
    type: 'Story',
    description:
      'New command:\n' +
      '  x bookmarks trends\n' +
      '  x bookmarks compare --folders "Robotics,AI HARDWARE,CHIPS"\n\n' +
      'Analyze signals across multiple folders. Detect convergence points ' +
      '(e.g., "CHIPS + Robotics overlap on NVIDIA robotics chips").\n' +
      'Time-series analysis: what topics are accelerating in your bookmarks?\n' +
      'This is where the cached data really pays off — cross-folder queries at zero API cost.',
    labels: ['v2', 'intelligence', 'planned'],
  },

  // ========== v3: PUBLISH ==========
  {
    summary: '[v3] Publish skill — post, schedule, and reply from CLI',
    type: 'Story',
    description:
      'New sub-skill: src/skills/publish/\n' +
      'Commands:\n' +
      '  x publish post "text here"\n' +
      '  x publish thread ["post 1", "post 2", "post 3"]\n' +
      '  x publish schedule "text" --at "2026-04-01 09:00"\n' +
      '  x publish reply <tweet_id> "response"\n\n' +
      'Requires OAuth 2.0 write scopes (tweet.write).\n' +
      'Enables full content lifecycle: research (bookmarks) → synthesize (brief) → publish (post).\n' +
      'Schedule feature needs a local cron or persistent process.\n' +
      'IMPORTANT: This changes the skill from read-only to read-write. Requires careful scope management and user confirmation before posting.',
    labels: ['v3', 'publish', 'planned'],
  },
  {
    summary: '[v3] Brief-to-thread pipeline — auto-generate X threads from research',
    type: 'Story',
    description:
      'Combine brief + publish:\n' +
      '  x bookmarks brief --folder "Robotics" --output thread\n\n' +
      'Takes a research brief and formats it as a publishable X thread.\n' +
      'Claude rewrites the brief into thread-optimized format (hook, insights, CTA).\n' +
      'User reviews before posting (never auto-post without confirmation).\n' +
      'This closes the loop: consume X → synthesize → publish back to X.\n' +
      'Directly addresses the @lexi_labs insight — turn consumable content into durable assets.',
    labels: ['v3', 'publish', 'brief', 'planned'],
  },
];

async function main() {
  const jira = createJiraClientFromEnv();

  console.log(`Creating ${tickets.length} tickets...\n`);

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

    const phase = ticket.labels.includes('launch') ? 'LAUNCH'
      : ticket.labels.includes('v2') ? 'v2'
      : ticket.labels.includes('v3') ? 'v3'
      : '???';
    console.log(`  ${issue.key} [${phase}] ${ticket.summary}`);
  }

  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
  process.exit(1);
});
