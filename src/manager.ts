import { BasePlatformAdapter } from './adapters/base.js';
import { FacebookAdapter } from './adapters/facebook.js';
import { InstagramAdapter } from './adapters/instagram.js';
import { ThreadsAdapter } from './adapters/threads.js';
import { TikTokAdapter } from './adapters/tiktok.js';
import { BlueskyAdapter } from './adapters/bluesky.js';
import { MastodonAdapter } from './adapters/mastodon.js';
import { TwitterAdapter } from './adapters/twitter.js';
import { YouTubeAdapter } from './adapters/youtube.js';
import {
  PlatformId,
  PlatformStatus,
  PostResult,
  TextPostParams,
  MediaPostParams,
  ReelPostParams,
} from './types.js';

export class SocialMediaManager {
  private adapters: Map<PlatformId, BasePlatformAdapter> = new Map();

  constructor() {
    this.registerAdapter(new FacebookAdapter());
    this.registerAdapter(new InstagramAdapter());
    this.registerAdapter(new ThreadsAdapter());
    this.registerAdapter(new TikTokAdapter());
    this.registerAdapter(new BlueskyAdapter());
    this.registerAdapter(new MastodonAdapter());
    this.registerAdapter(new TwitterAdapter());
    this.registerAdapter(new YouTubeAdapter());
  }

  private registerAdapter(adapter: BasePlatformAdapter) {
    this.adapters.set(adapter.id, adapter);
  }

  getAdapter(id: PlatformId): BasePlatformAdapter | undefined {
    return this.adapters.get(id);
  }

  getAllStatuses(): PlatformStatus[] {
    return Array.from(this.adapters.values()).map((adapter) => adapter.getStatus());
  }

  private resolvePlatforms(target: PlatformId[] | 'all'): BasePlatformAdapter[] {
    if (target === 'all') {
      // Pick all configured adapters
      return Array.from(this.adapters.values()).filter((a) => a.isConfigured());
    }

    return target
      .map((id) => this.adapters.get(id))
      .filter((a): a is BasePlatformAdapter => Boolean(a));
  }

  async postText(
    target: PlatformId[] | 'all',
    params: TextPostParams
  ): Promise<PostResult[]> {
    const selectedAdapters = this.resolvePlatforms(target);

    if (selectedAdapters.length === 0) {
      return [
        {
          platform: 'facebook',
          success: false,
          error:
            target === 'all'
              ? 'No platforms are currently configured in your .env file.'
              : 'None of the specified platforms exist or are configured.',
        },
      ];
    }

    const promises = selectedAdapters.map(async (adapter) => {
      try {
        if (!adapter.getCapabilities().text) {
          return {
            platform: adapter.id,
            success: false,
            error: `${adapter.name} does not support text-only posts (requires image/video).`,
          };
        }
        return await adapter.postText(params);
      } catch (err: any) {
        return {
          platform: adapter.id,
          success: false,
          error: err.message || 'Unexpected error while posting text',
        };
      }
    });

    return Promise.all(promises);
  }

  async postMedia(
    target: PlatformId[] | 'all',
    params: MediaPostParams
  ): Promise<PostResult[]> {
    const selectedAdapters = this.resolvePlatforms(target);

    if (selectedAdapters.length === 0) {
      return [
        {
          platform: 'facebook',
          success: false,
          error: 'No valid or configured platforms selected for media posting.',
        },
      ];
    }

    const promises = selectedAdapters.map(async (adapter) => {
      try {
        if (!adapter.getCapabilities().media) {
          return {
            platform: adapter.id,
            success: false,
            error: `${adapter.name} does not support this media post type.`,
          };
        }
        return await adapter.postMedia(params);
      } catch (err: any) {
        return {
          platform: adapter.id,
          success: false,
          error: err.message || 'Unexpected error while posting media',
        };
      }
    });

    return Promise.all(promises);
  }

  async postReel(
    target: PlatformId[] | 'all',
    params: ReelPostParams
  ): Promise<PostResult[]> {
    const selectedAdapters = this.resolvePlatforms(target);

    if (selectedAdapters.length === 0) {
      return [
        {
          platform: 'facebook',
          success: false,
          error: 'No valid or configured platforms selected for reel/short posting.',
        },
      ];
    }

    const promises = selectedAdapters.map(async (adapter) => {
      try {
        if (!adapter.getCapabilities().reel) {
          return {
            platform: adapter.id,
            success: false,
            error: `${adapter.name} does not have native Reel/Shorts capability (or is text-first).`,
          };
        }
        return await adapter.postReel(params);
      } catch (err: any) {
        return {
          platform: adapter.id,
          success: false,
          error: err.message || 'Unexpected error while uploading reel/short',
        };
      }
    });

    return Promise.all(promises);
  }
}
