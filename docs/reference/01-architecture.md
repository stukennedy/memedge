# Architecture Overview

[← Back to Index](00-index.md) | [Next: Feature Comparison →](02-feature-comparison.md)

---

## Memedge Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Cloudflare Workers Edge                          │
│                                                                       │
│  ┌───────────────────┐         ┌────────────────────┐              │
│  │   Agent Runtime   │         │   LLM Providers    │              │
│  │   (Effect-based)  │◄────────┤  - OpenAI          │              │
│  │  Durable Object   │         │  - Anthropic       │              │
│  └─────────┬─────────┘         │  - Gemini          │              │
│            │                   │  - Cloudflare AI   │              │
│            │                   └────────────────────┘              │
│            ▼                                                         │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │         LLM Orchestration (llm-orchestration.ts)          │     │
│  │                                                            │     │
│  │  System Prompt Assembly:                                  │     │
│  │  1. Base persona.system_prompt                            │     │
│  │  2. + buildMemoryContext() [legacy KV]                    │     │
│  │  3. + buildCoreMemoryContext() [memory blocks]            │     │
│  │  4. + buildSummaryContext() [recursive summaries]         │     │
│  │  5. + toolInstructions                                    │     │
│  └────────────────────────┬─────────────────────────────────┘     │
│                            │                                        │
│                            ▼                                        │
│  ┌─────────────────────────────────────────────────┐               │
│  │           Memory System (Dual Layer)             │               │
│  │                                                   │               │
│  │  ┌──────────────────┐    ┌──────────────────┐  │               │
│  │  │  Key-Value Store │    │  Memory Blocks   │  │               │
│  │  │  (Legacy/Simple) │    │  (Letta-style)   │  │               │
│  │  │                  │    │                  │  │               │
│  │  │  • purpose: key  │    │  • human block   │  │               │
│  │  │  • text: value   │    │  • persona block │  │               │
│  │  │  • Privacy markers│   │  • context block │  │               │
│  │  │  • Read-before-  │    │  • Custom blocks │  │               │
│  │  │    write pattern │    │  • insert/replace│  │               │
│  │  └──────────────────┘    │  • rethink       │  │               │
│  │                           │  • Archival      │  │               │
│  │                           │  • Auto-embed ✨ │  │               │
│  │                           └──────────────────┘  │               │
│  └───────────────────┬───────────────────────────┘               │
│                      │                                             │
│                      ▼                                             │
│  ┌──────────────────────────────────────────────────┐            │
│  │       Storage Layer (Durable Objects SQL)        │            │
│  │                                                    │            │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────┐ │           │
│  │  │agent_memory  │  │memory_blocks │  │archival │ │           │
│  │  │              │  │              │  │_memory  │ │           │
│  │  │- purpose     │  │- id          │  │         │ │           │
│  │  │- text        │  │- label       │  │- id     │ │           │
│  │  │- updated_at  │  │- content     │  │- content│ │           │
│  │  │              │  │- type        │  │- vector │ │           │
│  │  └──────────────┘  │- metadata    │  │_id      │ │           │
│  │                    └──────────────┘  └─────────┘ │           │
│  │  ┌──────────────────────────────────────────┐   │           │
│  │  │ memory_embeddings (semantic search)       │   │           │
│  │  │ - block_id / archival_id                  │   │           │
│  │  │ - embedding (JSON array, 768 dims)        │   │           │
│  │  │ - Auto-generated on create/update ✨      │   │           │
│  │  └──────────────────────────────────────────┘   │           │
│  │  ┌──────────────────────────────────────────┐   │           │
│  │  │ conversation_summaries_v2                 │   │           │
│  │  │ - id, summary, level, message_count       │   │           │
│  │  │ - parent_summary_id, created_at           │   │           │
│  │  │ - Auto-created hierarchically ✨          │   │           │
│  │  └──────────────────────────────────────────┘   │           │
│  └──────────────────────────────────────────────────┘            │
│                      │                                             │
│                      ▼                                             │
│  ┌──────────────────────────────────────────────────┐            │
│  │       Semantic Search Layer                      │            │
│  │                                                    │            │
│  │  ┌────────────────────────────────────────────┐  │            │
│  │  │  Cloudflare AI Embeddings                  │  │            │
│  │  │  (@cf/baai/bge-base-en-v1.5)              │  │            │
│  │  │                                            │  │            │
│  │  │  • 768 dimensions                          │  │            │
│  │  │  • Stored in SQL as JSON                   │  │            │
│  │  │  • Cosine similarity in-worker             │  │            │
│  │  │  • No external vector DB needed            │  │            │
│  │  │  • Optional (graceful degradation) ✨      │  │            │
│  │  └────────────────────────────────────────────┘  │            │
│  └──────────────────────────────────────────────────┘            │
│                      │                                             │
│                      ▼                                             │
│  ┌──────────────────────────────────────────────────┐            │
│  │       Summarization System                       │            │
│  │       (session-manager.ts)                       │            │
│  │                                                    │            │
│  │  Level 0: Base Summaries (10-20 messages)        │            │
│  │  Level 1: Meta-Summaries (10 x L0)               │            │
│  │  Level 2: Super-Summaries (10 x L1)              │            │
│  │                                                    │            │
│  │  • Recursive, hierarchical compression            │            │
│  │  • Auto-triggered on session cleanup ✨           │            │
│  │  • Integrated into system prompt ✨               │            │
│  └──────────────────────────────────────────────────┘            │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

✨ = Recently integrated/enhanced features
```

## Letta's Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Letta Platform                                 │
│                                                                       │
│  ┌───────────────────┐         ┌────────────────────┐              │
│  │   REST API        │         │   Agent Dev Env    │              │
│  │   Endpoints       │◄────────┤   (ADE)            │              │
│  │                   │         │   - Visualization  │              │
│  └─────────┬─────────┘         │   - No-code UI     │              │
│            │                   └────────────────────┘              │
│            │                                                         │
│            ▼                                                         │
│  ┌─────────────────────────────────────────────────┐               │
│  │           Agent Runtime                          │               │
│  │                                                   │               │
│  │  ┌──────────────────────────────────────────┐  │               │
│  │  │      Core Memory Manager                 │  │               │
│  │  │                                          │  │               │
│  │  │  • human block                           │  │               │
│  │  │  • persona block                         │  │               │
│  │  │  • system block                          │  │               │
│  │  │  • Custom blocks                         │  │               │
│  │  │                                          │  │               │
│  │  │  Operations:                             │  │               │
│  │  │  • core_memory_append                    │  │               │
│  │  │  • core_memory_replace                   │  │               │
│  │  │  • send_message                          │  │               │
│  │  └──────────────────────────────────────────┘  │               │
│  │                                                 │               │
│  │  ┌──────────────────────────────────────────┐  │               │
│  │  │      Archival Memory Manager             │  │               │
│  │  │                                          │  │               │
│  │  │  • archival_memory_insert                │  │               │
│  │  │  • archival_memory_search                │  │               │
│  │  │  • Unlimited storage                     │  │               │
│  │  │  • Vector-based retrieval                │  │               │
│  │  └──────────────────────────────────────────┘  │               │
│  └─────────────────────┬───────────────────────────┘               │
│                        │                                            │
│                        ▼                                            │
│  ┌──────────────────────────────────────────────────┐             │
│  │       Storage Layer                               │             │
│  │                                                    │             │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────┐ │             │
│  │  │PostgreSQL    │  │Vector Store  │  │Redis   │ │             │
│  │  │              │  │(Chroma/      │  │(Cache) │ │             │
│  │  │- Structured  │  │ Pinecone/    │  │        │ │             │
│  │  │  data        │  │ Qdrant)      │  │        │ │             │
│  │  │- Agent state │  │              │  │        │ │             │
│  │  │- Messages    │  │- Embeddings  │  │        │ │             │
│  │  └──────────────┘  │- Semantic    │  └────────┘ │             │
│  │                    │  search      │             │             │
│  │                    └──────────────┘             │             │
│  └──────────────────────────────────────────────────┘             │
│                        │                                           │
│                        ▼                                           │
│  ┌──────────────────────────────────────────────────┐            │
│  │       LLM Integration Layer                      │            │
│  │                                                    │            │
│  │  • Model-agnostic design                          │            │
│  │  • Multiple provider support                      │            │
│  │  • Context window management                      │            │
│  │  • Token usage optimization                       │            │
│  └──────────────────────────────────────────────────┘            │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

[← Back to Index](00-index.md) | [Next: Feature Comparison →](02-feature-comparison.md)

