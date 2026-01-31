# GitHub Copilot Instructions - mcp-video-reader

## Project Context

This is an **MCP (Model Context Protocol) server** for video analysis implementing **Progressive Context Enrichment**. Read [AGENTS.md](../AGENTS.md) for full context.

## Critical Rules

### Path Convention

**ALWAYS use relative paths in MCP tool calls**:
```typescript
// ✅ Correct
identify_context({ file_path: "./src/index.ts" })

// ❌ Wrong - breaks cross-machine
identify_context({ file_path: "/Users/name/project/src/index.ts" })
```

### Session Workflow

Start every conversation with:
```typescript
identify_context({ file_path: "./src/..." })
get_current_focus()
start_session({ context: "backend", current_focus: "..." })
```

End with:
```typescript
create_checkpoint({ summary: "...", next_focus: "..." })
complete_session()
```

---

## Code Guidelines

### TypeScript
- Strict mode enabled
- Explicit return types on functions
- No `any` - use `unknown` with type guards

### Tool Design
- Document token cost in description
- Include context hints in responses
- Check file existence before processing
- Return `success: boolean` in all responses

### File Locations
| What | Where |
|------|-------|
| Tool definitions | `./src/index.ts` TOOLS array |
| Tool handlers | `./src/index.ts` switch statement |
| Processing logic | `./src/video-processor.ts` |
| Type definitions | `./src/types.ts` |

---

## MCP Tools Available

### Session Management
- `identify_context` - Know your context
- `start_session` / `complete_session` - Manage work sessions
- `create_checkpoint` - Save progress
- `get_merged_guidelines` - Load rules

### Documentation
- `check_existing_documentation` - Before creating docs
- `manage_documentation` - Create/update docs
- `add_decision` - Record ADRs

### Patterns & Contracts
- `learn_pattern` - Teach new patterns
- `register_contract` - Define critical interfaces
- `validate_contract` - Check code against contracts

---

## Quick Reference

### Adding a New Tool

1. Add to `TOOLS` array in `./src/index.ts`:
```typescript
{
  name: 'tool_name',
  description: `What it does. ~X tokens cost.`,
  inputSchema: { type: 'object', properties: {...}, required: [...] }
}
```

2. Add handler in switch:
```typescript
case 'tool_name': {
  const { param } = args as { param: string };
  // Check file, process, return with hints
}
```

3. Update types in `./src/types.ts` if needed

### Response Pattern

```typescript
{
  success: true,
  data: { ... },
  contextHints: [{ type: 'suggestion', message: '...', suggestedTool: '...' }],
  nextSteps: ['...']
}
```

---

## Anti-Patterns

❌ Absolute paths in MCP calls
❌ Tools without token cost documentation
❌ Responses without context hints
❌ Using `analyze_video_full` for long videos
❌ Skipping `identify_context` at start
