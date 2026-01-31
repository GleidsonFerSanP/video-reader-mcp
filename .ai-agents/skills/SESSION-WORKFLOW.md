# Session Workflow - mcp-video-reader

> Detailed session management for multi-turn development tasks.

## Session Lifecycle

```
┌─────────────┐
│   START     │ identify_context + get_current_focus
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  WORKING    │ start_session (if no active session)
│             │ get_merged_guidelines
└──────┬──────┘
       │
       ▼ (every ~10 turns)
┌─────────────┐
│ CHECKPOINT  │ create_checkpoint
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  COMPLETE   │ complete_session
└─────────────┘
```

---

## Starting a Session

### Always Do First

```typescript
// 1. Identify context (RELATIVE PATH!)
identify_context({ file_path: "./src/index.ts" })

// 2. Check for existing session
get_current_focus()
```

### If No Active Session

```typescript
start_session({
  context: "backend",  // This is a backend-only project
  current_focus: "Implement get_scene_frames tool",
  active_contracts: [],  // Add if working with specific interfaces
  active_features: [],   // Add if working on registered features
  focus_reminders: [
    "Document token cost in tool description",
    "Include context hints in response"
  ]
})
```

### If Session Exists

```typescript
// Resume or update focus
update_focus({
  new_focus: "Now working on audio extraction improvements",
  reason: "User requested audio feature enhancements"
})
```

---

## During Work

### Refresh Context (Every 10 Turns)

```typescript
refresh_session_context()
```

### Create Checkpoints (After Milestones)

```typescript
create_checkpoint({
  summary: "Added get_scene_frames tool with scene detection logic",
  next_focus: "Add handler in switch statement",
  files_modified: [
    "./src/index.ts",
    "./src/video-processor.ts",
    "./src/types.ts"
  ]
})
```

---

## Validating Work

### Before Completing Session

```typescript
// Validate conversation is on track
validate_conversation_focus({
  proposed_action: "Ready to complete tool implementation"
})
```

### Check for Guideline Violations

```typescript
get_merged_guidelines({ context: "backend" })
// Review against your changes
```

---

## Completing a Session

```typescript
// 1. Final checkpoint
create_checkpoint({
  summary: "Completed get_scene_frames tool with tests",
  next_focus: "Future: Add scene thumbnail generation"
})

// 2. Complete
complete_session({ session_id: "current-session-id" })
```

---

## Session Context Values

For this project, always use:

| Field | Value | Reason |
|-------|-------|--------|
| `context` | `"backend"` | TypeScript MCP server |
| `project_id` | Auto-detected | Via identify_context |

---

## Example Full Session

```typescript
// === SESSION START ===
identify_context({ file_path: "./src/video-processor.ts" })
get_current_focus()
start_session({
  context: "backend",
  current_focus: "Optimize frame extraction performance"
})
get_merged_guidelines({ context: "backend" })

// === WORK ===
// ... make changes ...

// === CHECKPOINT (after significant progress) ===
create_checkpoint({
  summary: "Implemented parallel frame extraction with sharp",
  next_focus: "Add memory management for large videos",
  files_modified: ["./src/video-processor.ts"]
})

// === MORE WORK ===
// ... continue ...

// === COMPLETE ===
create_checkpoint({
  summary: "Performance optimizations complete, 3x faster",
  next_focus: "Future: Add GPU acceleration support"
})
complete_session()
```

---

## Troubleshooting

### "No active session found"

→ Call `start_session` with context and focus

### "Session context is stale"

→ Call `refresh_session_context()`

### "Focus has drifted"

→ Call `update_focus` with new direction

### "Need to switch projects"

→ Call `switch_project({ project_id: "..." })`
