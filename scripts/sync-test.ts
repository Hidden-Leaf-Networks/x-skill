/**
 * First sync test — pulls all bookmark folders + tweets into local cache.
 */
import { createBookmarksSkillFromEnv } from '../src/skills/bookmarks/index.js';

async function main() {
  const skill = createBookmarksSkillFromEnv();

  console.log('Syncing all bookmark folders from X API...\n');

  const result = await skill.syncAll();

  console.log(`Synced at: ${result.syncedAt}`);
  console.log(`Folders: ${result.totalFolders}`);
  console.log(`Total tweets: ${result.totalTweets}\n`);

  for (const folder of result.folders) {
    console.log(`  ${folder.name} — ${folder.tweetCount} tweets`);
  }

  console.log('\nCache stats:');
  const stats = skill.stats();
  console.log(`  Folders: ${stats.folders}`);
  console.log(`  Tweets: ${stats.tweets}`);
  console.log(`  Users: ${stats.users}`);
  console.log(`  Last sync: ${stats.lastSync}`);

  skill.close();
  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Sync failed:', err.message);
  if (err.status) console.error(`Status: ${err.status}`);
  process.exit(1);
});
