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

  // ---------------------------------------------------------------------------
  // TIER 2.5: SMART ANALYSIS TOOLS (Scene detection, chunks, streaming)
  // ---------------------------------------------------------------------------
  {
    name: 'detect_scenes',
    description: `Detect scene changes in video. Returns timestamps where significant visual changes occur. ~200 tokens.

Use to find key moments without extracting all frames. Then use get_scene_frames for visual data.`,
    inputSchema: {
      type: 'object',
      properties: {
        videoPath: {
          type: 'string',
          description: 'Absolute path to video',
        },
        threshold: {
          type: 'number',
          description: 'Detection sensitivity 0.0-1.0 (lower = more scenes). Default: 0.3',
          default: 0.3,
        },
        maxScenes: {
          type: 'number',
          description: 'Maximum scenes to detect (default: 20)',
          default: 20,
        },
        minSceneDuration: {
          type: 'number',
          description: 'Minimum scene duration in seconds (default: 1)',
          default: 1,
        },
      },
      required: ['videoPath'],
    },
  },
  {
    name: 'get_scene_frames',
    description: `Extract frames at detected scene changes. Smart alternative to evenly-spaced frames. ~10-50K tokens.

Better than get_frames_batch for videos with varying content - captures actual visual changes.`,
    inputSchema: {
      type: 'object',
      properties: {
        videoPath: {
          type: 'string',
          description: 'Absolute path to video',
        },
        threshold: {
          type: 'number',
          description: 'Scene detection sensitivity (default: 0.3)',
          default: 0.3,
        },
        maxScenes: {
          type: 'number',
          description: 'Maximum scenes/frames (default: 10)',
          default: 10,
        },
        maxWidth: {
          type: 'number',
          description: 'Max width pixels (default: 1920)',
          default: 1920,
        },
      },
      required: ['videoPath'],
    },
  },
  {
    name: 'get_video_chunks',
    description: `Divide video into chunks for progressive analysis. Returns chunk metadata without extracting content.

Use for long videos: get chunks list, then analyze_chunk for each segment progressively.`,
    inputSchema: {
      type: 'object',
      properties: {
        videoPath: {
          type: 'string',
          description: 'Absolute path to video',
        },
        chunkDuration: {
          type: 'number',
          description: 'Duration of each chunk in seconds (default: 30)',
          default: 30,
        },
      },
      required: ['videoPath'],
    },
  },
  {
    name: 'analyze_chunk',
    description: `Analyze a specific chunk of the video. Returns keyframe + optional audio. ~15-25K tokens.

Progressive analysis workflow: get_video_chunks → analyze_chunk(0) → analyze_chunk(1) → ...`,
    inputSchema: {
      type: 'object',
      properties: {
        videoPath: {
          type: 'string',
          description: 'Absolute path to video',
        },
        chunkIndex: {
          type: 'number',
          description: 'Chunk index to analyze (0-based)',
        },
        chunkDuration: {
          type: 'number',
          description: 'Chunk duration in seconds (default: 30)',
          default: 30,
        },
        includeAudio: {
          type: 'boolean',
          description: 'Extract audio segment for this chunk',
          default: false,
        },
      },
      required: ['videoPath', 'chunkIndex'],
    },
  },

  // ---------------------------------------------------------------------------
  // TIER 2.6: STREAM ANALYSIS - Progressive watching simulation
  // ---------------------------------------------------------------------------
  {
    name: 'stream_start',
    description: `Start streaming analysis of a video. Simulates progressively watching a video.

Best for long videos. Returns first segment, then use stream_next to continue. State is maintained.`,
    inputSchema: {
      type: 'object',
      properties: {
        videoPath: {
          type: 'string',
          description: 'Absolute path to video',
        },
        stepDuration: {
          type: 'number',
          description: 'Seconds per step (default: 30)',
          default: 30,
        },
        includeAudio: {
          type: 'boolean',
          description: 'Include audio extraction per step',
          default: false,
        },
        useSceneDetection: {
          type: 'boolean',
          description: 'Use smart scene detection for frame selection',
          default: true,
        },
        startPosition: {
          type: 'number',
          description: 'Start position in seconds (default: 0)',
          default: 0,
        },
      },
      required: ['videoPath'],
    },
  },
  {
    name: 'stream_next',
    description: `Continue streaming analysis. Advances to next segment.

Returns next frame + position + accumulated context. Call repeatedly until isComplete is true.`,
    inputSchema: {
      type: 'object',
      properties: {
        videoPath: {
          type: 'string',
          description: 'Absolute path to video (must match stream_start)',
        },
        stepDuration: {
          type: 'number',
          description: 'Seconds to advance (default: 30)',
          default: 30,
        },
        includeAudio: {
          type: 'boolean',
          description: 'Include audio extraction',
          default: false,
        },
      },
      required: ['videoPath'],
    },
  },
  {
    name: 'stream_status',
    description: `Get current streaming analysis status without advancing position.`,
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

  // ---------------------------------------------------------------------------
  // TIER 2.7: AUDIO TRANSCRIPTION
  // ---------------------------------------------------------------------------
  {
    name: 'transcribe_audio',
    description: `Transcribe audio from video using OpenAI Whisper API. ~100 tokens + transcript.

REQUIRES: Set OPENAI_API_KEY environment variable.
Returns full transcript with timed segments for correlation with video. 
Generates VTT/SRT subtitles automatically.`,
    inputSchema: {
      type: 'object',
      properties: {
        videoPath: {
          type: 'string',
          description: 'Absolute path to video',
        },
        subtitleFormat: {
          type: 'string',
          enum: ['vtt', 'srt', 'none'],
          description: 'Output subtitle format (default: vtt)',
          default: 'vtt',
        },
        startTime: {
          type: 'number',
          description: 'Start time in seconds (optional, for segments)',
        },
        endTime: {
          type: 'number',
          description: 'End time in seconds (optional, for segments)',
        },
        language: {
          type: 'string',
          description: 'Language code for better accuracy (e.g., "en", "pt", "es", "ja")',
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
    version: '3.0.0',
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

      // -----------------------------------------------------------------------
      // TIER 2.5: SMART ANALYSIS TOOLS
      // -----------------------------------------------------------------------
      case 'detect_scenes': {
        const {
          videoPath,
          threshold = 0.3,
          maxScenes = 20,
          minSceneDuration = 1,
        } = args as {
          videoPath: string;
          threshold?: number;
          maxScenes?: number;
          minSceneDuration?: number;
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

        const detection = await processor.detectScenes(videoPath, {
          threshold,
          maxScenes,
          minSceneDuration,
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              totalScenes: detection.totalScenes,
              threshold: detection.threshold,
              scenes: detection.scenes.map(s => ({
                index: s.index,
                timeRange: `${processor.formatTimestamp(s.startTime)}-${processor.formatTimestamp(s.endTime)}`,
                duration: `${s.duration.toFixed(1)}s`,
                keyFrameTimestamp: s.keyFrameTimestamp,
              })),
              suggestedKeyframes: detection.suggestedKeyframes.map(f => ({
                timestamp: f.timestamp,
                timestampFormatted: f.timestampFormatted,
                estimatedTokens: f.estimatedTokens,
              })),
              contextHints: detection.contextHints,
              nextSteps: [
                'Use get_scene_frames to extract frames at detected scene changes',
                'Use get_frame with specific keyFrameTimestamp for individual scenes',
              ],
            }, null, 2),
          }],
        };
      }

      case 'get_scene_frames': {
        const {
          videoPath,
          threshold = 0.3,
          maxScenes = 10,
          maxWidth = 1920,
        } = args as {
          videoPath: string;
          threshold?: number;
          maxScenes?: number;
          maxWidth?: number;
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

        const result = await processor.extractSceneFrames(videoPath, {
          threshold,
          maxScenes,
          maxWidth,
          format: 'jpeg',
        });

        const content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> = [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              scenesDetected: result.scenes.length,
              scenes: result.scenes.map((s, i) => ({
                index: s.index,
                timeRange: `${processor.formatTimestamp(s.startTime)}-${processor.formatTimestamp(s.endTime)}`,
                keyFrame: processor.formatTimestamp(s.keyFrameTimestamp),
                resolution: result.frames[i]?.resolution,
              })),
            }, null, 2),
          },
        ];

        // Add scene frames as images
        for (const frame of result.frames) {
          content.push({
            type: 'image',
            data: frame.base64,
            mimeType: frame.mimeType,
          });
        }

        return { content };
      }

      case 'get_video_chunks': {
        const {
          videoPath,
          chunkDuration = 30,
        } = args as {
          videoPath: string;
          chunkDuration?: number;
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

        const chunks = await processor.createChunks(videoPath, { chunkDuration });
        const metadata = await processor.getMetadataSummary(videoPath);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              video: {
                description: metadata.humanDescription,
                duration: metadata.durationFormatted,
              },
              totalChunks: chunks.length,
              chunkDuration: `${chunkDuration}s`,
              chunks: chunks.map(c => ({
                index: c.index,
                timeRange: c.timeRange,
                duration: `${c.duration.toFixed(1)}s`,
              })),
              workflow: [
                'Call analyze_chunk with chunkIndex=0 to start',
                'Review the frame and audio (if enabled)',
                'Continue with analyze_chunk for subsequent indices',
                'Build understanding progressively',
              ],
            }, null, 2),
          }],
        };
      }

      case 'analyze_chunk': {
        const {
          videoPath,
          chunkIndex,
          chunkDuration = 30,
          includeAudio = false,
        } = args as {
          videoPath: string;
          chunkIndex: number;
          chunkDuration?: number;
          includeAudio?: boolean;
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

        try {
          const result = await processor.analyzeChunk(videoPath, chunkIndex, {
            chunkDuration,
            includeAudio,
          });

          const content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> = [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                chunk: {
                  index: result.chunk.index,
                  timeRange: result.chunk.timeRange,
                  duration: `${result.chunk.duration.toFixed(1)}s`,
                },
                progress: result.progress,
                frame: {
                  timestamp: result.frame.timestamp,
                  timestampFormatted: result.frame.timestampFormatted,
                  resolution: result.frame.resolution,
                },
                audioSegmentPath: result.audioSegmentPath,
                contextHints: result.contextHints,
              }, null, 2),
            },
            {
              type: 'image',
              data: result.frame.base64,
              mimeType: result.frame.mimeType,
            },
          ];

          return { content };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : String(error),
              }, null, 2),
            }],
          };
        }
      }

      // -----------------------------------------------------------------------
      // TIER 2.6: STREAM ANALYSIS
      // -----------------------------------------------------------------------
      case 'stream_start': {
        const {
          videoPath,
          stepDuration = 30,
          includeAudio = false,
          useSceneDetection = true,
          startPosition = 0,
        } = args as {
          videoPath: string;
          stepDuration?: number;
          includeAudio?: boolean;
          useSceneDetection?: boolean;
          startPosition?: number;
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

        // Initialize and get first step
        await processor.initStreamAnalysis(videoPath, { startPosition });
        const step = await processor.getStreamStep(videoPath, {
          stepDuration,
          includeAudio,
          useSceneDetection,
        });

        const content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> = [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              streamStarted: true,
              position: step.position,
              scenesInSegment: step.scenesInSegment?.length || 0,
              state: {
                analyzedChunks: step.state.analyzedChunks.length,
                isComplete: step.state.isComplete,
              },
              contextHints: step.contextHints,
            }, null, 2),
          },
          {
            type: 'image',
            data: step.frame.base64,
            mimeType: step.frame.mimeType,
          },
        ];

        return { content };
      }

      case 'stream_next': {
        const {
          videoPath,
          stepDuration = 30,
          includeAudio = false,
        } = args as {
          videoPath: string;
          stepDuration?: number;
          includeAudio?: boolean;
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

        const state = processor.getStreamState(videoPath);
        if (!state) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'No active stream for this video. Use stream_start first.',
                hint: 'Call stream_start to initialize streaming analysis.',
              }, null, 2),
            }],
          };
        }

        if (state.isComplete) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                isComplete: true,
                message: 'Stream analysis already complete.',
                summary: {
                  totalDuration: processor.formatTimestamp(state.totalDuration),
                  chunksAnalyzed: state.analyzedChunks.length,
                  observations: state.observations,
                  keyEvents: state.keyEvents,
                },
              }, null, 2),
            }],
          };
        }

        const step = await processor.getStreamStep(videoPath, {
          stepDuration,
          includeAudio,
        });

        const content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> = [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              position: step.position,
              scenesInSegment: step.scenesInSegment?.length || 0,
              state: {
                analyzedChunks: step.state.analyzedChunks.length,
                isComplete: step.state.isComplete,
                observations: step.state.observations,
                keyEvents: step.state.keyEvents,
              },
              contextHints: step.contextHints,
            }, null, 2),
          },
          {
            type: 'image',
            data: step.frame.base64,
            mimeType: step.frame.mimeType,
          },
        ];

        return { content };
      }

      case 'stream_status': {
        const { videoPath } = args as { videoPath: string };

        const state = processor.getStreamState(videoPath);
        if (!state) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'No active stream for this video.',
                hint: 'Use stream_start to begin streaming analysis.',
              }, null, 2),
            }],
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              state: {
                videoPath: state.videoPath,
                currentPosition: processor.formatTimestamp(state.currentPosition),
                totalDuration: processor.formatTimestamp(state.totalDuration),
                percentComplete: Math.round((state.currentPosition / state.totalDuration) * 100),
                chunksAnalyzed: state.analyzedChunks.length,
                isComplete: state.isComplete,
                observations: state.observations,
                keyEvents: state.keyEvents,
              },
            }, null, 2),
          }],
        };
      }

      // -----------------------------------------------------------------------
      // TIER 2.7: AUDIO TRANSCRIPTION
      // -----------------------------------------------------------------------
      case 'transcribe_audio': {
        const {
          videoPath,
          subtitleFormat = 'vtt',
          startTime,
          endTime,
          language,
        } = args as {
          videoPath: string;
          subtitleFormat?: 'vtt' | 'srt' | 'none';
          startTime?: number;
          endTime?: number;
          language?: string;
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

        const metadata = await processor.getMetadata(videoPath);
        if (!metadata.hasAudio) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Video does not have an audio track.',
              }, null, 2),
            }],
          };
        }

        const result = await processor.transcribeAudio(videoPath, {
          subtitleFormat,
          startTime,
          endTime,
          language,
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              audioDuration: `${result.audioDuration.toFixed(1)}s`,
              estimatedTokens: result.estimatedTokens,
              segment: startTime !== undefined ? {
                startTime: processor.formatTimestamp(startTime),
                endTime: processor.formatTimestamp(endTime || metadata.duration),
              } : 'full',
              contextHints: result.contextHints,
              transcriptionGuide: {
                usingWhisper: 'whisper audio.wav --language auto --output_format vtt',
                usingOpenAI: 'Use OpenAI Whisper API with the extracted audio file',
                usingLocal: 'Install whisper.cpp for local CPU-based transcription',
              },
            }, null, 2),
          }],
        };
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
