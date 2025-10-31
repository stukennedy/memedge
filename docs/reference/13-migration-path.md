# Migration Path

[← Back to Implementation Robustness](12-implementation-robustness.md) | [Next: Conclusion →](14-conclusion.md)

---

## From Basic Memory to Block System

Memedge supports gradual migration through a dual memory system.

### Phase 1: Use Key-Value Memory (Current)

```typescript
memory_read("user_profile")
memory_write("user_profile", "Name: Bob")
```

### Phase 2: Add Block System Alongside

```typescript
// Old code still works
memory_read("user_profile")

// New code uses blocks
memory_get_block("human")
memory_insert("human", "Lives in NYC")
```

### Phase 3: Migrate Data

```typescript
// Read from old format
const old = await memory_read("user_profile")

// Create in new format
await memory_create_block(
  "human",
  "Human",
  old.text,
  "core"
)

// Optionally delete old
// await deleteMemory("user_profile")
```

### Phase 4: Use Block Tools Exclusively

```typescript
memory_get_block("human")
memory_insert("human", "New info")
memory_replace("human", "old", "new")
memory_rethink("human", "Condensed version")
```

---

## From Letta to Memedge

### 1. Core Memory Blocks (Direct mapping)

**Letta:**
```python
core_memory_append("human", "Lives in NYC")
```

**Ours:**
```typescript
memory_insert("human", "Lives in NYC", "end")
```

### 2. Core Memory Replace

**Letta:**
```python
core_memory_replace("human", "NYC", "SF")
```

**Ours:**
```typescript
memory_replace("human", "NYC", "SF")
```

### 3. Archival Memory

**Letta:**
```python
archival_memory_insert("Important fact")
archival_memory_search("query", page=0)
```

**Ours:**
```typescript
archival_insert("Important fact", {tags: [...]})
archival_search("query", limit=10)
```

### 4. Conversation Search

**Letta:**
```python
conversation_search("topic", page=0)
```

**Ours:**
```typescript
// Use summaries + memory_search
memory_search("topic", limit=5)
// Or search archival if older
archival_search("topic", limit=10)
```

### 5. Data Export/Import

```typescript
// Export from Letta (via API)
const lettaData = await lettaAPI.exportAgent(id)

// Import to Memedge
await memory_create_block("human", "Human",
  lettaData.memory.human, "core")
await memory_create_block("persona", "Persona",
  lettaData.memory.persona, "core")

// Import archival
for (const entry of lettaData.archival) {
  await archival_insert(entry.content, entry.metadata)
}
```

---

## Migration Best Practices

### 1. Start Small
- Begin with a single agent or test environment
- Validate functionality before full migration
- Test edge cases and error scenarios

### 2. Gradual Adoption
- Keep both systems running in parallel initially
- Migrate features incrementally
- Monitor performance and correctness

### 3. Data Validation
- Verify all data transferred correctly
- Check embedding generation for new blocks
- Validate search functionality

### 4. Rollback Plan
- Maintain original data until confident
- Document rollback procedures
- Test rollback process in staging

### 5. Performance Testing
- Monitor latency during migration
- Verify semantic search accuracy
- Check context window assembly

---

[← Back to Implementation Robustness](12-implementation-robustness.md) | [Next: Conclusion →](14-conclusion.md)

