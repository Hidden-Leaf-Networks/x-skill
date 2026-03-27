/**
 * Test auto-refresh: calls /users/me.
 * If token is expired, it should auto-refresh and succeed.
 */
import * as dotenv from 'dotenv';
dotenv.config();
import { createXClientFromEnv } from '../src/clients/x-client.js';

async function main() {
  console.log('Testing auto-refresh...');
  console.log(`Refresh token present: ${!!process.env.X_REFRESH_TOKEN}`);
  console.log(`Consumer key present: ${!!process.env.X_CONSUMER_KEY}`);
  console.log(`Consumer secret present: ${!!process.env.X_CONSUMER_SECRET}\n`);

  const client = createXClientFromEnv();
  const me = await client.getMe();

  console.log(`Authenticated as: ${me.data.name} (@${me.data.username})`);
  console.log('Auto-refresh is working!');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
