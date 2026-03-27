import * as dotenv from 'dotenv';
dotenv.config();
import { createJiraClientFromEnv, adf, text } from '@hidden-leaf/atlassian-skill';

const tickets = [
  {
    project: 'XSKILL',
    summary: 'Migrate GPT-generated docs (strategy PDF, briefs, deck) into HLN repo',
    type: 'Task',
    description:
      'The Edge Systems Strategy v1.0, Sentinel Product Brief, Forge QC Product Brief, and pitch deck ' +
      'were generated in a ChatGPT session and live in ~/Downloads. These need to be:\n' +
      '1. Pulled into a docs/ directory in the appropriate HLN repo (or new hln-docs repo)\n' +
      '2. Version-controlled with DocForge\n' +
      '3. Converted to markdown source + PDF build pipeline so future edits are tracked\n' +
      '4. Updated to reflect the full x-skill intelligence pipeline integration',
    labels: ['docs', 'next-session'],
  },
  {
    project: 'XSKILL',
    summary: 'Next session plan: token refresh → deep dive briefs → Sentinel repo scaffold',
    type: 'Task',
    description:
      'Pre-planned next session flow:\n\n' +
      '1. XSKILL-9: Implement OAuth auto-refresh (token expires ~2h, will be dead by next session)\n' +
      '2. XSKILL-29: Run first research briefs on priority folders (CHIPS, Robotics, AI HARDWARE, LLMs, Claude)\n' +
      '3. Scaffold hln-sentinel repo (Docker + FastAPI + Jinja2 + YOLO, per GPT dev plan)\n' +
      '4. Wire x-skill brief output → Jira ticket creation for actionable intelligence\n' +
      '5. If time: start Forge QC repo scaffold in parallel\n\n' +
      'Goal: by end of next session, have auto-refreshing tokens, 5 research briefs generated, ' +
      'and the Sentinel repo bootstrapped with Docker + basic detection running.',
    labels: ['planning', 'next-session'],
  },
  {
    project: 'HLN',
    summary: 'Establish DocForge pipeline for HLN versioned documentation',
    type: 'Story',
    description:
      'HLN now has multiple strategy docs, product briefs, and pitch materials being generated ' +
      'across sessions (Claude Code, ChatGPT, manual). Need a unified doc pipeline:\n' +
      '- Markdown source files in repo\n' +
      '- PDF generation (pandoc or similar)\n' +
      '- Version tracking via git\n' +
      '- Confluence sync for living docs\n' +
      '- DocForge integration for Claude Code-assisted writing\n\n' +
      'Docs to migrate: Edge Systems Strategy v1.0, Sentinel Brief, Forge QC Brief, ' +
      'Detroit Semiconductor Hub pitch deck, investor one-pager.',
    labels: ['docs', 'infrastructure', 'docforge'],
  },
];

async function main() {
  const jira = createJiraClientFromEnv();

  for (const t of tickets) {
    const issue = await jira.createIssue({
      project: t.project,
      issuetype: t.type,
      summary: t.summary,
      description: adf().paragraph(text().text(t.description)).build(),
      labels: t.labels,
    });
    console.log(`${issue.key} — ${t.summary}`);
  }
}

main().catch((err) => {
  console.error('Failed:', err.message);
  if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
  process.exit(1);
});
