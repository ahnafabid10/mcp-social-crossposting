import axios from 'axios';
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

export class InstagramAdapter extends BasePlatformAdapter {
  readonly id: PlatformId = 'instagram';
  readonly name = 'Instagram (Posts & Reels)';
  private apiVersion = 'v21.0';

  private getAccessToken(): string {
    return tokenStorage.get('instagram')?.accessToken || config.instagram.accessToken;
  }

  private getAccountId(): string {
    return tokenStorage.get('instagram')?.accountId || config.instagram.accountId;
  }

  isConfigured(): boolean {
    return Boolean(this.getAccessToken() && this.getAccountId());
  }

  getMissingEnv(): string[] {
    const missing: string[] = [];
    if (!this.getAccessToken()) missing.push('INSTAGRAM_ACCESS_TOKEN (or Login via OAuth)');
    if (!this.getAccountId()) missing.push('INSTAGRAM_ACCOUNT_ID (or Login via OAuth)');
    return missing;
  }

  getCapabilities() {
    return {
      text: false,
      media: true,
      reel: true,
    };
  }

  async postText(params: TextPostParams): Promise<PostResult> {
    return {
      platform: this.id,
      success: false,
      error: 'Instagram does not support text-only posts. Please provide an image or video/reel.',
    };
  }

  private async waitForContainer(creationId: string, maxAttempts = 15): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((res) => setTimeout(res, 3000));
      const statusUrl = `https://graph.facebook.com/${this.apiVersion}/${creationId}?fields=status_code&access_token=${this.getAccessToken()}`;
      const statusRes = await axios.get(statusUrl);
      const statusCode = statusRes.data.status_code;

      if (statusCode === 'FINISHED') return;
      if (statusCode === 'ERROR') {
        throw new Error('Instagram media container processing failed on Meta servers.');
      }
    }
  }

  async postMedia(params: MediaPostParams): Promise<PostResult> {
    if (!this.isConfigured()) {
      return {
        platform: this.id,
        success: false,
        error: `Instagram is not configured. Missing: ${this.getMissingEnv().join(', ')}`,
      };
    }

    try {
      const isUrl = params.mediaPath.startsWith('http://') || params.mediaPath.startsWith('https://');
      if (!isUrl) {
        throw new Error(
          'Instagram Graph API requires a publicly accessible media URL (http/https). Local file paths must be hosted or passed as a public URL.'
        );
      }

      const caption = this.appendTags(params.content, params.tags);
      const containerUrl = `https://graph.facebook.com/${this.apiVersion}/${this.getAccountId()}/media`;

      const payload: Record<string, any> = {
        caption,
        access_token: this.getAccessToken(),
      };

      if (params.mediaType === 'image') {
        payload.image_url = params.mediaPath;
      } else {
        payload.media_type = 'REELS';
        payload.video_url = params.mediaPath;
        payload.share_to_feed = true;
      }

      // Step 1: Create container
      const containerRes = await axios.post(containerUrl, payload);
      const creationId = containerRes.data.id;

      // If video, wait for processing
      if (params.mediaType === 'video') {
        await this.waitForContainer(creationId);
      }

      // Step 2: Publish container
      const publishUrl = `https://graph.facebook.com/${this.apiVersion}/${this.getAccountId()}/media_publish`;
      const publishRes = await axios.post(publishUrl, {
        creation_id: creationId,
        access_token: this.getAccessToken(),
      });

      const mediaId = publishRes.data.id;

      return {
        platform: this.id,
        success: true,
        postId: mediaId,
        postUrl: `https://instagram.com/p/${mediaId}`,
      };
    } catch (err: any) {
      return {
        platform: this.id,
        success: false,
        error: err.response?.data?.error?.message || err.message || 'Failed to post to Instagram',
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
