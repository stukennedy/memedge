# Context Management

[← Back to Recursive Summarization](06-recursive-summarization.md) | [Next: Privacy & Security →](08-privacy-security.md)

---

## Memedge Context Assembly

**Implementation Location**: `src/services/llm-orchestration.ts` → `generateResponse()`

### System Prompt Assembly Code

```typescript
// Actual system prompt assembly code:
const systemPrompt =
  persona.system_prompt           // Base agent instructions
  + memoryContext                 // Legacy key-value memories  
  + blockContext                  // NEW: Memory blocks (Letta-style)
  + summaryContext                // NEW: Recursive summaries
  + toolInstruction;              // Tool definitions

// Where:
// blockContext = yield* MemoryBlocks.buildCoreMemoryContext()
// summaryContext = RecursiveSummarization.buildSummaryContext(summaries)
```

### Token Allocation (~8K tokens total)

**1. System Prompt (~500 tokens)**
- Agent persona (persona.system_prompt)
- General instructions
- Tool descriptions

**2. Core Memory (~800 tokens)**
- human block: ~300 tokens
- persona block: ~200 tokens
- context block: ~300 tokens
- custom blocks: Variable

**3. Conversation History (~2000 tokens)**
- L2 Summary (if any): ~200 tokens
- L1 Summary (if any): ~300 tokens
- Recent L0 Summaries: ~500 tokens (3 x ~170)
- Unsummarized Messages: ~1000 tokens

**4. Retrieved Archival (~500 tokens, if any)**
- Dynamically loaded via memory_search
- Top 3-5 relevant entries

**5. Current Interaction (~4000 tokens)**
- User's current message
- Agent's response space
- Tool calls and results

### Dynamic Optimization

- If context grows too large, condense older summaries
- Move less relevant blocks to archival
- Agent can use memory_rethink to condense blocks

---

## Letta's Context Assembly

### Token Allocation (~8K tokens total)

**1. System Prompt (~800 tokens)**
- MemGPT core instructions
- Memory management guidelines
- Tool descriptions

**2. Core Memory (~600 tokens)**
- human: "..." ~250 tokens
- persona: "..." ~200 tokens
- system: "..." ~150 tokens

**3. Recent Conversation (~3000 tokens)**
- Last 20-50 messages in full
- (user + assistant + function calls)

**4. Current Interaction (~3600 tokens)**
- User's current message
- Agent's response space
- Tool calls and results

### Archival Memory
- **NOT in context by default**
- Agent must explicitly call archival_memory_search
- Retrieved content temporarily added to context
- Removed after use to save space

---

## Comparison

| Aspect | Memedge | Letta |
|--------|-------------------|-------|
| **Core Memory Size** | ~800 tokens | ~600 tokens |
| **History Handling** | Hierarchical summaries (~2000 tokens) | Recent full messages (~3000 tokens) |
| **Long-term Context** | Always present (L2/L3) | Requires explicit retrieval |
| **Flexibility** | Custom blocks + flexible allocation | Fixed structure |
| **Context Optimization** | Automatic via summarization | Manual via agent |
| **Archival Access** | Can be in context or searched | Search only |
| **Token Efficiency** | High (10k msgs in ~2k tokens) | Medium (50 msgs in ~3k tokens) |
| **Best For** | Long conversations, continuous context | Recent focus, explicit retrieval |

**Winner: Memedge** - More efficient token usage, better long-term context, automatic optimization.

---

[← Back to Recursive Summarization](06-recursive-summarization.md) | [Next: Privacy & Security →](08-privacy-security.md)

