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
}

/**
 * Chapter/segment markers if available in video
 */
export interface VideoChapter {
  title: string;
  startTime: number;
  endTime: number;
}
