/**
 * Create ATLSK ticket for dotenv auto-loading bug.
 */
import * as dotenv from 'dotenv';
dotenv.config();
import { createJiraClientFromEnv, adf, text } from '@hidden-leaf/atlassian-skill';

async function main() {
  const jira = createJiraClientFromEnv();

  const issue = await jira.createIssue({
    project: 'ATLSK',
    issuetype: 'Bug',
    summary: 'Auto-load .env from consuming project on import',
    description: adf()
      .heading(3, 'Problem')
      .paragraph(
        text().text(
          'When atlassian-skill is installed as a dependency in another project (e.g. x-skill), ' +
          'scripts that import from @hidden-leaf/atlassian-skill fail with "ATLASSIAN_CLOUD_ID and ' +
          'ATLASSIAN_SITE_URL are required" unless the consuming script manually calls dotenv.config() ' +
          'BEFORE the atlassian-skill import.'
        )
      )
      .heading(3, 'Current behavior')
      .paragraph(
        text().text(
          'The factory functions (createJiraClientFromEnv, etc.) read process.env at call time, ' +
          'but the consuming project\'s .env is not loaded automatically. The atlassian-skill ' +
          'package calls dotenv.config() in its own modules, but that only finds .env relative ' +
          'to node_modules/@hidden-leaf/atlassian-skill/, not the consuming project root.'
        )
      )
      .heading(3, 'Expected behavior')
      .paragraph(
        text().text(
          'Importing from @hidden-leaf/atlassian-skill should auto-resolve and load the .env ' +
          'from the consuming project\'s root directory (walking up from node_modules). The ' +
          'postinstall script already knows how to find the project root — the same logic should ' +
          'be used at runtime to locate and load .env.'
        )
      )
      .heading(3, 'Suggested fix')
      .paragraph(
        text().text(
          'In src/index.ts or a new src/env.ts init module, detect if running inside node_modules ' +
          'and walk up to find the consuming project\'s .env. Call dotenv.config({ path: resolved }) ' +
          'before any factory functions read env vars. This is what x-skill had to work around by ' +
          'adding `import dotenv; dotenv.config()` before every atlassian-skill import.'
        )
      )
      .heading(3, 'Reproduction')
      .codeBlock(
        'typescript',
        '// This FAILS:\nimport { createJiraClientFromEnv } from \'@hidden-leaf/atlassian-skill\';\nconst jira = createJiraClientFromEnv();\n// Error: ATLASSIAN_CLOUD_ID and ATLASSIAN_SITE_URL are required\n\n// This WORKS (but shouldn\'t be necessary):\nimport * as dotenv from \'dotenv\';\ndotenv.config();\nimport { createJiraClientFromEnv } from \'@hidden-leaf/atlassian-skill\';\nconst jira = createJiraClientFromEnv();'
      )
      .build(),
    labels: ['bug', 'dx', 'dotenv'],
  });

  console.log(`Created: ${issue.key} — ${issue.self}`);
}

main().catch((err) => {
  console.error('Failed:', err.message);
  if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
  process.exit(1);
});
