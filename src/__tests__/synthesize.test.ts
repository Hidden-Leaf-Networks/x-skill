import { buildBriefPrompt, generateBrief } from '../skills/bookmarks/synthesize';
import type { EnrichedBookmark } from '../skills/bookmarks/types';
import type { Tweet, User } from '../clients/types';

// ==========================================================================
// Fixtures
// ==========================================================================

function makeBookmark(overrides: {
  tweet?: Partial<Tweet>;
  author?: Partial<User> | null;
} = {}): EnrichedBookmark {
  const tweet: Tweet = {
    id: 't1',
    text: 'Interesting thread on robotics and AI convergence',
    author_id: 'u1',
    created_at: '2026-03-15T10:00:00Z',
    public_metrics: {
      like_count: 500,
      retweet_count: 100,
      reply_count: 25,
      quote_count: 50,
      bookmark_count: 75,
      impression_count: 50000,
    },
    ...overrides.tweet,
  };

  const author: User | undefined = overrides.author === null
    ? undefined
    : {
        id: 'u1',
        name: 'Dr. Robotics',
        username: 'drrobotics',
        verified: true,
        public_metrics: {
          followers_count: 50000,
          following_count: 500,
          tweet_count: 2000,
          listed_count: 300,
        },
        ...overrides.author,
      };

  return {
    tweet,
    author,
    formatted: `@${author?.username ?? 'unknown'}: ${tweet.text}`,
  };
}

describe('buildBriefPrompt', () => {
  it('generates a structured prompt with all sections', () => {
    const bookmarks = [makeBookmark()];
    const prompt = buildBriefPrompt(bookmarks, { topic: 'Robotics' });

    expect(prompt).toContain('Robotics');
    expect(prompt).toContain('Key Themes');
    expect(prompt).toContain('Notable Voices');
    expect(prompt).toContain('Signal vs. Noise');
    expect(prompt).toContain('Actionable Intelligence');
    expect(prompt).toContain('HLN Relevance');
    expect(prompt).toContain('1 bookmarked X posts');
  });

  it('includes post data in the prompt', () => {
    const bookmarks = [makeBookmark({
      tweet: { text: 'GPT-5 just dropped' },
      author: { username: 'openai', name: 'OpenAI' },
    })];

    const prompt = buildBriefPrompt(bookmarks, { topic: 'LLMs' });

    expect(prompt).toContain('@openai');
    expect(prompt).toContain('OpenAI');
    expect(prompt).toContain('GPT-5 just dropped');
    expect(prompt).toContain('Likes: 500');
  });

  it('includes HLN context when provided', () => {
    const bookmarks = [makeBookmark()];
    const prompt = buildBriefPrompt(bookmarks, {
      topic: 'AI',
      hlnContext: ['ARIA', 'Scroll', 'Konoha Engine'],
    });

    expect(prompt).toContain('ARIA');
    expect(prompt).toContain('Scroll');
    expect(prompt).toContain('Konoha Engine');
  });

  it('includes custom prompt when provided', () => {
    const bookmarks = [makeBookmark()];
    const prompt = buildBriefPrompt(bookmarks, {
      topic: 'AI',
      customPrompt: 'Focus on open source models only',
    });

    expect(prompt).toContain('Focus on open source models only');
    expect(prompt).toContain('Additional Instructions');
  });

  it('omits HLN section when no context', () => {
    const bookmarks = [makeBookmark()];
    const prompt = buildBriefPrompt(bookmarks, { topic: 'AI' });

    expect(prompt).not.toContain('## HLN Context');
  });

  it('handles bookmarks without author', () => {
    const bookmarks = [makeBookmark({ author: null })];
    const prompt = buildBriefPrompt(bookmarks, { topic: 'AI' });

    expect(prompt).toContain('unknown');
    expect(prompt).toContain('Unknown');
  });

  it('includes URLs from entities', () => {
    const bookmarks = [makeBookmark({
      tweet: {
        entities: {
          urls: [{
            start: 0, end: 23,
            url: 'https://t.co/abc',
            expanded_url: 'https://arxiv.org/paper/123',
            display_url: 'arxiv.org/paper/123',
          }],
        },
      },
    })];

    const prompt = buildBriefPrompt(bookmarks, { topic: 'Papers' });
    expect(prompt).toContain('https://arxiv.org/paper/123');
  });

  it('uses note_tweet text when available', () => {
    const bookmarks = [makeBookmark({
      tweet: {
        text: 'Truncated version...',
        note_tweet: { text: 'Full long-form content with all the details' },
      },
    })];

    const prompt = buildBriefPrompt(bookmarks, { topic: 'AI' });
    expect(prompt).toContain('Full long-form content with all the details');
  });

  it('numbers multiple posts sequentially', () => {
    const bookmarks = [
      makeBookmark({ tweet: { id: 't1' } }),
      makeBookmark({ tweet: { id: 't2' }, author: { username: 'user2' } }),
      makeBookmark({ tweet: { id: 't3' }, author: { username: 'user3' } }),
    ];

    const prompt = buildBriefPrompt(bookmarks, { topic: 'AI' });
    expect(prompt).toContain('Post 1');
    expect(prompt).toContain('Post 2');
    expect(prompt).toContain('Post 3');
  });
});

describe('generateBrief', () => {
  it('returns a ResearchBrief with metadata', async () => {
    const bookmarks = [
      makeBookmark({
        tweet: {
          context_annotations: [
            { domain: { id: '1', name: 'Technology' }, entity: { id: '2', name: 'Artificial Intelligence' } },
          ],
          entities: {
            hashtags: [{ start: 0, end: 3, tag: 'AI' }],
          },
        },
      }),
    ];

    const brief = await generateBrief(bookmarks, { topic: 'AI Research' });

    expect(brief.topic).toBe('AI Research');
    expect(brief.tweetCount).toBe(1);
    expect(brief.generatedAt).toBeTruthy();
    expect(brief.content).toContain('AI Research');
    expect(brief.hlnRelevance).toEqual([]);
  });

  it('extracts notable voices ranked by engagement', async () => {
    const bookmarks = [
      makeBookmark({
        tweet: { id: 't1', public_metrics: { like_count: 1000, retweet_count: 500, reply_count: 0, quote_count: 200, bookmark_count: 0, impression_count: 0 } },
        author: { username: 'top_voice' },
      }),
      makeBookmark({
        tweet: { id: 't2', public_metrics: { like_count: 10, retweet_count: 2, reply_count: 0, quote_count: 0, bookmark_count: 0, impression_count: 0 } },
        author: { username: 'small_voice' },
      }),
    ];

    const brief = await generateBrief(bookmarks, { topic: 'AI' });

    expect(brief.notableVoices[0]).toBe('@top_voice');
    expect(brief.notableVoices).toContain('@small_voice');
  });

  it('extracts themes from context annotations and hashtags', async () => {
    const bookmarks = [
      makeBookmark({
        tweet: {
          context_annotations: [
            { domain: { id: '1', name: 'Tech' }, entity: { id: '2', name: 'Machine Learning' } },
            { domain: { id: '1', name: 'Tech' }, entity: { id: '3', name: 'Machine Learning' } },
          ],
          entities: {
            hashtags: [
              { start: 0, end: 3, tag: 'AI' },
              { start: 4, end: 8, tag: 'ML' },
            ],
          },
        },
      }),
    ];

    const brief = await generateBrief(bookmarks, { topic: 'AI' });

    expect(brief.themes).toContain('Machine Learning');
    expect(brief.themes).toContain('#AI');
  });

  it('passes HLN context to hlnRelevance', async () => {
    const bookmarks = [makeBookmark()];

    const brief = await generateBrief(bookmarks, {
      topic: 'Robotics',
      hlnContext: ['ARIA', 'Asimov'],
    });

    expect(brief.hlnRelevance).toEqual(['ARIA', 'Asimov']);
  });

  it('handles bookmarks with no annotations or hashtags', async () => {
    const bookmarks = [makeBookmark()];

    const brief = await generateBrief(bookmarks, { topic: 'General' });

    expect(brief.themes).toEqual([]);
    expect(brief.notableVoices).toHaveLength(1);
  });
});
