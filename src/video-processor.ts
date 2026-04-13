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
import { createReadStream } from 'fs';
import path from 'path';
import os from 'os';
import OpenAI from 'openai';
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
  SceneInfo,
  SceneDetectionResult,
  SceneDetectionOptions,
  VideoChunk,
  ChunkAnalysisResult,
  ChunkOptions,
  TranscriptionSegment,
  TranscriptionResult,
  TranscriptionOptions,
  StreamAnalysisState,
  StreamAnalysisStep,
  StreamAnalysisOptions,
} from './types.js';

// Configure ffmpeg paths
ffmpeg.setFfmpegPath(ffmpegPath.path);
ffmpeg.setFfprobePath(ffprobePath.path);

// Token estimation constants (approximate)
const TOKENS_PER_KB_BASE64 = 1.33; // Base64 overhead
const TOKENS_PER_CHAR = 0.25; // Average for text
const BASE_METADATA_TOKENS = 150;
const WARNING_TOKEN_THRESHOLD = 50000;

// OpenAI API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export class VideoProcessor {
  private tempDir: string;
  private frameCache: Map<string, FrameReference[]> = new Map();
  private openai: OpenAI | null = null;

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'mcp-video-reader');
    
    // Initialize OpenAI client if API key is available
    if (OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    }
  }

  /**
   * Check if OpenAI transcription is available
   */
  isTranscriptionAvailable(): boolean {
    return this.openai !== null;
  }

  /**
   * Get transcription status for hints
   */
  getTranscriptionStatus(): { available: boolean; message: string } {
    if (this.openai) {
      return { 
        available: true, 
        message: 'OpenAI Whisper API configured and ready.' 
      };
    }
    return { 
      available: false, 
      message: 'Set OPENAI_API_KEY environment variable to enable transcription.' 
    };
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

  // ===========================================================================
  // SCENE DETECTION - Smart keyframe extraction
  // ===========================================================================

  /**
   * Detect scene changes in video using FFmpeg's scene detection filter
   * Returns timestamps where significant visual changes occur
   */
  async detectScenes(
    videoPath: string,
    options: SceneDetectionOptions = {}
  ): Promise<SceneDetectionResult> {
    const {
      threshold = 0.3,
      maxScenes = 20,
      minSceneDuration = 1,
    } = options;

    const metadata = await this.getMetadata(videoPath);
    
    return new Promise((resolve, reject) => {
      const sceneTimestamps: number[] = [0]; // Always include start
      
      // Use FFmpeg's scene detection filter
      ffmpeg(videoPath)
        .outputOptions([
          '-vf', `select='gt(scene,${threshold})',showinfo`,
          '-f', 'null',
        ])
        .output('-')
        .on('stderr', (line: string) => {
          // Parse showinfo output for scene timestamps
          const match = line.match(/pts_time:([0-9.]+)/);
          if (match) {
            const timestamp = parseFloat(match[1]);
            const lastTimestamp = sceneTimestamps[sceneTimestamps.length - 1];
            
            // Only add if minimum duration has passed since last scene
            if (timestamp - lastTimestamp >= minSceneDuration) {
              sceneTimestamps.push(timestamp);
            }
          }
        })
        .on('end', () => {
          // Build scene info from timestamps
          const scenes: SceneInfo[] = [];
          const limitedTimestamps = sceneTimestamps.slice(0, maxScenes);
          
          for (let i = 0; i < limitedTimestamps.length; i++) {
            const startTime = limitedTimestamps[i];
            const endTime = limitedTimestamps[i + 1] || metadata.duration;
            const duration = endTime - startTime;
            
            scenes.push({
              index: i,
              startTime,
              endTime,
              duration,
              keyFrameTimestamp: startTime + duration * 0.3, // 30% into scene
              confidence: i === 0 ? 1.0 : threshold,
            });
          }

          // Generate suggested keyframes
          const suggestedKeyframes: FrameReference[] = scenes.map((scene, idx) => ({
            index: idx,
            timestamp: scene.keyFrameTimestamp,
            timestampFormatted: this.formatTimestamp(scene.keyFrameTimestamp),
            resolution: `${Math.min(metadata.width, 1920)}x${Math.round(Math.min(metadata.width, 1920) * metadata.height / metadata.width)}`,
            estimatedTokens: this.estimateFrameTokens(metadata.width, metadata.height),
          }));

          // Generate context hints
          const contextHints: ContextHint[] = [
            {
              type: 'info',
              message: `Detected ${scenes.length} distinct scenes. Use get_scene_frames to extract representative frames.`,
              suggestedTool: 'get_scene_frames',
              priority: 8,
            },
          ];

          if (scenes.length > 10) {
            contextHints.push({
              type: 'suggestion',
              message: 'Many scenes detected. Consider fetching frames progressively or increasing threshold.',
              priority: 6,
            });
          }

          resolve({
            scenes,
            totalScenes: scenes.length,
            threshold,
            suggestedKeyframes,
            contextHints,
          });
        })
        .on('error', (err) => {
          // Fallback: generate evenly spaced scenes if detection fails
          console.error('Scene detection failed, using fallback:', err.message);
          const fallbackScenes: SceneInfo[] = [];
          const sceneCount = Math.min(maxScenes, Math.ceil(metadata.duration / 10));
          const interval = metadata.duration / sceneCount;
          
          for (let i = 0; i < sceneCount; i++) {
            const startTime = i * interval;
            const endTime = (i + 1) * interval;
            fallbackScenes.push({
              index: i,
              startTime,
              endTime,
              duration: interval,
              keyFrameTimestamp: startTime + interval / 2,
            });
          }

          const suggestedKeyframes: FrameReference[] = fallbackScenes.map((scene, idx) => ({
            index: idx,
            timestamp: scene.keyFrameTimestamp,
            timestampFormatted: this.formatTimestamp(scene.keyFrameTimestamp),
            resolution: `${Math.min(metadata.width, 1920)}x${Math.round(Math.min(metadata.width, 1920) * metadata.height / metadata.width)}`,
            estimatedTokens: this.estimateFrameTokens(metadata.width, metadata.height),
          }));

          resolve({
            scenes: fallbackScenes,
            totalScenes: fallbackScenes.length,
            threshold,
            suggestedKeyframes,
            contextHints: [{
              type: 'warning',
              message: 'Scene detection used fallback mode (evenly spaced). Results may be less accurate.',
              priority: 7,
            }],
          });
        })
        .run();
    });
  }

  /**
   * Extract frames at detected scene changes
   */
  async extractSceneFrames(
    videoPath: string,
    options: SceneDetectionOptions & { maxWidth?: number; format?: 'jpeg' | 'png' } = {}
  ): Promise<{ scenes: SceneInfo[]; frames: FrameData[] }> {
    const { maxWidth = 1920, format = 'jpeg' } = options;
    
    const detection = await this.detectScenes(videoPath, options);
    const frames: FrameData[] = [];

    // Extract frame for each scene's keyframe timestamp
    for (const scene of detection.scenes) {
      const frame = await this.extractSingleFrame(videoPath, scene.keyFrameTimestamp, {
        maxWidth,
        format,
        quality: 80,
      });
      frames.push({
        ...frame,
        index: scene.index,
      });
    }

    return {
      scenes: detection.scenes,
      frames,
    };
  }

  // ===========================================================================
  // CHUNK ANALYSIS - Progressive video understanding
  // ===========================================================================

  /**
   * Divide video into chunks for progressive analysis
   */
  async createChunks(
    videoPath: string,
    options: ChunkOptions = {}
  ): Promise<VideoChunk[]> {
    const { chunkDuration = 30 } = options;
    
    const metadata = await this.getMetadata(videoPath);
    const totalChunks = Math.ceil(metadata.duration / chunkDuration);
    const chunks: VideoChunk[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const startTime = i * chunkDuration;
      const endTime = Math.min((i + 1) * chunkDuration, metadata.duration);
      
      chunks.push({
        index: i,
        startTime,
        endTime,
        duration: endTime - startTime,
        timeRange: `${this.formatTimestamp(startTime)}-${this.formatTimestamp(endTime)}`,
        analyzed: false,
        keyFrameTimestamp: startTime + (endTime - startTime) / 2,
      });
    }

    return chunks;
  }

  /**
   * Analyze a specific chunk of the video
   */
  async analyzeChunk(
    videoPath: string,
    chunkIndex: number,
    options: ChunkOptions = {}
  ): Promise<ChunkAnalysisResult> {
    const { chunkDuration = 30, includeAudio = false, maxWidth = 1920 } = options;
    
    const metadata = await this.getMetadata(videoPath);
    const chunks = await this.createChunks(videoPath, options);
    
    if (chunkIndex >= chunks.length) {
      throw new Error(`Chunk index ${chunkIndex} out of range (max: ${chunks.length - 1})`);
    }

    const chunk = chunks[chunkIndex];
    
    // Extract representative frame for this chunk
    const frame = await this.extractSingleFrame(videoPath, chunk.keyFrameTimestamp, {
      maxWidth,
      format: 'jpeg',
      quality: 80,
    });

    // Extract audio segment if requested
    let audioSegmentPath: string | undefined;
    if (includeAudio && metadata.hasAudio) {
      audioSegmentPath = await this.extractAudio(videoPath, {
        startTime: chunk.startTime,
        endTime: chunk.endTime,
        format: 'mp3',
        bitrate: '128k',
      });
    }

    // Mark chunk as analyzed
    chunk.analyzed = true;

    // Generate context hints
    const contextHints: ContextHint[] = [];
    
    if (chunkIndex < chunks.length - 1) {
      contextHints.push({
        type: 'action',
        message: `Chunk ${chunkIndex + 1}/${chunks.length} analyzed. Call analyze_chunk with index ${chunkIndex + 1} to continue.`,
        suggestedTool: 'analyze_chunk',
        priority: 8,
      });
    } else {
      contextHints.push({
        type: 'info',
        message: 'Final chunk analyzed. Video analysis complete.',
        priority: 8,
      });
    }

    if (audioSegmentPath) {
      contextHints.push({
        type: 'suggestion',
        message: 'Audio segment extracted. Use transcribe_audio to get the spoken content.',
        suggestedTool: 'transcribe_audio',
        priority: 6,
      });
    }

    return {
      chunk,
      frame,
      audioSegmentPath,
      progress: {
        currentChunk: chunkIndex + 1,
        totalChunks: chunks.length,
        percentComplete: Math.round(((chunkIndex + 1) / chunks.length) * 100),
      },
      contextHints,
    };
  }

  // ===========================================================================
  // AUDIO TRANSCRIPTION
  // ===========================================================================

  /**
   * Transcribe audio from video using OpenAI Whisper API
   * Returns VTT/SRT format for easy correlation with video timestamps
   */
  async transcribeAudio(
    videoPath: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    const {
      language,
      subtitleFormat = 'vtt',
      startTime,
      endTime,
    } = options;

    await this.ensureTempDir();
    
    // First extract the audio
    const audioPath = await this.extractAudio(videoPath, {
      format: 'mp3', // MP3 is more efficient for Whisper API
      startTime,
      endTime,
    });

    const metadata = await this.getMetadata(videoPath);
    const audioDuration = endTime ? (endTime - (startTime || 0)) : metadata.duration;

    // Generate subtitle file path
    const subtitlePath = subtitleFormat !== 'none' 
      ? path.join(this.tempDir, `transcript-${Date.now()}.${subtitleFormat}`)
      : undefined;

    const contextHints: ContextHint[] = [];
    let fullText = '';
    let segments: TranscriptionSegment[] = [];

    // Check if OpenAI is configured
    if (!this.openai) {
      contextHints.push({
        type: 'warning',
        message: 'OPENAI_API_KEY not configured. Set the environment variable to enable transcription.',
        priority: 10,
      });
      contextHints.push({
        type: 'info',
        message: `Audio extracted to ${audioPath}. Configure OPENAI_API_KEY or use an external transcription service.`,
        priority: 8,
      });
      contextHints.push({
        type: 'suggestion',
        message: 'For local transcription, install whisper.cpp and run: ./main -m models/ggml-base.bin -f audio.wav',
        priority: 5,
      });

      const estimatedWords = (audioDuration / 60) * 150;
      const estimatedTokens = Math.ceil(estimatedWords * 1.3);

      return {
        fullText: '',
        segments: [],
        audioDuration,
        subtitlePath,
        estimatedTokens,
        contextHints,
      };
    }

    try {
      // Call OpenAI Whisper API with verbose_json for timestamps
      const transcription = await this.openai.audio.transcriptions.create({
        file: createReadStream(audioPath),
        model: 'whisper-1',
        language: language,
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
      });

      fullText = transcription.text;

      // Parse segments from verbose_json response
      if ('segments' in transcription && Array.isArray(transcription.segments)) {
        segments = transcription.segments.map((seg: { id: number; start: number; end: number; text: string }, index: number) => ({
          index: seg.id ?? index,
          startTime: seg.start + (startTime || 0), // Adjust for video offset
          endTime: seg.end + (startTime || 0),
          text: seg.text.trim(),
        }));
      }

      // Generate subtitle file if requested
      if (subtitlePath && segments.length > 0) {
        const subtitleContent = subtitleFormat === 'vtt' 
          ? this.generateVTT(segments)
          : this.generateSRT(segments);
        
        await fs.writeFile(subtitlePath, subtitleContent);
        
        contextHints.push({
          type: 'info',
          message: `Subtitles saved to ${subtitlePath}`,
          priority: 7,
        });
      }

      contextHints.push({
        type: 'info',
        message: `Transcribed ${segments.length} segments (${audioDuration.toFixed(1)}s of audio)`,
        priority: 8,
      });

      if ('language' in transcription) {
        contextHints.push({
          type: 'info',
          message: `Detected language: ${transcription.language}`,
          priority: 6,
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      contextHints.push({
        type: 'warning',
        message: `Transcription failed: ${errorMessage}`,
        priority: 10,
      });
      
      contextHints.push({
        type: 'info',
        message: `Audio extracted to ${audioPath}. You can try again or use a different transcription method.`,
        priority: 8,
      });
    }

    // Clean up audio file
    try {
      await fs.unlink(audioPath);
    } catch {
      // Ignore cleanup errors
    }

    // Calculate actual tokens from transcription
    const estimatedTokens = Math.ceil(fullText.length * TOKENS_PER_CHAR) + BASE_METADATA_TOKENS;

    return {
      fullText,
      segments,
      audioDuration,
      subtitlePath: subtitlePath && segments.length > 0 ? subtitlePath : undefined,
      estimatedTokens,
      contextHints,
    };
  }

  /**
   * Generate SRT format subtitles
   */
  private generateSRT(segments: TranscriptionSegment[]): string {
    return segments.map((seg, index) => {
      const startTime = this.formatSRTTime(seg.startTime);
      const endTime = this.formatSRTTime(seg.endTime);
      return `${index + 1}\n${startTime} --> ${endTime}\n${seg.text}\n`;
    }).join('\n');
  }

  /**
   * Format time for SRT (HH:MM:SS,mmm)
   */
  private formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  /**
   * Parse VTT/SRT subtitle content into segments
   */
  parseSubtitles(content: string, format: 'vtt' | 'srt'): TranscriptionSegment[] {
    const segments: TranscriptionSegment[] = [];
    const lines = content.split('\n');
    
    let index = 0;
    let i = 0;

    while (i < lines.length) {
      // Skip VTT header
      if (format === 'vtt' && lines[i].startsWith('WEBVTT')) {
        i++;
        continue;
      }

      // Look for timestamp line
      const timestampMatch = lines[i].match(
        /(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/
      );

      if (timestampMatch) {
        const startTime = 
          parseInt(timestampMatch[1]) * 3600 +
          parseInt(timestampMatch[2]) * 60 +
          parseInt(timestampMatch[3]) +
          parseInt(timestampMatch[4]) / 1000;
        
        const endTime =
          parseInt(timestampMatch[5]) * 3600 +
          parseInt(timestampMatch[6]) * 60 +
          parseInt(timestampMatch[7]) +
          parseInt(timestampMatch[8]) / 1000;

        // Collect text lines until empty line
        i++;
        const textLines: string[] = [];
        while (i < lines.length && lines[i].trim() !== '') {
          textLines.push(lines[i].trim());
          i++;
        }

        segments.push({
          index,
          startTime,
          endTime,
          text: textLines.join(' '),
        });
        index++;
      }
      i++;
    }

    return segments;
  }

  /**
   * Generate VTT format subtitle content
   */
  generateVTT(segments: TranscriptionSegment[]): string {
    let vtt = 'WEBVTT\n\n';
    
    for (const segment of segments) {
      const startFormatted = this.formatVTTTimestamp(segment.startTime);
      const endFormatted = this.formatVTTTimestamp(segment.endTime);
      vtt += `${startFormatted} --> ${endFormatted}\n${segment.text}\n\n`;
    }

    return vtt;
  }

  /**
   * Format timestamp for VTT (HH:MM:SS.mmm)
   */
  private formatVTTTimestamp(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }

  // ===========================================================================
  // STREAM ANALYSIS - Progressive video watching simulation
  // ===========================================================================

  private streamStates: Map<string, StreamAnalysisState> = new Map();

  /**
   * Initialize stream analysis for progressive video watching
   */
  async initStreamAnalysis(
    videoPath: string,
    options: StreamAnalysisOptions = {}
  ): Promise<StreamAnalysisState> {
    const { startPosition = 0 } = options;
    
    const metadata = await this.getMetadata(videoPath);
    
    const state: StreamAnalysisState = {
      videoPath,
      currentPosition: startPosition,
      totalDuration: metadata.duration,
      analyzedChunks: [],
      observations: [],
      keyEvents: [],
      isComplete: false,
    };

    this.streamStates.set(videoPath, state);
    return state;
  }

  /**
   * Get next step in stream analysis
   * Simulates "watching" the video progressively
   */
  async getStreamStep(
    videoPath: string,
    options: StreamAnalysisOptions = {}
  ): Promise<StreamAnalysisStep> {
    const {
      stepDuration = 30,
      includeAudio = false,
      useSceneDetection = true,
    } = options;

    // Get or initialize state
    let state = this.streamStates.get(videoPath);
    if (!state) {
      state = await this.initStreamAnalysis(videoPath, options);
    }

    const metadata = await this.getMetadata(videoPath);

    // Calculate position for this step
    const stepStart = state.currentPosition;
    const stepEnd = Math.min(stepStart + stepDuration, metadata.duration);
    
    // Get best frame for this segment
    let frameTimestamp = stepStart + (stepEnd - stepStart) / 2;
    let scenesInSegment: SceneInfo[] | undefined;

    // If using scene detection, find scenes in this segment
    if (useSceneDetection) {
      try {
        const detection = await this.detectScenes(videoPath, {
          threshold: 0.4,
          maxScenes: 5,
        });
        
        scenesInSegment = detection.scenes.filter(
          s => s.startTime >= stepStart && s.startTime < stepEnd
        );
        
        // Use first scene's keyframe if available
        if (scenesInSegment.length > 0) {
          frameTimestamp = scenesInSegment[0].keyFrameTimestamp;
        }
      } catch (error) {
        // Continue without scene detection
        console.error('Scene detection failed:', error);
      }
    }

    // Extract frame
    const frame = await this.extractSingleFrame(videoPath, frameTimestamp, {
      maxWidth: 1920,
      format: 'jpeg',
      quality: 80,
    });

    // Extract audio transcript for segment if requested
    let audioTranscript: string | undefined;
    if (includeAudio && metadata.hasAudio) {
      // Audio path is extracted but transcript would need external service
      await this.extractAudio(videoPath, {
        startTime: stepStart,
        endTime: stepEnd,
        format: 'mp3',
      });
    }

    // Update state
    const chunkIndex = Math.floor(stepStart / stepDuration);
    state.analyzedChunks.push(chunkIndex);
    state.currentPosition = stepEnd;
    state.isComplete = stepEnd >= metadata.duration;

    // Generate context hints
    const contextHints: ContextHint[] = [];
    
    if (!state.isComplete) {
      contextHints.push({
        type: 'action',
        message: `Viewed ${this.formatTimestamp(stepStart)}-${this.formatTimestamp(stepEnd)}. Use stream_next to continue watching.`,
        suggestedTool: 'stream_next',
        priority: 8,
      });
    } else {
      contextHints.push({
        type: 'info',
        message: `Video complete. Analyzed ${state.analyzedChunks.length} segments.`,
        priority: 8,
      });
    }

    if (scenesInSegment && scenesInSegment.length > 1) {
      contextHints.push({
        type: 'suggestion',
        message: `${scenesInSegment.length} scene changes detected in this segment. Consider fetching additional frames.`,
        suggestedTool: 'get_frame',
        priority: 5,
      });
    }

    return {
      frame,
      position: {
        current: stepEnd,
        total: metadata.duration,
        formatted: `${this.formatTimestamp(stepEnd)} / ${this.formatTimestamp(metadata.duration)}`,
        percentComplete: Math.round((stepEnd / metadata.duration) * 100),
      },
      audioTranscript,
      scenesInSegment,
      state,
      contextHints,
    };
  }

  /**
   * Add observation to stream analysis state
   */
  addStreamObservation(videoPath: string, observation: string): void {
    const state = this.streamStates.get(videoPath);
    if (state) {
      state.observations.push(observation);
    }
  }

  /**
   * Add key event to stream analysis state
   */
  addStreamKeyEvent(videoPath: string, timestamp: number, description: string): void {
    const state = this.streamStates.get(videoPath);
    if (state) {
      state.keyEvents.push({ timestamp, description });
    }
  }

  /**
   * Get current stream analysis state
   */
  getStreamState(videoPath: string): StreamAnalysisState | undefined {
    return this.streamStates.get(videoPath);
  }

  /**
   * Reset stream analysis
   */
  resetStreamAnalysis(videoPath: string): void {
    this.streamStates.delete(videoPath);
  }
}
