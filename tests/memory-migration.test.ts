import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Effect, Layer } from 'effect';
import * as Migration from '../src/memory/migration';
import * as MemoryBlocks from '../src/memory/blocks';
import * as SemanticSearch from '../src/memory/semantic-search';
import { SqlStorageContext } from '../src/memory/memory';

describe('Memory Migration', () => {
  let mockSql: SqlStorage;
  let mockExecResults: Map<string, any[]>;

  beforeEach(() => {
    mockExecResults = new Map();

    mockSql = {
      exec: vi.fn((query: string, ...params: any[]) => {
        if (query.includes('CREATE TABLE')) {
          return [];
        }
        if (query.includes('sqlite_master')) {
          return mockExecResults.get('table_check') || [];
        }
        // Check COUNT before general SELECT to avoid conflicts
        if (query.includes('SELECT COUNT')) {
          const key = query.includes('agent_memory')
            ? 'legacy_count'
            : 'blocks_count';
          return mockExecResults.get(key) || [[0]];
        }
        if (query.includes('SELECT') && query.includes('agent_memory')) {
          return mockExecResults.get('legacy_memories') || [];
        }
        if (query.includes('SELECT') && query.includes('memory_blocks')) {
          return mockExecResults.get('blocks') || [];
        }
        if (query.includes('INSERT OR REPLACE INTO memory_blocks')) {
          return [];
        }
        if (query.includes('INSERT OR REPLACE INTO agent_memory')) {
          return [];
        }
        if (query.includes('INSERT') && query.includes('memory_embeddings')) {
          return []; // Mock embedding storage
        }
        if (query.includes('ALTER TABLE')) {
          return [];
        }
        if (query.includes('DROP TABLE')) {
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
    const CombinedLayer = Layer.mergeAll(SqlLayer, AiLayer, MemoryBlockLayer);

    return await Effect.runPromise(
      Effect.scoped(Layer.toRuntime(CombinedLayer))
    );
  };

  describe('Migration needed check', () => {
    it('should detect when migration is needed', async () => {
      const runtime = await createTestRuntime();

      // Legacy table has data
      mockExecResults.set('legacy_count', [[5]]);
      // New table is empty
      mockExecResults.set('blocks_count', [[0]]);

      const program = Migration.checkMigrationNeeded();

      const needed = await Effect.runPromise(
        Effect.provide(program, runtime.context)
      );

      expect(needed).toBe(true);
    });

    it('should detect when migration is not needed (no legacy data)', async () => {
      const runtime = await createTestRuntime();

      // Legacy table is empty
      mockExecResults.set('legacy_count', [[0]]);
      mockExecResults.set('blocks_count', [[0]]);

      const program = Migration.checkMigrationNeeded();

      const needed = await Effect.runPromise(
        Effect.provide(program, runtime.context)
      );

      expect(needed).toBe(false);
    });

    it('should detect when migration already done', async () => {
      const runtime = await createTestRuntime();

      // Both tables have data
      mockExecResults.set('legacy_count', [[5]]);
      mockExecResults.set('blocks_count', [[3]]);

      const program = Migration.checkMigrationNeeded();

      const needed = await Effect.runPromise(
        Effect.provide(program, runtime.context)
      );

      expect(needed).toBe(false);
    });
  });

  describe('Legacy memory migration', () => {
    it('should migrate legacy memories to blocks', async () => {
      const runtime = await createTestRuntime();

      // Mock legacy table exists
      mockExecResults.set('table_check', [['agent_memory']]);

      // Mock legacy memories
      mockExecResults.set('legacy_memories', [
        ['customer_notes', 'User likes dark mode', Date.now()],
        ['user_preferences', 'Prefers TypeScript', Date.now()],
        ['agent_info', 'I am a helpful assistant', Date.now()],
      ]);

      const program = Migration.migrateLegacyMemoriesToBlocks();

      const result = await Effect.runPromise(
        Effect.provide(program, runtime.context)
      );

      expect(result.total).toBe(3);
      expect(result.migrated).toBe(3);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Verify standard blocks were created
      expect(mockSql.exec).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO memory_blocks'),
        'human',
        'Human',
        '',
        'core',
        expect.any(Number),
        '{}'
      );

      // Verify table rename
      expect(mockSql.exec).toHaveBeenCalledWith(
        expect.stringContaining('ALTER TABLE agent_memory RENAME TO')
      );
    });

    it('should skip migration when no legacy table exists', async () => {
      const runtime = await createTestRuntime();

      mockExecResults.set('table_check', []); // No legacy table

      const program = Migration.migrateLegacyMemoriesToBlocks();

      const result = await Effect.runPromise(
        Effect.provide(program, runtime.context)
      );

      expect(result.total).toBe(0);
      expect(result.migrated).toBe(0);
    });
  });

  describe('Rollback migration', () => {
    it('should restore legacy table from backup', async () => {
      const runtime = await createTestRuntime();

      // Mock backup table exists
      mockExecResults.set('table_check', [['agent_memory_legacy_backup']]);

      const program = Migration.rollbackMigration();

      await Effect.runPromise(Effect.provide(program, runtime.context));

      // Verify DROP and RENAME were called
      expect(mockSql.exec).toHaveBeenCalledWith(
        expect.stringContaining('DROP TABLE IF EXISTS agent_memory')
      );
      expect(mockSql.exec).toHaveBeenCalledWith(
        expect.stringContaining(
          'ALTER TABLE agent_memory_legacy_backup RENAME TO agent_memory'
        )
      );
    });

    it('should fail when no backup exists', async () => {
      const runtime = await createTestRuntime();

      mockExecResults.set('table_check', []); // No backup table

      const program = Migration.rollbackMigration();

      await expect(
        Effect.runPromise(Effect.provide(program, runtime.context))
      ).rejects.toThrow();
    });
  });

  describe('Export blocks to legacy', () => {
    it('should export blocks to legacy format', async () => {
      const runtime = await createTestRuntime();

      // Mock existing blocks
      mockExecResults.set('blocks', [
        ['human', 'Human', 'User info', 'core', Date.now(), '{}'],
        ['persona', 'Persona', 'Agent info', 'core', Date.now(), '{}'],
      ]);

      const program = Migration.exportBlocksToLegacy();

      const count = await Effect.runPromise(
        Effect.provide(program, runtime.context)
      );

      expect(count).toBe(2);

      // Verify legacy table creation
      expect(mockSql.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS agent_memory')
      );

      // Verify inserts
      const insertCalls = (mockSql.exec as any).mock.calls.filter((call: any) =>
        call[0].includes('INSERT OR REPLACE INTO agent_memory')
      );
      expect(insertCalls.length).toBe(2);
    });

    it('should convert block labels to purpose keys', async () => {
      const runtime = await createTestRuntime();

      mockExecResults.set('blocks', [
        ['custom', 'Project Notes', 'Content', 'core', Date.now(), '{}'],
      ]);

      const program = Migration.exportBlocksToLegacy();

      await Effect.runPromise(Effect.provide(program, runtime.context));

      // Verify purpose key conversion (spaces to underscores, lowercase)
      expect(mockSql.exec).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO agent_memory'),
        'project_notes', // Converted from "Project Notes"
        'Content',
        expect.any(Number)
      );
    });
  });
});
