import dotenv from 'dotenv';

// Load .env file
dotenv.config();

export const config = {
  port: parseInt(process.env.AUTH_PORT || '3456', 10),
  redirectHost: process.env.REDIRECT_HOST || 'http://localhost:3456',

  // OAuth App Credentials
  oauth: {
    meta: {
      appId: process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || '',
      appSecret: process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET || '',
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET || '',
    },
    twitter: {
      clientId: process.env.TWITTER_CLIENT_ID || '',
      clientSecret: process.env.TWITTER_CLIENT_SECRET || '',
    },
    tiktok: {
      clientKey: process.env.TIKTOK_CLIENT_KEY || '',
      clientSecret: process.env.TIKTOK_CLIENT_SECRET || '',
    },
  },

  // Direct Credentials (Fallback if not using OAuth)
  facebook: {
    pageAccessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN || '',
    pageId: process.env.FACEBOOK_PAGE_ID || '',
  },

  instagram: {
    accessToken: process.env.INSTAGRAM_ACCESS_TOKEN || '',
    accountId: process.env.INSTAGRAM_ACCOUNT_ID || '',
  },

  threads: {
    accessToken: process.env.THREADS_ACCESS_TOKEN || '',
    userId: process.env.THREADS_USER_ID || '',
  },

  tiktok: {
    accessToken: process.env.TIKTOK_ACCESS_TOKEN || '',
    creatorId: process.env.TIKTOK_CREATOR_ID || '',
  },

  bluesky: {
    identifier: process.env.BLUESKY_IDENTIFIER || '',
    password: process.env.BLUESKY_PASSWORD || '',
    service: process.env.BLUESKY_SERVICE || 'https://bsky.social',
  },

  mastodon: {
    instanceUrl: process.env.MASTODON_INSTANCE_URL || 'https://mastodon.social',
    accessToken: process.env.MASTODON_ACCESS_TOKEN || '',
  },

  twitter: {
    apiKey: process.env.TWITTER_API_KEY || '',
    apiSecret: process.env.TWITTER_API_SECRET || '',
    accessToken: process.env.TWITTER_ACCESS_TOKEN || '',
    accessSecret: process.env.TWITTER_ACCESS_SECRET || '',
    bearerToken: process.env.TWITTER_BEARER_TOKEN || '',
  },

  youtube: {
    clientId: process.env.YOUTUBE_CLIENT_ID || '',
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET || '',
    refreshToken: process.env.YOUTUBE_REFRESH_TOKEN || '',
  },

  imageGen: {
    geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || process.env.IMAGE_API_KEY || '',
  },
};
