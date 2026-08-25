/**
 * Backend selector for bookmark sync clients.
 */

import { createHermesTweetClientFromEnv } from './hermes-tweet-client.js';
import { createXClientFromEnv } from './x-client.js';
import type { XBookmarkClient, XClientOptions } from './types.js';

export type XSkillBackend = 'x-api' | 'hermes-tweet';

export function resolveXSkillBackend(): XSkillBackend {
  const backend = (process.env.X_SKILL_BACKEND ?? 'x-api').toLowerCase();
  if (backend === 'hermes-tweet' || backend === 'hermes_tweet' || backend === 'xquik') {
    return 'hermes-tweet';
  }
  return 'x-api';
}

export function createBookmarkClientFromEnv(options: XClientOptions = {}): XBookmarkClient {
  return resolveXSkillBackend() === 'hermes-tweet'
    ? createHermesTweetClientFromEnv(options)
    : createXClientFromEnv(options);
}
