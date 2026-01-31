# MCP Video Reader

An MCP (Model Context Protocol) server that enables AI models to read and analyze videos using **Progressive Context Enrichment** principles.

## 🎯 Key Features

* **Progressive Context Enrichment**: Start light, fetch details on demand
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
      "args": ["/absolute/path/to/mcp-video-reader/build/index.js"]
    }
  }
}
```

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
