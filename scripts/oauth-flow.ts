/**
 * OAuth 2.0 Authorization Code Flow with PKCE for X API.
 *
 * Run once to get your User Access Token:
 *   npx tsx scripts/oauth-flow.ts
 *
 * This will:
 *   1. Generate a PKCE code challenge
 *   2. Open your browser to X's authorize page
 *   3. Start a local server to catch the callback
 *   4. Exchange the auth code for a User Access Token
 *   5. Print the token + user ID to paste into your .env
 */

import * as http from 'http';
import * as crypto from 'crypto';
import * as url from 'url';
import * as dotenv from 'dotenv';

dotenv.config();

const CLIENT_ID = process.env.X_CONSUMER_KEY;
const CLIENT_SECRET = process.env.X_CONSUMER_SECRET;
const CALLBACK_URL = process.env.X_CALLBACK_URL || 'http://localhost:3000/callback';
const SCOPES = ['bookmark.read', 'tweet.read', 'users.read', 'offline.access'];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('ERROR: X_CONSUMER_KEY and X_CONSUMER_SECRET must be set in .env');
  process.exit(1);
}

// =============================================================================
// PKCE helpers
// =============================================================================

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
}

// =============================================================================
// Token exchange
// =============================================================================

async function exchangeCodeForToken(code: string, codeVerifier: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: CALLBACK_URL,
    code_verifier: codeVerifier,
    client_id: CLIENT_ID!,
  });

  const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  const response = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${text}`);
  }

  return response.json();
}

async function fetchUserId(accessToken: string): Promise<{ id: string; username: string; name: string }> {
  const response = await fetch('https://api.x.com/2/users/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch user info (${response.status}): ${text}`);
  }

  const data = await response.json() as { data: { id: string; username: string; name: string } };
  return data.data;
}

// =============================================================================
// Main flow
// =============================================================================

async function main(): Promise<void> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();

  // Build authorization URL
  const authUrl = new URL('https://x.com/i/oauth2/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', CLIENT_ID!);
  authUrl.searchParams.set('redirect_uri', CALLBACK_URL);
  authUrl.searchParams.set('scope', SCOPES.join(' '));
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  console.log('\n=== X API OAuth 2.0 Flow ===\n');
  console.log('Open this URL in your browser:\n');
  console.log(authUrl.toString());
  console.log('\nWaiting for callback on http://localhost:3000...\n');

  // Try to open browser automatically
  try {
    const { exec } = await import('child_process');
    const openCmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
    exec(`${openCmd} "${authUrl.toString()}"`);
  } catch {
    // Manual open is fine
  }

  // Start local server to catch callback
  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url?.startsWith('/callback')) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const parsed = url.parse(req.url, true);
      const callbackState = parsed.query.state as string;
      const callbackCode = parsed.query.code as string;
      const error = parsed.query.error as string;

      if (error) {
        res.writeHead(400);
        res.end(`Authorization error: ${error}`);
        server.close();
        reject(new Error(`Authorization denied: ${error}`));
        return;
      }

      if (callbackState !== state) {
        res.writeHead(400);
        res.end('State mismatch — possible CSRF. Try again.');
        server.close();
        reject(new Error('State mismatch'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body style="background: #15202B; color: #E7E9EA; font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
            <div style="text-align: center;">
              <h1>Authorized!</h1>
              <p>You can close this tab and return to the terminal.</p>
            </div>
          </body>
        </html>
      `);
      server.close();
      resolve(callbackCode);
    });

    server.listen(3000, () => {
      // Server is ready
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Timeout — no callback received within 5 minutes'));
    }, 300_000);
  });

  console.log('Authorization code received. Exchanging for token...\n');

  // Exchange code for token
  const token = await exchangeCodeForToken(code, codeVerifier);
  console.log('Token received! Fetching user info...\n');

  // Fetch user ID
  const user = await fetchUserId(token.access_token);

  console.log('=== SUCCESS ===\n');
  console.log(`Authenticated as: ${user.name} (@${user.username})`);
  console.log(`User ID: ${user.id}`);
  console.log(`Token expires in: ${token.expires_in}s (~${Math.round(token.expires_in / 3600)}h)`);
  console.log(`Scopes: ${token.scope}\n`);

  console.log('Add these to your .env:\n');
  console.log(`X_USER_ACCESS_TOKEN=${token.access_token}`);
  console.log(`X_USER_ID=${user.id}`);
  if (token.refresh_token) {
    console.log(`X_REFRESH_TOKEN=${token.refresh_token}`);
  }
  console.log('\nDone! You can now run sync.\n');
}

main().catch((err) => {
  console.error('OAuth flow failed:', err.message);
  process.exit(1);
});
