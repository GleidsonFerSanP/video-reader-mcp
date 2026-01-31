/**
 * Video Processor
 * 
 * Implements Context Engineering principles:
 * 1. Progressive Context Enrichment - Light overview first, details on demand
 * 2. Token Efficiency - Optimized outputs, JPEG for smaller payloads
 * 3. Context Hints - Guide LLM behavior with actionable suggestions
 */

import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import ffprobePath from '@ffprobe-installer/ffprobe';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  VideoMetadata,
  VideoMetadataSummary,
  VideoFrame,
  VideoAnalysis,
  VideoOverview,
  FrameReference,
  FrameData,
  ContextHint,
  AnalysisHint,
  TokenEstimate,
  FrameExtractionOptions,
  AudioExtractionOptions,
} from './types.js';

// Configure ffmpeg paths
ffmpeg.setFfmpegPath(ffmpegPath.path);
ffmpeg.setFfprobePath(ffprobePath.path);

// Token estimation constants (approximate)
const TOKENS_PER_KB_BASE64 = 1.33; // Base64 overhead
const TOKENS_PER_CHAR = 0.25; // Average for text
const BASE_METADATA_TOKENS = 150;
const WARNING_TOKEN_THRESHOLD = 50000;

export class VideoProcessor {
  private tempDir: string;
  private frameCache: Map<string, FrameReference[]> = new Map();

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'mcp-video-reader');
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Error creating temp directory:', error);
    }
  }

  async cleanupTempDir(): Promise<void> {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Error cleaning temp directory:', error);
    }
  }

  /**
   * Format seconds to human-readable timestamp
   */
  formatTimestamp(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }

  /**
   * Estimate token count for a base64 string
   */
  estimateBase64Tokens(base64Length: number): number {
    const kbSize = base64Length / 1024;
    return Math.ceil(kbSize * TOKENS_PER_KB_BASE64 * 1000 * TOKENS_PER_CHAR);
  }

  // ===========================================================================
  // METADATA METHODS - Lightweight initial context
  // ===========================================================================

  /**
   * Get raw video metadata
   */
  async getMetadata(videoPath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, async (err, metadata) => {
        if (err) {
          reject(new Error(`Failed to read video metadata: ${err.message}`));
          return;
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

        // Get file size
        let fileSize: number | undefined;
        try {
          const stats = await fs.stat(videoPath);
          fileSize = stats.size;
        } catch {
          // Ignore file size errors
        }

        resolve({
          duration: metadata.format.duration || 0,
          width: videoStream.width || 0,
          height: videoStream.height || 0,
          fps: eval(videoStream.r_frame_rate || '0') || 0,
          codec: videoStream.codec_name || 'unknown',
          format: metadata.format.format_name || 'unknown',
          bitrate: metadata.format.bit_rate || 0,
          hasAudio: !!audioStream,
          audioCodec: audioStream?.codec_name,
          fileSize,
        });
      });
    });
  }

  /**
   * Get human-readable metadata summary - optimized for LLM context
   * This is the PRIMARY entry point following Progressive Context Enrichment
   */
  async getMetadataSummary(videoPath: string): Promise<VideoMetadataSummary> {
    const metadata = await this.getMetadata(videoPath);
    
    // Build human description
    const resolutionLabel = this.getResolutionLabel(metadata.width, metadata.height);
    const orientation = metadata.width > metadata.height ? 'landscape' : 
                       metadata.width < metadata.height ? 'portrait' : 'square';
    const durationLabel = this.getDurationLabel(metadata.duration);
    
    const humanDescription = [
      resolutionLabel,
      orientation,
      'video',
      `${Math.round(metadata.fps)}fps`,
      durationLabel,
      metadata.hasAudio ? 'with audio' : 'no audio',
    ].join(', ');

    // Generate analysis hints based on video characteristics
    const analysisHints = this.generateAnalysisHints(metadata);

    return {
      durationFormatted: this.formatTimestamp(metadata.duration),
      resolution: `${metadata.width}x${metadata.height}`,
      humanDescription,
      analysisHints,
    };
  }

  /**
   * Get resolution label (4K, Full HD, HD, SD)
   */
  private getResolutionLabel(width: number, height: number): string {
    const pixels = width * height;
    if (pixels >= 3840 * 2160) return '4K Ultra HD';
    if (pixels >= 1920 * 1080) return 'Full HD';
    if (pixels >= 1280 * 720) return 'HD';
    if (pixels >= 854 * 480) return 'SD';
    return 'Low resolution';
  }

  /**
   * Get duration label
   */
  private getDurationLabel(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)} seconds`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }

  /**
   * Generate analysis hints based on video characteristics
   * Helps LLM decide optimal parameters
   */
  private generateAnalysisHints(metadata: VideoMetadata): AnalysisHint[] {
    const hints: AnalysisHint[] = [];

    // Duration-based hints
    if (metadata.duration < 30) {
      hints.push({
        aspect: 'duration',
        recommendation: 'Short video - extract all key frames (5-10 frames recommended)',
        parameters: { maxFrames: 10, interval: Math.max(1, metadata.duration / 10) },
      });
    } else if (metadata.duration < 300) {
      hints.push({
        aspect: 'duration',
        recommendation: 'Medium video - sample frames at regular intervals',
        parameters: { maxFrames: 15, interval: Math.floor(metadata.duration / 15) },
      });
    } else {
      hints.push({
        aspect: 'duration',
        recommendation: 'Long video - consider extracting frames progressively by time ranges',
        parameters: { maxFrames: 20, interval: Math.floor(metadata.duration / 20) },
      });
    }

    // Resolution hints
    if (metadata.width > 1920) {
      hints.push({
        aspect: 'resolution',
        recommendation: 'High resolution video - frames will be resized to 1920px max width for efficiency',
        parameters: { maxWidth: 1920 },
      });
    }

    // Audio hints
    if (metadata.hasAudio) {
      hints.push({
        aspect: 'audio',
        recommendation: 'Video has audio track - consider extracting for transcription',
      });
    }

    return hints;
  }

  // ===========================================================================
  // VIDEO OVERVIEW - Progressive Context Entry Point
  // ===========================================================================

  /**
   * Get video overview - minimal context, maximum utility
   * This is the RECOMMENDED first step for any video analysis
   */
  async getVideoOverview(
    videoPath: string,
    options: { frameCount?: number } = {}
  ): Promise<VideoOverview> {
    const { frameCount = 10 } = options;
    
    const metadata = await this.getMetadata(videoPath);
    const summary = await this.getMetadataSummary(videoPath);
    
    // Generate frame references (lightweight - no actual extraction)
    const frameInterval = Math.max(1, Math.floor(metadata.duration / frameCount));
    const availableFrames: FrameReference[] = [];
    
    for (let i = 0; i < frameCount && i * frameInterval < metadata.duration; i++) {
      const timestamp = i * frameInterval;
      availableFrames.push({
        index: i,
        timestamp,
        timestampFormatted: this.formatTimestamp(timestamp),
        resolution: `${Math.min(metadata.width, 1920)}x${Math.round(Math.min(metadata.width, 1920) * metadata.height / metadata.width)}`,
        estimatedTokens: this.estimateFrameTokens(metadata.width, metadata.height),
      });
    }

    // Cache frame references for later use
    this.frameCache.set(videoPath, availableFrames);

    // Generate context hints for LLM
    const contextHints = this.generateContextHints(metadata, availableFrames);

    return {
      videoPath,
      filename: path.basename(videoPath),
      metadata: summary,
      availableFrames,
      audio: {
        available: metadata.hasAudio,
        durationSeconds: metadata.hasAudio ? metadata.duration : undefined,
      },
      contextHints,
    };
  }

  /**
   * Estimate tokens for a frame based on resolution
   */
  private estimateFrameTokens(width: number, height: number): number {
    // Estimate based on typical JPEG compression at 80% quality
    const effectiveWidth = Math.min(width, 1920);
    const effectiveHeight = Math.round(effectiveWidth * height / width);
    const estimatedKB = (effectiveWidth * effectiveHeight * 0.1) / 1024; // ~0.1 bytes per pixel compressed
    return Math.ceil(estimatedKB * TOKENS_PER_KB_BASE64 * 1000 * TOKENS_PER_CHAR);
  }

  /**
   * Generate context hints for LLM guidance
   */
  private generateContextHints(
    metadata: VideoMetadata,
    frames: FrameReference[]
  ): ContextHint[] {
    const hints: ContextHint[] = [];
    
    // Calculate total token estimate
    const totalFrameTokens = frames.reduce((sum, f) => sum + f.estimatedTokens, 0);
    
    if (totalFrameTokens > WARNING_TOKEN_THRESHOLD) {
      hints.push({
        type: 'warning',
        message: `Extracting all ${frames.length} frames would use ~${Math.round(totalFrameTokens / 1000)}K tokens. Consider fetching specific frames instead.`,
        suggestedTool: 'get_frame',
        priority: 10,
      });
    }

    // Suggest progressive approach for long videos
    if (metadata.duration > 300) {
      hints.push({
        type: 'suggestion',
        message: 'For long videos, fetch frames progressively: start with a few key timestamps, then request more if needed.',
        suggestedTool: 'get_frame',
        priority: 8,
      });
    }

    // Audio hint
    if (metadata.hasAudio) {
      hints.push({
        type: 'info',
        message: 'Audio track available. Use extract_audio to get the audio file for transcription.',
        suggestedTool: 'extract_audio',
        priority: 5,
      });
    }

    // Default workflow hint
    hints.push({
      type: 'action',
      message: 'Review the frame timestamps above. Use get_frame to fetch specific frames for visual analysis.',
      suggestedTool: 'get_frame',
      priority: 3,
    });

    return hints.sort((a, b) => b.priority - a.priority);
  }

  // ===========================================================================
  // FRAME EXTRACTION - Progressive disclosure
  // ===========================================================================

  /**
   * Extract a single frame at specific timestamp
   * Primary method for progressive context enrichment
   */
  async extractSingleFrame(
    videoPath: string,
    timestamp: number,
    options: { maxWidth?: number; format?: 'png' | 'jpeg'; quality?: number } = {}
  ): Promise<FrameData> {
    const { maxWidth = 1920, format = 'jpeg', quality = 80 } = options;
    
    await this.ensureTempDir();
    const framePath = path.join(this.tempDir, `frame-${Date.now()}.${format}`);

    try {
      // Extract frame
      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoPath)
          .seekInput(timestamp)
          .frames(1)
          .output(framePath)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run();
      });

      // Process with sharp
      let imageBuffer: Buffer = await fs.readFile(framePath);
      const image = sharp(imageBuffer);
      const imageMetadata = await image.metadata();

      // Resize if needed
      let processedImage = image;
      if (imageMetadata.width && imageMetadata.width > maxWidth) {
        processedImage = image.resize(maxWidth, null, { fit: 'inside' });
      }

      // Convert to desired format
      if (format === 'jpeg') {
        imageBuffer = Buffer.from(await processedImage.jpeg({ quality }).toBuffer());
      } else {
        imageBuffer = Buffer.from(await processedImage.png().toBuffer());
      }

      const base64 = imageBuffer.toString('base64');
      const finalMetadata = await sharp(imageBuffer).metadata();

      return {
        index: 0,
        timestamp,
        timestampFormatted: this.formatTimestamp(timestamp),
        resolution: `${finalMetadata.width}x${finalMetadata.height}`,
        estimatedTokens: this.estimateBase64Tokens(base64.length),
        base64,
        mimeType: format === 'jpeg' ? 'image/jpeg' : 'image/png',
      };
    } finally {
      await fs.rm(framePath, { force: true }).catch(() => {});
    }
  }

  /**
   * Extract multiple frames
   * Use sparingly - prefer extractSingleFrame for progressive enrichment
   */
  async extractFrames(
    videoPath: string,
    options: FrameExtractionOptions = {}
  ): Promise<VideoFrame[]> {
    const {
      maxFrames = 10,
      interval,
      maxWidth = 1920,
      outputFormat = 'jpeg',
      jpegQuality = 80,
    } = options;

    await this.ensureTempDir();
    const frameDir = path.join(this.tempDir, `frames-${Date.now()}`);
    await fs.mkdir(frameDir, { recursive: true });

    const metadata = await this.getMetadata(videoPath);
    const frameInterval = interval || Math.max(1, Math.floor(metadata.duration / maxFrames));
    const totalFrames = Math.min(maxFrames, Math.floor(metadata.duration / frameInterval));

    const frames: VideoFrame[] = [];

    try {
      for (let i = 0; i < totalFrames; i++) {
        const timestamp = i * frameInterval;
        const framePath = path.join(frameDir, `frame-${i}.png`);

        await new Promise<void>((resolve, reject) => {
          ffmpeg(videoPath)
            .seekInput(timestamp)
            .frames(1)
            .output(framePath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .run();
        });

        let imageBuffer: Buffer = await fs.readFile(framePath);
        const image = sharp(imageBuffer);
        const imageMetadata = await image.metadata();

        let processedImage = image;
        if (imageMetadata.width && imageMetadata.width > maxWidth) {
          processedImage = image.resize(maxWidth, null, { fit: 'inside' });
        }

        if (outputFormat === 'jpeg') {
          imageBuffer = Buffer.from(await processedImage.jpeg({ quality: jpegQuality }).toBuffer());
        } else {
          imageBuffer = Buffer.from(await processedImage.png().toBuffer());
        }

        const base64 = imageBuffer.toString('base64');
        const finalMetadata = await sharp(imageBuffer).metadata();

        frames.push({
          timestamp,
          base64,
          width: finalMetadata.width || 0,
          height: finalMetadata.height || 0,
        });
      }

      return frames;
    } finally {
      await fs.rm(frameDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  // ===========================================================================
  // AUDIO EXTRACTION
  // ===========================================================================

  /**
   * Extract audio from video
   */
  async extractAudio(
    videoPath: string,
    options: AudioExtractionOptions = {}
  ): Promise<string> {
    const { format = 'mp3', bitrate = '128k', startTime, endTime } = options;
    
    await this.ensureTempDir();
    const audioPath = path.join(this.tempDir, `audio-${Date.now()}.${format}`);

    return new Promise((resolve, reject) => {
      let command = ffmpeg(videoPath).noVideo();

      if (startTime !== undefined) {
        command = command.seekInput(startTime);
      }
      if (endTime !== undefined && startTime !== undefined) {
        command = command.duration(endTime - startTime);
      }

      if (format === 'mp3') {
        command = command.audioCodec('libmp3lame').audioBitrate(bitrate);
      } else {
        command = command.audioCodec('pcm_s16le');
      }

      command
        .output(audioPath)
        .on('end', () => resolve(audioPath))
        .on('error', (err) => reject(new Error(`Failed to extract audio: ${err.message}`)))
        .run();
    });
  }

  // ===========================================================================
  // FULL ANALYSIS - Use only when comprehensive context is needed
  // ===========================================================================

  /**
   * Full video analysis
   * WARNING: This can produce large context. Prefer getVideoOverview + selective frame fetching.
   */
  async analyzeVideo(
    videoPath: string,
    options: {
      extractFrames?: boolean;
      maxFrames?: number;
      extractAudio?: boolean;
      frameInterval?: number;
    } = {}
  ): Promise<VideoAnalysis> {
    const {
      extractFrames: shouldExtractFrames = true,
      maxFrames = 10,
      extractAudio: shouldExtractAudio = true,
      frameInterval,
    } = options;

    const metadata = await this.getMetadata(videoPath);

    const frames = shouldExtractFrames
      ? await this.extractFrames(videoPath, {
          maxFrames,
          interval: frameInterval,
          outputFormat: 'jpeg',
          jpegQuality: 80,
        })
      : [];

    let audioPath: string | undefined;
    if (shouldExtractAudio && metadata.hasAudio) {
      try {
        audioPath = await this.extractAudio(videoPath);
      } catch (error) {
        console.error('Failed to extract audio:', error);
      }
    }

    return {
      metadata,
      frames,
      audioPath,
    };
  }

  // ===========================================================================
  // TOKEN ESTIMATION
  // ===========================================================================

  /**
   * Estimate tokens for a planned operation
   * Helps LLM decide if operation is worth the context cost
   */
  async estimateTokens(
    videoPath: string,
    options: { frameCount?: number; includeAudio?: boolean } = {}
  ): Promise<TokenEstimate> {
    const { frameCount = 10, includeAudio = false } = options;
    
    const metadata = await this.getMetadata(videoPath);
    const perFrameTokens = this.estimateFrameTokens(metadata.width, metadata.height);
    
    const totalFrameTokens = frameCount * perFrameTokens;
    const total = BASE_METADATA_TOKENS + totalFrameTokens;

    const estimate: TokenEstimate = {
      metadata: BASE_METADATA_TOKENS,
      perFrame: perFrameTokens,
      total,
    };

    if (total > WARNING_TOKEN_THRESHOLD) {
      estimate.warning = `Estimated ${Math.round(total / 1000)}K tokens exceeds recommended limit. Consider reducing frame count or fetching frames progressively.`;
    }

    return estimate;
  }
}
