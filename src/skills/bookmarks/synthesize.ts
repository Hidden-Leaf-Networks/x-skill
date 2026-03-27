/**
 * Brief synthesis — pipes bookmark posts through Claude and outputs
 * structured markdown covering themes, notable voices, signal vs. noise,
 * and HLN-specific relevance.
 *
 * This module is designed to be called by Claude Code itself. The output
 * is a structured ResearchBrief object that can be piped downstream to:
 *   - Jira tickets (via atlassian-skill)
 *   - ARIA context / planning prompts
 *   - Scroll training data corpus
 *   - Applied AI Studio client research
 */

import type { EnrichedBookmark, ResearchBrief } from './types.js';

interface SynthesizeOptions {
  topic: string;
  customPrompt?: string;
  hlnContext?: string[];
}

/**
 * Build the synthesis prompt from enriched bookmarks.
 * Returns the full prompt string — caller is responsible for sending to Claude.
 *
 * Design decision: this skill does NOT call the Claude API directly.
 * Instead, it builds a prompt + structured input that Claude Code can execute.
 * This keeps the skill stateless and avoids requiring a separate API key.
 */
export function buildBriefPrompt(
  bookmarks: EnrichedBookmark[],
  options: SynthesizeOptions,
): string {
  const { topic, customPrompt, hlnContext } = options;

  const postsBlock = bookmarks
    .map((b, i) => {
      const handle = b.author ? `@${b.author.username}` : 'unknown';
      const name = b.author?.name ?? 'Unknown';
      const text = b.tweet.note_tweet?.text ?? b.tweet.text;
      const date = b.tweet.created_at ?? 'unknown date';
      const metrics = b.tweet.public_metrics;
      const stats = metrics
        ? `Likes: ${metrics.like_count} | RTs: ${metrics.retweet_count} | Quotes: ${metrics.quote_count}`
        : 'no metrics';

      const urls = b.tweet.entities?.urls
        ?.map((u) => u.expanded_url)
        .join(', ') ?? '';

      return [
        `--- Post ${i + 1} ---`,
        `Author: ${name} (${handle})`,
        `Date: ${date}`,
        `Engagement: ${stats}`,
        urls ? `Links: ${urls}` : '',
        `Text: ${text}`,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');

  const hlnSection = hlnContext?.length
    ? `\n## HLN Context\nRelate findings to these HLN ventures/initiatives: ${hlnContext.join(', ')}`
    : '';

  const customSection = customPrompt
    ? `\n## Additional Instructions\n${customPrompt}`
    : '';

  return `You are a research analyst for Hidden Leaf Networks (HLN). Analyze the following ${bookmarks.length} bookmarked X posts from the "${topic}" folder and produce a structured research brief.

## Output Format

Produce a markdown document with these sections:

### Key Themes
- Identify 3-7 major themes or trends across the posts
- For each theme, cite 1-2 specific posts as evidence

### Notable Voices
- List the most influential or insightful accounts in this set
- Note their area of expertise and why they're worth following

### Signal vs. Noise
- **High signal:** Posts with genuine insight, data, or novel perspective
- **Low signal:** Posts that are hype, repetitive, or lack substance
- Assign a signal quality score (1-10) for the overall folder

### Actionable Intelligence
- What should HLN act on based on these posts?
- Any emerging opportunities, risks, or inflection points?

### HLN Relevance
- Which HLN ventures or initiatives does this research impact?
- Specific recommendations for how to use this intelligence
${hlnSection}
${customSection}

## Bookmarked Posts

${postsBlock}

---
Produce the brief now. Be concise but thorough. Prioritize actionable intelligence over summary.`;
}

/**
 * Generate a research brief from enriched bookmarks.
 *
 * This function builds the prompt and parses the response into a structured
 * ResearchBrief object. The actual Claude call happens inline — when this
 * skill is invoked from Claude Code, the model is already available.
 *
 * For programmatic use outside Claude Code, the caller should use
 * buildBriefPrompt() and send it to the Claude API themselves.
 */
export async function generateBrief(
  bookmarks: EnrichedBookmark[],
  options: SynthesizeOptions,
): Promise<ResearchBrief> {
  const prompt = buildBriefPrompt(bookmarks, options);

  // Extract structured metadata from bookmarks for the brief envelope
  const notableVoices = extractNotableVoices(bookmarks);
  const themes = extractThemes(bookmarks);

  return {
    topic: options.topic,
    generatedAt: new Date().toISOString(),
    tweetCount: bookmarks.length,
    content: prompt, // The prompt itself — Claude Code will synthesize when invoked
    notableVoices,
    themes,
    hlnRelevance: options.hlnContext ?? [],
  };
}

/**
 * Extract notable voices — accounts with highest engagement across bookmarks.
 */
function extractNotableVoices(bookmarks: EnrichedBookmark[]): string[] {
  const authorEngagement = new Map<string, number>();

  for (const b of bookmarks) {
    if (!b.author) continue;
    const handle = `@${b.author.username}`;
    const engagement =
      (b.tweet.public_metrics?.like_count ?? 0) +
      (b.tweet.public_metrics?.retweet_count ?? 0) * 2 +
      (b.tweet.public_metrics?.quote_count ?? 0) * 3;
    authorEngagement.set(
      handle,
      (authorEngagement.get(handle) ?? 0) + engagement,
    );
  }

  return [...authorEngagement.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([handle]) => handle);
}

/**
 * Extract preliminary themes from context annotations and hashtags.
 */
function extractThemes(bookmarks: EnrichedBookmark[]): string[] {
  const themeCount = new Map<string, number>();

  for (const b of bookmarks) {
    // Context annotations (X's ML-derived topics)
    if (b.tweet.context_annotations) {
      for (const ann of b.tweet.context_annotations) {
        const name = ann.entity.name;
        themeCount.set(name, (themeCount.get(name) ?? 0) + 1);
      }
    }

    // Hashtags
    if (b.tweet.entities?.hashtags) {
      for (const ht of b.tweet.entities.hashtags) {
        const tag = `#${ht.tag}`;
        themeCount.set(tag, (themeCount.get(tag) ?? 0) + 1);
      }
    }
  }

  return [...themeCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([theme]) => theme);
}
