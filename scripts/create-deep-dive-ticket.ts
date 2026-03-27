import * as dotenv from 'dotenv';
dotenv.config();
import { createJiraClientFromEnv, adf, text } from '@hidden-leaf/atlassian-skill';

async function main() {
  const jira = createJiraClientFromEnv();

  const issue = await jira.createIssue({
    project: 'XSKILL',
    issuetype: 'Story',
    summary: 'Deep dive: generate research briefs for all 20 bookmark categories',
    description: adf()
      .heading(3, 'Goal')
      .paragraph(text().text(
        'Systematically generate research briefs for each of the 20 cached bookmark folders. ' +
        'Each brief feeds into a specific HLN initiative. This is the first real intelligence extraction pass.'
      ))
      .heading(3, 'Folder → HLN Initiative Mapping')
      .paragraph(text().text(
        'Priority folders (direct HLN IP relevance):\n' +
        '• CHIPS → HLOS, Scroll (hardware substrate for HLN OS + training infra)\n' +
        '• Robotics → HLOS, Asimov (humanoid robotics, embodied AI)\n' +
        '• LLMs → Scroll, ARIA, Konoha Engine (fine-tuning, orchestration)\n' +
        '• Claude → ARIA v4, Applied AI Studio (Claude ecosystem, skill patterns)\n' +
        '• Agentic Skills → x-skill, atlassian-skill (competitive landscape, format validation)\n' +
        '• AI HARDWARE → HLOS, Scroll (compute, edge inference, custom silicon)\n' +
        '• AI MEDICINE → Orvex, Applied AI Studio (client vertical)\n' +
        '• AI MONEY → HLN strategy, Orvex (AI monetization, market signals)\n' +
        '• Cybersecurity → EmLink, HLOS (security posture for HLN products)\n' +
        '• Quantum Computing → long-horizon R&D signal\n' +
        '• AI TTS → ARIA v4 voice reintegration\n' +
        '• AI GAME DEV → MoPlay (game AI, procedural generation)\n' +
        '• 3D AI GEN → MoPlay, Applied AI Studio (3D asset generation)\n' +
        '• AI Live Action → Applied AI Studio (video/VFX AI)\n' +
        '• Web design → HLNW, EmLink (frontend patterns)\n' +
        '• App Design → EmLink, MoPlay (UX patterns)\n' +
        '• Automotive → HLOS (vehicle OS, autonomy)\n' +
        '• Textiles → iSWAG Resale (AI in fashion/textiles)\n' +
        '• Generators and Motors → HLOS, SUCO (electromechanical, utility)\n' +
        '• Home Design → SUCO (smart home, utility AI)'
      ))
      .heading(3, 'Process')
      .paragraph(text().text(
        '1. Run brief() for each folder with appropriate hlnContext\n' +
        '2. Review each brief for actionable intelligence\n' +
        '3. Create follow-up Jira tickets in relevant projects (HLN, HLOS, SCROLL, etc.) for any actions identified\n' +
        '4. Flag cross-folder convergence points (e.g., CHIPS + Robotics + AI HARDWARE overlap)\n' +
        '5. Archive briefs to Confluence as living research documents'
      ))
      .heading(3, 'Priority Order')
      .paragraph(text().text(
        'Start with the goldmine folders: CHIPS, Robotics, AI HARDWARE, LLMs, Claude. ' +
        'These directly feed HLOS and Scroll — the two ventures waiting on capital/GPU that need the strongest research foundation when they activate.'
      ))
      .build(),
    labels: ['intelligence', 'research', 'deep-dive', 'v1'],
  });

  console.log(`Created: ${issue.key} — ${issue.summary}`);
}

main().catch((err) => {
  console.error('Failed:', err.message);
  if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
  process.exit(1);
});
