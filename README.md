# MCP Video Reader

An MCP (Model Context Protocol) server that enables AI models to read and analyze videos using **Progressive Context Enrichment** principles.

## 🚀 Quick Start: VS Code Extension

The easiest way to use this MCP server is via the **VS Code Extension**:

1. **Install the extension**:
   

```bash
   cd extension
   npm install
   npm run package
   code --install-extension video-reader-mcp-1.0.0.vsix
   ```

2. **Restart VS Code** - The MCP server auto-configures for GitHub Copilot Chat!

3. **Start analyzing videos** in Copilot Chat:
   

```
   Analyze this video: /path/to/video.mp4
   ```

📦 **Extension Features**:
* ✅ Auto-configures MCP server for GitHub Copilot
* ✅ No manual configuration needed
* ✅ Commands: Configure, Restart, Status, View Docs
* ✅ Works on macOS, Windows, and Linux

---

## 🎯 Key Features

* **Progressive Context Enrichment**: Start light, fetch details on demand
* **🆕 Scene Detection**: Automatically detect scene changes for smart frame extraction
* **🆕 Chunk Analysis**: Divide videos into segments for progressive understanding
* **🆕 Stream Analysis**: Simulate "watching" a video progressively with state management
* **🆕 Audio Transcription Support**: Prepare audio for transcription services
* **Token Efficient**: Optimized outputs to minimize context consumption
* **Context Hints**: Guides AI behavior with actionable suggestions
* **Universal Format Support**: Works with any video format (mp4, avi, mov, mkv, webm, etc.)
* **Granular Tools**: Small, focused tools instead of monolithic operations

## 🧠 Context Engineering Principles

This MCP implements best practices from:
* [Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) - Anthropic
* [Progressive Context Enrichment for LLMs](https://www.inferable.ai/blog/posts/llm-progressive-context-encrichment) - Inferable

See [CONTEXT_ENGINEERING.md](CONTEXT_ENGINEERING.md) for detailed documentation.

### The Progressive Approach

```
Traditional Approach (Bad):
└─ analyze_video_full → Returns ALL frames → 100K+ tokens consumed

Progressive Approach (Good):
├─ get_video_overview → Light metadata + frame timestamps → ~200 tokens
├─ get_frame(t=30) → Specific frame → ~10K tokens  
├─ get_frame(t=90) → Another frame → ~10K tokens
└─ extract_audio → Audio path → ~50 tokens
```

## ✨ 100% Self-Contained

**🎉 No FFmpeg installation required!**

All binaries are included via npm packages:
* ✅ `@ffmpeg-installer/ffmpeg`
* ✅ `@ffprobe-installer/ffprobe`

Works on **any OS** (macOS, Windows, Linux) without manual installation!

## 🚀 Installation

```bash
# Clone the repository
git clone <your-repository>
cd mcp-video-reader

# Install dependencies
npm install

# Build
npm run build

# (Optional) Verify setup
node test-setup.js
```

## ⚙️ Configuration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` :

```json
{
  "mcpServers": {
    "video-reader": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-video-reader/build/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-your-api-key-here"
      }
    }
  }
}
```

> **Note:** The `OPENAI_API_KEY` is optional but required for `transcribe_audio` functionality.

## 🛠️ Tools Reference

### Tier 1: Discovery Tools (Use First)

#### `get_video_overview`

**[RECOMMENDED FIRST STEP]** Get a lightweight overview without extracting frame data.

```typescript
// Returns: metadata summary, frame timestamps (no images), context hints
get_video_overview({
  videoPath: "/path/to/video.mp4",
  frameCount: 10  // Number of reference timestamps
})
```

#### `get_video_metadata`

Quick technical specs only.

```typescript
// Returns: duration, resolution, fps, codec, format, has audio
get_video_metadata({ videoPath: "/path/to/video.mp4" })
```

#### `estimate_analysis_cost`

Plan before executing - estimate token cost.

```typescript
// Returns: token estimates, warnings if too large
estimate_analysis_cost({
  videoPath: "/path/to/video.mp4",
  frameCount: 10
})
```

### Tier 2: Progressive Fetch Tools

#### `get_frame`

**[PRIMARY TOOL]** Extract a single frame at specific timestamp.

```typescript
// Returns: single frame image + metadata
get_frame({
  videoPath: "/path/to/video.mp4",
  timestamp: 30,        // seconds
  maxWidth: 1920,       // optional
  format: "jpeg",       // jpeg (smaller) or png
  quality: 80           // JPEG quality 1-100
})
```

#### `get_frames_batch`

Extract multiple specific frames (max 5 recommended).

```typescript
// Returns: multiple frame images
get_frames_batch({
  videoPath: "/path/to/video.mp4",
  timestamps: [30, 90, 150],  // Array of timestamps
  maxWidth: 1920,
  format: "jpeg"
})
```

#### `extract_audio`

Extract audio track with segment support.

```typescript
// Returns: path to extracted audio file
extract_audio({
  videoPath: "/path/to/video.mp4",
  format: "mp3",        // mp3 or wav
  bitrate: "128k",      // 64k, 128k, 192k, 256k
  startTime: 0,         // optional segment start
  endTime: 60           // optional segment end
})
```

### Tier 3: Comprehensive Tools (Use Sparingly)

#### `analyze_video_full`

**⚠️ HIGH CONTEXT COST** - Full analysis with multiple frames.

```typescript
// Returns: metadata + all frames + audio path
// WARNING: Can produce 50K-150K+ tokens
analyze_video_full({
  videoPath: "/path/to/video.mp4",
  maxFrames: 8,         // Keep low!
  extractAudio: true,
  frameInterval: 10     // seconds between frames
})
```

### 🆕 Tier 2.5: Smart Analysis Tools

#### `detect_scenes`

Detect scene changes without extracting frames. Returns timestamps where visual changes occur.

```typescript
// Returns: scene list with timestamps and suggested keyframes
detect_scenes({
  videoPath: "/path/to/video.mp4",
  threshold: 0.3,       // 0.0-1.0 (lower = more scenes)
  maxScenes: 20,
  minSceneDuration: 1   // Minimum scene duration in seconds
})
```

#### `get_scene_frames`

Extract frames at detected scene changes - smarter than evenly-spaced frames.

```typescript
// Returns: frames at scene change points
get_scene_frames({
  videoPath: "/path/to/video.mp4",
  threshold: 0.3,
  maxScenes: 10,
  maxWidth: 1920
})
```

#### `get_video_chunks`

Divide video into chunks for progressive analysis.

```typescript
// Returns: chunk metadata without extracting content
get_video_chunks({
  videoPath: "/path/to/video.mp4",
  chunkDuration: 30     // seconds per chunk
})
```

#### `analyze_chunk`

Analyze a specific chunk with keyframe + optional audio.

```typescript
// Returns: frame + audio path for specific segment
analyze_chunk({
  videoPath: "/path/to/video.mp4",
  chunkIndex: 0,        // 0-based index
  chunkDuration: 30,
  includeAudio: true
})
```

### 🆕 Tier 2.6: Stream Analysis (Progressive Watching)

#### `stream_start`

Start streaming analysis - simulates watching a video progressively.

```typescript
// Returns: first segment + state initialization
stream_start({
  videoPath: "/path/to/video.mp4",
  stepDuration: 30,     // seconds per step
  includeAudio: false,
  useSceneDetection: true,
  startPosition: 0
})
```

#### `stream_next`

Continue streaming - advances to next segment.

```typescript
// Returns: next frame + position + accumulated context
stream_next({
  videoPath: "/path/to/video.mp4",
  stepDuration: 30,
  includeAudio: false
})
```

#### `stream_status`

Check streaming progress without advancing.

```typescript
// Returns: current state, observations, key events
stream_status({ videoPath: "/path/to/video.mp4" })
```

### 🆕 Tier 2.7: Audio Transcription

#### `transcribe_audio`

Transcribe audio using OpenAI Whisper API with timed segments.

**⚠️ Requires:** `OPENAI_API_KEY` environment variable

```typescript
// Returns: full transcript + timed segments + subtitles
transcribe_audio({
  videoPath: "/path/to/video.mp4",
  subtitleFormat: "vtt",  // vtt, srt, or none
  startTime: 0,           // optional segment
  endTime: 60,
  language: "en"          // improves accuracy
})
```

## ⚙️ Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | For transcription | Your OpenAI API key for Whisper transcription |

**Example:**
```bash
export OPENAI_API_KEY="sk-..."
```

## 💡 Usage Examples

### Recommended: Progressive Analysis

```
User: "Analyze this tutorial video: /path/video.mp4"

AI uses tools progressively:
1. get_video_overview → See it's 10 minutes, has audio, 10 frame timestamps
2. get_frame(0) → Check intro
3. get_frame(180) → Check middle section  
4. get_frame(540) → Check end
5. extract_audio → Get audio for transcription

Result: Comprehensive analysis with ~30K tokens instead of 150K+
```

### 🆕 Smart Scene Detection

```
User: "What are the main scenes in this video?"

AI uses scene detection:
1. detect_scenes → Find 8 scene changes with timestamps
2. get_scene_frames → Extract frames at scene boundaries

Result: Captures actual content changes, not arbitrary intervals
```

### 🆕 Streaming Analysis (Long Videos)

```
User: "Watch through this 1-hour presentation"

AI uses streaming:
1. stream_start → Initialize and see first 30 seconds
2. stream_next → Advance to 0:30-1:00
3. stream_next → Continue to 1:00-1:30
... continues until video ends

Result: Progressive understanding with maintained context state
```

### 🆕 Chunk-Based Analysis

```
User: "Analyze this video section by section"

AI uses chunks:
1. get_video_chunks → See video has 10 chunks of 30s each
2. analyze_chunk(0) → Analyze first chunk with audio
3. analyze_chunk(1) → Continue with second chunk
...

Result: Systematic coverage with audio support
```

### Quick Metadata Check

```
User: "How long is this video?"

AI: get_video_metadata → Returns duration, resolution, etc. (~100 tokens)
```

### Planning Large Analysis

```
AI: estimate_analysis_cost(frameCount=20)
← "Estimated 120K tokens. Consider progressive fetching."

AI: get_video_overview → Reviews timestamps
AI: get_frames_batch([key_timestamps]) → Only important moments
```

## 📊 Token Cost Reference

| Tool | Typical Cost | Use Case |
|------|--------------|----------|
| `get_video_overview` | ~200 tokens | Always first |
| `get_video_metadata` | ~100 tokens | Quick specs |
| `estimate_analysis_cost` | ~150 tokens | Planning |
| `get_frame` | ~10K tokens | Single frame |
| `get_frames_batch` | ~25-75K tokens | Multiple frames (max 5) |
| `extract_audio` | ~50 tokens | Audio extraction |
| `detect_scenes` | ~200 tokens | Find scene changes |
| `get_scene_frames` | ~10-50K tokens | Frames at scene changes |
| `get_video_chunks` | ~150 tokens | Plan chunk analysis |
| `analyze_chunk` | ~15-25K tokens | Single chunk + audio |
| `stream_start` | ~15K tokens | Begin streaming |
| `stream_next` | ~15K tokens | Continue streaming |
| `stream_status` | ~100 tokens | Check progress |
| `transcribe_audio` | ~100+ tokens | Whisper transcription* |
| `analyze_video_full` | ~50-150K+ tokens | Full analysis (avoid) |
| `get_frame` | 5K-15K tokens | Progressive fetching |
| `get_frames_batch` (5) | 25K-75K tokens | Multiple specific frames |
| `analyze_video_full` | 50K-150K+ tokens | Full analysis (rare) |

## 🏗️ Architecture

```
mcp-video-reader/
├── src/
│   ├── index.ts              # MCP server with tiered tools
│   ├── video-processor.ts    # Processing with progressive support
│   └── types.ts              # Context-aware types
├── CONTEXT_ENGINEERING.md    # Principles documentation
├── build/                    # Compiled code
├── package.json
└── tsconfig.json
```

## 🔧 Development

```bash
# Build in watch mode
npm run watch

# Test locally
npm run build && node build/index.js
```

## 📝 Supported Formats

All FFmpeg-supported formats including:
* **Video**: mp4, avi, mov, mkv, webm, flv, wmv, m4v, mpg, 3gp
* **Containers**: ts, mts, m2ts, vob, ogv

## ⚠️ Important Notes

1. **Frames are JPEG by default** - Smaller than PNG, suitable for most analysis
2. **Max 1920px width** - Larger images are resized automatically
3. **Temp files** - Audio/frames stored in `/tmp/mcp-video-reader/`
4. **Batch limit** - `get_frames_batch` limited to 5 frames for context management

## 📄 License

MIT

## 📚 Further Reading

* [CONTEXT_ENGINEERING.md](CONTEXT_ENGINEERING.md) - Detailed principles
* [Anthropic: Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
* [Inferable: Progressive Context Enrichment](https://www.inferable.ai/blog/posts/llm-progressive-context-encrichment)
