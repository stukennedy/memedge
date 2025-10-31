/**
 * Letta-inspired Memory Block System
 * Structured memory with semantic search capabilities
 */
import { Effect, Context, Layer } from 'effect';
import { MemoryError } from '../shared/errors';
import { SqlStorageContext } from './memory';
import * as SemanticSearch from './semantic-search';

export type MemoryBlockType = 'core' | 'archival';

export interface MemoryBlock {
  id: string;
  label: string;
  content: string;
  type: MemoryBlockType;
  updated_at: number;
  metadata?: Record<string, any>;
}

export interface ArchivalEntry {
  id: string;
  content: string;
  created_at: number;
  metadata?: Record<string, any>;
  vector_id?: string;
}

export interface MemorySearchResult {
  block: MemoryBlock;
  score: number;
}

export interface ArchivalSearchResult {
  entry: ArchivalEntry;
  score: number;
}

/**
 * Memory Block Manager Service interface
 */
export interface MemoryBlockManagerService {
  initializeDatabase: () => Effect.Effect<void, MemoryError>;

  // Core memory block operations
  getBlock: (id: string) => Effect.Effect<MemoryBlock | null, MemoryError>;
  getAllBlocks: (
    type?: MemoryBlockType
  ) => Effect.Effect<MemoryBlock[], MemoryError>;
  createBlock: (
    id: string,
    label: string,
    content: string,
    type?: MemoryBlockType
  ) => Effect.Effect<MemoryBlock, MemoryError, SqlStorageContext>;
  updateBlock: (
    id: string,
    content: string
  ) => Effect.Effect<void, MemoryError, SqlStorageContext>;
  deleteBlock: (id: string) => Effect.Effect<void, MemoryError>;

  // Memory operations (Letta-style)
  insertContent: (
    blockId: string,
    content: string,
    position?: 'start' | 'end'
  ) => Effect.Effect<void, MemoryError, SqlStorageContext>;
  replaceContent: (
    blockId: string,
    oldContent: string,
    newContent: string
  ) => Effect.Effect<void, MemoryError, SqlStorageContext>;
  rethinkBlock: (
    blockId: string,
    newContent: string,
    reason?: string
  ) => Effect.Effect<void, MemoryError, SqlStorageContext>;

  // Archival memory operations
  insertArchival: (
    content: string,
    metadata?: Record<string, any>
  ) => Effect.Effect<string, MemoryError>;
  searchArchival: (
    query: string,
    limit?: number
  ) => Effect.Effect<ArchivalEntry[], MemoryError>;
  getAllArchivalEntries: () => Effect.Effect<ArchivalEntry[], MemoryError>;

  // Context building
  buildCoreMemoryContext: () => Effect.Effect<string, MemoryError>;
}

export const MemoryBlockManagerService =
  Context.GenericTag<MemoryBlockManagerService>('@services/MemoryBlockManager');

/**
 * Standard memory block labels
 */
export const STANDARD_BLOCKS = {
  HUMAN: 'human',
  PERSONA: 'persona',
  CONTEXT: 'context',
} as const;

/**
 * Memory Block Manager implementation
 */
export const MemoryBlockManagerLive = Layer.effect(
  MemoryBlockManagerService,
  Effect.gen(function* () {
    const { sql } = yield* SqlStorageContext;
    const blocksCache = new Map<string, MemoryBlock>();

    const initializeDatabase = (): Effect.Effect<void, MemoryError> =>
      Effect.try({
        try: () => {
          sql.exec(`
            CREATE TABLE IF NOT EXISTS memory_blocks (
              id TEXT PRIMARY KEY,
              label TEXT NOT NULL,
              content TEXT NOT NULL,
              type TEXT NOT NULL CHECK(type IN ('core', 'archival')),
              updated_at INTEGER NOT NULL,
              metadata TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_type_updated ON memory_blocks(type, updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_label ON memory_blocks(label);

            CREATE TABLE IF NOT EXISTS archival_memory (
              id TEXT PRIMARY KEY,
              content TEXT NOT NULL,
              created_at INTEGER NOT NULL,
              metadata TEXT,
              vector_id TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_archival_created ON archival_memory(created_at DESC);
          `);

          console.log('Memory blocks database initialized');
        },
        catch: (cause) =>
          new MemoryError({ operation: 'initializeDatabase', cause }),
      });

    const getBlock = (
      id: string
    ): Effect.Effect<MemoryBlock | null, MemoryError> =>
      Effect.try({
        try: () => {
          // Check cache first
          const cached = blocksCache.get(id);
          if (cached) {
            return cached;
          }

          // Query database
          const cursor = sql.exec(
            `SELECT id, label, content, type, updated_at, metadata
             FROM memory_blocks
             WHERE id = ?`,
            id
          );

          const rows = [...cursor];
          if (rows.length === 0) {
            return null;
          }

          const row = rows[0];
          const block: MemoryBlock = {
            id: Array.isArray(row) ? (row[0] as string) : (row as any).id,
            label: Array.isArray(row) ? (row[1] as string) : (row as any).label,
            content: Array.isArray(row)
              ? (row[2] as string)
              : (row as any).content,
            type: Array.isArray(row)
              ? (row[3] as MemoryBlockType)
              : (row as any).type,
            updated_at: Array.isArray(row)
              ? (row[4] as number)
              : (row as any).updated_at,
            metadata: Array.isArray(row)
              ? JSON.parse((row[5] as string) || '{}')
              : JSON.parse((row as any).metadata || '{}'),
          };

          blocksCache.set(id, block);
          return block;
        },
        catch: (cause) => new MemoryError({ operation: 'getBlock', cause }),
      });

    const getAllBlocks = (
      type?: MemoryBlockType
    ): Effect.Effect<MemoryBlock[], MemoryError> =>
      Effect.try({
        try: () => {
          const query = type
            ? `SELECT id, label, content, type, updated_at, metadata
               FROM memory_blocks
               WHERE type = ?
               ORDER BY updated_at DESC`
            : `SELECT id, label, content, type, updated_at, metadata
               FROM memory_blocks
               ORDER BY updated_at DESC`;

          const cursor = type ? sql.exec(query, type) : sql.exec(query);
          const blocks: MemoryBlock[] = [];

          for (const row of cursor) {
            const block: MemoryBlock = {
              id: Array.isArray(row) ? (row[0] as string) : (row as any).id,
              label: Array.isArray(row)
                ? (row[1] as string)
                : (row as any).label,
              content: Array.isArray(row)
                ? (row[2] as string)
                : (row as any).content,
              type: Array.isArray(row)
                ? (row[3] as MemoryBlockType)
                : (row as any).type,
              updated_at: Array.isArray(row)
                ? (row[4] as number)
                : (row as any).updated_at,
              metadata: Array.isArray(row)
                ? JSON.parse((row[5] as string) || '{}')
                : JSON.parse((row as any).metadata || '{}'),
            };
            blocks.push(block);
            blocksCache.set(block.id, block);
          }

          return blocks;
        },
        catch: (cause) => new MemoryError({ operation: 'getAllBlocks', cause }),
      });

    const createBlock = (
      id: string,
      label: string,
      content: string,
      type: MemoryBlockType = 'core'
    ): Effect.Effect<MemoryBlock, MemoryError, SqlStorageContext> =>
      Effect.gen(function* () {
        // Create block in database
        const timestamp = Date.now();
        const metadata = '{}';

        yield* Effect.try({
          try: () => {
            sql.exec(
              `INSERT INTO memory_blocks (id, label, content, type, updated_at, metadata)
               VALUES (?, ?, ?, ?, ?, ?)`,
              id,
              label,
              content,
              type,
              timestamp,
              metadata
            );
          },
          catch: (cause) =>
            new MemoryError({ operation: 'createBlock', cause }),
        });

        const block: MemoryBlock = {
          id,
          label,
          content,
          type,
          updated_at: timestamp,
          metadata: {},
        };

        blocksCache.set(id, block);
        console.log(`Created memory block: ${id} (${label})`);

        return block;
      });

    const updateBlock = (
      id: string,
      content: string
    ): Effect.Effect<void, MemoryError, SqlStorageContext> =>
      Effect.gen(function* () {
        const timestamp = Date.now();

        // Update block in database
        yield* Effect.try({
          try: () => {
            sql.exec(
              `UPDATE memory_blocks
               SET content = ?, updated_at = ?
               WHERE id = ?`,
              content,
              timestamp,
              id
            );

            // Update cache
            const cached = blocksCache.get(id);
            if (cached) {
              cached.content = content;
              cached.updated_at = timestamp;
            }

            console.log(`Updated memory block: ${id}`);
          },
          catch: (cause) =>
            new MemoryError({ operation: 'updateBlock', cause }),
        });
      });

    const deleteBlock = (id: string): Effect.Effect<void, MemoryError> =>
      Effect.try({
        try: () => {
          sql.exec(`DELETE FROM memory_blocks WHERE id = ?`, id);
          blocksCache.delete(id);
          console.log(`Deleted memory block: ${id}`);
        },
        catch: (cause) => new MemoryError({ operation: 'deleteBlock', cause }),
      });

    const insertContent = (
      blockId: string,
      content: string,
      position: 'start' | 'end' = 'end'
    ): Effect.Effect<void, MemoryError, SqlStorageContext> =>
      Effect.gen(function* () {
        const block = yield* getBlock(blockId);
        if (!block) {
          yield* Effect.fail(
            new MemoryError({
              operation: 'insertContent',
              cause: `Block not found: ${blockId}`,
            })
          );
          return;
        }

        const newContent =
          position === 'start'
            ? `${content}\n${block.content}`
            : `${block.content}\n${content}`;

        yield* updateBlock(blockId, newContent.trim());
      });

    const replaceContent = (
      blockId: string,
      oldContent: string,
      newContent: string
    ): Effect.Effect<void, MemoryError, SqlStorageContext> =>
      Effect.gen(function* () {
        const block = yield* getBlock(blockId);
        if (!block) {
          yield* Effect.fail(
            new MemoryError({
              operation: 'replaceContent',
              cause: `Block not found: ${blockId}`,
            })
          );
          return;
        }

        const updated = block.content.replace(oldContent, newContent);
        yield* updateBlock(blockId, updated);
      });

    const rethinkBlock = (
      blockId: string,
      newContent: string,
      reason?: string
    ): Effect.Effect<void, MemoryError, SqlStorageContext> =>
      Effect.gen(function* () {
        const block = yield* getBlock(blockId);
        if (!block) {
          yield* Effect.fail(
            new MemoryError({
              operation: 'rethinkBlock',
              cause: `Block not found: ${blockId}`,
            })
          );
          return;
        }

        if (reason) {
          console.log(`Rethinking block ${blockId}: ${reason}`);
        }

        yield* updateBlock(blockId, newContent);
      });

    const insertArchival = (
      content: string,
      metadata?: Record<string, any>
    ): Effect.Effect<string, MemoryError> =>
      Effect.try({
        try: () => {
          const id = `archival_${Date.now()}_${Math.random()
            .toString(36)
            .substring(7)}`;
          const timestamp = Date.now();
          const metadataJson = JSON.stringify(metadata || {});

          sql.exec(
            `INSERT INTO archival_memory (id, content, created_at, metadata)
             VALUES (?, ?, ?, ?)`,
            id,
            content,
            timestamp,
            metadataJson
          );

          console.log(`Inserted archival memory: ${id}`);
          return id;
        },
        catch: (cause) =>
          new MemoryError({ operation: 'insertArchival', cause }),
      });

    const searchArchival = (
      query: string,
      limit: number = 10
    ): Effect.Effect<ArchivalEntry[], MemoryError> =>
      Effect.try({
        try: () => {
          // Simple text search fallback
          // Use semantic-search.ts for semantic search with embeddings
          const cursor = sql.exec(
            `SELECT id, content, created_at, metadata, vector_id
             FROM archival_memory
             WHERE content LIKE ?
             ORDER BY created_at DESC
             LIMIT ?`,
            `%${query}%`,
            limit
          );

          const entries: ArchivalEntry[] = [];
          for (const row of cursor) {
            entries.push({
              id: Array.isArray(row) ? (row[0] as string) : (row as any).id,
              content: Array.isArray(row)
                ? (row[1] as string)
                : (row as any).content,
              created_at: Array.isArray(row)
                ? (row[2] as number)
                : (row as any).created_at,
              metadata: Array.isArray(row)
                ? JSON.parse((row[3] as string) || '{}')
                : JSON.parse((row as any).metadata || '{}'),
              vector_id: Array.isArray(row)
                ? (row[4] as string)
                : (row as any).vector_id,
            });
          }

          return entries;
        },
        catch: (cause) =>
          new MemoryError({ operation: 'searchArchival', cause }),
      });

    const getAllArchivalEntries = (): Effect.Effect<
      ArchivalEntry[],
      MemoryError
    > =>
      Effect.try({
        try: () => {
          const cursor = sql.exec(`
            SELECT id, content, created_at, metadata, vector_id
            FROM archival_memory
            ORDER BY created_at DESC
          `);

          const entries: ArchivalEntry[] = [];
          for (const row of cursor) {
            entries.push({
              id: Array.isArray(row) ? (row[0] as string) : (row as any).id,
              content: Array.isArray(row)
                ? (row[1] as string)
                : (row as any).content,
              created_at: Array.isArray(row)
                ? (row[2] as number)
                : (row as any).created_at,
              metadata: Array.isArray(row)
                ? JSON.parse((row[3] as string) || '{}')
                : JSON.parse((row as any).metadata || '{}'),
              vector_id: Array.isArray(row)
                ? (row[4] as string)
                : (row as any).vector_id,
            });
          }

          return entries;
        },
        catch: (cause) =>
          new MemoryError({ operation: 'getAllArchivalEntries', cause }),
      });

    const buildCoreMemoryContext = (): Effect.Effect<string, MemoryError> =>
      Effect.gen(function* () {
        const blocks = yield* getAllBlocks('core');

        if (blocks.length === 0) {
          return '';
        }

        let context = '\n\n## Core Memory\nYour structured memory blocks:\n\n';

        for (const block of blocks) {
          const date = new Date(block.updated_at).toLocaleString();
          context += `### ${block.label} (${block.id})\n`;
          context += `*Last updated: ${date}*\n\n`;
          context += `${block.content}\n\n`;
          context += '---\n\n';
        }

        context += `Use memory tools to manage these blocks: memory_insert, memory_replace, memory_rethink`;

        return context;
      });

    // Initialize: Load existing blocks into cache
    yield* Effect.try({
      try: () => {
        try {
          const cursor = sql.exec(
            `SELECT id, label, content, type, updated_at, metadata
             FROM memory_blocks
             WHERE type = 'core'
             ORDER BY updated_at DESC`
          );

          for (const row of cursor) {
            const block: MemoryBlock = {
              id: Array.isArray(row) ? (row[0] as string) : (row as any).id,
              label: Array.isArray(row)
                ? (row[1] as string)
                : (row as any).label,
              content: Array.isArray(row)
                ? (row[2] as string)
                : (row as any).content,
              type: Array.isArray(row)
                ? (row[3] as MemoryBlockType)
                : (row as any).type,
              updated_at: Array.isArray(row)
                ? (row[4] as number)
                : (row as any).updated_at,
              metadata: Array.isArray(row)
                ? JSON.parse((row[5] as string) || '{}')
                : JSON.parse((row as any).metadata || '{}'),
            };
            blocksCache.set(block.id, block);
          }

          console.log(`Loaded ${blocksCache.size} core memory blocks`);
        } catch (error) {
          // Table might not exist yet - this is OK, it will be created by initializeDatabase
          console.log('Loaded 0 core memory blocks');
        }
      },
      catch: (cause) => new MemoryError({ operation: 'loadCache', cause }),
    });

    return {
      initializeDatabase,
      getBlock,
      getAllBlocks,
      createBlock,
      updateBlock,
      deleteBlock,
      insertContent,
      replaceContent,
      rethinkBlock,
      insertArchival,
      searchArchival,
      getAllArchivalEntries,
      buildCoreMemoryContext,
    } satisfies MemoryBlockManagerService;
  })
);

/**
 * Convenience functions for using Memory Block Manager
 */
export const getBlock = (id: string) =>
  Effect.gen(function* () {
    const manager = yield* MemoryBlockManagerService;
    return yield* manager.getBlock(id);
  });

export const createBlock = (
  id: string,
  label: string,
  content: string,
  type?: MemoryBlockType
) =>
  Effect.gen(function* () {
    const manager = yield* MemoryBlockManagerService;
    return yield* manager.createBlock(id, label, content, type);
  });

export const insertContent = (
  blockId: string,
  content: string,
  position?: 'start' | 'end'
) =>
  Effect.gen(function* () {
    const manager = yield* MemoryBlockManagerService;
    return yield* manager.insertContent(blockId, content, position);
  });

export const buildCoreMemoryContext = () =>
  Effect.gen(function* () {
    const manager = yield* MemoryBlockManagerService;
    return yield* manager.buildCoreMemoryContext();
  });
