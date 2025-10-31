# Recursive Summarization

[← Back to Memory Tools](05-memory-tools.md) | [Next: Context Management →](07-context-management.md)

---

## Memedge Implementation

**Implementation Location**: `src/services/summaries/`
- **Trigger**: `session-manager.ts` → `summarizeSession()` (on message cleanup)
- **Logic**: `recursive-summarization.ts` → `createBaseSummary()`, `createRecursiveSummary()`
- **Integration**: `llm-orchestration.ts` → `generateResponse()` (loads summaries into prompt)

### Hierarchical Summary System

```
┌─────────────────────────────────────────────────────────────┐
│              Recursive Summarization System                  │
│                                                               │
│  Automatically triggered after each session cleanup          │
│  Timeline: ──────────────────────────────────────►          │
│                                                               │
│  Messages (1-20) → L0 Summary                               │
│  Messages (21-40) → L0 Summary                              │
│  Messages (41-60) → L0 Summary                              │
│  ...                                                          │
│                                                               │
│  10 x L0 Summaries → L1 Summary (200 messages)              │
│  10 x L1 Summaries → L2 Summary (2,000 messages)            │
│  10 x L2 Summaries → L3 Summary (20,000 messages)           │
│                                                               │
│  Context Loading Strategy:                                   │
│  1. Load most recent L2 summary (if exists)                 │
│  2. Load most recent L1 summary (if exists)                 │
│  3. Load last 3 L0 summaries                                │
│  4. Load current active messages (unsummarized)             │
│                                                               │
│  Storage: conversation_summaries_v2 table                    │
│  - id, summary, level, message_count, parent, created_at    │
└─────────────────────────────────────────────────────────────┘
```

### Configuration

```typescript
{
  baseSummaryThreshold: 20,    // Messages before L0 summary
  recursiveThreshold: 10,       // Summaries before next level
  maxLevel: 3,                  // Max recursion depth
  recentSummaryCount: 3         // Recent summaries to load
}
```

### Example Scale

- 20 messages → 1 L0 summary
- 200 messages → 10 L0 summaries → 1 L1 summary  
- 2,000 messages → 10 L1 summaries → 1 L2 summary
- 20,000 messages → 10 L2 summaries → 1 L3 summary

### Context for 10,000 messages

- 1 x L2 summary (1,000-2,000 messages)
- 1 x L1 summary (100-200 messages)
- 3 x L0 summaries (last 60-80 messages)
- Current unsummarized messages
- **Total**: ~6-7 summary blocks vs. 10,000 raw messages

### Benefits

- **Logarithmic growth**: 10k messages = ~13 summaries
- Maintain both recent detail and long-term context
- Efficient context window usage
- Automatic consolidation when threshold reached

---

## Letta's Implementation

Letta has a simpler summarization approach:

### Approach

- **Recent Messages**: Last N messages kept in full (typically 20-50)
- **Archival Memory**: Older messages stored with embeddings
- **On-Demand Retrieval**: Retrieved via conversation_search when needed

### Context Loading Strategy

1. Load core memory blocks (human, persona, system)
2. Load last N messages in full
3. If context needed, agent calls conversation_search
4. Retrieved messages temporarily in context

### Characteristics

- No automatic summarization
- Relies on:
  - Core memory blocks for persistent facts
  - Archival for full message history
  - Agent-driven retrieval when needed

---

## Comparison

| Aspect | Memedge | Letta |
|--------|-------------------|-------|
| **Approach** | Automatic hierarchical summarization | Archival + on-demand retrieval |
| **Context Efficiency** | Very high (log growth) | Medium (linear for recent) |
| **History Access** | Layered summaries | Full messages via search |
| **Automation** | Fully automatic | Agent-driven retrieval |
| **Long-term Context** | Always present via L2/L3 | Requires explicit search |
| **Detail Preservation** | Recent: high, Old: condensed | Recent: full, Old: full but not in context |
| **Context Size** | ~6-7 blocks for 10k msgs | ~50 messages + retrieval |
| **Implementation Complexity** | High (recursive logic) | Low (simple archival) |
| **Best For** | Long conversations, continuous context | Short interactions, specific recall |

**Winner: Memedge (for long conversations)** - Automatic, efficient, maintains long-term context. Letta wins for applications needing exact historical messages.

---

[← Back to Memory Tools](05-memory-tools.md) | [Next: Context Management →](07-context-management.md)

