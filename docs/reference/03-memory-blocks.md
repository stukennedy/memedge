# Memory Block Systems

[← Back to Feature Comparison](02-feature-comparison.md) | [Next: Semantic Search →](04-semantic-search.md)

---

## Memedge Implementation

### Standard Memory Blocks

```typescript
interface MemoryBlock {
  id: string;              // Unique identifier
  label: string;           // Human-readable name
  content: string;         // The actual memory content
  type: "core" | "archival"; // Core = always loaded
  updated_at: number;      // Last modification timestamp
  metadata?: Record<string, any>; // Extensible metadata
}
```

**Standard Blocks:**
- `human`: Information about the user (preferences, history, context)
- `persona`: Agent's identity, role, and capabilities  
- `context`: Current session context and active topics
- **Custom blocks**: User-defined categories (projects, technical_profile, health_info, etc.)

### Key-Value Memory (Legacy Compatible)

```typescript
interface MemoryEntry {
  purpose: string;         // Key/purpose identifier
  text: string;           // Content with privacy markers
  updated_at: number;     // Timestamp
}
```

**Privacy-Aware Features:**
- Supports `[PRIVATE]`, `[CONFIDENTIAL]`, `[DO NOT SHARE]` markers
- LLM automatically respects context when sharing
- Read-before-write pattern prevents data loss

---

## Letta's Implementation

### Core Memory Blocks

```python
{
  "human": "Name: Sarah\nOccupation: Software Engineer\nPreferences: Concise responses",
  "persona": "I am a helpful AI assistant specialized in coding tasks",
  "system": "Agent configuration and behavior guidelines"
}
```

**Characteristics:**
- Fixed structure (human, persona, system)
- No built-in privacy markers
- Simple key-value within each block
- Size limits enforced per block

---

## Comparison

| Aspect | Memedge | Letta |
|--------|---------|-------|
| Block Structure | Flexible, extensible with metadata | Fixed three-block structure |
| Custom Blocks | ✅ Unlimited custom blocks | ⚠️ Limited customization |
| Privacy Features | ✅ Built-in privacy markers | ❌ Not included |
| Block Types | Core + Archival distinction | Core only (archival separate) |
| Metadata | ✅ JSON metadata per block | ❌ Not supported |
| Organization | Encourages granular organization | Tends toward monolithic blocks |

**Winner: Memedge** - More flexible, privacy-aware, and better organized.

---

[← Back to Feature Comparison](02-feature-comparison.md) | [Next: Semantic Search →](04-semantic-search.md)

