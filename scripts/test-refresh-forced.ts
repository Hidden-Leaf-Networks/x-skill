/**
 * Force-test auto-refresh by using an invalid access token.
 * The client should detect 401, refresh using the refresh token, and succeed.
 */
import * as dotenv from 'dotenv';
dotenv.config();
import { XClient } from '../src/clients/x-client.js';

async function main() {
  console.log('Force-testing auto-refresh with expired/invalid token...\n');

  const client = new XClient({
    userAccessToken: 'deliberately_invalid_token_to_trigger_401',
    userId: process.env.X_USER_ID!,
    refreshToken: process.env.X_REFRESH_TOKEN,
    consumerKey: process.env.X_CONSUMER_KEY,
    consumerSecret: process.env.X_CONSUMER_SECRET,
  });

  const me = await client.getMe();

  console.log(`\nAuthenticated as: ${me.data.name} (@${me.data.username})`);
  console.log('Auto-refresh worked — recovered from expired token!');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
