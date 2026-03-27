import * as dotenv from 'dotenv';
dotenv.config();

const TOKEN = process.env.X_USER_ACCESS_TOKEN;
const USER_ID = process.env.X_USER_ID;

// Grab first folder ID from the folders response
async function main() {
  // Get folders
  const fRes = await fetch(`https://api.x.com/2/users/${USER_ID}/bookmarks/folders`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const folders = await fRes.json() as { data: Array<{ id: string; name: string }> };
  console.log('Folders:', JSON.stringify(folders.data?.slice(0, 3), null, 2));

  if (!folders.data?.[0]) return;

  // Get tweets from first folder
  const tRes = await fetch(
    `https://api.x.com/2/users/${USER_ID}/bookmarks/folders/${folders.data[0].id}`,
    { headers: { Authorization: `Bearer ${TOKEN}` } },
  );
  const tweets = await tRes.json();
  console.log(`\nFolder "${folders.data[0].name}" response:`);
  console.log(JSON.stringify(tweets, null, 2).slice(0, 2000));

  // Also check main bookmarks endpoint shape for comparison
  const bRes = await fetch(
    `https://api.x.com/2/users/${USER_ID}/bookmarks?max_results=2&tweet.fields=author_id,created_at,text,public_metrics,entities,context_annotations&user.fields=name,username,description,public_metrics&expansions=author_id`,
    { headers: { Authorization: `Bearer ${TOKEN}` } },
  );
  const bookmarks = await bRes.json();
  console.log('\nMain bookmarks endpoint (with expansions):');
  console.log(JSON.stringify(bookmarks, null, 2).slice(0, 2000));
}

main();
