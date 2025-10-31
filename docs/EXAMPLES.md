# Memedge Examples

This document provides practical examples of using Memedge in your applications.

## Example 1: Basic Memory Storage

```typescript
import { Effect, Layer } from 'effect';
import { 
  MemoryManagerLive,
  MemoryManagerService,
  SqlStorageContext 
} from 'memedge';

// Simple memory operations
async function basicExample(sql: SqlStorage) {
  const sqlContext = SqlStorageContext.of({ sql });
  
  const program = Effect.gen(function* () {
    const memory = yield* MemoryManagerService;
    
    // Initialize
    yield* memory.initializeDatabase();
    
    // Store user information
    yield* memory.writeMemory('user_profile', 'Name: Bob\nAge: 35\nRole: Manager');
    yield* memory.writeMemory('preferences', 'Theme: Dark\nLanguage: English');
    
    // Read back
    const profile = yield* memory.readMemory('user_profile');
    console.log('Profile:', profile?.text);
    
    // Build context for LLM
    const context = yield* memory.buildMemoryContext();
    console.log('Memory context:', context);
  });
  
  await Effect.runPromise(
    program.pipe(
      Effect.provide(MemoryManagerLive),
      Effect.provide(Layer.succeed(SqlStorageContext, sqlContext))
    )
  );
}
```

## Example 2: Structured Memory Blocks

```typescript
import { 
  MemoryBlockManagerLive,
  MemoryBlockManagerService,
  STANDARD_BLOCKS 
} from 'memedge';

async function structuredMemoryExample(sql: SqlStorage) {
  const sqlContext = SqlStorageContext.of({ sql });
  
  const program = Effect.gen(function* () {
    const manager = yield* MemoryBlockManagerService;
    
    // Initialize
    yield* manager.initializeDatabase();
    
    // Create standard blocks
    yield* manager.createBlock(
      STANDARD_BLOCKS.HUMAN,
      'Human',
      'Name: Sarah\nRole: Product Manager\nCompany: TechCorp',
      'core'
    );
    
    yield* manager.createBlock(
      STANDARD_BLOCKS.PERSONA,
      'Persona',
      'I am a helpful AI assistant specialized in product management.',
      'core'
    );
    
    // Create custom block
    yield* manager.createBlock(
      'current_project',
      'Current Project',
      'Project: Mobile App Redesign\nStatus: In Progress\nDeadline: March 2025',
      'core'
    );
    
    // Update block using different methods
    // 1. Insert (append)
    yield* manager.insertContent(
      STANDARD_BLOCKS.HUMAN,
      'Timezone: PST',
      'end'
    );
    
    // 2. Replace specific content
    yield* manager.replaceContent(
      'current_project',
      'In Progress',
      'Review Phase'
    );
    
    // 3. Complete rewrite
    yield* manager.rethinkBlock(
      STANDARD_BLOCKS.PERSONA,
      'I am a specialized AI assistant for product management, with expertise in roadmapping, feature prioritization, and stakeholder communication.',
      'Expanding persona description'
    );
    
    // List all blocks
    const blocks = yield* manager.getAllBlocks('core');
    console.log(`Total blocks: ${blocks.length}`);
    blocks.forEach(b => console.log(`- ${b.label}: ${b.content.substring(0, 50)}...`));
  });
  
  await Effect.runPromise(
    program.pipe(
      Effect.provide(MemoryBlockManagerLive),
      Effect.provide(Layer.succeed(SqlStorageContext, sqlContext))
    )
  );
}
```

## Example 3: Semantic Search

```typescript
import { 
  MemoryBlockManagerService,
  searchMemoryBlocks,
  initializeEmbeddingsTables,
  ensureBlockEmbeddings,
  AiBindingContext 
} from 'memedge';

async function semanticSearchExample(sql: SqlStorage, ai: Ai) {
  const sqlContext = SqlStorageContext.of({ sql });
  const aiContext = AiBindingContext.of({ ai });
  
  const program = Effect.gen(function* () {
    const manager = yield* MemoryBlockManagerService;
    
    // Initialize
    yield* manager.initializeDatabase();
    yield* initializeEmbeddingsTables();
    
    // Create diverse memory blocks
    yield* manager.createBlock('work', 'Work', 'I work as a software engineer at Google, focusing on cloud infrastructure.', 'core');
    yield* manager.createBlock('hobbies', 'Hobbies', 'I enjoy hiking, photography, and playing guitar.', 'core');
    yield* manager.createBlock('health', 'Health', '[PRIVATE] Vegetarian diet. Exercise 3x per week. Allergic to shellfish.', 'core');
    
    // Get all blocks and ensure embeddings exist
    const blocks = yield* manager.getAllBlocks('core');
    yield* ensureBlockEmbeddings(blocks);
    
    // Semantic search examples
    console.log('\n=== Search: "What do you do for work?" ===');
    const workResults = yield* searchMemoryBlocks('What do you do for work?', blocks, 3, 0.5);
    workResults.forEach(r => {
      console.log(`${r.block.label} (score: ${r.score.toFixed(2)})`);
      console.log(r.block.content);
    });
    
    console.log('\n=== Search: "Tell me about your diet" ===');
    const dietResults = yield* searchMemoryBlocks('Tell me about your diet', blocks, 3, 0.5);
    dietResults.forEach(r => {
      console.log(`${r.block.label} (score: ${r.score.toFixed(2)})`);
      console.log(r.block.content);
    });
    
    console.log('\n=== Search: "hobbies and interests" ===');
    const hobbyResults = yield* searchMemoryBlocks('hobbies and interests', blocks, 3, 0.5);
    hobbyResults.forEach(r => {
      console.log(`${r.block.label} (score: ${r.score.toFixed(2)})`);
      console.log(r.block.content);
    });
  });
  
  await Effect.runPromise(
    program.pipe(
      Effect.provide(MemoryBlockManagerLive),
      Effect.provide(Layer.succeed(SqlStorageContext, sqlContext)),
      Effect.provide(Layer.succeed(AiBindingContext, aiContext))
    )
  );
}
```

## Example 4: Archival Memory

```typescript
async function archivalMemoryExample(sql: SqlStorage) {
  const sqlContext = SqlStorageContext.of({ sql });
  
  const program = Effect.gen(function* () {
    const manager = yield* MemoryBlockManagerService;
    
    yield* manager.initializeDatabase();
    
    // Store various facts in archival
    yield* manager.insertArchival(
      'User mentioned their birthday is on March 15th',
      { category: 'personal', date: '2025-01-15' }
    );
    
    yield* manager.insertArchival(
      'User prefers using VS Code with Vim keybindings',
      { category: 'preferences', date: '2025-01-16' }
    );
    
    yield* manager.insertArchival(
      'Discussion about React vs Vue for the new project',
      { category: 'projects', date: '2025-01-17' }
    );
    
    // Search archival memory
    const results = yield* manager.searchArchival('birthday', 5);
    console.log('Search results for "birthday":');
    results.forEach(r => {
      console.log(`- ${r.content}`);
      console.log(`  Metadata:`, r.metadata);
    });
  });
  
  await Effect.runPromise(
    program.pipe(
      Effect.provide(MemoryBlockManagerLive),
      Effect.provide(Layer.succeed(SqlStorageContext, sqlContext))
    )
  );
}
```

## Example 5: Recursive Summarization

```typescript
import { 
  initializeDatabase as initSummaryDB,
  createBaseSummary,
  checkRecursiveSummarizationNeeded,
  createRecursiveSummary,
  loadSummariesForContext,
  buildSummaryContext 
} from 'memedge/summaries';

async function summarizationExample(sql: SqlStorage, messages: Message[], persona: PersonaConfig) {
  const sqlContext = SqlStorageContext.of({ sql });
  
  const program = Effect.gen(function* () {
    // Initialize summarization database
    yield* initSummaryDB();
    
    // Create base summary from recent messages
    console.log('Creating base summary...');
    const summaryId = yield* createBaseSummary(messages, persona);
    console.log(`Created summary ${summaryId}`);
    
    // Check if we need recursive summarization
    const check = yield* checkRecursiveSummarizationNeeded();
    
    if (check.needed && check.summaries) {
      console.log(`Creating level ${check.level} recursive summary...`);
      const recursiveId = yield* createRecursiveSummary(
        check.summaries,
        check.level,
        persona
      );
      console.log(`Created recursive summary ${recursiveId}`);
    }
    
    // Load summaries for context
    const summaries = yield* loadSummariesForContext();
    console.log(`Loaded ${summaries.base.length} base summaries`);
    console.log(`Loaded ${summaries.recursive.length} recursive summaries`);
    
    // Build context string for LLM
    const context = buildSummaryContext(summaries);
    console.log('Summary context:', context);
  });
  
  await Effect.runPromise(
    program.pipe(
      Effect.provide(Layer.succeed(SqlStorageContext, sqlContext))
    )
  );
}
```

## Example 6: Privacy-Aware Memory

```typescript
async function privacyExample(sql: SqlStorage) {
  const sqlContext = SqlStorageContext.of({ sql });
  
  const program = Effect.gen(function* () {
    const memory = yield* MemoryManagerService;
    
    yield* memory.initializeDatabase();
    
    // Store mixed privacy information
    yield* memory.writeMemory(
      'health_info',
      `
      [PUBLIC] Exercises regularly
      [PRIVATE] Has Type 2 diabetes
      [CONFIDENTIAL] Taking metformin 500mg twice daily
      [DO NOT SHARE] Medical record number: 12345
      `.trim()
    );
    
    yield* memory.writeMemory(
      'contact_info',
      `
      [PUBLIC] Email: user@example.com
      [PRIVATE] Personal phone: 555-0123
      [CONFIDENTIAL] Home address: 123 Main St
      `.trim()
    );
    
    // When building shareable profile, check markers
    const healthInfo = yield* memory.readMemory('health_info');
    if (healthInfo) {
      const publicInfo = healthInfo.text
        .split('\n')
        .filter(line => line.includes('[PUBLIC]'))
        .map(line => line.replace('[PUBLIC]', '').trim())
        .join('\n');
      
      console.log('Shareable health info:', publicInfo);
      // Output: "Exercises regularly"
    }
  });
  
  await Effect.runPromise(
    program.pipe(
      Effect.provide(MemoryManagerLive),
      Effect.provide(Layer.succeed(SqlStorageContext, sqlContext))
    )
  );
}
```

## Example 7: Migration from Legacy to Blocks

```typescript
import { 
  migrateLegacyMemoriesToBlocks,
  checkMigrationNeeded 
} from 'memedge/memory';

async function migrationExample(sql: SqlStorage) {
  const sqlContext = SqlStorageContext.of({ sql });
  
  const program = Effect.gen(function* () {
    // Check if migration is needed
    const needed = yield* checkMigrationNeeded();
    
    if (needed) {
      console.log('Migration needed, starting...');
      
      // Perform migration
      const result = yield* migrateLegacyMemoriesToBlocks();
      
      console.log(`Migration complete:`);
      console.log(`- Total: ${result.total}`);
      console.log(`- Migrated: ${result.migrated}`);
      console.log(`- Skipped: ${result.skipped}`);
      console.log(`- Errors: ${result.errors.length}`);
      
      if (result.errors.length > 0) {
        console.error('Migration errors:', result.errors);
      }
    } else {
      console.log('No migration needed');
    }
  });
  
  await Effect.runPromise(
    program.pipe(
      Effect.provide(MemoryManagerLive),
      Effect.provide(MemoryBlockManagerLive),
      Effect.provide(Layer.succeed(SqlStorageContext, sqlContext))
    )
  );
}
```

## Full Application Example

See the [examples/](../examples/) directory for complete working examples including:

- Cloudflare Worker setup
- LLM tool integration with OpenAI/Anthropic
- Building a chatbot with memory
- Durable Objects configuration
- Error handling patterns

## Tips

1. **Always initialize databases** before use
2. **Read before write** when updating existing memories
3. **Use semantic search** for better retrieval
4. **Organize with blocks** for complex agents
5. **Mark private data** with privacy markers
6. **Test migrations** before production use

