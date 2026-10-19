import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store tokens in root directory as tokens.json
const STORAGE_FILE = path.resolve(process.cwd(), 'tokens.json');

export interface StoredPlatformTokens {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  accountId?: string;
  accountName?: string;
  extra?: Record<string, any>;
}

export interface TokensDatabase {
  facebook?: StoredPlatformTokens;
  instagram?: StoredPlatformTokens;
  threads?: StoredPlatformTokens;
  tiktok?: StoredPlatformTokens;
  bluesky?: StoredPlatformTokens;
  mastodon?: StoredPlatformTokens;
  twitter?: StoredPlatformTokens;
  youtube?: StoredPlatformTokens;
}

class TokenStorage {
  private db: TokensDatabase = {};

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(STORAGE_FILE)) {
        const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
        this.db = JSON.parse(raw);
      } else {
        this.db = {};
      }
    } catch (err) {
      console.error('Error reading tokens.json:', err);
      this.db = {};
    }
  }

  save() {
    try {
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(this.db, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving tokens.json:', err);
    }
  }

  get(platform: keyof TokensDatabase): StoredPlatformTokens | undefined {
    this.load();
    return this.db[platform];
  }

  set(platform: keyof TokensDatabase, tokens: StoredPlatformTokens) {
    this.load();
    this.db[platform] = {
      ...this.db[platform],
      ...tokens,
    };
    this.save();
  }

  remove(platform: keyof TokensDatabase) {
    this.load();
    delete this.db[platform];
    this.save();
  }

  getAll(): TokensDatabase {
    this.load();
    return this.db;
  }
}

export const tokenStorage = new TokenStorage();
