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

export class YouTubeAdapter extends BasePlatformAdapter {
  readonly id: PlatformId = 'youtube';
  readonly name = 'YouTube (Shorts & Videos)';

  private getClientId(): string {
    return config.oauth.google.clientId || config.youtube.clientId;
  }

  private getClientSecret(): string {
    return config.oauth.google.clientSecret || config.youtube.clientSecret;
  }

  private getRefreshToken(): string {
    return tokenStorage.get('youtube')?.refreshToken || config.youtube.refreshToken;
  }

  isConfigured(): boolean {
    return Boolean(
      (this.getClientId() && this.getClientSecret() && this.getRefreshToken()) ||
        tokenStorage.get('youtube')?.accessToken
    );
  }

  getMissingEnv(): string[] {
    const missing: string[] = [];
    if (!this.getClientId()) missing.push('GOOGLE_CLIENT_ID');
    if (!this.getClientSecret()) missing.push('GOOGLE_CLIENT_SECRET');
    if (!this.getRefreshToken() && !tokenStorage.get('youtube')?.accessToken) {
      missing.push('YOUTUBE_REFRESH_TOKEN (or Login via OAuth)');
    }
    return missing;
  }

  getCapabilities() {
    return {
      text: false,
      media: true,
      reel: true,
    };
  }

  private async getAccessToken(): Promise<string> {
    const stored = tokenStorage.get('youtube');
    if (stored?.accessToken && stored.expiresAt && stored.expiresAt > Date.now() + 60000) {
      return stored.accessToken;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No YouTube refresh token available. Please connect via OAuth.');
    }

    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const res = await axios.post(tokenUrl, {
      client_id: this.getClientId(),
      client_secret: this.getClientSecret(),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const newAccessToken = res.data.access_token;
    tokenStorage.set('youtube', {
      accessToken: newAccessToken,
      expiresAt: Date.now() + (res.data.expires_in || 3600) * 1000,
    });

    return newAccessToken;
  }

  async postText(params: TextPostParams): Promise<PostResult> {
    return {
      platform: this.id,
      success: false,
      error: 'YouTube adapter is configured for Video & Shorts uploads. Text-only posting is not supported.',
    };
  }

  async postMedia(params: MediaPostParams): Promise<PostResult> {
    if (params.mediaType !== 'video') {
      return {
        platform: this.id,
        success: false,
        error: 'YouTube only accepts video uploads.',
      };
    }

    return this.postReel({
      title: params.title || 'New Upload',
      description: params.content,
      videoPath: params.mediaPath,
      tags: params.tags,
    });
  }

  async postReel(params: ReelPostParams): Promise<PostResult> {
    if (!this.isConfigured()) {
      return {
        platform: this.id,
        success: false,
        error: `YouTube is not configured. Missing: ${this.getMissingEnv().join(', ')}`,
      };
    }

    try {
      if (!fs.existsSync(params.videoPath)) {
        throw new Error(`Video file not found at: ${params.videoPath}`);
      }

      const accessToken = await this.getAccessToken();

      let title = params.title || 'New YouTube Short';
      let description = this.appendTags(params.description, params.tags);

      if (!title.toLowerCase().includes('#shorts') && !description.toLowerCase().includes('#shorts')) {
        description += '\n\n#Shorts';
      }

      const metadata = {
        snippet: {
          title: title.substring(0, 100),
          description,
          tags: params.tags || ['Shorts'],
          categoryId: '22',
        },
        status: {
          privacyStatus: 'public',
          selfDeclaredMadeForKids: false,
        },
      };

      const form = new FormData();
      form.append('snippet', JSON.stringify(metadata), {
        contentType: 'application/json; charset=UTF-8',
      });
      form.append('video', fs.createReadStream(params.videoPath), {
        contentType: 'video/mp4',
      });

      const uploadUrl =
        'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status';

      const res = await axios.post(uploadUrl, form, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...form.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      const videoId = res.data.id;

      return {
        platform: this.id,
        success: true,
        postId: videoId,
        postUrl: `https://youtube.com/shorts/${videoId}`,
        details: { videoId, title },
      };
    } catch (err: any) {
      return {
        platform: this.id,
        success: false,
        error: err.response?.data?.error?.message || err.message || 'Failed to upload YouTube Short/Video',
      };
    }
  }
}
