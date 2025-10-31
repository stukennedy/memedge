/**
 * Memory tools for LLM function calling
 */
import { z } from 'zod';

export const getMemoryTools = () => ({
  memory_read: {
    description:
      'Read a memory entry by its purpose key. Use this when you need to recall stored information about the user, their preferences, or ongoing context. Returns the stored text for that purpose, or null if not found.',
    inputSchema: z.object({
      purpose: z
        .string()
        .describe(
          "The purpose/key of the memory to read (e.g., 'user_profile', 'communication_preferences', 'current_context', 'project_details')"
        ),
    }),
  },
  memory_write: {
    description:
      'Store or update information in persistent memory. CRITICAL: When UPDATING existing memories, ALWAYS use memory_read FIRST to get current content, then merge new info with existing content before writing - otherwise you will erase existing data! For NEW memories, you can write directly. PRIVACY: If user marks information as private/confidential/sensitive, include markers like [PRIVATE], [CONFIDENTIAL], or [DO NOT SHARE] in the text so you can filter appropriately when sharing information later.',
    inputSchema: z.object({
      purpose: z
        .string()
        .describe(
          "A short, descriptive key for this memory. Use separate blocks for different categories: 'user_profile' (name, age, pets), 'employment' (company, role), 'preferences' (communication style), 'technical_profile' (skills, expertise), 'health_info' (medical), 'current_context' (active work), 'project_[name]' (specific projects). Don't dump everything in user_profile - organize by category!"
        ),
      text: z
        .string()
        .describe(
          'The information to store. Be concise but complete. Include relevant details like names, roles, preferences, facts, or context. IMPORTANT: If user specifies privacy context (e.g., "this is private", "don\'t share this"), prepend appropriate markers like [PRIVATE], [CONFIDENTIAL], [DO NOT SHARE], or [PERSONAL] to the text.'
        ),
    }),
  },
});
