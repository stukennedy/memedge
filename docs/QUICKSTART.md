# Memedge Quick Start Guide

This guide will help you get started with Memedge in your Cloudflare Workers project.

## Prerequisites

- Cloudflare Workers account
- Node.js 18+ installed
- Basic understanding of Effect (optional but helpful)

## Installation

```bash
npm install memedge effect zod
```

## Setup with Cloudflare Durable Objects

### 1. Define Your Durable Object

```typescript
// src/agent.ts
import { DurableObject } from 'cloudflare:workers';
import { Effect, Layer } from 'effect';
import { 
  MemoryManagerLive,
  MemoryBlockManagerLive,
  SqlStorageContext 
} from 'memedge';

export class Agent extends DurableObject {
  async fetch(request: Request) {
    const sql = this.ctx.storage.sql;
    
    // Create SQL storage context
    const sqlContext = SqlStorageContext.of({ sql });
    
    // Your program
    const program = Effect.gen(function* () {
      const memoryManager = yield* MemoryManagerService;
      
      // Initialize on first run
      yield* memoryManager.initializeDatabase();
      
      // Use memory operations
      yield* memoryManager.writeMemory('user_name', 'Alice');
      const entry = yield* memoryManager.readMemory('user_name');
      
      return { message: `Hello ${entry?.text}!` };
    });
    
    // Run with layers
    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(MemoryManagerLive),
        Effect.provide(Layer.succeed(SqlStorageContext, sqlContext))
      )
    );
    
    return Response.json(result);
  }
}
```

### 2. Configure wrangler.toml

```toml
name = "my-agent"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[durable_objects.bindings]]
name = "AGENT"
class_name = "Agent"

[[migrations]]
tag = "v1"
new_classes = ["Agent"]
```

## Using Memory Blocks

```typescript
import { MemoryBlockManagerService } from 'memedge';

const program = Effect.gen(function* () {
  const manager = yield* MemoryBlockManagerService;
  
  // Initialize database
  yield* manager.initializeDatabase();
  
  // Create memory blocks
  yield* manager.createBlock(
    'human',
    'Human',
    'Name: Alice\nRole: Engineer',
    'core'
  );
  
  yield* manager.createBlock(
    'persona',
    'Persona',
    'I am a helpful AI assistant',
    'core'
  );
  
  // Insert more content
  yield* manager.insertContent('human', 'Company: TechCorp', 'end');
  
  // Get all blocks
  const blocks = yield* manager.getAllBlocks('core');
  
  return blocks;
});
```

## Adding LLM Tools

```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { getAllMemoryTools } from 'memedge/tools';

const tools = getAllMemoryTools();

const response = await generateText({
  model: openai('gpt-4'),
  messages: [
    { role: 'user', content: 'Remember that I prefer dark mode' }
  ],
  tools,
  maxSteps: 5
});

// Handle tool calls
for (const step of response.steps) {
  if (step.toolCalls) {
    for (const toolCall of step.toolCalls) {
      // Execute memory tool
      if (toolCall.toolName === 'memory_write') {
        const result = await executeMemoryWrite(toolCall.args);
        // Use result...
      }
    }
  }
}
```

## Semantic Search with Cloudflare AI

```typescript
import { 
  searchMemoryBlocks,
  AiBindingContext 
} from 'memedge';

const program = Effect.gen(function* () {
  const manager = yield* MemoryBlockManagerService;
  const blocks = yield* manager.getAllBlocks();
  
  // Search semantically
  const results = yield* searchMemoryBlocks(
    'user preferences',
    blocks,
    5,
    0.5
  );
  
  return results;
});

// Provide AI binding from Cloudflare environment
const result = await Effect.runPromise(
  program.pipe(
    Effect.provide(MemoryBlockManagerLive),
    Effect.provide(Layer.succeed(AiBindingContext, { ai: env.AI })),
    Effect.provide(Layer.succeed(SqlStorageContext, sqlContext))
  )
);
```

## Next Steps

- Read the [API Documentation](./API.md)
- Check out [Examples](../examples/)
- Learn about [Memory Block Organization](./MEMORY_BLOCKS.md)
- Explore [Recursive Summarization](./SUMMARIZATION.md)

## Common Patterns

### Read-Before-Write

Always read before updating to prevent data loss:

```typescript
// ❌ Wrong - overwrites existing data
yield* memoryManager.writeMemory('profile', 'Age: 30');

// ✅ Correct - merge with existing
const existing = yield* memoryManager.readMemory('profile');
const merged = existing ? `${existing.text}\nAge: 30` : 'Age: 30';
yield* memoryManager.writeMemory('profile', merged);
```

### Privacy Markers

```typescript
yield* memoryManager.writeMemory(
  'health',
  '[PRIVATE] Has diabetes\n[CONFIDENTIAL] Taking insulin'
);
```

### Custom Memory Blocks

```typescript
yield* manager.createBlock(
  'project_phoenix',
  'Project Phoenix',
  'Status: In Progress\nDeadline: Q1 2025',
  'core'
);
```

## Troubleshooting

### Database not initialized

Make sure to call `initializeDatabase()` before other operations:

```typescript
yield* memoryManager.initializeDatabase();
```

### Missing AI binding for semantic search

Semantic search requires Cloudflare AI binding:

```toml
# wrangler.toml
[ai]
binding = "AI"
```

### Effect errors

Handle errors properly with Effect:

```typescript
const result = await Effect.runPromise(
  program.pipe(
    Effect.catchAll(error => {
      console.error('Memory error:', error);
      return Effect.succeed(defaultValue);
    })
  )
);
```

## Resources

- [Effect Documentation](https://effect.website)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Letta Documentation](https://docs.letta.ai)

