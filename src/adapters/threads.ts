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

export class ThreadsAdapter extends BasePlatformAdapter {
  readonly id: PlatformId = 'threads';
  readonly name = 'Threads (Meta)';
  private apiVersion = 'v1.0';

  private getAccessToken(): string {
    return tokenStorage.get('threads')?.accessToken || config.threads.accessToken;
  }

  private getUserId(): string {
    return tokenStorage.get('threads')?.accountId || config.threads.userId || 'me';
  }

  isConfigured(): boolean {
    return Boolean(this.getAccessToken());
  }

  getMissingEnv(): string[] {
    const missing: string[] = [];
    if (!this.getAccessToken()) missing.push('THREADS_ACCESS_TOKEN (or Login via OAuth)');
    return missing;
  }

  getCapabilities() {
    return {
      text: true,
      media: true,
      reel: true,
    };
  }

  private async waitForContainer(creationId: string, maxAttempts = 15): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((res) => setTimeout(res, 3000));
      const statusUrl = `https://graph.threads.net/${this.apiVersion}/${creationId}?fields=status,error_message&access_token=${this.getAccessToken()}`;
      const statusRes = await axios.get(statusUrl);
      const status = statusRes.data.status;

      if (status === 'FINISHED') return;
      if (status === 'ERROR') {
        throw new Error(`Threads media processing error: ${statusRes.data.error_message || 'Unknown'}`);
      }
    }
  }

  async postText(params: TextPostParams): Promise<PostResult> {
    if (!this.isConfigured()) {
      return {
        platform: this.id,
        success: false,
        error: `Threads is not configured. Missing: ${this.getMissingEnv().join(', ')}`,
      };
    }

    try {
      const content = this.appendTags(params.content, params.tags);
      const userId = this.getUserId();

      // Step 1: Create text container
      const containerUrl = `https://graph.threads.net/${this.apiVersion}/${userId}/threads`;
      const containerRes = await axios.post(containerUrl, {
        media_type: 'TEXT',
        text: content,
        access_token: this.getAccessToken(),
      });

      const creationId = containerRes.data.id;

      // Step 2: Publish container
      const publishUrl = `https://graph.threads.net/${this.apiVersion}/${userId}/threads_publish`;
      const publishRes = await axios.post(publishUrl, {
        creation_id: creationId,
        access_token: this.getAccessToken(),
      });

      const threadId = publishRes.data.id;

      return {
        platform: this.id,
        success: true,
        postId: threadId,
        postUrl: `https://www.threads.net/post/${threadId}`,
      };
    } catch (err: any) {
      return {
        platform: this.id,
        success: false,
        error: err.response?.data?.error?.message || err.message || 'Failed to post text to Threads',
      };
    }
  }

  async postMedia(params: MediaPostParams): Promise<PostResult> {
    if (!this.isConfigured()) {
      return {
        platform: this.id,
        success: false,
        error: `Threads is not configured. Missing: ${this.getMissingEnv().join(', ')}`,
      };
    }

    try {
      const isUrl = params.mediaPath.startsWith('http://') || params.mediaPath.startsWith('https://');
      if (!isUrl) {
        throw new Error(
          'Threads API requires a publicly accessible media URL (http/https). Please provide a hosted link.'
        );
      }

      const content = this.appendTags(params.content, params.tags);
      const userId = this.getUserId();
      const containerUrl = `https://graph.threads.net/${this.apiVersion}/${userId}/threads`;

      const payload: Record<string, any> = {
        text: content,
        access_token: this.getAccessToken(),
      };

      if (params.mediaType === 'image') {
        payload.media_type = 'IMAGE';
        payload.image_url = params.mediaPath;
      } else {
        payload.media_type = 'VIDEO';
        payload.video_url = params.mediaPath;
      }

      // Step 1: Create container
      const containerRes = await axios.post(containerUrl, payload);
      const creationId = containerRes.data.id;

      // Step 2: Wait if video
      if (params.mediaType === 'video') {
        await this.waitForContainer(creationId);
      }

      // Step 3: Publish container
      const publishUrl = `https://graph.threads.net/${this.apiVersion}/${userId}/threads_publish`;
      const publishRes = await axios.post(publishUrl, {
        creation_id: creationId,
        access_token: this.getAccessToken(),
      });

      const threadId = publishRes.data.id;

      return {
        platform: this.id,
        success: true,
        postId: threadId,
        postUrl: `https://www.threads.net/post/${threadId}`,
      };
    } catch (err: any) {
      return {
        platform: this.id,
        success: false,
        error: err.response?.data?.error?.message || err.message || 'Failed to post media to Threads',
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
