/**
 * MCP Video Reader Types
 * 
 * Designed with Context Engineering principles:
 * - Progressive Context Enrichment: Start light, fetch details on demand
 * - Token Efficiency: Structured summaries over raw data dumps
 * - Context Hints: Guide the LLM on what actions to take next
 */

// ============================================================================
// VIDEO METADATA - Lightweight initial context
// ============================================================================

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  format: string;
  bitrate: number;
  hasAudio: boolean;
  audioCodec?: string;
  fileSize?: number;
}

/**
 * Human-readable summary of metadata for token-efficient context
 */
export interface VideoMetadataSummary {
  /** e.g., "5:32" */
  durationFormatted: string;
  /** e.g., "1920x1080" */
  resolution: string;
  /** e.g., "Full HD landscape video, 30fps, 5.5 minutes, has audio" */
  humanDescription: string;
  /** Suggested analysis approach based on video characteristics */
  analysisHints: AnalysisHint[];
}

// ============================================================================
// FRAMES - Progressive disclosure pattern
// ============================================================================

export interface VideoFrame {
  timestamp: number;
  base64: string;
  width: number;
  height: number;
}

/**
 * Lightweight frame reference - fetch actual data only when needed
 * Following Progressive Context Enrichment pattern
 */
export interface FrameReference {
  /** Frame index in sequence */
  index: number;
  /** Timestamp in seconds */
  timestamp: number;
  /** Human readable timestamp e.g., "2:35" */
  timestampFormatted: string;
  /** Frame resolution e.g., "1920x1080" */
  resolution: string;
  /** Estimated context size if this frame is fetched */
  estimatedTokens: number;
}

/**
 * Frame with full data - only fetched on demand
 */
export interface FrameData extends FrameReference {
  /** Full base64 encoded image */
  base64: string;
  /** MIME type */
  mimeType: 'image/png' | 'image/jpeg';
}

// ============================================================================
// VIDEO ANALYSIS - Structured for progressive enrichment
// ============================================================================

/**
 * Initial video overview - minimal context, maximum utility
 */
export interface VideoOverview {
  /** Path identifier */
  videoPath: string;
  /** Filename only */
  filename: string;
  /** Lightweight metadata summary */
  metadata: VideoMetadataSummary;
  /** Available frame timestamps for progressive fetching */
  availableFrames: FrameReference[];
  /** Audio status */
  audio: {
    available: boolean;
    durationSeconds?: number;
    /** Path to extracted audio if already processed */
    extractedPath?: string;
  };
  /** Hints for the LLM on what to do next */
  contextHints: ContextHint[];
}

/**
 * Full analysis result - only when comprehensive analysis is needed
 */
export interface VideoAnalysis {
  metadata: VideoMetadata;
  frames: VideoFrame[];
  audioPath?: string;
  /** Human-readable analysis summary */
  summary?: VideoAnalysisSummary;
}

export interface VideoAnalysisSummary {
  /** One-line description */
  brief: string;
  /** Key observations */
  observations: string[];
  /** Recommended next steps */
  recommendations: string[];
}

// ============================================================================
// CONTEXT ENGINEERING PRIMITIVES
// ============================================================================

/**
 * Hints to guide LLM behavior - reduces ambiguity and improves tool selection
 */
export interface ContextHint {
  /** Type of hint */
  type: 'action' | 'warning' | 'info' | 'suggestion';
  /** The hint message */
  message: string;
  /** Related tool to use */
  suggestedTool?: string;
  /** Priority (higher = more important) */
  priority: number;
}

/**
 * Analysis hints based on video characteristics
 */
export interface AnalysisHint {
  aspect: 'duration' | 'resolution' | 'audio' | 'format';
  recommendation: string;
  parameters?: Record<string, unknown>;
}

/**
 * Token budget estimation for context management
 */
export interface TokenEstimate {
  /** Estimated tokens for metadata */
  metadata: number;
  /** Estimated tokens per frame */
  perFrame: number;
  /** Estimated tokens for audio transcript (if available) */
  audioTranscript?: number;
  /** Total estimated tokens */
  total: number;
  /** Warning if approaching context limits */
  warning?: string;
}

// ============================================================================
// TOOL RESPONSE TYPES - Consistent, informative responses
// ============================================================================

export interface ToolResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  /** Hints for next actions */
  contextHints?: ContextHint[];
  /** Token usage estimate */
  tokenEstimate?: TokenEstimate;
}

/**
 * Paginated response for large result sets
 */
export interface PaginatedResponse<T> {
  items: T[];
  /** Current page */
  page: number;
  /** Total pages available */
  totalPages: number;
  /** Total items */
  totalItems: number;
  /** Has more items */
  hasMore: boolean;
  /** Hint for fetching more */
  fetchMoreHint?: string;
}

// ============================================================================
// PROCESSING OPTIONS - Fine-grained control for efficiency
// ============================================================================

export interface FrameExtractionOptions {
  /** Maximum frames to extract */
  maxFrames?: number;
  /** Interval in seconds between frames */
  interval?: number;
  /** Maximum width (preserves aspect ratio) */
  maxWidth?: number;
  /** Output format - jpeg is smaller, png is lossless */
  outputFormat?: 'png' | 'jpeg';
  /** JPEG quality (1-100) if using jpeg format */
  jpegQuality?: number;
  /** Only return references, not actual data */
  referencesOnly?: boolean;
}

export interface VideoAnalysisOptions {
  /** Extract frames */
  extractFrames?: boolean;
  /** Maximum frames */
  maxFrames?: number;
  /** Extract audio */
  extractAudio?: boolean;
  /** Frame interval */
  frameInterval?: number;
  /** Generate summary */
  generateSummary?: boolean;
  /** Mode: 'overview' for minimal context, 'full' for complete analysis */
  mode?: 'overview' | 'full';
}

export interface AudioExtractionOptions {
  /** Output format */
  format?: 'mp3' | 'wav';
  /** Bitrate for mp3 */
  bitrate?: '64k' | '128k' | '192k' | '256k';
  /** Only extract a segment */
  startTime?: number;
  /** End time for segment */
  endTime?: number;
}

// ============================================================================
// SCENE ANALYSIS - Advanced progressive context
// ============================================================================

/**
 * Scene change detection for smarter frame selection
 */
export interface SceneInfo {
  /** Scene index */
  index: number;
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime: number;
  /** Duration */
  duration: number;
  /** Representative frame for this scene */
  keyFrameTimestamp: number;
  /** Scene change confidence (0-1) */
  confidence?: number;
}

/**
 * Chapter/segment markers if available in video
 */
export interface VideoChapter {
  title: string;
  startTime: number;
  endTime: number;
}

// ============================================================================
// SCENE DETECTION - Smart frame extraction
// ============================================================================

export interface SceneDetectionResult {
  /** Detected scenes */
  scenes: SceneInfo[];
  /** Total scenes found */
  totalScenes: number;
  /** Detection threshold used */
  threshold: number;
  /** Recommended keyframes to fetch */
  suggestedKeyframes: FrameReference[];
  /** Context hints */
  contextHints: ContextHint[];
}

export interface SceneDetectionOptions {
  /** Sensitivity threshold (0.0-1.0, lower = more scenes). Default: 0.3 */
  threshold?: number;
  /** Maximum scenes to detect. Default: 20 */
  maxScenes?: number;
  /** Minimum scene duration in seconds. Default: 1 */
  minSceneDuration?: number;
}

// ============================================================================
// CHUNK ANALYSIS - Progressive video understanding
// ============================================================================

export interface VideoChunk {
  /** Chunk index */
  index: number;
  /** Start time in seconds */
  startTime: number;
  /** End time in seconds */
  endTime: number;
  /** Duration in seconds */
  duration: number;
  /** Formatted time range "0:00-0:30" */
  timeRange: string;
  /** Whether this chunk has been analyzed */
  analyzed: boolean;
  /** Key frame for this chunk */
  keyFrameTimestamp: number;
}

export interface ChunkAnalysisResult {
  /** Current chunk being analyzed */
  chunk: VideoChunk;
  /** Frame data for this chunk */
  frame: FrameData;
  /** Audio segment path if extracted */
  audioSegmentPath?: string;
  /** Progress info */
  progress: {
    currentChunk: number;
    totalChunks: number;
    percentComplete: number;
  };
  /** Accumulated context from previous chunks */
  previousContext?: string[];
  /** Hints for next steps */
  contextHints: ContextHint[];
}

export interface ChunkOptions {
  /** Duration of each chunk in seconds. Default: 30 */
  chunkDuration?: number;
  /** Include audio for each chunk */
  includeAudio?: boolean;
  /** Max width for frames. Default: 1920 */
  maxWidth?: number;
}

// ============================================================================
// AUDIO TRANSCRIPTION - Speech to text
// ============================================================================

export interface TranscriptionSegment {
  /** Segment index */
  index: number;
  /** Start time in seconds */
  startTime: number;
  /** End time in seconds */
  endTime: number;
  /** Transcribed text */
  text: string;
  /** Speaker label if diarization enabled */
  speaker?: string;
  /** Confidence score 0-1 */
  confidence?: number;
}

export interface TranscriptionResult {
  /** Full transcription text */
  fullText: string;
  /** Segmented transcription with timestamps */
  segments: TranscriptionSegment[];
  /** Language detected */
  language?: string;
  /** Duration of audio transcribed */
  audioDuration: number;
  /** Path to VTT/SRT subtitle file */
  subtitlePath?: string;
  /** Estimated tokens for full transcript */
  estimatedTokens: number;
  /** Context hints */
  contextHints: ContextHint[];
}

export interface TranscriptionOptions {
  /** Language code (e.g., 'en', 'pt', 'es'). Auto-detect if omitted */
  language?: string;
  /** Output subtitle format */
  subtitleFormat?: 'vtt' | 'srt' | 'none';
  /** Time segment to transcribe */
  startTime?: number;
  endTime?: number;
  /** Enable speaker diarization */
  diarization?: boolean;
  /** Use Whisper model size: tiny, base, small, medium, large */
  model?: 'tiny' | 'base' | 'small' | 'medium' | 'large';
}

// ============================================================================
// STREAM ANALYSIS - Progressive video watching simulation
// ============================================================================

export interface StreamAnalysisState {
  /** Video being analyzed */
  videoPath: string;
  /** Current position in seconds */
  currentPosition: number;
  /** Total duration */
  totalDuration: number;
  /** Chunks analyzed so far */
  analyzedChunks: number[];
  /** Accumulated observations */
  observations: string[];
  /** Key events detected with timestamps */
  keyEvents: Array<{
    timestamp: number;
    description: string;
  }>;
  /** Is analysis complete */
  isComplete: boolean;
}

export interface StreamAnalysisStep {
  /** Current frame */
  frame: FrameData;
  /** Current position */
  position: {
    current: number;
    total: number;
    formatted: string;
    percentComplete: number;
  };
  /** Audio transcript for this segment if available */
  audioTranscript?: string;
  /** Scenes in current segment */
  scenesInSegment?: SceneInfo[];
  /** Analysis state */
  state: StreamAnalysisState;
  /** What to do next */
  contextHints: ContextHint[];
}

export interface StreamAnalysisOptions {
  /** Seconds to advance per step. Default: 30 */
  stepDuration?: number;
  /** Include audio transcription per step */
  includeAudio?: boolean;
  /** Use scene detection for smart frame selection */
  useSceneDetection?: boolean;
  /** Starting position in seconds */
  startPosition?: number;
}
