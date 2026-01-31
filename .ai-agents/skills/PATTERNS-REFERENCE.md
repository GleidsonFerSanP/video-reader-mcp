# Patterns Reference - mcp-video-reader

> Code patterns and templates for this MCP server.

## Adding Tools

### 1. Define Tool in TOOLS Array

Location: `./src/index.ts`

```typescript
// In the TOOLS array
{
  name: 'get_scene_frames',
  description: `Extract keyframes from scene changes. Returns ~20K tokens for 5 scenes.

Use after get_video_overview when you need representative frames from different parts of the video.`,
  inputSchema: {
    type: 'object',
    properties: {
      videoPath: {
        type: 'string',
        description: 'Absolute path to video',
      },
      maxScenes: {
        type: 'number',
        description: 'Maximum scenes to detect (default: 5)',
        default: 5,
      },
      threshold: {
        type: 'number',
        description: 'Scene change sensitivity 0-1 (default: 0.3)',
        default: 0.3,
      },
    },
    required: ['videoPath'],
  },
}
```

**Checklist**:
* [ ] Token cost in description
* [ ] Usage guidance in description
* [ ] Default values specified
* [ ] Required fields marked

### 2. Add Handler in Switch Statement

Location: `./src/index.ts` (in `CallToolRequestSchema` handler)

```typescript
case 'get_scene_frames': {
  const { videoPath, maxScenes = 5, threshold = 0.3 } = args as {
    videoPath: string;
    maxScenes?: number;
    threshold?: number;
  };

  // Always check file exists first
  if (!await checkFile(videoPath)) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: `File not found: ${videoPath}`,
          hint: 'Provide absolute path to existing video file.',
        }, null, 2),
      }],
    };
  }

  // Call processor method
  const scenes = await processor.detectScenes(videoPath, { maxScenes, threshold });

  // Return with context hints
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        scenes: scenes.map(s => ({
          timestamp: s.keyFrameTimestamp,
          formatted: processor.formatTimestamp(s.keyFrameTimestamp),
          duration: s.duration,
        })),
        contextHints: [{
          type: 'suggestion',
          message: `Use get_frame to fetch specific scene keyframes`,
          suggestedTool: 'get_frame',
          priority: 7,
        }],
        nextSteps: [
          'Use get_frame with scene timestamps for visual analysis',
          'Scenes are sorted by timestamp',
        ],
      }, null, 2),
    }],
  };
}
```

**Checklist**:
* [ ] Type assertion for args
* [ ] File existence check
* [ ] Error handling with hints
* [ ] Context hints in response
* [ ] Next steps suggestions

---

## Video Processor Methods

Location: `./src/video-processor.ts`

### Processing Method Pattern

```typescript
/**
 * Detect scene changes in video
 * 
 * Context Engineering: Returns lightweight scene info,
 * use get_frame to fetch actual keyframes on demand.
 */
async detectScenes(
  videoPath: string, 
  options: SceneDetectionOptions = {}
): Promise<SceneInfo[]> {
  const { maxScenes = 5, threshold = 0.3 } = options;

  // Get video metadata first
  const metadata = await this.getMetadata(videoPath);

  // FFmpeg scene detection
  return new Promise((resolve, reject) => {
    const scenes: SceneInfo[] = [];
    
    ffmpeg(videoPath)
      .videoFilters(`select='gt(scene,${threshold})',showinfo`)
      .format('null')
      .on('stderr', (line) => {
        // Parse scene timestamps from FFmpeg output
        const match = line.match(/pts_time:(\d+\.?\d*)/);
        if (match && scenes.length < maxScenes) {
          const timestamp = parseFloat(match[1]);
          scenes.push({
            index: scenes.length,
            startTime: timestamp,
            endTime: timestamp + 1, // Approximate
            duration: 1,
            keyFrameTimestamp: timestamp,
          });
        }
      })
      .on('end', () => resolve(scenes))
      .on('error', (err) => reject(err))
      .output('/dev/null')
      .run();
  });
}
```

**Checklist**:
* [ ] JSDoc with Context Engineering note
* [ ] Options interface with defaults
* [ ] Metadata fetch if needed
* [ ] Promise-based async
* [ ] Error handling

---

## Type Definitions

Location: `./src/types.ts`

### Interface Pattern

```typescript
/**
 * Scene change detection result
 * 
 * Following Progressive Context pattern:
 * Contains references to keyframes, not actual frame data.
 */
export interface SceneInfo {
  /** Scene index (0-based) */
  index: number;
  /** Scene start timestamp in seconds */
  startTime: number;
  /** Scene end timestamp in seconds */
  endTime: number;
  /** Scene duration in seconds */
  duration: number;
  /** Best frame to represent this scene */
  keyFrameTimestamp: number;
}

/**
 * Options for scene detection
 */
export interface SceneDetectionOptions {
  /** Maximum number of scenes to detect */
  maxScenes?: number;
  /** Scene change threshold 0-1 (higher = fewer scenes) */
  threshold?: number;
}
```

**Checklist**:
* [ ] JSDoc explaining purpose
* [ ] Context Engineering note if relevant
* [ ] All fields documented
* [ ] Optional fields marked with `?`

---

## Response Patterns

### Success Response

```typescript
{
  success: true,
  data: { /* typed data */ },
  contextHints: [
    {
      type: 'suggestion',
      message: 'Use get_frame to fetch specific frames',
      suggestedTool: 'get_frame',
      priority: 7,
    }
  ],
  nextSteps: [
    'Fetch frames at identified timestamps',
    'Use extract_audio for speech content',
  ],
}
```

### Error Response

```typescript
{
  success: false,
  error: 'File not found: /path/to/video.mp4',
  hint: 'Provide absolute path to existing video file.',
  contextHints: [
    {
      type: 'action',
      message: 'Verify file path and try again',
      priority: 9,
    }
  ],
}
```

### Warning Response

```typescript
{
  success: true,
  data: { /* data */ },
  warning: 'Video is 2 hours long. Consider using progressive fetching.',
  contextHints: [
    {
      type: 'warning',
      message: 'Large video detected. Use get_frame instead of analyze_video_full',
      suggestedTool: 'get_frame',
      priority: 8,
    }
  ],
}
```

---

## Learning Patterns

When you identify a reusable pattern:

```typescript
learn_pattern({
  name: "Tiered Tool Response",
  context: "backend",
  description: "Response structure that guides LLM to appropriate next tool",
  pattern: `{
    success: true,
    data: { lightweight_info },
    contextHints: [{ type, message, suggestedTool }],
    nextSteps: ["Use X for Y", "Use Z for W"]
  }`,
  examples: [
    "get_video_overview returns frame timestamps with hints to use get_frame",
    "estimate_analysis_cost suggests progressive approach for large videos"
  ]
})
```
