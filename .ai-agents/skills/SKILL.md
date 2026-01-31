# SKILL.md - mcp-video-reader Development

> Progressive disclosure hub for AI agents working on this MCP server.

## Quick Start

```typescript
// Session startup (ALWAYS use relative paths!)
identify_context({ file_path: "./src/index.ts" })
get_current_focus()
start_session({ context: "backend", current_focus: "task description" })
```

**Path Convention**: Always `./path/to/file.ts` - never absolute paths.

---

## Core Concepts

### This Is an MCP Server

* Exposes tools via Model Context Protocol
* Tools are defined in `./src/index.ts` TOOLS array
* Handlers process tool calls in switch statement
* Uses `@modelcontextprotocol/sdk` for server implementation

### Progressive Context Enrichment

The server's design philosophy - fetch context progressively:

```
Step 1: get_video_overview    → Light metadata, frame timestamps
Step 2: get_frame(timestamp)  → Specific frame on demand
Step 3: extract_audio         → Audio path (not data)
```

Never use `analyze_video_full` unless video is <1 minute.

---

## When Working On...

### Adding a New Tool

→ See [PATTERNS-REFERENCE.md](PATTERNS-REFERENCE.md#adding-tools)

### Modifying Video Processing

→ See [PATTERNS-REFERENCE.md](PATTERNS-REFERENCE.md#video-processor)

### Understanding Types

→ Read `./src/types.ts` directly - it's well documented

### Session Management

→ See [SESSION-WORKFLOW.md](SESSION-WORKFLOW.md)

### Documenting Changes

→ See [DOCUMENTATION-WORKFLOW.md](DOCUMENTATION-WORKFLOW.md)

---

## Architecture at a Glance

```
┌─────────────────┐
│  MCP Client     │ (Claude, etc.)
└────────┬────────┘
         │ JSON-RPC
┌────────▼────────┐
│  Server         │ ./src/index.ts
│  - TOOLS array  │
│  - Handlers     │
└────────┬────────┘
         │
┌────────▼────────┐
│ VideoProcessor  │ ./src/video-processor.ts
│  - getMetadata  │
│  - extractFrame │
│  - extractAudio │
└────────┬────────┘
         │
┌────────▼────────┐
│  FFmpeg/FFprobe │ (via npm packages)
└─────────────────┘
```

---

## Anti-Patterns

❌ **Don't** use absolute paths in MCP tool calls
❌ **Don't** skip `identify_context` at session start
❌ **Don't** create tools without documenting token cost
❌ **Don't** return raw video data - use base64 for images
❌ **Don't** forget context hints in tool responses
❌ **Don't** use `analyze_video_full` for long videos

---

## MCP Tool Reference

### Session Tools

| Tool | Purpose |
|------|---------|
| `identify_context` | Auto-detect project context from file |
| `start_session` | Begin focused work session |
| `get_current_focus` | Get active session state |
| `update_focus` | Change direction mid-session |
| `create_checkpoint` | Save progress milestone |
| `complete_session` | Mark session done |

### Guidelines & Contracts

| Tool | Purpose |
|------|---------|
| `get_merged_guidelines` | Load all applicable guidelines |
| `register_contract` | Define interface contracts |
| `validate_contract` | Check code against contract |

### Documentation

| Tool | Purpose |
|------|---------|
| `check_existing_documentation` | Before creating new docs |
| `manage_documentation` | Create/update docs |
| `add_decision` | Record ADRs |

---

## Files to Know

| File | Purpose | When to Read |
|------|---------|--------------|
| `./src/index.ts` | Tool definitions, handlers | Adding/modifying tools |
| `./src/video-processor.ts` | FFmpeg operations | Video processing changes |
| `./src/types.ts` | TypeScript interfaces | Any type-related work |
| `./package.json` | Dependencies, scripts | Adding deps, build config |
| `./tsconfig.json` | TypeScript config | Compiler issues |
