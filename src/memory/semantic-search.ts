/**
 * Semantic Search for Memory Blocks using SQLite + Cloudflare AI Embeddings
 * Fast, cheap, and simple - no external vector DB needed!
 */
import { Effect, Context } from 'effect';
import { MemoryError } from '../shared/errors';
import { SqlStorageContext } from './memory';
import type { MemoryBlock, ArchivalEntry } from './blocks';

/**
 * Cloudflare AI binding context
 */
export interface AiBindingContext {
  readonly ai: Ai;
}

export const AiBindingContext =
  Context.GenericTag<AiBindingContext>('@context/AiBinding');

/**
 * Embedding model configuration
 */
const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5'; // 768 dimensions, fast & accurate
const EMBEDDING_DIMENSIONS = 768;

/**
 * Generate embedding for text using Cloudflare AI
 */
export function generateEmbedding(
  text: string
): Effect.Effect<number[], MemoryError, AiBindingContext> {
  return Effect.gen(function* () {
    const { ai } = yield* AiBindingContext;

    const result = yield* Effect.tryPromise({
      try: async () => {
        const response = await ai.run(EMBEDDING_MODEL, { text: [text] });
        return response as { data: number[][] };
      },
      catch: (error) =>
        new MemoryError({
          operation: 'generate embedding',
          cause: error,
        }),
    });

    if (!result.data || !result.data[0]) {
      yield* Effect.fail(
        new MemoryError({
          operation: 'generate embedding',
          cause: 'No embedding returned from AI',
        })
      );
    }

    return result.data[0];
  });
}

/**
 * Cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Store embedding for a memory block
 */
export function storeBlockEmbedding(
  blockId: string,
  embedding: number[]
): Effect.Effect<void, MemoryError, SqlStorageContext> {
  return Effect.gen(function* () {
    const { sql } = yield* SqlStorageContext;

    const embeddingJson = JSON.stringify(embedding);

    sql.exec(
      `INSERT OR REPLACE INTO memory_embeddings (block_id, embedding, updated_at)
       VALUES (?, ?, ?)`,
      blockId,
      embeddingJson,
      Date.now()
    );

    console.log(`Stored embedding for block: ${blockId}`);
  });
}

/**
 * Store embedding for archival entry
 */
export function storeArchivalEmbedding(
  entryId: string,
  embedding: number[]
): Effect.Effect<void, MemoryError, SqlStorageContext> {
  return Effect.gen(function* () {
    const { sql } = yield* SqlStorageContext;

    const embeddingJson = JSON.stringify(embedding);

    sql.exec(
      `INSERT OR REPLACE INTO archival_embeddings (entry_id, embedding, updated_at)
       VALUES (?, ?, ?)`,
      entryId,
      embeddingJson,
      Date.now()
    );

    console.log(`Stored embedding for archival entry: ${entryId}`);
  });
}

/**
 * Get all block embeddings
 */
export function getAllBlockEmbeddings(): Effect.Effect<
  Map<string, number[]>,
  MemoryError,
  SqlStorageContext
> {
  return Effect.gen(function* () {
    const { sql } = yield* SqlStorageContext;

    const cursor = sql.exec(`
      SELECT block_id, embedding
      FROM memory_embeddings
    `);

    const embeddings = new Map<string, number[]>();

    for (const row of cursor) {
      const blockId = Array.isArray(row)
        ? (row[0] as string)
        : (row as any).block_id;
      const embeddingJson = Array.isArray(row)
        ? (row[1] as string)
        : (row as any).embedding;

      const embedding = JSON.parse(embeddingJson) as number[];
      embeddings.set(blockId, embedding);
    }

    return embeddings;
  });
}

/**
 * Get all archival embeddings
 */
export function getAllArchivalEmbeddings(): Effect.Effect<
  Map<string, number[]>,
  MemoryError,
  SqlStorageContext
> {
  return Effect.gen(function* () {
    const { sql } = yield* SqlStorageContext;

    const cursor = sql.exec(`
      SELECT entry_id, embedding
      FROM archival_embeddings
    `);

    const embeddings = new Map<string, number[]>();

    for (const row of cursor) {
      const entryId = Array.isArray(row)
        ? (row[0] as string)
        : (row as any).entry_id;
      const embeddingJson = Array.isArray(row)
        ? (row[1] as string)
        : (row as any).embedding;

      const embedding = JSON.parse(embeddingJson) as number[];
      embeddings.set(entryId, embedding);
    }

    return embeddings;
  });
}

/**
 * Search memory blocks by semantic similarity
 */
export function searchMemoryBlocks(
  query: string,
  blocks: MemoryBlock[],
  limit: number = 5,
  threshold: number = 0.5
): Effect.Effect<
  Array<{ block: MemoryBlock; score: number }>,
  MemoryError,
  AiBindingContext | SqlStorageContext
> {
  return Effect.gen(function* () {
    // Generate query embedding
    const queryEmbedding = yield* generateEmbedding(query);

    // Get all block embeddings
    const blockEmbeddings = yield* getAllBlockEmbeddings();

    // Calculate similarities
    const results: Array<{ block: MemoryBlock; score: number }> = [];

    for (const block of blocks) {
      const embedding = blockEmbeddings.get(block.id);
      if (!embedding) {
        // No embedding yet - skip or generate on the fly
        continue;
      }

      const score = cosineSimilarity(queryEmbedding, embedding);

      if (score >= threshold) {
        results.push({ block, score });
      }
    }

    // Sort by score descending and limit
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  });
}

/**
 * Search archival memory by semantic similarity
 */
export function searchArchivalMemory(
  query: string,
  entries: ArchivalEntry[],
  limit: number = 10,
  threshold: number = 0.5
): Effect.Effect<
  Array<{ entry: ArchivalEntry; score: number }>,
  MemoryError,
  AiBindingContext | SqlStorageContext
> {
  return Effect.gen(function* () {
    // Generate query embedding
    const queryEmbedding = yield* generateEmbedding(query);

    // Get all archival embeddings
    const archivalEmbeddings = yield* getAllArchivalEmbeddings();

    // Calculate similarities
    const results: Array<{ entry: ArchivalEntry; score: number }> = [];

    for (const entry of entries) {
      const embedding = archivalEmbeddings.get(entry.id);
      if (!embedding) {
        continue;
      }

      const score = cosineSimilarity(queryEmbedding, embedding);

      if (score >= threshold) {
        results.push({ entry, score });
      }
    }

    // Sort by score descending and limit
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  });
}

/**
 * Initialize embeddings tables
 */
export function initializeEmbeddingsTables(): Effect.Effect<
  void,
  MemoryError,
  SqlStorageContext
> {
  return Effect.gen(function* () {
    const { sql } = yield* SqlStorageContext;

    sql.exec(`
      CREATE TABLE IF NOT EXISTS memory_embeddings (
        block_id TEXT PRIMARY KEY,
        embedding TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS archival_embeddings (
        entry_id TEXT PRIMARY KEY,
        embedding TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    console.log('Embeddings tables initialized');
  });
}

/**
 * Auto-generate embeddings for blocks that don't have them
 */
export function ensureBlockEmbeddings(
  blocks: MemoryBlock[]
): Effect.Effect<number, MemoryError, AiBindingContext | SqlStorageContext> {
  return Effect.gen(function* () {
    const existingEmbeddings = yield* getAllBlockEmbeddings();
    let generated = 0;

    for (const block of blocks) {
      if (!existingEmbeddings.has(block.id)) {
        // Generate and store embedding
        const embedding = yield* generateEmbedding(block.content);
        yield* storeBlockEmbedding(block.id, embedding);
        generated++;
      }
    }

    if (generated > 0) {
      console.log(`Generated ${generated} new block embeddings`);
    }

    return generated;
  });
}

/**
 * Auto-generate embeddings for archival entries that don't have them
 */
export function ensureArchivalEmbeddings(
  entries: ArchivalEntry[]
): Effect.Effect<number, MemoryError, AiBindingContext | SqlStorageContext> {
  return Effect.gen(function* () {
    const existingEmbeddings = yield* getAllArchivalEmbeddings();
    let generated = 0;

    for (const entry of entries) {
      if (!existingEmbeddings.has(entry.id)) {
        // Generate and store embedding
        const embedding = yield* generateEmbedding(entry.content);
        yield* storeArchivalEmbedding(entry.id, embedding);
        generated++;
      }
    }

    if (generated > 0) {
      console.log(`Generated ${generated} new archival embeddings`);
    }

    return generated;
  });
}

/**
 * Update embedding when block content changes
 */
export function updateBlockEmbedding(
  blockId: string,
  content: string
): Effect.Effect<void, MemoryError, AiBindingContext | SqlStorageContext> {
  return Effect.gen(function* () {
    const embedding = yield* generateEmbedding(content);
    yield* storeBlockEmbedding(blockId, embedding);
  });
}

/**
 * Delete embedding when block is deleted
 */
export function deleteBlockEmbedding(
  blockId: string
): Effect.Effect<void, MemoryError, SqlStorageContext> {
  return Effect.gen(function* () {
    const { sql } = yield* SqlStorageContext;

    sql.exec(`DELETE FROM memory_embeddings WHERE block_id = ?`, blockId);
  });
}

/**
 * Delete archival embedding when entry is deleted
 */
export function deleteArchivalEmbedding(
  entryId: string
): Effect.Effect<void, MemoryError, SqlStorageContext> {
  return Effect.gen(function* () {
    const { sql } = yield* SqlStorageContext;

    sql.exec(`DELETE FROM archival_embeddings WHERE entry_id = ?`, entryId);
  });
}
