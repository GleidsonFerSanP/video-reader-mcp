#!/usr/bin/env node

/**
 * MCP Video Reader Server
 * 
 * Implements Context Engineering & Progressive Context Enrichment principles:
 * 
 * 1. PROGRESSIVE DISCLOSURE: Start with lightweight overview, fetch details on demand
 * 2. TOKEN EFFICIENCY: Minimize context consumption while maximizing utility
 * 3. CONTEXT HINTS: Guide LLM behavior with actionable suggestions
 * 4. GRANULAR TOOLS: Small, focused tools instead of monolithic operations
 * 
 * Recommended workflow:
 * 1. get_video_overview - Get lightweight metadata and frame references
 * 2. get_frame - Fetch specific frames on demand
 * 3. extract_audio - Get audio for transcription if needed
 * 
 * Avoid: analyze_video_full (high context cost) unless comprehensive analysis is needed
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { VideoProcessor } from './video-processor.js';
import { promises as fs } from 'fs';
import path from 'path';

const processor = new VideoProcessor();

// =============================================================================
// TOOL DEFINITIONS - Following Context Engineering best practices
// =============================================================================

const TOOLS: Tool[] = [
  // ---------------------------------------------------------------------------
  // TIER 1: DISCOVERY TOOLS (Lightweight, use first)
  // ---------------------------------------------------------------------------
  {
    name: 'get_video_overview',
    description: `Get video metadata and frame timestamps without extracting images. Returns ~200 tokens.

Use FIRST to plan analysis. Then use get_frame for specific timestamps.`,
    inputSchema: {
      type: 'object',
      properties: {
        videoPath: {
          type: 'string',
          description: 'Absolute path to video',
        },
        frameCount: {
          type: 'number',
          description: 'Frame reference points (default: 10)',
          default: 10,
        },
      },
      required: ['videoPath'],
    },
  },
  {
    name: 'get_video_metadata',
    description: `Get technical specs only: duration, resolution, fps, codec, format, bitrate, has audio. ~100 tokens.`,
    inputSchema: {
      type: 'object',
      properties: {
        videoPath: {
          type: 'string',
          description: 'Absolute path to video',
        },
      },
      required: ['videoPath'],
    },
  },
  {
    name: 'estimate_analysis_cost',
    description: `Estimate token cost before extracting frames. Use to plan approach and avoid context overflow.`,
    inputSchema: {
      type: 'object',
      properties: {
        videoPath: {
          type: 'string',
          description: 'Absolute path to video',
        },
        frameCount: {
          type: 'number',
          description: 'Frames to estimate',
          default: 10,
        },
      },
      required: ['videoPath'],
    },
  },

  // ---------------------------------------------------------------------------
  // TIER 2: PROGRESSIVE FETCH TOOLS (Fetch specific data on demand)
  // ---------------------------------------------------------------------------
  {
    name: 'get_frame',
    description: `Extract single frame at timestamp. Returns base64 JPEG (~5-15K tokens).

Primary tool for progressive analysis: get_video_overview first, then fetch specific frames.`,
    inputSchema: {
      type: 'object',
      properties: {
        videoPath: {
          type: 'string',
          description: 'Absolute path to video',
        },
        timestamp: {
          type: 'number',
          description: 'Timestamp in seconds',
        },
        maxWidth: {
          type: 'number',
          description: 'Max width pixels (default: 1920)',
          default: 1920,
        },
        format: {
          type: 'string',
          enum: ['jpeg', 'png'],
          description: 'jpeg (smaller) or png (lossless)',
          default: 'jpeg',
        },
        quality: {
          type: 'number',
          description: 'JPEG quality 1-100 (default: 80)',
          default: 80,
        },
      },
      required: ['videoPath', 'timestamp'],
    },
  },
  {
    name: 'get_frames_batch',
    description: `Extract multiple frames at specific timestamps. Limited to 5 frames (~25-75K tokens).

For long videos, prefer get_frame progressively.`,
    inputSchema: {
      type: 'object',
      properties: {
        videoPath: {
          type: 'string',
          description: 'Absolute path to video',
        },
        timestamps: {
          type: 'array',
          items: { type: 'number' },
          description: 'Timestamps in seconds (max 5)',
        },
        maxWidth: {
          type: 'number',
          description: 'Max width pixels (default: 1920)',
          default: 1920,
        },
        format: {
          type: 'string',
          enum: ['jpeg', 'png'],
          default: 'jpeg',
        },
      },
      required: ['videoPath', 'timestamps'],
    },
  },
  {
    name: 'extract_audio',
    description: `Extract audio track to MP3/WAV. Returns file path for transcription. Supports time segments.`,
    inputSchema: {
      type: 'object',
      properties: {
        videoPath: {
          type: 'string',
          description: 'Absolute path to video',
        },
        format: {
          type: 'string',
          enum: ['mp3', 'wav'],
          description: 'mp3 (smaller) or wav (lossless)',
          default: 'mp3',
        },
        bitrate: {
          type: 'string',
          enum: ['64k', '128k', '192k', '256k'],
          default: '128k',
        },
        startTime: {
          type: 'number',
          description: 'Segment start (seconds)',
        },
        endTime: {
          type: 'number',
          description: 'Segment end (seconds)',
        },
      },
      required: ['videoPath'],
    },
  },

  // ---------------------------------------------------------------------------
  // TIER 3: COMPREHENSIVE TOOLS (High context cost - use sparingly)
  // ---------------------------------------------------------------------------
  {
    name: 'analyze_video_full',
    description: `Full analysis: metadata + multiple frames + audio. 50K-150K+ tokens.

Only for short videos (<1 min). Otherwise use: get_video_overview → get_frame → extract_audio.`,
    inputSchema: {
      type: 'object',
      properties: {
        videoPath: {
          type: 'string',
          description: 'Absolute path to video',
        },
        maxFrames: {
          type: 'number',
          description: 'Frames to extract (default: 8, max: 15)',
          default: 8,
        },
        extractAudio: {
          type: 'boolean',
          description: 'Extract audio track',
          default: true,
        },
        frameInterval: {
          type: 'number',
          description: 'Seconds between frames (auto if omitted)',
        },
      },
      required: ['videoPath'],
    },
  },
];

// =============================================================================
// SERVER SETUP
// =============================================================================

const server = new Server(
  {
    name: 'mcp-video-reader',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// =============================================================================
// TOOL HANDLERS
// =============================================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Helper to check file exists
    const checkFile = async (filePath: string) => {
      try {
        await fs.access(filePath);
        return true;
      } catch {
        return false;
      }
    };

    switch (name) {
      // -----------------------------------------------------------------------
      // TIER 1: DISCOVERY TOOLS
      // -----------------------------------------------------------------------
      case 'get_video_overview': {
        const { videoPath, frameCount = 10 } = args as {
          videoPath: string;
          frameCount?: number;
        };

        if (!await checkFile(videoPath)) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `File not found: ${videoPath}`,
                hint: 'Please provide an absolute path to an existing video file.',
              }, null, 2),
            }],
          };
        }

        const overview = await processor.getVideoOverview(videoPath, { frameCount });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              overview: {
                filename: overview.filename,
                metadata: overview.metadata,
                audio: overview.audio,
                availableFrames: overview.availableFrames,
              },
              contextHints: overview.contextHints,
              nextSteps: [
                'Use get_frame with a specific timestamp to fetch frame data for visual analysis',
                'Use extract_audio if you need to transcribe spoken content',
              ],
            }, null, 2),
          }],
        };
      }

      case 'get_video_metadata': {
        const { videoPath } = args as { videoPath: string };

        if (!await checkFile(videoPath)) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `File not found: ${videoPath}`,
              }, null, 2),
            }],
          };
        }

        const metadata = await processor.getMetadata(videoPath);
        const summary = await processor.getMetadataSummary(videoPath);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              filename: path.basename(videoPath),
              summary: summary.humanDescription,
              metadata: {
                duration: summary.durationFormatted,
                durationSeconds: metadata.duration,
                resolution: summary.resolution,
                fps: metadata.fps,
                codec: metadata.codec,
                format: metadata.format,
                bitrate: `${Math.round(metadata.bitrate / 1000)} kbps`,
                hasAudio: metadata.hasAudio,
              },
              analysisHints: summary.analysisHints,
            }, null, 2),
          }],
        };
      }

      case 'estimate_analysis_cost': {
        const { videoPath, frameCount = 10 } = args as {
          videoPath: string;
          frameCount?: number;
        };

        if (!await checkFile(videoPath)) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `File not found: ${videoPath}`,
              }, null, 2),
            }],
          };
        }

        const estimate = await processor.estimateTokens(videoPath, { frameCount });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              estimate: {
                metadataTokens: estimate.metadata,
                tokensPerFrame: estimate.perFrame,
                totalForFrames: frameCount * estimate.perFrame,
                totalEstimated: estimate.total,
                warning: estimate.warning,
              },
              recommendation: estimate.warning
                ? 'Consider using progressive frame fetching (get_frame) instead of full analysis'
                : 'Context budget is manageable for this analysis',
            }, null, 2),
          }],
        };
      }

      // -----------------------------------------------------------------------
      // TIER 2: PROGRESSIVE FETCH TOOLS
      // -----------------------------------------------------------------------
      case 'get_frame': {
        const {
          videoPath,
          timestamp,
          maxWidth = 1920,
          format = 'jpeg',
          quality = 80,
        } = args as {
          videoPath: string;
          timestamp: number;
          maxWidth?: number;
          format?: 'jpeg' | 'png';
          quality?: number;
        };

        if (!await checkFile(videoPath)) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `File not found: ${videoPath}`,
              }, null, 2),
            }],
          };
        }

        const frame = await processor.extractSingleFrame(videoPath, timestamp, {
          maxWidth,
          format,
          quality,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                frame: {
                  timestamp: frame.timestamp,
                  timestampFormatted: frame.timestampFormatted,
                  resolution: frame.resolution,
                  mimeType: frame.mimeType,
                  estimatedTokens: frame.estimatedTokens,
                },
              }, null, 2),
            },
            {
              type: 'image',
              data: frame.base64,
              mimeType: frame.mimeType,
            },
          ],
        };
      }

      case 'get_frames_batch': {
        const {
          videoPath,
          timestamps,
          maxWidth = 1920,
          format = 'jpeg',
        } = args as {
          videoPath: string;
          timestamps: number[];
          maxWidth?: number;
          format?: 'jpeg' | 'png';
        };

        if (!await checkFile(videoPath)) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `File not found: ${videoPath}`,
              }, null, 2),
            }],
          };
        }

        // Limit to 5 frames for context management
        const limitedTimestamps = timestamps.slice(0, 5);
        if (timestamps.length > 5) {
          console.error(`Warning: Limited from ${timestamps.length} to 5 frames for context management`);
        }

        const frames = await Promise.all(
          limitedTimestamps.map(ts =>
            processor.extractSingleFrame(videoPath, ts, { maxWidth, format, quality: 80 })
          )
        );

        const content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> = [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              framesExtracted: frames.length,
              totalTimestampsRequested: timestamps.length,
              limited: timestamps.length > 5,
              frames: frames.map(f => ({
                timestamp: f.timestamp,
                timestampFormatted: f.timestampFormatted,
                resolution: f.resolution,
                estimatedTokens: f.estimatedTokens,
              })),
            }, null, 2),
          },
        ];

        // Add each frame as image
        for (const frame of frames) {
          content.push({
            type: 'image',
            data: frame.base64,
            mimeType: frame.mimeType,
          });
        }

        return { content };
      }

      case 'extract_audio': {
        const {
          videoPath,
          format = 'mp3',
          bitrate = '128k',
          startTime,
          endTime,
        } = args as {
          videoPath: string;
          format?: 'mp3' | 'wav';
          bitrate?: '64k' | '128k' | '192k' | '256k';
          startTime?: number;
          endTime?: number;
        };

        if (!await checkFile(videoPath)) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `File not found: ${videoPath}`,
              }, null, 2),
            }],
          };
        }

        // Check if video has audio
        const metadata = await processor.getMetadata(videoPath);
        if (!metadata.hasAudio) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Video does not have an audio track',
              }, null, 2),
            }],
          };
        }

        const audioPath = await processor.extractAudio(videoPath, {
          format,
          bitrate,
          startTime,
          endTime,
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              audioPath,
              format,
              segment: startTime !== undefined ? {
                startTime,
                endTime: endTime || metadata.duration,
              } : 'full',
              nextStep: 'Use this audio path with a transcription service to get the spoken content.',
            }, null, 2),
          }],
        };
      }

      // -----------------------------------------------------------------------
      // TIER 3: COMPREHENSIVE TOOLS
      // -----------------------------------------------------------------------
      case 'analyze_video_full': {
        const {
          videoPath,
          maxFrames = 8,
          extractAudio = true,
          frameInterval,
        } = args as {
          videoPath: string;
          maxFrames?: number;
          extractAudio?: boolean;
          frameInterval?: number;
        };

        if (!await checkFile(videoPath)) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `File not found: ${videoPath}`,
              }, null, 2),
            }],
          };
        }

        // Warn if requesting many frames
        const estimate = await processor.estimateTokens(videoPath, { frameCount: maxFrames });
        
        const analysis = await processor.analyzeVideo(videoPath, {
          extractFrames: true,
          maxFrames: Math.min(maxFrames, 15), // Cap at 15 frames
          extractAudio,
          frameInterval,
        });

        const summary = await processor.getMetadataSummary(videoPath);

        const content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> = [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              contextWarning: estimate.warning,
              video: {
                filename: path.basename(videoPath),
                summary: summary.humanDescription,
                duration: summary.durationFormatted,
                resolution: summary.resolution,
              },
              metadata: {
                durationSeconds: analysis.metadata.duration,
                fps: analysis.metadata.fps,
                codec: analysis.metadata.codec,
                format: analysis.metadata.format,
                bitrate: `${Math.round(analysis.metadata.bitrate / 1000)} kbps`,
                hasAudio: analysis.metadata.hasAudio,
              },
              framesExtracted: analysis.frames.length,
              frames: analysis.frames.map((f, i) => ({
                index: i + 1,
                timestamp: f.timestamp,
                timestampFormatted: processor.formatTimestamp(f.timestamp),
                resolution: `${f.width}x${f.height}`,
              })),
              audioExtracted: !!analysis.audioPath,
              audioPath: analysis.audioPath,
            }, null, 2),
          },
        ];

        // Add frames as images
        for (const frame of analysis.frames) {
          content.push({
            type: 'image',
            data: frame.base64,
            mimeType: 'image/jpeg',
          });
        }

        return { content };
      }

      default:
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Unknown tool: ${name}`,
              availableTools: TOOLS.map(t => t.name),
            }, null, 2),
          }],
        };
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          hint: 'Check that the video file exists and is in a supported format.',
        }, null, 2),
      }],
      isError: true,
    };
  }
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Video Reader Server v2.0 started');
  console.error('Implements: Context Engineering & Progressive Context Enrichment');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
