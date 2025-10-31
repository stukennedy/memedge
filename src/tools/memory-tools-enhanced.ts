/**
 * Enhanced Memory Tools (Letta-inspired)
 * Provides sophisticated memory management for LLM agents
 */
import { z } from 'zod';

export const getEnhancedMemoryTools = () => ({
  memory_get_block: {
    description:
      "Get the full content of a specific memory block. Use this to read what's currently stored in a memory block like 'human', 'persona', or 'context'.",
    inputSchema: z.object({
      block_id: z
        .string()
        .describe(
          "The ID of the memory block to retrieve (e.g., 'human', 'persona', 'context')"
        ),
    }),
  },

  memory_insert: {
    description:
      'Insert new content into a memory block. The content will be added at the specified position (start or end). Use this to add new information to your memory without overwriting existing content.',
    inputSchema: z.object({
      block_id: z
        .string()
        .describe(
          "The ID of the memory block (e.g., 'human', 'persona', 'context')"
        ),
      content: z
        .string()
        .describe('The content to insert into the memory block'),
      position: z
        .enum(['start', 'end'])
        .optional()
        .describe("Where to insert the content (default: 'end')"),
    }),
  },

  memory_replace: {
    description:
      'Replace specific content within a memory block. Use this to update or correct existing information. You must provide the exact text to find and replace.',
    inputSchema: z.object({
      block_id: z.string().describe('The ID of the memory block'),
      old_content: z
        .string()
        .describe('The exact text to find and replace in the memory block'),
      new_content: z.string().describe('The new text to replace it with'),
    }),
  },

  memory_rethink: {
    description:
      'Completely rewrite a memory block. Use this when you need to reorganize, condense, or completely change the structure of a memory block. This is useful when a block has grown too large or needs better organization.',
    inputSchema: z.object({
      block_id: z.string().describe('The ID of the memory block to rewrite'),
      new_content: z
        .string()
        .describe('The complete new content for the memory block'),
      reason: z
        .string()
        .optional()
        .describe("Optional: Why you're rewriting this block (for logging)"),
    }),
  },

  memory_create_block: {
    description:
      "Create a new custom memory block with a specific label. Use this to organize information into new categories beyond the standard 'human', 'persona', and 'context' blocks.",
    inputSchema: z.object({
      block_id: z
        .string()
        .describe(
          "A unique ID for the new block (e.g., 'projects', 'preferences')"
        ),
      label: z.string().describe('A human-readable label for the block'),
      content: z.string().describe('The initial content for the block'),
      type: z
        .enum(['core', 'archival'])
        .optional()
        .describe(
          "Block type: 'core' (always loaded) or 'archival' (searchable). Default: 'core'"
        ),
    }),
  },

  memory_list_blocks: {
    description:
      'List all memory blocks with their IDs and labels. Use this to see what memory blocks exist and what they contain.',
    inputSchema: z.object({
      type: z
        .enum(['core', 'archival'])
        .optional()
        .describe(
          'Filter by block type. If not specified, returns all blocks.'
        ),
    }),
  },

  archival_insert: {
    description:
      "Store information in long-term archival memory. Use this for facts, details, or context that you don't need immediately but might want to retrieve later. Archival memory is searchable but not always loaded into context.",
    inputSchema: z.object({
      content: z.string().describe('The content to store in archival memory'),
      metadata: z
        .record(z.string(), z.any())
        .optional()
        .describe(
          'Optional metadata to attach (e.g., tags, dates, categories)'
        ),
    }),
  },

  archival_search: {
    description:
      'Search your long-term archival memory for relevant information. Use this to recall facts or details you stored previously. The search will find semantically relevant content.',
    inputSchema: z.object({
      query: z.string().describe('What to search for in archival memory'),
      limit: z
        .number()
        .optional()
        .describe('Maximum number of results to return (default: 10)'),
    }),
  },

  memory_search: {
    description:
      "Search across all memory blocks (both core and archival) for relevant information. Use this when you need to recall something but aren't sure which memory block it's in.",
    inputSchema: z.object({
      query: z.string().describe('What to search for across all memory'),
      blocks: z
        .array(z.string())
        .optional()
        .describe('Optional: Limit search to specific block IDs'),
      limit: z
        .number()
        .optional()
        .describe('Maximum number of results to return (default: 5)'),
    }),
  },
});

/**
 * Backward compatibility: Map old tools to new tools
 * This allows existing agents to work with new system
 */
export const getLegacyMemoryTools = () => ({
  memory_read: {
    description:
      'Read a memory entry by its purpose. Returns the stored text for that purpose, or null if not found. Note: Consider migrating to memory_get_block for the new memory block system.',
    inputSchema: z.object({
      purpose: z
        .string()
        .describe(
          "The purpose/key of the memory to read (e.g., 'issues', 'customer_notes')"
        ),
    }),
  },
  memory_write: {
    description:
      "Write or update a memory entry. Creates a new entry if the purpose doesn't exist, or updates it if it does. Note: Consider migrating to memory_insert or memory_replace for better control.",
    inputSchema: z.object({
      purpose: z.string().describe('The purpose/key of the memory'),
      text: z.string().describe('The text content to store'),
    }),
  },
});

/**
 * Get all memory tools (enhanced + legacy for backward compatibility)
 */
export const getAllMemoryTools = () => ({
  ...getEnhancedMemoryTools(),
  ...getLegacyMemoryTools(),
});
