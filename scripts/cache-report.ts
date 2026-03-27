/**
 * Report what's in the local cache vs what the folder IDs suggest.
 */
import { createStoreFromEnv } from '../src/cache/store.js';

const store = createStoreFromEnv();
const folders = store.getFolders();
const stats = store.getStats();

console.log(`Cache: ${stats.tweets} tweets, ${stats.users} users, ${stats.folders} folders`);
console.log(`Last sync: ${stats.lastSync}\n`);

let totalLinked = 0;
for (const folder of folders) {
  const tweets = store.getTweetsByFolder(folder.id);
  const linked = tweets.length;
  totalLinked += linked;
  const hasTweet = tweets.filter(t => t.tweet.text && t.tweet.text.length > 0).length;
  console.log(`  ${folder.name.padEnd(25)} ${String(folder.tweet_count ?? '?').padStart(3)} folder IDs | ${String(linked).padStart(3)} linked w/ data | ${String(hasTweet).padStart(3)} have text`);
}

console.log(`\nTotal linked tweet-folder pairs: ${totalLinked}`);
console.log(`Unique tweets in DB: ${stats.tweets}`);

store.close();
