# Universal Social Media MCP Server 🚀

A modular **Model Context Protocol (MCP)** server that allows your AI IDE (Antigravity IDE, Claude Desktop, Cursor, VSCode) to create and publish posts, photos, reels, and video shorts across multiple social media platforms simultaneously.

---

## ✨ Features

- 🔐 **1-Click OAuth Assistant (`npm run auth`)**: Connect your social accounts through a modern browser dashboard without copy-pasting complex access tokens.
- 🔄 **Auto-Refreshing Tokens**: Google/YouTube and Meta long-lived tokens refresh automatically behind the scenes.
- 📱 **All Major Platforms**: Facebook, Instagram Reels, Threads, YouTube Shorts, X (Twitter), Bluesky, Mastodon, and TikTok.
- 🛡️ **Fault-Tolerant**: If one platform fails, other posts continue successfully.
- 🔌 **Standard MCP Tools**: Fully compatible with any IDE or client supporting Model Context Protocol.

---

## 🌐 Supported Platforms & Features

| Platform | Text Posts | Media (Photos / Videos) | Reels / Shorts | Auth Method |
| :--- | :---: | :---: | :---: | :--- |
| **Facebook** | ✅ | ✅ | ✅ (Reels) | 1-Click Meta OAuth or Page Token |
| **Instagram** | ❌ (Media only) | ✅ | ✅ (Reels) | 1-Click Meta OAuth |
| **Threads** | ✅ | ✅ | ✅ | 1-Click Meta OAuth |
| **YouTube** | ❌ (Video only) | ✅ | ✅ (Shorts) | 1-Click Google OAuth (Auto-refreshed) |
| **X (Twitter)**| ✅ | ✅ | ❌ | 1-Click Twitter OAuth 2.0 PKCE |
| **Bluesky** | ✅ | ✅ | 🔄 (Clips) | Direct Handle & App Password |
| **Mastodon** | ✅ | ✅ | ❌ | Instant OAuth (Zero Developer Setup) |
| **TikTok** | ❌ (Video only) | ✅ | ✅ | Content Posting API |

---

## 🚀 Quick Start (OAuth Setup)

### 1. Install & Build
```bash
npm install
npm run build
```

### 2. Launch the OAuth Assistant
```bash
npm run auth
```
This opens your browser at **`http://localhost:3456`**:
- **Bluesky & Mastodon**: Connect immediately with zero developer account setup.
- **YouTube, Meta (FB/IG/Threads), and Twitter**: Add your App Client ID / Secret in `.env` once, then click **"Connect with 1-Click"** to authorize.
- All tokens are automatically saved to `tokens.json`.

---

## 🔌 Connecting to Your IDE

### Antigravity IDE / Cursor (`mcp_config.json`):
```json
{
  "mcpServers": {
    "social-media": {
      "command": "node",
      "args": ["c:/Projects/social media mcp/dist/index.js"]
    }
  }
}
```

### Claude Desktop (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "social-media": {
      "command": "node",
      "args": ["C:\\Projects\\social media mcp\\dist\\index.js"]
    }
  }
}
```

---

## 🧰 Available MCP Tools

Your AI assistant in the IDE has access to these 4 tools:

1. **`list_social_platforms`**: Lists all supported platforms, showing which ones are connected via OAuth or `.env`.
2. **`post_social_text`**: Publishes a text status or update across multiple platforms.
   - Example: `platforms: ["facebook", "threads", "bluesky", "twitter"]`, `content: "Hello World!", tags: ["tech"]`
3. **`post_social_media`**: Publishes images or standard videos with captions.
4. **`upload_social_reel_or_short`**: Uploads short-form vertical video (Reels, Shorts, TikTok).
   - Example: `platforms: ["youtube", "facebook", "instagram"]`, `videoPath: "C:/path/to/reel.mp4"`, `title: "Demo"`
5. **`generate_study_social_image`**: Generates high-res study visa / higher education images with a strict **NO humans, NO animals** policy (focusing on aesthetic study desks, passports, visas, books, empty gothic campuses).
   - Supports OpenAI DALL-E 3 (`OPENAI_API_KEY`) with seamless free AI generator fallback.
   - Can optionally auto-post across all connected social channels in one command (`autoPost: true`).

---

## 💬 Example Prompts in Your IDE

- *"Check which social media platforms are currently connected."*
- *"Generate a random study visa promotional image (no people) and post it to Facebook and Twitter with a captivating caption!"*
- *"Post this announcement to Twitter, Bluesky, and Threads: 'Excited to announce our new project launch! 🚀' with tags #tech #launch"*
- *"Upload this video `C:/Videos/ai_demo.mp4` as a Reel/Short to YouTube and Facebook with title 'Antigravity IDE in Action'!"*
