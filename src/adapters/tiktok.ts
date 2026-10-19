import axios from 'axios';
import fs from 'fs';
import { BasePlatformAdapter } from './base.js';
import {
  PlatformId,
  PostResult,
  TextPostParams,
  MediaPostParams,
  ReelPostParams,
} from '../types.js';
import { config } from '../config.js';

export class TikTokAdapter extends BasePlatformAdapter {
  readonly id: PlatformId = 'tiktok';
  readonly name = 'TikTok (Content Posting API)';

  isConfigured(): boolean {
    return Boolean(config.tiktok.accessToken);
  }

  getMissingEnv(): string[] {
    const missing: string[] = [];
    if (!config.tiktok.accessToken) missing.push('TIKTOK_ACCESS_TOKEN');
    return missing;
  }

  getCapabilities() {
    return {
      text: false, // TikTok is video-first
      media: true,
      reel: true,
    };
  }

  async postText(params: TextPostParams): Promise<PostResult> {
    return {
      platform: this.id,
      success: false,
      error: 'TikTok does not support text-only posts. Please provide a video or reel.',
    };
  }

  async postMedia(params: MediaPostParams): Promise<PostResult> {
    if (params.mediaType !== 'video') {
      return {
        platform: this.id,
        success: false,
        error: 'TikTok currently only supports video posting via this adapter.',
      };
    }

    return this.postReel({
      title: params.title || 'New Video',
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
        error: `TikTok is not configured. Missing: ${this.getMissingEnv().join(', ')}`,
      };
    }

    try {
      const isUrl = params.videoPath.startsWith('http://') || params.videoPath.startsWith('https://');
      const caption = this.appendTags(`${params.title ? `${params.title} - ` : ''}${params.description}`, params.tags);

      const initUrl = 'https://open.tiktokapis.com/v2/post/publish/video/init/';

      let sourceInfo: any;
      let totalChunkCount = 1;
      let videoSize = 0;

      if (isUrl) {
        sourceInfo = {
          source: 'PULL_FROM_URL',
          video_url: params.videoPath,
        };
      } else {
        if (!fs.existsSync(params.videoPath)) {
          throw new Error(`Video file not found at: ${params.videoPath}`);
        }
        const stats = fs.statSync(params.videoPath);
        videoSize = stats.size;
        sourceInfo = {
          source: 'FILE_UPLOAD',
          video_size: videoSize,
          chunk_size: videoSize,
          total_chunk_count: 1,
        };
      }

      const body = {
        post_info: {
          title: caption.substring(0, 2200), // TikTok caption limit
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          video_cover_timestamp_ms: 1000,
        },
        source_info: sourceInfo,
      };

      const res = await axios.post(initUrl, body, {
        headers: {
          Authorization: `Bearer ${config.tiktok.accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
      });

      const publishId = res.data.data?.publish_id;
      const uploadUrl = res.data.data?.upload_url;

      // If FILE_UPLOAD, upload the binary buffer to the provided upload_url
      if (!isUrl && uploadUrl) {
        const fileBuffer = fs.readFileSync(params.videoPath);
        await axios.put(uploadUrl, fileBuffer, {
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
            'Content-Length': videoSize.toString(),
          },
        });
      }

      return {
        platform: this.id,
        success: true,
        postId: publishId,
        postUrl: 'https://www.tiktok.com',
        details: res.data.data,
      };
    } catch (err: any) {
      return {
        platform: this.id,
        success: false,
        error: err.response?.data?.error?.message || err.message || 'Failed to post video to TikTok',
      };
    }
  }
}
