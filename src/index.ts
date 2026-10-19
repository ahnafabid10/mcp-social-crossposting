#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SocialMediaManager } from './manager.js';
import { PlatformId } from './types.js';

const manager = new SocialMediaManager();

const server = new Server(
  {
    name: 'social-media-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 1. List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_social_platforms',
        description:
          'Lists all supported social media platforms (Facebook, Instagram, Threads, TikTok, Bluesky, Mastodon, X, YouTube), displaying which ones are authenticated via .env and what features they support (text, media, reels).',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'post_social_text',
        description:
          'Publishes a text status/update to one or multiple social media platforms, or to all configured platforms at once.',
        inputSchema: {
          type: 'object',
          properties: {
            platforms: {
              type: 'array',
              items: {
                type: 'string',
                enum: [
                  'all',
                  'facebook',
                  'threads',
                  'bluesky',
                  'mastodon',
                  'twitter',
                ],
              },
              description:
                'Target platform IDs or ["all"] to post to every configured text-supporting platform.',
            },
            content: {
              type: 'string',
              description: 'The text message / update to post.',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional hashtags to append (e.g. ["tech", "ai", "coding"]).',
            },
          },
          required: ['platforms', 'content'],
        },
      },
      {
        name: 'post_social_media',
        description:
          'Publishes an image or standard video with a caption/text to chosen social media platforms.',
        inputSchema: {
          type: 'object',
          properties: {
            platforms: {
              type: 'array',
              items: {
                type: 'string',
                enum: [
                  'all',
                  'facebook',
                  'instagram',
                  'threads',
                  'bluesky',
                  'mastodon',
                  'twitter',
                  'tiktok',
                  'youtube',
                ],
              },
              description: 'Target platform IDs or ["all"].',
            },
            content: {
              type: 'string',
              description: 'Caption or status message accompanying the media.',
            },
            mediaPath: {
              type: 'string',
              description: 'Absolute local file path or public HTTP/HTTPS URL of the image/video.',
            },
            mediaType: {
              type: 'string',
              enum: ['image', 'video'],
              description: 'Whether the media file is an image or a video.',
            },
            title: {
              type: 'string',
              description: 'Optional title for the post/video.',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional hashtags to append.',
            },
          },
          required: ['platforms', 'content', 'mediaPath', 'mediaType'],
        },
      },
      {
        name: 'upload_social_reel_or_short',
        description:
          'Uploads and publishes a short-form vertical video (Reel / Short / TikTok) to supported video platforms (YouTube Shorts, Facebook Reels, Instagram Reels, TikTok, Threads).',
        inputSchema: {
          type: 'object',
          properties: {
            platforms: {
              type: 'array',
              items: {
                type: 'string',
                enum: [
                  'all',
                  'youtube',
                  'facebook',
                  'instagram',
                  'tiktok',
                  'threads',
                  'bluesky',
                ],
              },
              description:
                'Platforms to upload the reel/short to, or ["all"] for all video-enabled platforms.',
            },
            videoPath: {
              type: 'string',
              description: 'Absolute local path or public URL of the .mp4 video file.',
            },
            title: {
              type: 'string',
              description: 'Title of the reel or short.',
            },
            description: {
              type: 'string',
              description: 'Description/caption of the reel or short.',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Hashtags to append (e.g. ["shorts", "reels", "viral"]).',
            },
          },
          required: ['platforms', 'videoPath', 'title', 'description'],
        },
      },
    ],
  };
});

// 2. Handle Tool Invocations
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'list_social_platforms') {
      const statuses = manager.getAllStatuses();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(statuses, null, 2),
          },
        ],
      };
    }

    if (name === 'post_social_text') {
      const { platforms, content, tags } = args as {
        platforms: string[];
        content: string;
        tags?: string[];
      };

      const target = platforms.includes('all') ? 'all' : (platforms as PlatformId[]);
      const results = await manager.postText(target, { content, tags });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                summary: `Dispatched text post to ${results.length} platform(s).`,
                results,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (name === 'post_social_media') {
      const { platforms, content, mediaPath, mediaType, title, tags } = args as {
        platforms: string[];
        content: string;
        mediaPath: string;
        mediaType: 'image' | 'video';
        title?: string;
        tags?: string[];
      };

      const target = platforms.includes('all') ? 'all' : (platforms as PlatformId[]);
      const results = await manager.postMedia(target, {
        content,
        mediaPath,
        mediaType,
        title,
        tags,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                summary: `Dispatched media post to ${results.length} platform(s).`,
                results,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (name === 'upload_social_reel_or_short') {
      const { platforms, videoPath, title, description, tags } = args as {
        platforms: string[];
        videoPath: string;
        title: string;
        description: string;
        tags?: string[];
      };

      const target = platforms.includes('all') ? 'all' : (platforms as PlatformId[]);
      const results = await manager.postReel(target, {
        videoPath,
        title,
        description,
        tags,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                summary: `Dispatched reel/short upload to ${results.length} platform(s).`,
                results,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error: any) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Error executing ${name}: ${error.message || String(error)}`,
        },
      ],
    };
  }
});

// 3. Start Stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Universal Social Media MCP Server running on stdio');
}

main().catch((err) => {
  console.error('Fatal MCP Server error:', err);
  process.exit(1);
});
