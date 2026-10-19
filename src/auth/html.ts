import { tokenStorage } from '../storage.js';
import { config } from '../config.js';

export function renderDashboardHtml(message?: { type: 'success' | 'error'; text: string }): string {
  const tokens = tokenStorage.getAll();

  const platforms = [
    {
      id: 'facebook',
      name: 'Facebook Pages',
      icon: '📘',
      desc: 'Post updates, photos & Reels to your Facebook Page',
      connected: Boolean(tokens.facebook?.accessToken || config.facebook.pageAccessToken),
      accountName: tokens.facebook?.accountName || (tokens.facebook?.accountId ? `Page ID: ${tokens.facebook.accountId}` : undefined),
      connectUrl: '/auth/meta',
      needsAppId: !config.oauth.meta.appId,
      appIdName: 'META_APP_ID',
    },
    {
      id: 'instagram',
      name: 'Instagram Business',
      icon: '📸',
      desc: 'Publish Photos, Carousels & Reels',
      connected: Boolean(tokens.instagram?.accessToken || config.instagram.accessToken),
      accountName: tokens.instagram?.accountName || (tokens.instagram?.accountId ? `Account: ${tokens.instagram.accountId}` : undefined),
      connectUrl: '/auth/meta',
      needsAppId: !config.oauth.meta.appId,
      appIdName: 'META_APP_ID',
    },
    {
      id: 'threads',
      name: 'Threads (Meta)',
      icon: '🧵',
      desc: 'Publish text posts, photos & video threads',
      connected: Boolean(tokens.threads?.accessToken || config.threads.accessToken),
      accountName: tokens.threads?.accountName,
      connectUrl: '/auth/meta',
      needsAppId: !config.oauth.meta.appId,
      appIdName: 'META_APP_ID',
    },
    {
      id: 'youtube',
      name: 'YouTube & Shorts',
      icon: '▶️',
      desc: 'Upload full videos and YouTube Shorts',
      connected: Boolean(tokens.youtube?.refreshToken || config.youtube.refreshToken),
      accountName: tokens.youtube?.accountName || 'Connected via OAuth',
      connectUrl: '/auth/google',
      needsAppId: !config.oauth.google.clientId,
      appIdName: 'GOOGLE_CLIENT_ID',
    },
    {
      id: 'twitter',
      name: 'X (Twitter)',
      icon: '✖️',
      desc: 'Post tweets and media via Twitter API v2',
      connected: Boolean(tokens.twitter?.accessToken || config.twitter.accessToken),
      accountName: tokens.twitter?.accountName,
      connectUrl: '/auth/twitter',
      needsAppId: !config.oauth.twitter.clientId,
      appIdName: 'TWITTER_CLIENT_ID',
    },
    {
      id: 'bluesky',
      name: 'Bluesky',
      icon: '🦋',
      desc: 'Post status & images via AT Protocol (No App ID required)',
      connected: Boolean(tokens.bluesky?.accessToken || (config.bluesky.identifier && config.bluesky.password)),
      accountName: tokens.bluesky?.accountName || config.bluesky.identifier,
      isForm: true,
      formType: 'bluesky',
    },
    {
      id: 'mastodon',
      name: 'Mastodon',
      icon: '🐘',
      desc: 'Decentralized posts & media (Instant OAuth, Zero App ID)',
      connected: Boolean(tokens.mastodon?.accessToken || config.mastodon.accessToken),
      accountName: tokens.mastodon?.accountName,
      isForm: true,
      formType: 'mastodon',
    },
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Universal Social Media MCP - OAuth Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(22, 29, 47, 0.7);
      --card-border: rgba(255, 255, 255, 0.08);
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --accent: #06b6d4;
      --success: #10b981;
      --warning: #f59e0b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Outfit', sans-serif;
      background: var(--bg);
      background-image: 
        radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 40%),
        radial-gradient(circle at 90% 80%, rgba(6, 182, 212, 0.15) 0%, transparent 40%);
      color: var(--text);
      min-height: 100vh;
      padding: 40px 20px;
    }

    .container {
      max-width: 1040px;
      margin: 0 auto;
    }

    header {
      text-align: center;
      margin-bottom: 36px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.3);
      color: #818cf8;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 500;
      margin-bottom: 12px;
      letter-spacing: 0.5px;
    }

    h1 {
      font-size: 2.5rem;
      font-weight: 700;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, #ffffff 30%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }

    p.subtitle {
      color: var(--text-muted);
      font-size: 1.1rem;
      max-width: 600px;
      margin: 0 auto;
    }

    .alert {
      padding: 16px 20px;
      border-radius: 12px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 0.95rem;
      animation: slideDown 0.3s ease;
    }

    .alert-success {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
    }

    .alert-error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
    }

    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }

    .card {
      background: var(--card-bg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: all 0.25s ease;
      position: relative;
      overflow: hidden;
    }

    .card:hover {
      border-color: rgba(99, 102, 241, 0.4);
      transform: translateY(-2px);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3);
    }

    .card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .platform-icon {
      font-size: 2rem;
      background: rgba(255, 255, 255, 0.05);
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .status-pill {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 9999px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .status-connected {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .status-disconnected {
      background: rgba(148, 163, 184, 0.1);
      color: #94a3b8;
      border: 1px solid rgba(148, 163, 184, 0.2);
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }

    .card-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: #fff;
      margin-bottom: 6px;
    }

    .card-desc {
      font-size: 0.88rem;
      color: var(--text-muted);
      line-height: 1.45;
      margin-bottom: 18px;
    }

    .account-info {
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 8px 12px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.82rem;
      color: #38bdf8;
      margin-bottom: 16px;
      word-break: break-all;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 10px 16px;
      border-radius: 10px;
      font-family: inherit;
      font-size: 0.95rem;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      border: none;
      transition: all 0.2s ease;
    }

    .btn-primary {
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
      color: white;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
    }

    .btn-primary:hover {
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
      transform: translateY(-1px);
    }

    .btn-danger {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
    }

    .btn-danger:hover {
      background: rgba(239, 68, 68, 0.25);
    }

    .btn-disabled {
      background: rgba(255, 255, 255, 0.05);
      color: #64748b;
      cursor: not-allowed;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .form-input {
      width: 100%;
      padding: 9px 12px;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: #fff;
      font-size: 0.9rem;
      margin-bottom: 10px;
      outline: none;
      transition: border-color 0.2s ease;
    }

    .form-input:focus {
      border-color: var(--primary);
    }

    .help-hint {
      font-size: 0.78rem;
      color: #eab308;
      margin-top: 8px;
      line-height: 1.35;
    }

    .footer {
      text-align: center;
      padding-top: 20px;
      color: var(--text-muted);
      font-size: 0.85rem;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="badge">✨ Universal Social Media MCP</div>
      <h1>OAuth Authentication Hub</h1>
      <p class="subtitle">Connect your accounts in one click. Once authorized, your IDE can post updates, reels, and shorts directly without manual token copying!</p>
    </header>

    ${message ? `<div class="alert alert-${message.type}">${message.type === 'success' ? '✅' : '⚠️'} ${message.text}</div>` : ''}

    <div class="grid">
      ${platforms
        .map((p) => {
          return `
          <div class="card">
            <div>
              <div class="card-header">
                <div class="platform-icon">${p.icon}</div>
                <div class="status-pill ${p.connected ? 'status-connected' : 'status-disconnected'}">
                  <div class="status-dot"></div>
                  ${p.connected ? 'Connected' : 'Not Connected'}
                </div>
              </div>
              <h2 class="card-title">${p.name}</h2>
              <p class="card-desc">${p.desc}</p>

              ${p.accountName ? `<div class="account-info">👤 ${p.accountName}</div>` : ''}

              ${
                p.needsAppId && !p.connected
                  ? `<p class="help-hint">⚠️ Add <code>${p.appIdName}</code> in <code>.env</code> to enable 1-click login.</p>`
                  : ''
              }
            </div>

            <div>
              ${
                p.connected
                  ? `<form action="/disconnect" method="POST">
                      <input type="hidden" name="platform" value="${p.id}">
                      <button type="submit" class="btn btn-danger">Disconnect</button>
                    </form>`
                  : p.isForm
                  ? p.formType === 'bluesky'
                    ? `<form action="/auth/bluesky" method="POST">
                        <input class="form-input" type="text" name="identifier" placeholder="Handle (e.g. user.bsky.social)" required>
                        <input class="form-input" type="password" name="password" placeholder="App Password" required>
                        <button type="submit" class="btn btn-primary">Connect Bluesky</button>
                      </form>`
                    : `<form action="/auth/mastodon" method="GET">
                        <input class="form-input" type="text" name="instance" placeholder="Instance (default: https://mastodon.social)">
                        <button type="submit" class="btn btn-primary">Connect Mastodon</button>
                      </form>`
                  : p.needsAppId
                  ? `<button class="btn btn-disabled" disabled>Requires ${p.appIdName}</button>`
                  : `<a href="${p.connectUrl}" class="btn btn-primary">Connect with 1-Click →</a>`
              }
            </div>
          </div>
        `;
        })
        .join('')}
    </div>

    <div class="footer">
      Social Media MCP Server • Running on port ${config.port} • Saved tokens are kept locally in <code>tokens.json</code>
    </div>
  </div>
</body>
</html>`;
}
