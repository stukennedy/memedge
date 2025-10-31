# Semantic Search Implementation

[← Back to Memory Blocks](03-memory-blocks.md) | [Next: Memory Tools →](05-memory-tools.md)

---

## Memedge Implementation

```
┌────────────────────────────────────────────────────────────────┐
│                    Semantic Search Flow                         │
│                                                                  │
│  ┌──────────┐                                                   │
│  │  Query   │                                                   │
│  │ "health  │                                                   │
│  │  info"   │                                                   │
│  └────┬─────┘                                                   │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────┐                                   │
│  │ Cloudflare AI Embedding │                                   │
│  │ @cf/baai/bge-base-en-v1.5│                                  │
│  │                          │                                   │
│  │ Input: "health info"     │                                   │
│  │ Output: [0.23, -0.45,...]│ (768 dims)                       │
│  └────────┬─────────────────┘                                   │
│           │                                                      │
│           ▼                                                      │
│  ┌────────────────────────────┐                                │
│  │  Load All Block Embeddings │                                │
│  │  from SQL                  │                                │
│  │                            │                                │
│  │  block_id    │ embedding   │                                │
│  │ ─────────────┼──────────── │                                │
│  │  human       │ [0.12,...]  │                                │
│  │  persona     │ [-0.34,...] │                                │
│  │  health_info │ [0.21,...]  │                                │
│  └────────┬───────────────────┘                                │
│           │                                                      │
│           ▼                                                      │
│  ┌──────────────────────────┐                                  │
│  │  Cosine Similarity       │                                  │
│  │  (In-Worker Computation) │                                  │
│  │                          │                                  │
│  │  health_info: 0.87       │◄──── Top match!                 │
│  │  human:       0.45       │                                  │
│  │  persona:     0.12       │                                  │
│  └────────┬─────────────────┘                                  │
│           │                                                      │
│           ▼                                                      │
│  ┌────────────────────────────┐                                │
│  │  Return Top N Results      │                                │
│  │  (filtered by threshold)   │                                │
│  │                            │                                │
│  │  [                         │                                │
│  │    {                       │                                │
│  │      block: {...},         │                                │
│  │      score: 0.87           │                                │
│  │    }                       │                                │
│  │  ]                         │                                │
│  └────────────────────────────┘                                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Key Characteristics

- **Embeddings stored in SQL as JSON** (no separate vector DB)
- **Cosine similarity computed in-worker** (fast, no network calls)
- **768-dimensional embeddings** from Cloudflare AI
- **Threshold filtering** (default 0.5) for relevance
- **Sub-50ms search latency** for typical queries
- **Automatic embedding generation** - embeddings created on block create/update
- **Graceful degradation** - memory operations work even without AI binding
- **Zero-configuration** - no manual embedding management needed

---

## Letta's Implementation

```
┌────────────────────────────────────────────────────────────────┐
│                    Letta Semantic Search Flow                   │
│                                                                  │
│  ┌──────────┐                                                   │
│  │  Query   │                                                   │
│  │ "health  │                                                   │
│  │  info"   │                                                   │
│  └────┬─────┘                                                   │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────┐                                   │
│  │ OpenAI/Custom Embedding │                                   │
│  │ Model                   │                                   │
│  │                          │                                   │
│  │ Network call to external │                                   │
│  │ embedding service        │                                   │
│  └────────┬─────────────────┘                                   │
│           │                                                      │
│           ▼                                                      │
│  ┌────────────────────────────┐                                │
│  │  Vector Database Query     │                                │
│  │  (Chroma/Pinecone/Qdrant)  │                                │
│  │                            │                                │
│  │  Network call to external  │                                │
│  │  vector DB service         │                                │
│  └────────┬───────────────────┘                                │
│           │                                                      │
│           ▼                                                      │
│  ┌────────────────────────────┐                                │
│  │  Vector DB performs        │                                │
│  │  similarity search         │                                │
│  │  (HNSW/IVF index)          │                                │
│  └────────┬───────────────────┘                                │
│           │                                                      │
│           ▼                                                      │
│  ┌────────────────────────────┐                                │
│  │  Return results via        │                                │
│  │  network to Letta          │                                │
│  └────────┬───────────────────┘                                │
│           │                                                      │
│           ▼                                                      │
│  ┌────────────────────────────┐                                │
│  │  Format and return to      │                                │
│  │  agent                     │                                │
│  └────────────────────────────┘                                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Key Characteristics

- **External vector database** (Chroma, Pinecone, Qdrant)
- **Multiple network hops** (embedding → vector DB → results)
- **Optimized indexing** (HNSW/IVF) for large-scale search
- **Higher latency** (~100-200ms) due to network calls
- **Better for massive datasets** (millions of vectors)

---

## Comparison

| Aspect | Memedge | Letta |
|--------|-------------------|-------|
| Storage | SQL (JSON embeddings) | Dedicated vector DB |
| Network Calls | 1 (embedding only) | 2-3 (embedding + vector DB) |
| Latency | ~30-50ms | ~100-200ms |
| Complexity | Low (single service) | High (multiple services) |
| Cost | Included in CF Workers | Separate vector DB costs |
| Scale | Good for <10k vectors | Excellent for millions |
| Operational Overhead | None (managed) | Manage vector DB |
| Co-location | Same worker | Separate service |

**Winner: Memedge (for typical use cases)** - Lower latency, simpler architecture, no additional services. Letta wins for massive-scale applications.

---

[← Back to Memory Blocks](03-memory-blocks.md) | [Next: Memory Tools →](05-memory-tools.md)

