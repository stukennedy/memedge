/**
 * Enhanced Memory Tool Execution Handlers
 * Implements Letta-inspired memory operations
 */
import { Effect } from 'effect';
import { MemoryError } from '../shared/errors';
import * as MemoryBlocks from '../memory/blocks';
import * as LegacyMemory from '../memory/memory';
import * as SemanticSearch from '../memory/semantic-search';

/**
 * Execute enhanced memory tools
 */

export function executeMemoryGetBlock(args: {
  block_id: string;
}): Effect.Effect<
  { block_id: string; label: string; content: string; updated_at: string },
  MemoryError,
  MemoryBlocks.MemoryBlockManagerService
> {
  return Effect.gen(function* () {
    const manager = yield* MemoryBlocks.MemoryBlockManagerService;
    const block = yield* manager.getBlock(args.block_id);

    if (!block) {
      return {
        block_id: args.block_id,
        label: '',
        content: `Block '${args.block_id}' does not exist. Use memory_create_block to create it first.`,
        updated_at: '',
      };
    }

    return {
      block_id: block.id,
      label: block.label,
      content: block.content,
      updated_at: new Date(block.updated_at).toLocaleString(),
    };
  });
}

export function executeMemoryInsert(args: {
  block_id: string;
  content: string;
  position?: 'start' | 'end';
}): Effect.Effect<
  { success: boolean; message: string },
  MemoryError,
  MemoryBlocks.MemoryBlockManagerService | LegacyMemory.SqlStorageContext
> {
  return Effect.gen(function* () {
    const manager = yield* MemoryBlocks.MemoryBlockManagerService;

    // Check if block exists
    const block = yield* manager.getBlock(args.block_id);
    if (!block) {
      return {
        success: false,
        message: `Block '${args.block_id}' does not exist. Use memory_create_block to create it first.`,
      };
    }

    yield* manager.insertContent(
      args.block_id,
      args.content,
      args.position || 'end'
    );

    return {
      success: true,
      message: `Successfully inserted content into block '${
        args.block_id
      }' at ${args.position || 'end'}`,
    };
  });
}

export function executeMemoryReplace(args: {
  block_id: string;
  old_content: string;
  new_content: string;
}): Effect.Effect<
  { success: boolean; message: string },
  MemoryError,
  MemoryBlocks.MemoryBlockManagerService | LegacyMemory.SqlStorageContext
> {
  return Effect.gen(function* () {
    const manager = yield* MemoryBlocks.MemoryBlockManagerService;

    // Check if block exists
    const block = yield* manager.getBlock(args.block_id);
    if (!block) {
      return {
        success: false,
        message: `Block '${args.block_id}' does not exist.`,
      };
    }

    // Check if old_content exists in block
    if (!block.content.includes(args.old_content)) {
      return {
        success: false,
        message: `Content to replace not found in block '${
          args.block_id
        }'. Current content: ${block.content.substring(0, 100)}...`,
      };
    }

    yield* manager.replaceContent(
      args.block_id,
      args.old_content,
      args.new_content
    );

    return {
      success: true,
      message: `Successfully replaced content in block '${args.block_id}'`,
    };
  });
}

export function executeMemoryRethink(args: {
  block_id: string;
  new_content: string;
  reason?: string;
}): Effect.Effect<
  { success: boolean; message: string },
  MemoryError,
  MemoryBlocks.MemoryBlockManagerService | LegacyMemory.SqlStorageContext
> {
  return Effect.gen(function* () {
    const manager = yield* MemoryBlocks.MemoryBlockManagerService;

    // Check if block exists
    const block = yield* manager.getBlock(args.block_id);
    if (!block) {
      return {
        success: false,
        message: `Block '${args.block_id}' does not exist.`,
      };
    }

    yield* manager.rethinkBlock(args.block_id, args.new_content, args.reason);

    const reasonMsg = args.reason ? ` (Reason: ${args.reason})` : '';
    return {
      success: true,
      message: `Successfully rewrote block '${args.block_id}'${reasonMsg}`,
    };
  });
}

export function executeMemoryCreateBlock(args: {
  block_id: string;
  label: string;
  content: string;
  type?: 'core' | 'archival';
}): Effect.Effect<
  { success: boolean; message: string; block_id: string },
  MemoryError,
  MemoryBlocks.MemoryBlockManagerService | LegacyMemory.SqlStorageContext
> {
  return Effect.gen(function* () {
    const manager = yield* MemoryBlocks.MemoryBlockManagerService;

    // Check if block already exists
    const existing = yield* manager.getBlock(args.block_id);
    if (existing) {
      return {
        success: false,
        message: `Block '${args.block_id}' already exists. Use memory_replace or memory_rethink to modify it.`,
        block_id: args.block_id,
      };
    }

    yield* manager.createBlock(
      args.block_id,
      args.label,
      args.content,
      args.type || 'core'
    );

    return {
      success: true,
      message: `Successfully created ${args.type || 'core'} memory block '${
        args.block_id
      }' (${args.label})`,
      block_id: args.block_id,
    };
  });
}

export function executeMemoryListBlocks(args: {
  type?: 'core' | 'archival';
}): Effect.Effect<
  {
    blocks: Array<{
      id: string;
      label: string;
      type: string;
      preview: string;
      updated_at: string;
    }>;
  },
  MemoryError,
  MemoryBlocks.MemoryBlockManagerService
> {
  return Effect.gen(function* () {
    const manager = yield* MemoryBlocks.MemoryBlockManagerService;
    const blocks = yield* manager.getAllBlocks(args.type);

    return {
      blocks: blocks.map((block) => ({
        id: block.id,
        label: block.label,
        type: block.type,
        preview:
          block.content.substring(0, 100) +
          (block.content.length > 100 ? '...' : ''),
        updated_at: new Date(block.updated_at).toLocaleString(),
      })),
    };
  });
}

export function executeArchivalInsert(args: {
  content: string;
  metadata?: Record<string, any>;
}): Effect.Effect<
  { success: boolean; message: string; id: string },
  MemoryError,
  MemoryBlocks.MemoryBlockManagerService
> {
  return Effect.gen(function* () {
    const manager = yield* MemoryBlocks.MemoryBlockManagerService;
    const id = yield* manager.insertArchival(args.content, args.metadata);

    return {
      success: true,
      message: `Successfully stored in archival memory`,
      id,
    };
  });
}

export function executeArchivalSearch(args: {
  query: string;
  limit?: number;
  useSemanticSearch?: boolean;
}): Effect.Effect<
  {
    results: Array<{
      id: string;
      content: string;
      created_at: string;
      metadata?: Record<string, any>;
      score?: number;
    }>;
  },
  MemoryError,
  | MemoryBlocks.MemoryBlockManagerService
  | SemanticSearch.AiBindingContext
  | LegacyMemory.SqlStorageContext
> {
  return Effect.gen(function* () {
    const manager = yield* MemoryBlocks.MemoryBlockManagerService;

    // Try semantic search first if requested (requires AI binding)
    if (args.useSemanticSearch) {
      const semanticSearchEffect = Effect.gen(function* () {
        // Get all archival entries
        const entries = yield* manager.getAllArchivalEntries();

        // Perform semantic search
        const results = yield* SemanticSearch.searchArchivalMemory(
          args.query,
          entries,
          args.limit || 10
        );

        return {
          results: results.map((r) => ({
            id: r.entry.id,
            content: r.entry.content,
            created_at: new Date(r.entry.created_at).toLocaleString(),
            metadata: r.entry.metadata,
            score: Math.round(r.score * 100) / 100, // Round to 2 decimals
          })),
        };
      });

      // If semantic search fails (no AI binding), fall back to text search
      const fallbackEffect = Effect.gen(function* () {
        const entries = yield* manager.searchArchival(args.query, args.limit);
        return {
          results: entries.map((entry) => ({
            id: entry.id,
            content: entry.content,
            created_at: new Date(entry.created_at).toLocaleString(),
            metadata: entry.metadata,
          })),
        };
      });

      return yield* Effect.orElse(semanticSearchEffect, () => fallbackEffect);
    }

    // Text search fallback
    const entries = yield* manager.searchArchival(args.query, args.limit);

    return {
      results: entries.map((entry) => ({
        id: entry.id,
        content: entry.content,
        created_at: new Date(entry.created_at).toLocaleString(),
        metadata: entry.metadata,
      })),
    };
  });
}

export function executeMemorySearch(args: {
  query: string;
  blocks?: string[];
  limit?: number;
  useSemanticSearch?: boolean;
}): Effect.Effect<
  {
    results: Array<{
      block_id: string;
      label: string;
      content: string;
      score: number;
    }>;
  },
  MemoryError,
  | MemoryBlocks.MemoryBlockManagerService
  | SemanticSearch.AiBindingContext
  | LegacyMemory.SqlStorageContext
> {
  return Effect.gen(function* () {
    const manager = yield* MemoryBlocks.MemoryBlockManagerService;

    // Get all blocks or filtered blocks
    const allBlocks = yield* manager.getAllBlocks();
    const blocksToSearch = args.blocks
      ? allBlocks.filter((b) => args.blocks!.includes(b.id))
      : allBlocks;

    // Try semantic search first if requested (requires AI binding)
    if (args.useSemanticSearch) {
      const semanticSearchEffect = Effect.gen(function* () {
        const results = yield* SemanticSearch.searchMemoryBlocks(
          args.query,
          blocksToSearch,
          args.limit || 5
        );

        return {
          results: results.map((r) => ({
            block_id: r.block.id,
            label: r.block.label,
            content: r.block.content,
            score: Math.round(r.score * 100) / 100, // Round to 2 decimals
          })),
        };
      });

      // If semantic search fails (no AI binding), fall back to text search
      const fallbackEffect = Effect.gen(function* () {
        const query = args.query.toLowerCase();
        const results = blocksToSearch
          .filter((block) => block.content.toLowerCase().includes(query))
          .map((block) => ({
            block_id: block.id,
            label: block.label,
            content: block.content,
            score: 1.0, // Placeholder score for text match
          }))
          .slice(0, args.limit || 5);

        return { results };
      });

      return yield* Effect.orElse(semanticSearchEffect, () => fallbackEffect);
    }

    // Text search fallback
    const query = args.query.toLowerCase();
    const results = blocksToSearch
      .filter((block) => block.content.toLowerCase().includes(query))
      .map((block) => ({
        block_id: block.id,
        label: block.label,
        content: block.content,
        score: 1.0, // Placeholder score for text match
      }))
      .slice(0, args.limit || 5);

    return { results };
  });
}

/**
 * Legacy memory tool handlers (backward compatibility)
 */

export function executeLegacyMemoryRead(args: {
  purpose: string;
}): Effect.Effect<
  { purpose: string; text: string | null; updated_at?: string },
  MemoryError,
  LegacyMemory.MemoryManagerService
> {
  return Effect.gen(function* () {
    const manager = yield* LegacyMemory.MemoryManagerService;
    const entry = yield* manager.readMemory(args.purpose);

    if (!entry) {
      return {
        purpose: args.purpose,
        text: null,
      };
    }

    return {
      purpose: entry.purpose,
      text: entry.text,
      updated_at: new Date(entry.updated_at).toLocaleString(),
    };
  });
}

export function executeLegacyMemoryWrite(args: {
  purpose: string;
  text: string;
}): Effect.Effect<
  { success: boolean; message: string },
  MemoryError,
  LegacyMemory.MemoryManagerService
> {
  return Effect.gen(function* () {
    const manager = yield* LegacyMemory.MemoryManagerService;
    yield* manager.writeMemory(args.purpose, args.text);

    return {
      success: true,
      message: `Successfully wrote memory for purpose: ${args.purpose}`,
    };
  });
}
