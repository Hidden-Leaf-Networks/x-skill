/**
 * Create the XSKILL Jira project for tracking x-skill development.
 */
import * as dotenv from 'dotenv';
dotenv.config();
import { createJiraClientFromEnv } from '@hidden-leaf/atlassian-skill';

async function main() {
  const jira = createJiraClientFromEnv();

  // Get lead account ID
  const me = await jira.getCurrentUser();

  // Create the project
  const project = await jira.createProject({
    key: 'XSKILL',
    name: 'X Skill',
    projectTypeKey: 'software',
    projectTemplateKey: 'com.pyxis.greenhopper.jira:gh-simplified-scrum-classic',
    description: '@hidden-leaf/x-skill — X bookmark intelligence skill for Claude Code. Turns curated X bookmarks into structured research briefs for the HLN stack.',
    leadAccountId: me.accountId,
  });

  console.log('Created Jira project:', JSON.stringify(project, null, 2));
}

main().catch((err) => {
  console.error('Failed:', err.message);
  if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
  process.exit(1);
});
