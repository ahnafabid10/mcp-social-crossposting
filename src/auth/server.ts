import http from 'http';
import url from 'url';
import querystring from 'querystring';
import crypto from 'crypto';
import { exec } from 'child_process';
import axios from 'axios';
import { BskyAgent } from '@atproto/api';
import { config } from '../config.js';
import { tokenStorage } from '../storage.js';
import { renderDashboardHtml } from './html.js';
import { PlatformId } from '../types.js';

// In-memory state for OAuth PKCE and dynamic app registration
const oauthSessions = new Map<string, any>();

function parseBody(req: http.IncomingMessage): Promise<Record<string, string>> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      resolve(querystring.parse(body) as Record<string, string>);
    });
  });
}

export function startAuthServer() {
  const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url || '/', true);
    const pathname = parsedUrl.pathname || '/';

    try {
      // 1. Dashboard Home
      if (pathname === '/') {
        const msg = parsedUrl.query.msg as string;
        const type = (parsedUrl.query.type as 'success' | 'error') || 'success';
        const html = renderDashboardHtml(msg ? { type, text: msg } : undefined);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }

      // 2. Disconnect a platform
      if (pathname === '/disconnect' && req.method === 'POST') {
        const body = await parseBody(req);
        const platform = body.platform as PlatformId;
        if (platform) {
          tokenStorage.remove(platform as any);
        }
        res.writeHead(302, { Location: '/?msg=Account+disconnected+successfully&type=success' });
        res.end();
        return;
      }

      // 3. Google (YouTube) OAuth Flow
      if (pathname === '/auth/google') {
        if (!config.oauth.google.clientId) {
          res.writeHead(302, { Location: '/?msg=Missing+GOOGLE_CLIENT_ID+in+.env&type=error' });
          res.end();
          return;
        }

        const redirectUri = `${config.redirectHost}/callback/google`;
        const scope = encodeURIComponent(
          'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly'
        );
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.oauth.google.clientId}&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;

        res.writeHead(302, { Location: authUrl });
        res.end();
        return;
      }

      if (pathname === '/callback/google') {
        const code = parsedUrl.query.code as string;
        if (!code) {
          res.writeHead(302, { Location: '/?msg=Google+auth+cancelled+or+failed&type=error' });
          res.end();
          return;
        }

        const tokenUrl = 'https://oauth2.googleapis.com/token';
        const redirectUri = `${config.redirectHost}/callback/google`;

        const tokenRes = await axios.post(tokenUrl, {
          code,
          client_id: config.oauth.google.clientId,
          client_secret: config.oauth.google.clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        });

        tokenStorage.set('youtube', {
          accessToken: tokenRes.data.access_token,
          refreshToken: tokenRes.data.refresh_token,
          expiresAt: Date.now() + tokenRes.data.expires_in * 1000,
          accountName: 'YouTube Channel Connected',
        });

        res.writeHead(302, { Location: '/?msg=YouTube+connected+successfully!&type=success' });
        res.end();
        return;
      }

      // 4. Meta (Facebook, Instagram, Threads) OAuth Flow
      if (pathname === '/auth/meta') {
        if (!config.oauth.meta.appId) {
          res.writeHead(302, { Location: '/?msg=Missing+META_APP_ID+in+.env&type=error' });
          res.end();
          return;
        }

        const redirectUri = `${config.redirectHost}/callback/meta`;
        const scopes = [
          'pages_show_list',
          'pages_read_engagement',
          'pages_manage_posts',
          'instagram_basic',
          'instagram_content_publish',
          'threads_basic',
          'threads_content_publish',
        ].join(',');

        const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${config.oauth.meta.appId}&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&scope=${scopes}&response_type=code`;

        res.writeHead(302, { Location: authUrl });
        res.end();
        return;
      }

      if (pathname === '/callback/meta') {
        const code = parsedUrl.query.code as string;
        if (!code) {
          res.writeHead(302, { Location: '/?msg=Meta+auth+cancelled+or+failed&type=error' });
          res.end();
          return;
        }

        const redirectUri = `${config.redirectHost}/callback/meta`;

        // Exchange for short token
        const tokenRes = await axios.get(
          `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${config.oauth.meta.appId}&client_secret=${config.oauth.meta.appSecret}&redirect_uri=${encodeURIComponent(
            redirectUri
          )}&code=${code}`
        );

        const shortToken = tokenRes.data.access_token;

        // Exchange for long-lived user token (60 days)
        const longTokenRes = await axios.get(
          `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${config.oauth.meta.appId}&client_secret=${config.oauth.meta.appSecret}&fb_exchange_token=${shortToken}`
        );

        const longUserToken = longTokenRes.data.access_token;

        // Fetch managed Pages
        const pagesRes = await axios.get(
          `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${longUserToken}`
        );

        const pages = pagesRes.data.data;
        if (pages && pages.length > 0) {
          const firstPage = pages[0];
          tokenStorage.set('facebook', {
            accessToken: firstPage.access_token,
            accountId: firstPage.id,
            accountName: firstPage.name,
          });

          if (firstPage.instagram_business_account) {
            tokenStorage.set('instagram', {
              accessToken: firstPage.access_token,
              accountId: firstPage.instagram_business_account.id,
              accountName: `@${firstPage.name}`,
            });
          }
        }

        // Store Threads long token
        tokenStorage.set('threads', {
          accessToken: longUserToken,
          accountName: 'Threads Profile Connected',
        });

        res.writeHead(302, { Location: '/?msg=Meta+accounts+(Facebook,+Instagram,+Threads)+connected!&type=success' });
        res.end();
        return;
      }

      // 5. Twitter (X) OAuth 2.0 PKCE Flow
      if (pathname === '/auth/twitter') {
        if (!config.oauth.twitter.clientId) {
          res.writeHead(302, { Location: '/?msg=Missing+TWITTER_CLIENT_ID+in+.env&type=error' });
          res.end();
          return;
        }

        const state = crypto.randomBytes(16).toString('hex');
        const codeVerifier = crypto.randomBytes(32).toString('base64url');
        const codeChallenge = crypto
          .createHash('sha256')
          .update(codeVerifier)
          .digest('base64url');

        oauthSessions.set(state, { codeVerifier });

        const redirectUri = `${config.redirectHost}/callback/twitter`;
        const scope = encodeURIComponent('tweet.read tweet.write users.read offline.access');

        const authUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${config.oauth.twitter.clientId}&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&scope=${scope}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

        res.writeHead(302, { Location: authUrl });
        res.end();
        return;
      }

      if (pathname === '/callback/twitter') {
        const code = parsedUrl.query.code as string;
        const state = parsedUrl.query.state as string;
        const session = oauthSessions.get(state);

        if (!code || !session) {
          res.writeHead(302, { Location: '/?msg=Twitter+auth+cancelled+or+session+expired&type=error' });
          res.end();
          return;
        }

        const redirectUri = `${config.redirectHost}/callback/twitter`;
        const params = new URLSearchParams();
        params.append('code', code);
        params.append('grant_type', 'authorization_code');
        params.append('client_id', config.oauth.twitter.clientId);
        params.append('redirect_uri', redirectUri);
        params.append('code_verifier', session.codeVerifier);

        const headers: Record<string, string> = {
          'Content-Type': 'application/x-www-form-urlencoded',
        };

        if (config.oauth.twitter.clientSecret) {
          const basic = Buffer.from(
            `${config.oauth.twitter.clientId}:${config.oauth.twitter.clientSecret}`
          ).toString('base64');
          headers['Authorization'] = `Basic ${basic}`;
        }

        const tokenRes = await axios.post('https://api.twitter.com/2/oauth2/token', params, {
          headers,
        });

        tokenStorage.set('twitter', {
          accessToken: tokenRes.data.access_token,
          refreshToken: tokenRes.data.refresh_token,
          expiresAt: Date.now() + tokenRes.data.expires_in * 1000,
          accountName: 'X Account Connected',
        });

        oauthSessions.delete(state);

        res.writeHead(302, { Location: '/?msg=X+(Twitter)+connected+successfully!&type=success' });
        res.end();
        return;
      }

      // 6. Bluesky Direct Auth
      if (pathname === '/auth/bluesky' && req.method === 'POST') {
        const body = await parseBody(req);
        const identifier = body.identifier?.trim();
        const password = body.password?.trim();

        if (!identifier || !password) {
          res.writeHead(302, { Location: '/?msg=Please+provide+Bluesky+handle+and+password&type=error' });
          res.end();
          return;
        }

        const agent = new BskyAgent({ service: config.bluesky.service });
        await agent.login({ identifier, password });

        tokenStorage.set('bluesky', {
          accessToken: agent.session?.accessJwt,
          refreshToken: agent.session?.refreshJwt,
          accountName: agent.session?.handle || identifier,
          extra: { password },
        });

        res.writeHead(302, { Location: '/?msg=Bluesky+account+connected!&type=success' });
        res.end();
        return;
      }

      // 7. Mastodon Instant OAuth (Dynamic Client Registration)
      if (pathname === '/auth/mastodon') {
        let instance = (parsedUrl.query.instance as string)?.trim() || 'https://mastodon.social';
        if (!instance.startsWith('http://') && !instance.startsWith('https://')) {
          instance = `https://${instance}`;
        }
        instance = instance.replace(/\/$/, '');

        const redirectUri = `${config.redirectHost}/callback/mastodon`;

        // Dynamically register app with the user's Mastodon instance
        const appRes = await axios.post(`${instance}/api/v1/apps`, {
          client_name: 'Universal Social Media MCP',
          redirect_uris: redirectUri,
          scopes: 'read write',
        });

        const clientId = appRes.data.client_id;
        const clientSecret = appRes.data.client_secret;

        const state = crypto.randomBytes(16).toString('hex');
        oauthSessions.set(state, { instance, clientId, clientSecret, redirectUri });

        const authUrl = `${instance}/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&response_type=code&scope=read+write&state=${state}`;

        res.writeHead(302, { Location: authUrl });
        res.end();
        return;
      }

      if (pathname === '/callback/mastodon') {
        const code = parsedUrl.query.code as string;
        const state = parsedUrl.query.state as string;
        const session = oauthSessions.get(state);

        if (!code || !session) {
          res.writeHead(302, { Location: '/?msg=Mastodon+authorization+failed&type=error' });
          res.end();
          return;
        }

        const tokenRes = await axios.post(`${session.instance}/oauth/token`, {
          client_id: session.clientId,
          client_secret: session.clientSecret,
          redirect_uri: session.redirectUri,
          grant_type: 'authorization_code',
          code,
        });

        tokenStorage.set('mastodon', {
          accessToken: tokenRes.data.access_token,
          accountName: session.instance,
          extra: { instanceUrl: session.instance },
        });

        oauthSessions.delete(state);

        res.writeHead(302, { Location: '/?msg=Mastodon+connected+successfully!&type=success' });
        res.end();
        return;
      }

      // 404
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    } catch (err: any) {
      console.error('Auth Server Error:', err);
      const errorMsg = encodeURIComponent(err.response?.data?.error_description || err.message || 'Internal Error');
      res.writeHead(302, { Location: `/?msg=${errorMsg}&type=error` });
      res.end();
    }
  });

  server.listen(config.port, () => {
    const url = `http://localhost:${config.port}`;
    console.log(`\n======================================================`);
    console.log(`🌐 Social Media OAuth Assistant is live at: ${url}`);
    console.log(`======================================================\n`);

    // Automatically open in default browser
    if (process.platform === 'win32') {
      exec(`start ${url}`);
    } else if (process.platform === 'darwin') {
      exec(`open ${url}`);
    } else {
      exec(`xdg-open ${url}`);
    }
  });

  return server;
}

// Allow direct execution via: tsx src/auth/server.ts or node dist/auth/server.js
if (process.argv[1]?.includes('server')) {
  startAuthServer();
}
