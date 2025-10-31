import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Effect, Layer } from 'effect';
import * as MemoryBlocks from '../src/memory/blocks';
import { SqlStorageContext } from '../src/memory/memory';
import * as SemanticSearch from '../src/memory/semantic-search';
import { MemoryError } from '../src/shared/errors';

describe('MemoryBlocks', () => {
  let mockSql: SqlStorage;
  let mockExecResults: Map<string, any[]>;

  beforeEach(() => {
    mockExecResults = new Map();

    mockSql = {
      exec: vi.fn((query: string, ...params: any[]) => {
        // Mock different queries
        if (query.includes('CREATE TABLE')) {
          return [];
        }
        if (query.includes('SELECT') && query.includes('memory_blocks')) {
          const key = `select_blocks_${params.join('_')}`;
          return mockExecResults.get(key) || [];
        }
        if (query.includes('SELECT') && query.includes('archival_memory')) {
          return mockExecResults.get('archival') || [];
        }
        if (query.includes('INSERT') && query.includes('memory_blocks')) {
          return [];
        }
        if (query.includes('INSERT') && query.includes('archival_memory')) {
          return [];
        }
        if (query.includes('INSERT') && query.includes('memory_embeddings')) {
          return []; // Mock embedding storage
        }
        if (query.includes('UPDATE') && query.includes('memory_blocks')) {
          return [];
        }
        if (query.includes('DELETE') && query.includes('memory_blocks')) {
          return [];
        }
        return [];
      }),
    } as unknown as SqlStorage;
  });

  const createTestRuntime = async () => {
    // Mock AI binding for embedding generation
    const mockAi = {
      run: vi.fn().mockResolvedValue({
        data: [[0.1, 0.2, 0.3]], // Mock embedding vector
      }),
    };

    const SqlLayer = Layer.succeed(SqlStorageContext, { sql: mockSql });
    const AiLayer = Layer.succeed(SemanticSearch.AiBindingContext, {
      ai: mockAi as any,
    });

    const MemoryBlockLayer = MemoryBlocks.MemoryBlockManagerLive.pipe(
      Layer.provide(Layer.mergeAll(SqlLayer, AiLayer))
    );

    // Merge all layers so they're available at the top level
    const AppLayer = Layer.mergeAll(MemoryBlockLayer, SqlLayer, AiLayer);

    return await Effect.runPromise(Effect.scoped(Layer.toRuntime(AppLayer)));
  };

  describe('Database initialization', () => {
    it('should create memory blocks tables', async () => {
      const runtime = await createTestRuntime();

      const program = Effect.gen(function* () {
        const manager = yield* MemoryBlocks.MemoryBlockManagerService;
        yield* manager.initializeDatabase();
      });

      await Effect.runPromise(Effect.provide(program, runtime.context));

      expect(mockSql.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS memory_blocks')
      );
      expect(mockSql.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS archival_memory')
      );
    });
  });

  describe('Block creation', () => {
    it('should create a new memory block', async () => {
      const runtime = await createTestRuntime();

      const program = Effect.gen(function* () {
        const manager = yield* MemoryBlocks.MemoryBlockManagerService;
        yield* manager.initializeDatabase();

        const block = yield* manager.createBlock(
          'test-block',
          'Test Block',
          'Test content',
          'core'
        );

        return block;
      });

      const result = await Effect.runPromise(
        Effect.provide(program, runtime.context)
      );

      expect(result.id).toBe('test-block');
      expect(result.label).toBe('Test Block');
      expect(result.content).toBe('Test content');
      expect(result.type).toBe('core');
      expect(mockSql.exec).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO memory_blocks'),
        'test-block',
        'Test Block',
        'Test content',
        'core',
        expect.any(Number),
        '{}'
      );
    });
  });

  describe('Block retrieval', () => {
    it('should get a block by id', async () => {
      const runtime = await createTestRuntime();

      // Mock block data
      mockExecResults.set('select_blocks_test-block', [
        ['test-block', 'Test Block', 'Test content', 'core', Date.now(), '{}'],
      ]);

      const program = Effect.gen(function* () {
        const manager = yield* MemoryBlocks.MemoryBlockManagerService;
        const block = yield* manager.getBlock('test-block');
        return block;
      });

      const result = await Effect.runPromise(
        Effect.provide(program, runtime.context)
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe('test-block');
      expect(result?.label).toBe('Test Block');
      expect(result?.content).toBe('Test content');
    });

    it('should return null for non-existent block', async () => {
      const runtime = await createTestRuntime();

      mockExecResults.set('select_blocks_non-existent', []);

      const program = Effect.gen(function* () {
        const manager = yield* MemoryBlocks.MemoryBlockManagerService;
        const block = yield* manager.getBlock('non-existent');
        return block;
      });

      const result = await Effect.runPromise(
        Effect.provide(program, runtime.context)
      );

      expect(result).toBeNull();
    });
  });

  describe('Block updates', () => {
    it('should update block content', async () => {
      const runtime = await createTestRuntime();

      const program = Effect.gen(function* () {
        const manager = yield* MemoryBlocks.MemoryBlockManagerService;
        yield* manager.updateBlock('test-block', 'Updated content');
      });

      await Effect.runPromise(Effect.provide(program, runtime.context));

      expect(mockSql.exec).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE memory_blocks'),
        'Updated content',
        expect.any(Number),
        'test-block'
      );
    });

    it('should insert content at end', async () => {
      const runtime = await createTestRuntime();

      mockExecResults.set('select_blocks_test-block', [
        [
          'test-block',
          'Test Block',
          'Original content',
          'core',
          Date.now(),
          '{}',
        ],
      ]);

      const program = Effect.gen(function* () {
        const manager = yield* MemoryBlocks.MemoryBlockManagerService;
        yield* manager.insertContent('test-block', 'New content', 'end');
      });

      await Effect.runPromise(Effect.provide(program, runtime.context));

      expect(mockSql.exec).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE memory_blocks'),
        expect.stringContaining('Original content\nNew content'),
        expect.any(Number),
        'test-block'
      );
    });

    it('should insert content at start', async () => {
      const runtime = await createTestRuntime();

      mockExecResults.set('select_blocks_test-block', [
        [
          'test-block',
          'Test Block',
          'Original content',
          'core',
          Date.now(),
          '{}',
        ],
      ]);

      const program = Effect.gen(function* () {
        const manager = yield* MemoryBlocks.MemoryBlockManagerService;
        yield* manager.insertContent('test-block', 'New content', 'start');
      });

      await Effect.runPromise(Effect.provide(program, runtime.context));

      expect(mockSql.exec).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE memory_blocks'),
        expect.stringContaining('New content\nOriginal content'),
        expect.any(Number),
        'test-block'
      );
    });

    it('should replace specific content', async () => {
      const runtime = await createTestRuntime();

      mockExecResults.set('select_blocks_test-block', [
        [
          'test-block',
          'Test Block',
          'The old text here',
          'core',
          Date.now(),
          '{}',
        ],
      ]);

      const program = Effect.gen(function* () {
        const manager = yield* MemoryBlocks.MemoryBlockManagerService;
        yield* manager.replaceContent('test-block', 'old text', 'new text');
      });

      await Effect.runPromise(Effect.provide(program, runtime.context));

      expect(mockSql.exec).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE memory_blocks'),
        'The new text here',
        expect.any(Number),
        'test-block'
      );
    });

    it('should rethink (rewrite) entire block', async () => {
      const runtime = await createTestRuntime();

      mockExecResults.set('select_blocks_test-block', [
        [
          'test-block',
          'Test Block',
          'Old messy content',
          'core',
          Date.now(),
          '{}',
        ],
      ]);

      const program = Effect.gen(function* () {
        const manager = yield* MemoryBlocks.MemoryBlockManagerService;
        yield* manager.rethinkBlock(
          'test-block',
          'Clean organized content',
          'Reorganizing for clarity'
        );
      });

      await Effect.runPromise(Effect.provide(program, runtime.context));

      expect(mockSql.exec).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE memory_blocks'),
        'Clean organized content',
        expect.any(Number),
        'test-block'
      );
    });
  });

  describe('Block deletion', () => {
    it('should delete a block', async () => {
      const runtime = await createTestRuntime();

      const program = Effect.gen(function* () {
        const manager = yield* MemoryBlocks.MemoryBlockManagerService;
        yield* manager.deleteBlock('test-block');
      });

      await Effect.runPromise(Effect.provide(program, runtime.context));

      expect(mockSql.exec).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM memory_blocks'),
        'test-block'
      );
    });
  });

  describe('Archival memory', () => {
    it('should insert archival entry', async () => {
      const runtime = await createTestRuntime();

      const program = Effect.gen(function* () {
        const manager = yield* MemoryBlocks.MemoryBlockManagerService;
        const id = yield* manager.insertArchival('Historical fact', {
          category: 'history',
        });
        return id;
      });

      const result = await Effect.runPromise(
        Effect.provide(program, runtime.context)
      );

      expect(result).toMatch(/^archival_\d+_[a-z0-9]+$/);
      expect(mockSql.exec).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO archival_memory'),
        expect.any(String),
        'Historical fact',
        expect.any(Number),
        expect.stringContaining('category')
      );
    });

    it('should search archival memory', async () => {
      const runtime = await createTestRuntime();

      mockExecResults.set('archival', [
        [
          'archival_1',
          'User went to MIT',
          Date.now(),
          '{"category":"education"}',
          null,
        ],
      ]);

      const program = Effect.gen(function* () {
        const manager = yield* MemoryBlocks.MemoryBlockManagerService;
        const results = yield* manager.searchArchival('MIT', 10);
        return results;
      });

      const results = await Effect.runPromise(
        Effect.provide(program, runtime.context)
      );

      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('User went to MIT');
    });
  });

  describe('Context building', () => {
    it('should build memory context from blocks', async () => {
      const runtime = await createTestRuntime();

      // Mock some blocks
      const mockBlocks = [
        ['human', 'Human', 'Name: Alice', 'core', Date.now(), '{}'],
        ['persona', 'Persona', 'Role: Assistant', 'core', Date.now(), '{}'],
      ];

      mockExecResults.set('select_blocks_core', mockBlocks);

      const program = Effect.gen(function* () {
        const manager = yield* MemoryBlocks.MemoryBlockManagerService;
        const context = yield* manager.buildCoreMemoryContext();
        return context;
      });

      const context = await Effect.runPromise(
        Effect.provide(program, runtime.context)
      );

      expect(context).toContain('Core Memory');
      expect(context).toContain('Human');
      expect(context).toContain('Name: Alice');
      expect(context).toContain('Persona');
      expect(context).toContain('Role: Assistant');
      expect(context).toContain('memory_insert');
    });

    it('should return empty string when no blocks exist', async () => {
      const runtime = await createTestRuntime();

      mockExecResults.set('select_blocks_core', []);

      const program = Effect.gen(function* () {
        const manager = yield* MemoryBlocks.MemoryBlockManagerService;
        const context = yield* manager.buildCoreMemoryContext();
        return context;
      });

      const context = await Effect.runPromise(
        Effect.provide(program, runtime.context)
      );

      expect(context).toBe('');
    });
  });

  describe('Error handling', () => {
    it('should fail when inserting to non-existent block', async () => {
      const runtime = await createTestRuntime();

      mockExecResults.set('select_blocks_non-existent', []);

      const program = Effect.gen(function* () {
        const manager = yield* MemoryBlocks.MemoryBlockManagerService;
        yield* manager.insertContent('non-existent', 'content');
      });

      await expect(
        Effect.runPromise(Effect.provide(program, runtime.context))
      ).rejects.toThrow();
    });

    it('should fail when replacing in non-existent block', async () => {
      const runtime = await createTestRuntime();

      mockExecResults.set('select_blocks_non-existent', []);

      const program = Effect.gen(function* () {
        const manager = yield* MemoryBlocks.MemoryBlockManagerService;
        yield* manager.replaceContent('non-existent', 'old', 'new');
      });

      await expect(
        Effect.runPromise(Effect.provide(program, runtime.context))
      ).rejects.toThrow();
    });
  });
});
