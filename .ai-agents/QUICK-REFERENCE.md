# Quick Reference - mcp-video-reader

> Condensed checklist for AI agents. Keep in context.

## Every Conversation

```
□ identify_context({ file_path: "./src/..." })
□ get_current_focus() 
□ start_session({ context: "backend", current_focus: "..." })
□ [work]
□ create_checkpoint({ summary: "...", next_focus: "..." })
□ complete_session()
```

**⚠️ RELATIVE PATHS ONLY**: `./src/index.ts` not `/Users/.../src/index.ts`

---

## Tool Tiers (Always Use Tier 1 First)

| Tier | Tool | Tokens | When |
|------|------|--------|------|
| 1 | `get_video_overview` | ~200 | **FIRST** - get metadata |
| 1 | `get_video_metadata` | ~100 | Tech specs only |
| 1 | `estimate_analysis_cost` | ~50 | Before large ops |
| 2 | `get_frame` | ~10K | Single frame on demand |
| 2 | `get_frames_batch` | ~50K | Max 5 frames |
| 2 | `extract_audio` | ~50 | Audio path for transcription |
| 3 | `analyze_video_full` | ~100K+ | ⚠️ Only <1 min videos |

---

## Code Changes Checklist

```
□ Types updated in ./src/types.ts
□ Tool defined in TOOLS array (./src/index.ts)
□ Handler added in switch statement
□ Token cost documented in description
□ Context hints included in response
□ Build passes: npm run build
```

---

## File Map

```
./src/index.ts           - Tool definitions + handlers
./src/video-processor.ts - Processing logic
./src/types.ts           - All interfaces
./build/                 - Compiled JS (gitignored patterns)
```

---

## Patterns

**Response structure**:

```typescript
{
  success: boolean,
  data: { ... },
  contextHints: [{ type, message, suggestedTool, priority }],
  nextSteps: string[]
}
```

**Error handling**:

```typescript
if (!await checkFile(videoPath)) {
  return { success: false, error: `File not found: ${videoPath}` };
}
```

---

## Links

* [AGENTS.md](../AGENTS.md) - Full documentation
* [skills/SKILL.md](skills/SKILL.md) - Progressive disclosure hub
* [skills/PATTERNS-REFERENCE.md](skills/PATTERNS-REFERENCE.md) - Code patterns
