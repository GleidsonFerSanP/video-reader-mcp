# Documentation Workflow - mcp-video-reader

> When and how to create documentation for this project.

## Should I Document This?

Use the MCP tool to check:

```typescript
should_document({
  change_type: "feature",     // feature | bugfix | refactor | architecture | config
  complexity: "medium",       // simple | medium | complex
  description: "Added scene detection tool"
})
```

### Quick Rules

| Change Type | Complexity | Document? |
|-------------|------------|-----------|
| Feature | Complex | ✅ Yes - full doc |
| Feature | Medium | 📝 Maybe - ADR if architectural |
| Feature | Simple | ❌ No - code comments |
| Architecture | Any | ✅ Yes - ADR required |
| Bugfix | Any | ❌ No - commit message |
| Refactor | Complex | 📝 ADR if breaking |
| Config | Any | ❌ No - inline comments |

---

## Before Creating Docs

**Always check for existing documentation first**:

```typescript
check_existing_documentation({
  title: "Video Processing Architecture",
  topics: ["video", "processing", "ffmpeg"],
  keywords: ["frame extraction", "progressive context"],
  context: "backend"
})
```

---

## Creating Documentation

### Standard Documentation

```typescript
manage_documentation({
  action: "create",
  title: "Scene Detection Implementation",
  file_path: "docs/scene-detection.md",
  context: "backend",
  type: "guide",  // architecture | api | guide | troubleshooting | setup
  summary: "How scene detection works in mcp-video-reader",
  topics: ["scene detection", "keyframes", "video analysis"],
  keywords: ["ffmpeg", "scene", "frames"]
})
```

### Architectural Decision Record (ADR)

For significant design decisions:

```typescript
add_decision({
  title: "Use Progressive Context Enrichment Pattern",
  context: "Need to handle large videos without overwhelming LLM context",
  decision: "Implement tiered tool system: Discovery → Fetch → Comprehensive",
  alternatives: [
    "Single monolithic analyze_video tool",
    "Streaming video data to LLM"
  ],
  positive_consequences: [
    "Token budget stays manageable",
    "AI can analyze hour-long videos",
    "Faster response times for simple queries"
  ],
  negative_consequences: [
    "More tool calls required",
    "Slightly more complex implementation"
  ]
})
```

---

## Documentation Types

### Architecture ( `type: "architecture"` )

* System design decisions
* Component relationships
* Data flow diagrams

### API ( `type: "api"` )

* Tool documentation
* Interface specifications
* Usage examples

### Guide ( `type: "guide"` )

* How-to instructions
* Implementation patterns
* Best practices

### Troubleshooting ( `type: "troubleshooting"` )

* Common errors and solutions
* Debug procedures
* FAQ

### Setup ( `type: "setup"` )

* Installation instructions
* Configuration guides
* Environment setup

---

## Updating Existing Docs

```typescript
manage_documentation({
  action: "update",
  document_id: "doc-123",  // From list_documentation
  title: "Scene Detection Implementation",
  file_path: "docs/scene-detection.md",
  context: "backend",
  type: "guide",
  summary: "Updated with new keyframe algorithm"
})
```

---

## Listing Project Documentation

```typescript
// All docs
list_documentation()

// Filtered
list_documentation({
  context: "backend",
  type: "architecture",
  keywords: ["video", "processing"]
})
```

---

## This Project's Doc Structure

```
./AGENTS.md                           # Main agent entry point
./README.md                           # Human-focused readme
./.ai-agents/
├── QUICK-REFERENCE.md                # Condensed checklist
├── copilot-instructions.md           # GitHub Copilot config
└── skills/
    ├── SKILL.md                      # Progressive disclosure hub
    ├── SESSION-WORKFLOW.md           # Session management
    ├── CONTRACT-REFERENCE.md         # Interface contracts
    ├── DOCUMENTATION-WORKFLOW.md     # This file
    └── PATTERNS-REFERENCE.md         # Code patterns
```

---

## Code Comments vs Documentation

### Use Code Comments For

* Function behavior explanation
* Parameter descriptions
* Implementation notes
* TODO/FIXME markers

### Use Documentation For

* System architecture
* Cross-file patterns
* Design decisions
* User-facing guides
