# Privacy and Security

[← Back to Context Management](07-context-management.md) | [Next: Performance Analysis →](09-performance.md)

---

## Memedge Implementation

### Privacy Markers System

Memedge has a built-in privacy markers system that automatically respects user privacy preferences:

#### How It Works

1. **LLM Recognition** - Detects privacy cues:
   - "this is private"
   - "confidential"
   - "don't share"
   - "for my eyes only"

2. **Marker Assignment** - Maps to structured markers:
   - `[PRIVATE]`
   - `[CONFIDENTIAL]`
   - `[DO NOT SHARE]`
   - `[PERSONAL]`
   - `[PUBLIC]`

3. **Structured Storage** - Stores with markers:
   - Example: `"[PRIVATE] Health: Diabetes"`

4. **Context-Aware Retrieval** - Filters based on context:
   - User asks "Share with HR" → Filters [PRIVATE] items
   - User asks "What's my health?" → Includes [PRIVATE] items (direct request)

### Privacy Levels

| Marker | Behavior | Use Case |
|--------|----------|----------|
| `[PRIVATE]` | Exclude from summaries | Personal information |
| `[CONFIDENTIAL]` | Business secrets | Work-related sensitive data |
| `[DO NOT SHARE]` | Strictest filter | Explicit prohibition |
| `[PERSONAL]` | For user only | Intimate information |
| `[PUBLIC]` | Always shareable | Explicitly public data |
| No marker | Default (contextual) | General information |

### Read-Before-Write Pattern

**Problem**: `memory_write` uses INSERT OR REPLACE → Writing without reading erases existing data!

#### ❌ WRONG Approach
```typescript
// User: "Add: I have athlete's foot (private)"
memory_write("health_info", "[PRIVATE] Athlete's foot")
// Result: Erases "Allergic to penicillin"!
```

#### ✅ CORRECT Approach
```typescript
// Step 1: Read existing data
const existing = memory_read("health_info")
// → Returns: "Allergic to penicillin. Sprained ankle"

// Step 2: Merge new info
const merged = existing + ". [PRIVATE] Athlete's foot"

// Step 3: Write merged data
memory_write("health_info", merged)
// Result: All data preserved! ✓
```

#### Enforcement
- Tool description emphasizes pattern
- Examples demonstrate correct usage
- Error messages guide correction

---

## Letta's Implementation

- **No built-in privacy markers** - all data treated equally
- **Agent discretion** - relies on LLM to manage sensitive information
- **Core memory is visible** - no automatic filtering
- **Authentication** - REST API with auth tokens
- **Identity management** - Multi-user support

---

## Comparison

| Feature | Memedge | Letta |
|---------|-------------------|-------|
| **Privacy Markers** | ✅ Built-in system | ❌ Not included |
| **Automatic Filtering** | ✅ Context-aware | ❌ Manual |
| **Data Loss Prevention** | ✅ Read-before-write | ⚠️ Agent responsibility |
| **Privacy Levels** | ✅ 5 levels | N/A |
| **User Education** | ✅ Extensive prompts | ⚠️ Basic |
| **Authentication** | ✅ Cloudflare auth | ✅ Built-in auth |
| **Multi-tenancy** | ✅ Per-agent isolation | ✅ Multi-user support |

**Winner: Memedge** - More sophisticated privacy handling with built-in markers and data loss prevention.

---

[← Back to Context Management](07-context-management.md) | [Next: Performance Analysis →](09-performance.md)

