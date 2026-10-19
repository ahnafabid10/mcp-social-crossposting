import { BskyAgent } from '@atproto/api';
import fs from 'fs';
import path from 'path';
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

export class BlueskyAdapter extends BasePlatformAdapter {
  readonly id: PlatformId = 'bluesky';
  readonly name = 'Bluesky (AT Protocol)';
  private agent: BskyAgent | null = null;

  private getIdentifier(): string {
    return tokenStorage.get('bluesky')?.accountName || config.bluesky.identifier;
  }

  private getPassword(): string {
    return tokenStorage.get('bluesky')?.extra?.password || config.bluesky.password;
  }

  isConfigured(): boolean {
    return Boolean(this.getIdentifier() && this.getPassword());
  }

  getMissingEnv(): string[] {
    const missing: string[] = [];
    if (!this.getIdentifier()) missing.push('BLUESKY_IDENTIFIER (or Connect in Dashboard)');
    if (!this.getPassword()) missing.push('BLUESKY_PASSWORD (or Connect in Dashboard)');
    return missing;
  }

  getCapabilities() {
    return {
      text: true,
      media: true,
      reel: false,
    };
  }

  private async getAuthenticatedAgent(): Promise<BskyAgent> {
    if (!this.agent) {
      this.agent = new BskyAgent({ service: config.bluesky.service });
    }
    if (!this.agent.hasSession) {
      await this.agent.login({
        identifier: this.getIdentifier(),
        password: this.getPassword(),
      });
    }
    return this.agent;
  }

  async postText(params: TextPostParams): Promise<PostResult> {
    if (!this.isConfigured()) {
      return {
        platform: this.id,
        success: false,
        error: `Bluesky is not configured. Missing: ${this.getMissingEnv().join(', ')}`,
      };
    }

    try {
      const agent = await this.getAuthenticatedAgent();
      const content = this.appendTags(params.content, params.tags);
      const res = await agent.post({ text: content });

      return {
        platform: this.id,
        success: true,
        postId: res.uri,
        postUrl: `https://bsky.app/profile/${agent.session?.handle}/post/${res.uri.split('/').pop()}`,
      };
    } catch (err: any) {
      return {
        platform: this.id,
        success: false,
        error: err.message || 'Failed to post to Bluesky',
      };
    }
  }

  async postMedia(params: MediaPostParams): Promise<PostResult> {
    if (!this.isConfigured()) {
      return {
        platform: this.id,
        success: false,
        error: `Bluesky is not configured. Missing: ${this.getMissingEnv().join(', ')}`,
      };
    }

    try {
      const agent = await this.getAuthenticatedAgent();
      const content = this.appendTags(params.content, params.tags);

      if (!fs.existsSync(params.mediaPath)) {
        throw new Error(`Media file not found at: ${params.mediaPath}`);
      }

      const fileBuffer = fs.readFileSync(params.mediaPath);
      const ext = path.extname(params.mediaPath).toLowerCase();
      let mimeType = 'image/jpeg';
      if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.webp') mimeType = 'image/webp';
      else if (ext === '.gif') mimeType = 'image/gif';
      else if (ext === '.mp4') mimeType = 'video/mp4';

      const uploadRes = await agent.uploadBlob(fileBuffer, { encoding: mimeType });

      let record: any = {
        text: content,
      };

      if (mimeType.startsWith('image/')) {
        record.embed = {
          $type: 'app.bsky.embed.images',
          images: [
            {
              alt: params.title || 'Attached image',
              image: uploadRes.data.blob,
            },
          ],
        };
      } else {
        record.embed = {
          $type: 'app.bsky.embed.video',
          video: uploadRes.data.blob,
        };
      }

      const res = await agent.post(record);

      return {
        platform: this.id,
        success: true,
        postId: res.uri,
        postUrl: `https://bsky.app/profile/${agent.session?.handle}/post/${res.uri.split('/').pop()}`,
      };
    } catch (err: any) {
      return {
        platform: this.id,
        success: false,
        error: err.message || 'Failed to post media to Bluesky',
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
