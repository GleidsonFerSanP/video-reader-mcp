# Video Reader MCP - VS Code Extension

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A VS Code extension that enables AI models (GitHub Copilot) to read and analyze video files using **Progressive Context Enrichment** principles.

## 🆕 What's New in v2.0.0

* 🎬 **Scene Detection**: Automatically find scene changes and extract representative frames
* 📦 **Chunk Analysis**: Break long videos into analyzable chunks (~30s each)
* 🎥 **Stream Analysis**: Simulate "watching" videos progressively with memory
* 🎤 **Whisper Transcription**: Transcribe audio using OpenAI Whisper API (requires `OPENAI_API_KEY`)

## Features

* 🎬 **Video Analysis**: Extract metadata, frames, and audio from video files
* 🚀 **Auto-configuration**: Automatically configures MCP server for GitHub Copilot Chat
* 📊 **Progressive Context**: Start with lightweight overviews, fetch details on demand
* 🎯 **Token Efficient**: Minimizes context consumption while maximizing utility

## Quick Start

1. **Install the extension** from the VS Code Marketplace
2. **Restart VS Code** - the MCP server auto-configures
3. **Open Copilot Chat** and ask about videos!

### Example Usage

In GitHub Copilot Chat:

```
@workspace Analyze this video: /path/to/video.mp4
```

The AI will use progressive context enrichment:
1. First get a lightweight overview (~200 tokens)
2. Then fetch specific frames on demand (~10K tokens per frame)
3. Extract audio if needed for transcription

## Available Tools

| Tool | Description | Token Cost |
|------|-------------|------------|
| `get_video_overview` | Get video metadata and frame timestamps | ~200 tokens |
| `get_video_metadata` | Technical specs: duration, resolution, fps | ~100 tokens |
| `estimate_analysis_cost` | Estimate tokens before extracting frames | ~50 tokens |
| `get_frame` | Extract a single frame at timestamp | ~10K tokens |
| `get_frames_batch` | Extract multiple frames (max 5) | ~50K tokens |
| `extract_audio` | Extract audio track | ~50 tokens |
| `detect_scenes` | Find scene change timestamps | ~200 tokens |
| `get_scene_frames` | Extract frames at scene boundaries | ~10-50K tokens |
| `get_video_chunks` | Plan chunk-based analysis | ~150 tokens |
| `analyze_chunk` | Analyze single chunk with frames + audio | ~15-25K tokens |
| `stream_start` | Start streaming analysis session | ~15K tokens |
| `stream_next` | Continue to next video segment | ~15K tokens |
| `stream_status` | Check streaming progress | ~100 tokens |
| `transcribe_audio` | Transcribe with Whisper API* | ~100+ tokens |
| `analyze_video_full` | Full video analysis (use sparingly) | ~100K+ tokens |

\* Requires `OPENAI_API_KEY` environment variable

## Commands

* **Video Reader MCP: Configure** - Update MCP server configuration
* **Video Reader MCP: Restart** - Restart the MCP server
* **Video Reader MCP: Status** - Check server status and available tools
* **Video Reader MCP: Open Documentation** - View full documentation

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `videoReaderMcp.autoStart` | `true` | Auto-start MCP server on VS Code startup |
| `videoReaderMcp.logLevel` | `info` | Log level (error, warn, info, debug) |
| `videoReaderMcp.defaultFrameQuality` | `80` | JPEG quality for extracted frames (1-100) |
| `videoReaderMcp.maxFrameWidth` | `1920` | Maximum width for extracted frames |

## ⚙️ Configuration for Transcription

To enable audio transcription with OpenAI Whisper, set the `OPENAI_API_KEY` environment variable:

```json
// In your settings.json or extension configuration
{
  "env": {
    "OPENAI_API_KEY": "sk-your-api-key-here"
  }
}
```

## Requirements

* VS Code 1.85.0 or higher
* GitHub Copilot Chat extension
* No external FFmpeg installation required (bundled)
* OpenAI API key (optional, for transcription)

## Progressive Context Enrichment

This extension implements the Progressive Context Enrichment pattern:

```
❌ Bad:  analyze_video_full → ALL frames → 100K+ tokens
✅ Good: get_video_overview → get_frame(t=30) → get_frame(t=90) → ~20K tokens
```

The AI starts with lightweight metadata and progressively fetches specific data as needed, keeping token usage minimal.

## Troubleshooting

### MCP Server not appearing in Copilot

1. Run command: **Video Reader MCP: Status**
2. Check if server is configured
3. Restart VS Code
4. If issues persist, run: **Video Reader MCP: Configure**

### Check Output

View detailed logs:
1. Open **Output** panel (`Ctrl+Shift+U` / `Cmd+Shift+U`)
2. Select **Video Reader MCP** from dropdown

## License

MIT - see [LICENSE](LICENSE)

## Repository

[https://github.com/GleidsonFerSanP/video-reader-mcp](https://github.com/GleidsonFerSanP/video-reader-mcp)
