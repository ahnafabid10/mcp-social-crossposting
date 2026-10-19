import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import FormData from 'form-data';
import { BasePlatformAdapter } from './base.js';
import {
  PlatformId,
  PostResult,
  TextPostParams,
  MediaPostParams,
  ReelPostParams,
} from '../types.js';
import { config } from '../config.js';
import { tokenStorage } from '../storage.js';

export class TwitterAdapter extends BasePlatformAdapter {
  readonly id: PlatformId = 'twitter';
  readonly name = 'X (Twitter)';

  private getStoredToken(): string | undefined {
    return tokenStorage.get('twitter')?.accessToken;
  }

  isConfigured(): boolean {
    return Boolean(
      this.getStoredToken() ||
        (config.twitter.apiKey &&
          config.twitter.apiSecret &&
          config.twitter.accessToken &&
          config.twitter.accessSecret) ||
        config.twitter.bearerToken
    );
  }

  getMissingEnv(): string[] {
    const missing: string[] = [];
    if (!this.getStoredToken() && !config.twitter.apiKey && !config.twitter.bearerToken) {
      missing.push('TWITTER_API_KEY (or Connect via OAuth in dashboard)');
    }
    return missing;
  }

  getCapabilities() {
    return {
      text: true,
      media: true,
      reel: false,
    };
  }

  private getOAuth1Header(method: string, url: string): string {
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: config.twitter.apiKey,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: config.twitter.accessToken,
      oauth_version: '1.0',
    };

    const sortedKeys = Object.keys(oauthParams).sort();
    const paramString = sortedKeys
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
      .join('&');

    const signatureBase = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
    const signingKey = `${encodeURIComponent(config.twitter.apiSecret)}&${encodeURIComponent(config.twitter.accessSecret)}`;

    const signature = crypto
      .createHmac('sha1', signingKey)
      .update(signatureBase)
      .digest('base64');

    oauthParams['oauth_signature'] = signature;

    const authHeaderParts = Object.keys(oauthParams)
      .sort()
      .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`);

    return `OAuth ${authHeaderParts.join(', ')}`;
  }

  private getAuthHeaders(method: string, url: string): Record<string, string> {
    const stored = this.getStoredToken();
    if (stored) {
      return {
        Authorization: `Bearer ${stored}`,
      };
    }

    if (config.twitter.apiKey && config.twitter.accessToken) {
      return {
        Authorization: this.getOAuth1Header(method, url),
      };
    }

    return {
      Authorization: `Bearer ${config.twitter.bearerToken}`,
    };
  }

  async postText(params: TextPostParams): Promise<PostResult> {
    if (!this.isConfigured()) {
      return {
        platform: this.id,
        success: false,
        error: `X (Twitter) is not configured. Missing: ${this.getMissingEnv().join(', ')}`,
      };
    }

    try {
      const content = this.appendTags(params.content, params.tags);
      const url = 'https://api.twitter.com/2/tweets';

      const headers = {
        ...this.getAuthHeaders('POST', url),
        'Content-Type': 'application/json',
      };

      const res = await axios.post(url, { text: content }, { headers });
      const tweetId = res.data.data.id;

      return {
        platform: this.id,
        success: true,
        postId: tweetId,
        postUrl: `https://x.com/i/status/${tweetId}`,
      };
    } catch (err: any) {
      return {
        platform: this.id,
        success: false,
        error: err.response?.data?.detail || err.response?.data?.title || err.message || 'Failed to post tweet',
      };
    }
  }

  async postMedia(params: MediaPostParams): Promise<PostResult> {
    if (!this.isConfigured()) {
      return {
        platform: this.id,
        success: false,
        error: `X (Twitter) is not configured. Missing: ${this.getMissingEnv().join(', ')}`,
      };
    }

    try {
      if (!fs.existsSync(params.mediaPath)) {
        throw new Error(`Media file not found at: ${params.mediaPath}`);
      }

      // Upload media to Twitter v1.1 upload endpoint
      const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';
      const form = new FormData();
      form.append('media', fs.createReadStream(params.mediaPath));

      const authHeaders = this.getAuthHeaders('POST', uploadUrl);
      const uploadRes = await axios.post(uploadUrl, form, {
        headers: {
          ...authHeaders,
          ...form.getHeaders(),
        },
      });

      const mediaId = uploadRes.data.media_id_string;

      // Publish tweet with media_ids
      const content = this.appendTags(params.content, params.tags);
      const tweetUrl = 'https://api.twitter.com/2/tweets';
      const tweetHeaders = {
        ...this.getAuthHeaders('POST', tweetUrl),
        'Content-Type': 'application/json',
      };

      const res = await axios.post(
        tweetUrl,
        {
          text: content,
          media: {
            media_ids: [mediaId],
          },
        },
        { headers: tweetHeaders }
      );

      const tweetId = res.data.data.id;

      return {
        platform: this.id,
        success: true,
        postId: tweetId,
        postUrl: `https://x.com/i/status/${tweetId}`,
      };
    } catch (err: any) {
      return {
        platform: this.id,
        success: false,
        error: err.response?.data?.detail || err.message || 'Failed to post media to X',
      };
    }
  }

  async postReel(params: ReelPostParams): Promise<PostResult> {
    return this.postMedia({
      content: params.description,
      title: params.title,
      mediaPath: params.videoPath,
      mediaType: 'video',
      tags: params.tags,
    });
  }
}
