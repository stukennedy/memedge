# Memedge 🧠

**Advanced memory management system for LLM agents with Letta-inspired features**

Memedge is a sophisticated memory system designed for building stateful LLM agents on Cloudflare Workers. Inspired by [Letta (formerly MemGPT)](https://github.com/letta-ai/letta), it provides structured memory blocks, semantic search, recursive summarization, and privacy-aware memory management.

## ✨ Features

- **🎯 Structured Memory Blocks**: Organize information into core blocks (human, persona, context) and custom blocks
- **🔍 Semantic Search**: Built-in semantic search using Cloudflare AI embeddings (no external vector DB needed!)
- **📚 Archival Memory**: Long-term storage with searchable history
- **🔄 Recursive Summarization**: Hierarchical conversation summarization for managing long-term context
- **🔒 Privacy-Aware**: Built-in privacy markers ([PRIVATE], [CONFIDENTIAL], [DO NOT SHARE])
- **⚡ Edge-Native**: Optimized for Cloudflare Workers with Durable Objects
- **🛠️ LLM Tool Integration**: Ready-to-use tool definitions for function calling
- **💾 SQL-Based**: Uses Cloudflare Durable Objects SQL for persistence
- **🎨 Effect-Based**: Leverages Effect for type-safe error handling

## 📦 Installation

```bash
npm install memedge
# or
yarn add memedge
# or
pnpm add memedge
```

## 🚀 Quick Start

### Basic Memory Operations

```typescript
import { Effect } from 'effect';
import { 
  MemoryManagerLive, 
  SqlStorageContext 
} from 'memedge/memory';

// Setup SQL storage context
const sqlContext = SqlStorageContext.of({ sql: durableObjectSQL });

// Create and use memory manager
const program = Effect.gen(function* () {
  const memoryManager = yield* MemoryManagerService;
  
  // Initialize database
  yield* memoryManager.initializeDatabase();
  
  // Write memory
  yield* memoryManager.writeMemory('user_profile', 'Name: Alice, Role: Engineer');
  
  // Read memory
  const entry = yield* memoryManager.readMemory('user_profile');
  console.log(entry?.text);
});

// Run with context
Effect.runPromise(
  program.pipe(
    Effect.provide(MemoryManagerLive),
    Effect.provide(Layer.succeed(SqlStorageContext, sqlContext))
  )
);
```

### Memory Blocks (Letta-Style)

```typescript
import { 
  MemoryBlockManagerLive,
  MemoryBlockManagerService 
} from 'memedge/memory';

const program = Effect.gen(function* () {
  const manager = yield* MemoryBlockManagerService;
  
  // Create a memory block
  yield* manager.createBlock(
    'human',
    'Human',
    'Name: Alice\nRole: Software Engineer\nPrefers: Concise responses',
    'core'
  );
  
  // Insert content
  yield* manager.insertContent(
    'human',
    'Company: TechCorp',
    'end'
  );
  
  // Replace content
  yield* manager.replaceContent(
    'human',
    'Concise responses',
    'Detailed explanations'
  );
  
  // Get block
  const block = yield* manager.getBlock('human');
  console.log(block?.content);
});
```

### Semantic Search

```typescript
import { 
  searchMemoryBlocks,
  generateEmbedding,
  AiBindingContext 
} from 'memedge/memory';

const program = Effect.gen(function* () {
  const manager = yield* MemoryBlockManagerService;
  const blocks = yield* manager.getAllBlocks();
  
  // Search memory blocks semantically
  const results = yield* searchMemoryBlocks(
    'health information',
    blocks,
    5,  // limit
    0.5 // threshold
  );
  
  results.forEach(r => {
    console.log(`${r.block.label}: ${r.score}`);
    console.log(r.block.content);
  });
});

// Provide AI binding for embeddings
Effect.runPromise(
  program.pipe(
    Effect.provide(MemoryBlockManagerLive),
    Effect.provide(Layer.succeed(AiBindingContext, { ai: env.AI }))
  )
);
```

### Recursive Summarization

```typescript
import { 
  createBaseSummary,
  checkRecursiveSummarizationNeeded,
  createRecursiveSummary 
} from 'memedge/summaries';

const program = Effect.gen(function* () {
  // Create base summary from messages
  const summaryId = yield* createBaseSummary(messages, persona);
  
  // Check if recursive summarization is needed
  const check = yield* checkRecursiveSummarizationNeeded();
  
  if (check.needed && check.summaries) {
    // Create recursive summary
    const recursiveId = yield* createRecursiveSummary(
      check.summaries,
      check.level!,
      persona
    );
    console.log(`Created level ${check.level} summary: ${recursiveId}`);
  }
});
```

## 🛠️ LLM Tool Integration

Memedge provides ready-to-use tool definitions for LLM function calling:

```typescript
import { 
  getMemoryTools,
  getEnhancedMemoryTools,
  getAllMemoryTools 
} from 'memedge/tools';

// Basic tools
const basicTools = getMemoryTools();
// { memory_read, memory_write }

// Enhanced Letta-style tools
const enhancedTools = getEnhancedMemoryTools();
// { 
//   memory_get_block, memory_insert, memory_replace, 
//   memory_rethink, memory_create_block, memory_list_blocks,
//   archival_insert, archival_search, memory_search 
// }

// All tools (enhanced + legacy)
const allTools = getAllMemoryTools();

// Use with your LLM provider
const response = await generateText({
  model: openai('gpt-4'),
  tools: allTools,
  // ...
});
```

### Tool Execution

```typescript
import { 
  executeMemoryGetBlock,
  executeMemoryInsert,
  executeMemorySearch 
} from 'memedge/tools';

// Execute tool based on LLM response
if (toolCall.name === 'memory_get_block') {
  const result = yield* executeMemoryGetBlock(toolCall.args);
  // { block_id, label, content, updated_at }
}

if (toolCall.name === 'memory_insert') {
  const result = yield* executeMemoryInsert(toolCall.args);
  // { success, message }
}

if (toolCall.name === 'memory_search') {
  const result = yield* executeMemorySearch({
    ...toolCall.args,
    useSemanticSearch: true
  });
  // { results: [{ block_id, label, content, score }] }
}
```

## 📚 Core Concepts

### Memory Blocks

Memory blocks are structured containers for different types of information:

- **Core Blocks**: Always loaded into context (human, persona, context, custom)
- **Archival Blocks**: Searchable long-term storage, loaded on-demand
- **Operations**: insert, replace, rethink (complete rewrite)

### Privacy Markers

Memedge supports privacy-aware memory with built-in markers:

```typescript
// Store private information
yield* memoryManager.writeMemory(
  'health_info',
  '[PRIVATE] Allergic to penicillin. [CONFIDENTIAL] Therapy on Tuesdays.'
);

// The system respects these markers when sharing information
```

Supported markers:
- `[PRIVATE]` - Personal information
- `[CONFIDENTIAL]` - Confidential data
- `[DO NOT SHARE]` - Explicitly not shareable
- `[PERSONAL]` - Personal notes

### Semantic Search Architecture

Memedge uses a simple but effective approach to semantic search:

1. **Embeddings Generation**: Uses Cloudflare AI (@cf/baai/bge-base-en-v1.5, 768 dimensions)
2. **Storage**: Embeddings stored as JSON in SQL (no separate vector DB!)
3. **Search**: Cosine similarity computed in-worker
4. **Performance**: Sub-50ms search latency for typical queries
5. **Cost**: Included in Cloudflare Workers costs

### Recursive Summarization

Hierarchical conversation summarization for managing long-term context:

```
Level 0: Base Summaries (20 messages each)
Level 1: Meta-Summaries (10 x L0)
Level 2: Super-Summaries (10 x L1)
Level 3: Ultra-Summaries (10 x L2)
```

This logarithmic approach keeps context manageable even with thousands of messages.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Memedge System                        │
│                                                           │
│  ┌────────────────┐  ┌──────────────────────────────┐  │
│  │ Memory Manager │  │ Memory Block Manager          │  │
│  │ (Legacy KV)    │  │ (Letta-style)                 │  │
│  │                │  │                                │  │
│  │ • purpose/text │  │ • Structured blocks           │  │
│  │ • Privacy      │  │ • Core + Archival             │  │
│  │   markers      │  │ • insert/replace/rethink      │  │
│  └────────────────┘  └──────────────────────────────┘  │
│           │                       │                      │
│           └───────────┬───────────┘                      │
│                       ▼                                  │
│  ┌───────────────────────────────────────────────────┐ │
│  │        Semantic Search (Cloudflare AI)             │ │
│  │                                                     │ │
│  │  • Generate embeddings (768D)                      │ │
│  │  • Store in SQL as JSON                            │ │
│  │  • Cosine similarity search                        │ │
│  │  • No external vector DB                           │ │
│  └───────────────────────────────────────────────────┘ │
│                       │                                  │
│                       ▼                                  │
│  ┌───────────────────────────────────────────────────┐ │
│  │     Recursive Summarization                        │ │
│  │                                                     │ │
│  │  • Base summaries (L0)                             │ │
│  │  • Recursive meta-summaries (L1, L2, L3)          │ │
│  │  • Hierarchical context compression                │ │
│  └───────────────────────────────────────────────────┘ │
│                       │                                  │
│                       ▼                                  │
│  ┌───────────────────────────────────────────────────┐ │
│  │        Durable Objects SQL Storage                 │ │
│  │                                                     │ │
│  │  • agent_memory (legacy)                           │ │
│  │  • memory_blocks (structured)                      │ │
│  │  • archival_memory (long-term)                     │ │
│  │  • memory_embeddings (vectors)                     │ │
│  │  • conversation_summaries_v2 (recursive)           │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## 🔧 Configuration

### Summarization Config

```typescript
const config: SummarizationConfig = {
  baseSummaryThreshold: 20,    // Messages before L0 summary
  recursiveThreshold: 10,       // Summaries before next level
  maxLevel: 3,                  // Maximum recursion depth
  recentSummaryCount: 3         // Recent summaries to load
};
```

### Semantic Search Config

```typescript
// Search with custom threshold and limit
const results = yield* searchMemoryBlocks(
  query,
  blocks,
  10,   // limit: max results
  0.7   // threshold: minimum similarity score
);
```

## 📖 API Reference

See the [API documentation](./docs/api.md) for detailed API reference.

## 🧪 Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by [Letta (MemGPT)](https://github.com/letta-ai/letta) - Thank you to the Letta team for pioneering advanced memory systems for LLM agents
- Built for [Cloudflare Workers](https://workers.cloudflare.com/)
- Powered by [Effect](https://effect.website/)

## 🔗 Links

- [Documentation](./docs/)
- [Examples](./examples/)
- [Changelog](./CHANGELOG.md)
- [Roadmap](./ROADMAP.md)

## 📊 Comparison with Letta

| Feature | Memedge | Letta |
|---------|---------|-------|
| **Architecture** | Cloudflare Workers + Durable Objects | Python + PostgreSQL + Vector DB |
| **Memory Blocks** | ✅ Core + Archival | ✅ Core + Archival |
| **Semantic Search** | ✅ Built-in (Cloudflare AI) | ✅ External Vector DB |
| **Embeddings** | 768D, stored in SQL | Configurable, separate DB |
| **Latency** | ~30-50ms (edge) | ~100-200ms (server) |
| **Scalability** | Edge-native, globally distributed | Server-based |
| **Privacy Markers** | ✅ Built-in | ❌ Not included |
| **Recursive Summarization** | ✅ Hierarchical | ❌ Simple |
| **Tool Integration** | ✅ Zod schemas | ✅ Pydantic |
| **Cost** | Included in Workers | Separate services |
| **Visual Tools** | ❌ Code-first | ✅ Agent Dev Environment |

---

**Made with ❤️ for the LLM agent community**

