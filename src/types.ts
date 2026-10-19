export type PlatformId =
  | 'facebook'
  | 'instagram'
  | 'threads'
  | 'tiktok'
  | 'bluesky'
  | 'mastodon'
  | 'twitter'
  | 'youtube';

export interface PostResult {
  platform: PlatformId;
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
  details?: Record<string, any>;
}

export interface TextPostParams {
  content: string;
  tags?: string[];
}

export interface MediaPostParams {
  content: string;
  mediaPath: string; // Absolute path or URL
  mediaType: 'image' | 'video';
  title?: string;
  tags?: string[];
}

export interface ReelPostParams {
  title: string;
  description: string;
  videoPath: string; // Absolute path or URL
  tags?: string[];
}

export interface PlatformStatus {
  id: PlatformId;
  name: string;
  configured: boolean;
  authSource?: 'oauth' | 'env' | 'none';
  accountName?: string;
  missingEnvVars?: string[];
  capabilities: {
    text: boolean;
    media: boolean;
    reel: boolean;
  };
}
