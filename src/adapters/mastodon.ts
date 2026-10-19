import axios from 'axios';
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

export class MastodonAdapter extends BasePlatformAdapter {
  readonly id: PlatformId = 'mastodon';
  readonly name = 'Mastodon';

  private getAccessToken(): string {
    return tokenStorage.get('mastodon')?.accessToken || config.mastodon.accessToken;
  }

  private getInstanceUrl(): string {
    return (
      tokenStorage.get('mastodon')?.extra?.instanceUrl ||
      config.mastodon.instanceUrl ||
      'https://mastodon.social'
    );
  }

  isConfigured(): boolean {
    return Boolean(this.getAccessToken());
  }

  getMissingEnv(): string[] {
    const missing: string[] = [];
    if (!this.getAccessToken()) missing.push('MASTODON_ACCESS_TOKEN (or Connect via Dashboard)');
    return missing;
  }

  getCapabilities() {
    return {
      text: true,
      media: true,
      reel: false,
    };
  }

  private getClient() {
    const baseUrl = this.getInstanceUrl().replace(/\/$/, '');
    return axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${this.getAccessToken()}`,
      },
    });
  }

  async postText(params: TextPostParams): Promise<PostResult> {
    if (!this.isConfigured()) {
      return {
        platform: this.id,
        success: false,
        error: `Mastodon is not configured. Missing: ${this.getMissingEnv().join(', ')}`,
      };
    }

    try {
      const client = this.getClient();
      const content = this.appendTags(params.content, params.tags);

      const res = await client.post('/api/v1/statuses', {
        status: content,
      });

      return {
        platform: this.id,
        success: true,
        postId: res.data.id,
        postUrl: res.data.url,
      };
    } catch (err: any) {
      return {
        platform: this.id,
        success: false,
        error: err.response?.data?.error || err.message || 'Failed to post to Mastodon',
      };
    }
  }

  async postMedia(params: MediaPostParams): Promise<PostResult> {
    if (!this.isConfigured()) {
      return {
        platform: this.id,
        success: false,
        error: `Mastodon is not configured. Missing: ${this.getMissingEnv().join(', ')}`,
      };
    }

    try {
      if (!fs.existsSync(params.mediaPath)) {
        throw new Error(`Media file not found at: ${params.mediaPath}`);
      }

      const client = this.getClient();
      const form = new FormData();
      form.append('file', fs.createReadStream(params.mediaPath));
      if (params.title) {
        form.append('description', params.title);
      }

      const mediaRes = await client.post('/api/v2/media', form, {
        headers: form.getHeaders(),
      });

      const mediaId = mediaRes.data.id;
      const content = this.appendTags(params.content, params.tags);

      const statusRes = await client.post('/api/v1/statuses', {
        status: content,
        media_ids: [mediaId],
      });

      return {
        platform: this.id,
        success: true,
        postId: statusRes.data.id,
        postUrl: statusRes.data.url,
      };
    } catch (err: any) {
      return {
        platform: this.id,
        success: false,
        error: err.response?.data?.error || err.message || 'Failed to post media to Mastodon',
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
