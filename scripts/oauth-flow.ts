/**
 * OAuth 2.0 Authorization Code Flow with PKCE for X API.
 *
 * Supports dual-account management:
 *   npx tsx scripts/oauth-flow.ts              → personal account (default)
 *   npx tsx scripts/oauth-flow.ts personal     → personal account (@hlntre)
 *   npx tsx scripts/oauth-flow.ts org           → org account (@HiddenLeafNet)
 *
 * This will:
 *   1. Generate a PKCE code challenge
 *   2. Open your browser to X's authorize page
 *   3. Start a local server to catch the callback
 *   4. Exchange the auth code for a User Access Token
 *   5. Fetch user info (id, username, name)
 *   6. Auto-update the correct env vars in .env
 */

import * as http from 'http';
import * as crypto from 'crypto';
import * as url from 'url';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

type AccountType = 'personal' | 'org';

const CLIENT_ID = process.env.X_CONSUMER_KEY;
const CLIENT_SECRET = process.env.X_CONSUMER_SECRET;
const CALLBACK_URL = process.env.X_CALLBACK_URL || 'http://localhost:3000/callback';
const SCOPES = ['bookmark.read', 'bookmark.write', 'tweet.read', 'tweet.write', 'users.read', 'offline.access'];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('ERROR: X_CONSUMER_KEY and X_CONSUMER_SECRET must be set in .env');
  process.exit(1);
}

// =============================================================================
// Account type from CLI arg
// =============================================================================

function getAccountType(): AccountType {
  const arg = process.argv[2]?.toLowerCase();
  if (arg === 'org') return 'org';
  if (arg === 'personal' || !arg) return 'personal';
  console.error(`Unknown account type: "${arg}". Use "personal" or "org".`);
  process.exit(1);
}

// =============================================================================
// Env var mapping per account type
// =============================================================================

function getEnvKeys(account: AccountType) {
  if (account === 'org') {
    return {
      accessToken: 'X_ORG_ACCESS_TOKEN',
      userId: 'X_ORG_USER_ID',
      refreshToken: 'X_ORG_REFRESH_TOKEN',
      username: 'X_ORG_USERNAME',
    };
  }
  return {
    accessToken: 'X_USER_ACCESS_TOKEN',
    userId: 'X_USER_ID',
    refreshToken: 'X_REFRESH_TOKEN',
    username: 'X_USER_USERNAME',
  };
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

// =============================================================================
// Fetch user info
// =============================================================================

async function fetchUserId(accessToken: string): Promise<{ id: string; name: string; username: string }> {
  const response = await fetch('https://api.x.com/2/users/me?user.fields=id,name,username', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user info (${response.status})`);
  }

  const data = await response.json();
  return data.data;
}

// =============================================================================
// Update .env file
// =============================================================================

function updateEnvFile(updates: Record<string, string>): void {
  const envPath = path.resolve(process.cwd(), '.env');
  let content = fs.readFileSync(envPath, 'utf-8');

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      // Append if not found
      content += `\n${key}=${value}`;
    }
  }

  fs.writeFileSync(envPath, content);
}

// =============================================================================
// Main flow
// =============================================================================

async function main(): Promise<void> {
  const account = getAccountType();
  const envKeys = getEnvKeys(account);
  const label = account === 'org' ? 'ORG (@HiddenLeafNet)' : 'PERSONAL (@hlntre)';

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

  console.log(`\n=== X API OAuth 2.0 Flow — ${label} ===\n`);
  console.log(`Authenticating for: ${label}`);
  console.log(`Env vars that will be updated: ${Object.values(envKeys).join(', ')}\n`);
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
              <h1>✓ Authorized!</h1>
              <p>Account: <strong>${label}</strong></p>
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

  console.log(`=== SUCCESS — ${label} ===\n`);
  console.log(`Authenticated as: ${user.name} (@${user.username})`);
  console.log(`User ID: ${user.id}`);
  console.log(`Token expires in: ${token.expires_in}s (~${Math.round(token.expires_in / 3600)}h)`);
  console.log(`Scopes: ${token.scope}\n`);

  // Auto-update .env
  const updates: Record<string, string> = {
    [envKeys.accessToken]: token.access_token,
    [envKeys.userId]: user.id,
    [envKeys.username]: user.username,
  };
  if (token.refresh_token) {
    updates[envKeys.refreshToken] = token.refresh_token;
  }

  updateEnvFile(updates);
  console.log(`✓ .env updated with ${account} account credentials:`);
  for (const [key] of Object.entries(updates)) {
    console.log(`  ${key}=***`);
  }

  console.log(`\nDone! Run sync to pull ${account} bookmarks.\n`);
}

main().catch((err) => {
  console.error('OAuth flow failed:', err.message);
  process.exit(1);
});
