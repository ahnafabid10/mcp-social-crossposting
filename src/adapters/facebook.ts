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

export class FacebookAdapter extends BasePlatformAdapter {
  readonly id: PlatformId = 'facebook';
  readonly name = 'Facebook (Pages & Reels)';
  private apiVersion = 'v21.0';

  private getAccessToken(): string {
    return tokenStorage.get('facebook')?.accessToken || config.facebook.pageAccessToken;
  }

  private getPageId(): string {
    return tokenStorage.get('facebook')?.accountId || config.facebook.pageId;
  }

  isConfigured(): boolean {
    return Boolean(this.getAccessToken() && this.getPageId());
  }

  getMissingEnv(): string[] {
    const missing: string[] = [];
    if (!this.getAccessToken()) missing.push('FACEBOOK_PAGE_ACCESS_TOKEN (or Login via OAuth)');
    if (!this.getPageId()) missing.push('FACEBOOK_PAGE_ID (or Login via OAuth)');
    return missing;
  }

  getCapabilities() {
    return {
      text: true,
      media: true,
      reel: true,
    };
  }

  async postText(params: TextPostParams): Promise<PostResult> {
    if (!this.isConfigured()) {
      return {
        platform: this.id,
        success: false,
        error: `Facebook is not configured. Missing: ${this.getMissingEnv().join(', ')}`,
      };
    }

    try {
      const content = this.appendTags(params.content, params.tags);
      const url = `https://graph.facebook.com/${this.apiVersion}/${this.getPageId()}/feed`;

      const res = await axios.post(url, {
        message: content,
        access_token: this.getAccessToken(),
      });

      const postId = res.data.id;
      return {
        platform: this.id,
        success: true,
        postId,
        postUrl: `https://facebook.com/${postId}`,
      };
    } catch (err: any) {
      return {
        platform: this.id,
        success: false,
        error: err.response?.data?.error?.message || err.message || 'Failed to post to Facebook',
      };
    }
  }

  async postMedia(params: MediaPostParams): Promise<PostResult> {
    if (!this.isConfigured()) {
      return {
        platform: this.id,
        success: false,
        error: `Facebook is not configured. Missing: ${this.getMissingEnv().join(', ')}`,
      };
    }

    try {
      if (!fs.existsSync(params.mediaPath)) {
        throw new Error(`Media file not found at: ${params.mediaPath}`);
      }

      const content = this.appendTags(params.content, params.tags);

      if (params.mediaType === 'image') {
        const form = new FormData();
        form.append('source', fs.createReadStream(params.mediaPath));
        form.append('caption', content);
        form.append('access_token', this.getAccessToken());

        const url = `https://graph.facebook.com/${this.apiVersion}/${this.getPageId()}/photos`;
        const res = await axios.post(url, form, { headers: form.getHeaders() });

        return {
          platform: this.id,
          success: true,
          postId: res.data.id,
          postUrl: `https://facebook.com/${res.data.id}`,
        };
      } else {
        const form = new FormData();
        form.append('source', fs.createReadStream(params.mediaPath));
        form.append('description', content);
        if (params.title) form.append('title', params.title);
        form.append('access_token', this.getAccessToken());

        const url = `https://graph.facebook.com/${this.apiVersion}/${this.getPageId()}/videos`;
        const res = await axios.post(url, form, { headers: form.getHeaders() });

        return {
          platform: this.id,
          success: true,
          postId: res.data.id,
          postUrl: `https://facebook.com/${res.data.id}`,
        };
      }
    } catch (err: any) {
      return {
        platform: this.id,
        success: false,
        error: err.response?.data?.error?.message || err.message || 'Failed to post media to Facebook',
      };
    }
  }

  async postReel(params: ReelPostParams): Promise<PostResult> {
    if (!this.isConfigured()) {
      return {
        platform: this.id,
        success: false,
        error: `Facebook is not configured. Missing: ${this.getMissingEnv().join(', ')}`,
      };
    }

    try {
      if (!fs.existsSync(params.videoPath)) {
        throw new Error(`Video file not found at: ${params.videoPath}`);
      }

      const description = this.appendTags(params.description, params.tags);
      const stats = fs.statSync(params.videoPath);
      const fileSize = stats.size;

      // 1. Initialize Reel upload
      const initUrl = `https://graph.facebook.com/${this.apiVersion}/${this.getPageId()}/video_reels`;
      const initRes = await axios.post(initUrl, {
        upload_phase: 'start',
        access_token: this.getAccessToken(),
      });

      const videoId = initRes.data.video_id;
      const uploadUrl = initRes.data.upload_url;

      // 2. Upload the video binary
      const videoStream = fs.createReadStream(params.videoPath);
      await axios.post(uploadUrl, videoStream, {
        headers: {
          Authorization: `OAuth ${this.getAccessToken()}`,
          offset: '0',
          file_size: fileSize.toString(),
          'Content-Type': 'application/octet-stream',
        },
      });

      // 3. Publish Reel
      const finishRes = await axios.post(initUrl, {
        upload_phase: 'finish',
        video_id: videoId,
        video_state: 'PUBLISHED',
        description: description,
        title: params.title,
        access_token: this.getAccessToken(),
      });

      return {
        platform: this.id,
        success: true,
        postId: videoId,
        postUrl: `https://facebook.com/reel/${videoId}`,
        details: finishRes.data,
      };
    } catch (err: any) {
      return {
        platform: this.id,
        success: false,
        error: err.response?.data?.error?.message || err.message || 'Failed to upload Facebook Reel',
      };
    }
  }
}
