import {
  PlatformId,
  PlatformStatus,
  PostResult,
  TextPostParams,
  MediaPostParams,
  ReelPostParams,
} from '../types.js';

import { tokenStorage } from '../storage.js';

export abstract class BasePlatformAdapter {
  abstract readonly id: PlatformId;
  abstract readonly name: string;

  abstract isConfigured(): boolean;
  abstract getMissingEnv(): string[];

  abstract getCapabilities(): {
    text: boolean;
    media: boolean;
    reel: boolean;
  };

  abstract postText(params: TextPostParams): Promise<PostResult>;
  abstract postMedia(params: MediaPostParams): Promise<PostResult>;
  abstract postReel(params: ReelPostParams): Promise<PostResult>;

  getStatus(): PlatformStatus {
    const isConf = this.isConfigured();
    const stored = tokenStorage.get(this.id as any);
    let authSource: 'oauth' | 'env' | 'none' = 'none';

    if (isConf) {
      authSource = stored?.accessToken || stored?.refreshToken ? 'oauth' : 'env';
    }

    return {
      id: this.id,
      name: this.name,
      configured: isConf,
      authSource,
      accountName: stored?.accountName,
      missingEnvVars: this.getMissingEnv(),
      capabilities: this.getCapabilities(),
    };
  }

  protected appendTags(text: string, tags?: string[]): string {
    if (!tags || tags.length === 0) return text;
    const formattedTags = tags
      .map((t) => (t.startsWith('#') ? t : `#${t}`))
      .join(' ');
    return `${text}\n\n${formattedTags}`;
  }
}
