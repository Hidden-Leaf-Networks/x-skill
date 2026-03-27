/**
 * Debug script — test individual X API endpoints to see what's available.
 */
import * as dotenv from 'dotenv';
dotenv.config();

const TOKEN = process.env.X_USER_ACCESS_TOKEN;
const USER_ID = process.env.X_USER_ID;

async function testEndpoint(name: string, url: string) {
  console.log(`\n--- ${name} ---`);
  console.log(`GET ${url}`);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const body = await res.text();
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${body.slice(0, 500)}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`Error: ${msg}`);
  }
}

async function main() {
  console.log(`User ID: ${USER_ID}`);

  // 1. Test auth — /2/users/me
  await testEndpoint('GET /2/users/me', 'https://api.x.com/2/users/me');

  // 2. Test bookmarks — /2/users/:id/bookmarks
  await testEndpoint(
    'GET /2/users/:id/bookmarks',
    `https://api.x.com/2/users/${USER_ID}/bookmarks?max_results=5&tweet.fields=author_id,created_at,text`,
  );

  // 3. Test bookmark folders — /2/users/:id/bookmarks/folders
  await testEndpoint(
    'GET /2/users/:id/bookmarks/folders',
    `https://api.x.com/2/users/${USER_ID}/bookmarks/folders`,
  );
}

main();
