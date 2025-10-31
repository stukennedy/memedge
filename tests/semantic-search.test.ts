import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Effect, Layer, Context } from 'effect';
import * as SemanticSearch from '../src/memory/semantic-search';
import { SqlStorageContext } from '../src/memory/memory';
import type { MemoryBlock, ArchivalEntry } from '../src/memory/blocks';

describe('SemanticSearch', () => {
  let mockSql: SqlStorage;
  let mockAi: Ai;
  let mockExecResults: Map<string, any[]>;

  beforeEach(() => {
    mockExecResults = new Map();

    mockSql = {
      exec: vi.fn((query: string, ...params: any[]) => {
        // Normalize whitespace for easier matching
        const normalizedQuery = query.replace(/\s+/g, ' ').trim();

        if (normalizedQuery.includes('CREATE TABLE')) {
          return [];
        }
        if (
          normalizedQuery.includes('SELECT') &&
          normalizedQuery.includes('memory_embeddings')
        ) {
          return mockExecResults.get('embeddings') || [];
        }
        if (
          normalizedQuery.includes('SELECT') &&
          normalizedQuery.includes('archival_embeddings')
        ) {
          return mockExecResults.get('archival_embeddings') || [];
        }
        if (normalizedQuery.includes('INSERT OR REPLACE')) {
          return [];
        }
        if (normalizedQuery.includes('DELETE FROM')) {
          return [];
        }
        return [];
      }),
    } as unknown as SqlStorage;

    mockAi = {
      run: vi.fn(async (model: string, options: any) => {
        // Return mock embedding (768 dimensions)
        const mockEmbedding = Array(768)
          .fill(0)
          .map(() => Math.random());
        return {
          data: [mockEmbedding],
        };
      }),
    } as unknown as Ai;
  });

  const createTestRuntime = async () => {
    const SqlLayer = Layer.succeed(SqlStorageContext, { sql: mockSql });
    const AiLayer = Layer.succeed(SemanticSearch.AiBindingContext, {
      ai: mockAi,
    });
    const CombinedLayer = Layer.mergeAll(SqlLayer, AiLayer);

    return await Effect.runPromise(
      Effect.scoped(Layer.toRuntime(CombinedLayer))
    );
  };

  describe('Cosine similarity', () => {
    it('should calculate similarity correctly', () => {
      const a = [1, 0, 0];
      const b = [1, 0, 0];
      const similarity = SemanticSearch.cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(1.0);
    });

    it('should handle orthogonal vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      const similarity = SemanticSearch.cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(0.0);
    });

    it('should handle opposite vectors', () => {
      const a = [1, 0, 0];
      const b = [-1, 0, 0];
      const similarity = SemanticSearch.cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(-1.0);
    });

    it('should throw error for different length vectors', () => {
      const a = [1, 0];
      const b = [1, 0, 0];
      expect(() => SemanticSearch.cosineSimilarity(a, b)).toThrow();
    });

    it('should handle zero vectors', () => {
      const a = [0, 0, 0];
      const b = [1, 0, 0];
      const similarity = SemanticSearch.cosineSimilarity(a, b);
      expect(similarity).toBe(0);
    });
  });

  describe('Embedding generation', () => {
    it('should generate embedding using Cloudflare AI', async () => {
      const runtime = await createTestRuntime();

      const program = SemanticSearch.generateEmbedding('Test text');

      const embedding = await Effect.runPromise(
        Effect.provide(program, runtime.context)
      );

      expect(embedding).toHaveLength(768);
      expect(mockAi.run).toHaveBeenCalledWith('@cf/baai/bge-base-en-v1.5', {
        text: ['Test text'],
      });
    });

    it('should fail when AI returns no data', async () => {
      const runtime = await createTestRuntime();

      mockAi.run = vi.fn(async () => ({ data: [] })) as any;

      const program = SemanticSearch.generateEmbedding('Test text');

      await expect(
        Effect.runPromise(Effect.provide(program, runtime.context))
      ).rejects.toThrow();
    });
  });

  describe('Embedding storage', () => {
    it('should store block embedding', async () => {
      const runtime = await createTestRuntime();

      const embedding = Array(768).fill(0.5);

      const program = SemanticSearch.storeBlockEmbedding(
        'test-block',
        embedding
      );

      await Effect.runPromise(Effect.provide(program, runtime.context));

      expect(mockSql.exec).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO memory_embeddings'),
        'test-block',
        expect.any(String),
        expect.any(Number)
      );
    });

    it('should store archival embedding', async () => {
      const runtime = await createTestRuntime();

      const embedding = Array(768).fill(0.5);

      const program = SemanticSearch.storeArchivalEmbedding(
        'archival-1',
        embedding
      );

      await Effect.runPromise(Effect.provide(program, runtime.context));

      expect(mockSql.exec).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO archival_embeddings'),
        'archival-1',
        expect.any(String),
        expect.any(Number)
      );
    });
  });

  describe('Embedding retrieval', () => {
    it('should get all block embeddings', async () => {
      const runtime = await createTestRuntime();

      const mockEmbedding = JSON.stringify([0.1, 0.2, 0.3]);
      mockExecResults.set('embeddings', [
        ['block-1', mockEmbedding],
        ['block-2', mockEmbedding],
      ]);

      const program = SemanticSearch.getAllBlockEmbeddings();

      const embeddings = await Effect.runPromise(
        Effect.provide(program, runtime.context)
      );

      expect(embeddings.size).toBe(2);
      expect(embeddings.has('block-1')).toBe(true);
      expect(embeddings.has('block-2')).toBe(true);
      expect(embeddings.get('block-1')).toEqual([0.1, 0.2, 0.3]);
    });

    it('should get all archival embeddings', async () => {
      const runtime = await createTestRuntime();

      const mockEmbedding = JSON.stringify([0.1, 0.2, 0.3]);
      mockExecResults.set('archival_embeddings', [
        ['archival-1', mockEmbedding],
      ]);

      const program = SemanticSearch.getAllArchivalEmbeddings();

      const embeddings = await Effect.runPromise(
        Effect.provide(program, runtime.context)
      );

      expect(embeddings.size).toBe(1);
      expect(embeddings.has('archival-1')).toBe(true);
    });
  });

  describe('Database initialization', () => {
    it('should create embeddings tables', async () => {
      const runtime = await createTestRuntime();

      const program = SemanticSearch.initializeEmbeddingsTables();

      await Effect.runPromise(Effect.provide(program, runtime.context));

      expect(mockSql.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS memory_embeddings')
      );
      expect(mockSql.exec).toHaveBeenCalledWith(
        expect.stringContaining(
          'CREATE TABLE IF NOT EXISTS archival_embeddings'
        )
      );
    });
  });
});
