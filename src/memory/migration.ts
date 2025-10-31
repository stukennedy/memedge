/**
 * Migration utilities for moving from legacy memory to memory blocks
 */
import { Effect } from 'effect';
import { MemoryError } from '../shared/errors';
import { SqlStorageContext } from './memory';
import * as MemoryBlocks from './blocks';

export interface MigrationResult {
  total: number;
  migrated: number;
  skipped: number;
  errors: string[];
}

/**
 * Migrate legacy agent_memory entries to memory blocks
 */
export function migrateLegacyMemoriesToBlocks(): Effect.Effect<
  MigrationResult,
  MemoryError,
  SqlStorageContext | MemoryBlocks.MemoryBlockManagerService
> {
  return Effect.gen(function* () {
    console.log('Starting memory migration from legacy to blocks...');

    const { sql } = yield* SqlStorageContext;
    const manager = yield* MemoryBlocks.MemoryBlockManagerService;

    const result: MigrationResult = {
      total: 0,
      migrated: 0,
      skipped: 0,
      errors: [],
    };

    // Check if legacy table exists
    const tableCheck = yield* Effect.try({
      try: () => {
        const cursor = sql.exec(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name='agent_memory'
        `);
        return [...cursor].length > 0;
      },
      catch: (cause) =>
        new MemoryError({ operation: 'check legacy table', cause }),
    });

    if (!tableCheck) {
      console.log('No legacy agent_memory table found, skipping migration');
      return result;
    }

    // Create standard blocks if they don't exist
    const standardBlocks = {
      human: { label: 'Human', content: '' },
      persona: { label: 'Persona', content: '' },
      context: { label: 'Context', content: '' },
    };

    for (const [id, { label, content }] of Object.entries(standardBlocks)) {
      const existing = yield* manager.getBlock(id);
      if (!existing) {
        yield* manager.createBlock(id, label, content, 'core');
        console.log(`Created standard block: ${id}`);
      }
    }

    // Query all legacy memories
    const memories = yield* Effect.try({
      try: () => {
        const cursor = sql.exec(`
          SELECT purpose, text, updated_at
          FROM agent_memory
          ORDER BY updated_at ASC
        `);
        return [...cursor];
      },
      catch: (cause) =>
        new MemoryError({ operation: 'query legacy memories', cause }),
    });

    result.total = memories.length;
    console.log(`Found ${memories.length} legacy memories to migrate`);

    // Migrate each memory
    for (const row of memories) {
      try {
        const purpose = Array.isArray(row)
          ? (row[0] as string)
          : (row as any).purpose;
        const text = Array.isArray(row)
          ? (row[1] as string)
          : (row as any).text;

        // Determine target block based on purpose keywords
        let targetBlock = 'context';
        const purposeLower = purpose.toLowerCase();

        if (purposeLower.match(/user|customer|person|human|client|people/)) {
          targetBlock = 'human';
        } else if (
          purposeLower.match(/agent|persona|identity|role|assistant/)
        ) {
          targetBlock = 'persona';
        }

        // Format content with original purpose as a label
        const formattedContent = `**${purpose}**\n${text}`;

        // Insert into appropriate block
        yield* manager.insertContent(targetBlock, formattedContent, 'end');

        result.migrated++;
        console.log(`Migrated '${purpose}' → ${targetBlock} block`);
      } catch (error) {
        result.errors.push(
          `Failed to migrate memory: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        result.skipped++;
      }
    }

    // Optionally rename legacy table for backup
    if (result.migrated > 0) {
      const renameEffect = Effect.try({
        try: () => {
          sql.exec(`
            ALTER TABLE agent_memory RENAME TO agent_memory_legacy_backup;
          `);
          console.log('Renamed legacy table to agent_memory_legacy_backup');
        },
        catch: (cause) =>
          new MemoryError({ operation: 'rename legacy table', cause }),
      });

      // Ignore errors - this is non-fatal
      yield* Effect.orElseSucceed(renameEffect, () => undefined);
    }

    console.log(
      `Migration complete: ${result.migrated} migrated, ${result.skipped} skipped, ${result.errors.length} errors`
    );

    return result;
  });
}

/**
 * Check if migration is needed
 */
export function checkMigrationNeeded(): Effect.Effect<
  boolean,
  MemoryError,
  SqlStorageContext
> {
  return Effect.gen(function* () {
    const { sql } = yield* SqlStorageContext;

    // Check if legacy table exists and has data
    const hasLegacyDataEffect = Effect.try({
      try: () => {
        const cursor = sql.exec(`
          SELECT COUNT(*) as count
          FROM agent_memory
        `);
        const rows = [...cursor];
        const count = Array.isArray(rows[0])
          ? (rows[0][0] as number)
          : (rows[0] as any).count;
        return count > 0;
      },
      catch: (cause) =>
        new MemoryError({ operation: 'check legacy data', cause }),
    });

    // Convert error to false (table doesn't exist)
    const hasLegacyData = yield* Effect.orElseSucceed(
      hasLegacyDataEffect,
      () => false
    );

    if (!hasLegacyData) {
      return false;
    }

    // Check if memory_blocks table exists and has data
    const hasNewDataEffect = Effect.try({
      try: () => {
        const cursor = sql.exec(`
          SELECT COUNT(*) as count
          FROM memory_blocks
        `);
        const rows = [...cursor];
        const count = Array.isArray(rows[0])
          ? (rows[0][0] as number)
          : (rows[0] as any).count;
        return count > 0;
      },
      catch: (cause) => new MemoryError({ operation: 'check new data', cause }),
    });

    // Convert error to false (table doesn't exist)
    const hasNewData = yield* Effect.orElseSucceed(
      hasNewDataEffect,
      () => false
    );

    // Migration needed if we have legacy data but no new data
    return hasLegacyData && !hasNewData;
  });
}

/**
 * Rollback migration (restore legacy table)
 */
export function rollbackMigration(): Effect.Effect<
  void,
  MemoryError,
  SqlStorageContext
> {
  return Effect.gen(function* () {
    const { sql } = yield* SqlStorageContext;

    console.log('Rolling back memory migration...');

    yield* Effect.try({
      try: () => {
        // Check if backup exists
        const cursor = sql.exec(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name='agent_memory_legacy_backup'
        `);

        if ([...cursor].length === 0) {
          throw new Error('No backup table found');
        }

        // Drop current agent_memory if it exists
        sql.exec(`DROP TABLE IF EXISTS agent_memory`);

        // Restore from backup
        sql.exec(`
          ALTER TABLE agent_memory_legacy_backup RENAME TO agent_memory
        `);

        console.log('Migration rolled back successfully');
      },
      catch: (cause) =>
        new MemoryError({ operation: 'rollback migration', cause }),
    });
  });
}

/**
 * Export memory blocks back to legacy format (for compatibility)
 */
export function exportBlocksToLegacy(): Effect.Effect<
  number,
  MemoryError,
  SqlStorageContext | MemoryBlocks.MemoryBlockManagerService
> {
  return Effect.gen(function* () {
    const { sql } = yield* SqlStorageContext;
    const manager = yield* MemoryBlocks.MemoryBlockManagerService;

    console.log('Exporting memory blocks to legacy format...');

    // Get all blocks
    const blocks = yield* manager.getAllBlocks('core');

    // Recreate legacy table if it doesn't exist
    yield* Effect.try({
      try: () => {
        sql.exec(`
          CREATE TABLE IF NOT EXISTS agent_memory (
            purpose TEXT PRIMARY KEY,
            text TEXT NOT NULL,
            updated_at INTEGER NOT NULL
          )
        `);
      },
      catch: (cause) =>
        new MemoryError({ operation: 'create legacy table', cause }),
    });

    // Export each block
    let exportedCount = 0;
    for (const block of blocks) {
      // Use block label as purpose
      const purpose = block.label.toLowerCase().replace(/\s+/g, '_');

      yield* Effect.try({
        try: () => {
          sql.exec(
            `INSERT OR REPLACE INTO agent_memory (purpose, text, updated_at)
             VALUES (?, ?, ?)`,
            purpose,
            block.content,
            block.updated_at
          );
          exportedCount++;
        },
        catch: (cause) =>
          new MemoryError({ operation: 'export block to legacy', cause }),
      });
    }

    console.log(`Exported ${exportedCount} blocks to legacy format`);
    return exportedCount;
  });
}
