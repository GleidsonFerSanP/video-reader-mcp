# Contract Reference - mcp-video-reader

> Critical interfaces and validation workflows.

## Key Interfaces (Contracts)

These interfaces define the data structures that **must be respected** across the codebase.

### VideoOverview Contract

The primary response structure for progressive context:

```typescript
interface VideoOverview {
  videoPath: string;
  filename: string;
  metadata: VideoMetadataSummary;
  availableFrames: FrameReference[];
  audio: {
    available: boolean;
    durationSeconds?: number;
    extractedPath?: string;
  };
  contextHints: ContextHint[];
}
```

**Rules**:
1. `availableFrames` must contain timestamps only, not actual frame data
2. `contextHints` must always be populated with actionable suggestions
3. `metadata` uses human-readable `VideoMetadataSummary`, not raw `VideoMetadata`

---

### ContextHint Contract

Guides LLM behavior after tool responses:

```typescript
interface ContextHint {
  type: 'action' | 'warning' | 'info' | 'suggestion';
  message: string;
  suggestedTool?: string;
  priority: number;  // Higher = more important
}
```

**Rules**:
1. Every tool response should include at least one hint
2. `action` type requires `suggestedTool`
3. `warning` type for token budget concerns
4. Priority 1-10, use 8+ sparingly

---

### FrameReference Contract

Lightweight frame pointer (not the actual data):

```typescript
interface FrameReference {
  index: number;
  timestamp: number;
  timestampFormatted: string;  // "2:35" format
  resolution: string;          // "1920x1080"
  estimatedTokens: number;     // ~10000 for JPEG
}
```

**Rules**:
1. Must not contain base64 data (that's `FrameData`)
2. `estimatedTokens` calculated based on resolution
3. `timestampFormatted` uses `m:ss` format

---

### Tool Response Contract

Consistent response structure for all tools:

```typescript
interface ToolResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  contextHints?: ContextHint[];
  tokenEstimate?: TokenEstimate;
}
```

**Rules**:
1. `success: false` must include `error`
2. `success: true` must include `data`
3. Include `contextHints` when possible
4. Include `tokenEstimate` for heavy operations

---

## Registering Contracts

When you identify a critical interface that must be enforced:

```typescript
register_contract({
  name: "VideoOverview",
  context: "backend",
  description: "Primary response structure for progressive video analysis",
  interface_code: `interface VideoOverview {
    videoPath: string;
    filename: string;
    metadata: VideoMetadataSummary;
    availableFrames: FrameReference[];
    audio: { available: boolean; ... };
    contextHints: ContextHint[];
  }`,
  rules: [
    "availableFrames contains timestamps only, not frame data",
    "contextHints always populated with actionable suggestions",
    "metadata uses VideoMetadataSummary, not raw VideoMetadata"
  ],
  file_path: "./src/types.ts"
})
```

---

## Validating Code Against Contracts

Before completing changes that touch contract interfaces:

```typescript
validate_contract({
  contract_name: "VideoOverview",
  code: `
    const overview: VideoOverview = {
      videoPath: path,
      filename: basename,
      metadata: summary,
      availableFrames: frames,
      audio: { available: true },
      // Missing contextHints!
    };
  `
})
// Returns: Violation - contextHints must be populated
```

---

## Contract Checklist

When modifying these files, validate:

| File | Contracts to Check |
|------|-------------------|
| `./src/index.ts` | `ToolResponse` , `ContextHint` |
| `./src/video-processor.ts` | `VideoOverview` , `FrameReference` , `FrameData` |
| `./src/types.ts` | All (source of truth) |

---

## Getting Contracts

```typescript
// Get all contracts for this project
get_contracts({ context: "backend" })

// Search specific contract
get_contracts({ search: "VideoOverview" })
```
