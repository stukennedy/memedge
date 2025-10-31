/**
 * Effect-based Memory Manager
 * Uses Effect for async operations and error handling
 */
import { Effect, Context, Layer } from 'effect';
import { MemoryError, MemoryNotFoundError } from '../shared/errors';

export interface MemoryEntry {
  purpose: string;
  text: string;
  updated_at: number;
}

/**
 * Memory Manager Service interface
 */
export interface MemoryManagerService {
  initializeDatabase: () => Effect.Effect<void, MemoryError>;
  loadMemories: () => Effect.Effect<Map<string, MemoryEntry>, MemoryError>;
  writeMemory: (
    purpose: string,
    text: string
  ) => Effect.Effect<void, MemoryError>;
  readMemory: (
    purpose: string
  ) => Effect.Effect<MemoryEntry | null, MemoryError>;
  deleteMemory: (purpose: string) => Effect.Effect<void, MemoryError>;
  getAllMemories: () => Effect.Effect<MemoryEntry[], never>;
  buildMemoryContext: () => Effect.Effect<string, never>;
}

export const MemoryManagerService = Context.GenericTag<MemoryManagerService>(
  '@services/MemoryManager'
);

/**
 * SQL Storage context
 */
export interface SqlStorageContext {
  readonly sql: SqlStorage;
}

export const SqlStorageContext = Context.GenericTag<SqlStorageContext>(
  '@context/SqlStorage'
);

/**
 * Memory Manager implementation
 */
export const MemoryManagerLive = Layer.effect(
  MemoryManagerService,
  Effect.gen(function* () {
    const { sql } = yield* SqlStorageContext;
    let memoriesCache = new Map<string, MemoryEntry>();

    const initializeDatabase = (): Effect.Effect<void, MemoryError> =>
      Effect.try({
        try: () => {
          sql.exec(`
            CREATE TABLE IF NOT EXISTS agent_memory (
              purpose TEXT PRIMARY KEY,
              text TEXT NOT NULL,
              updated_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_updated_at ON agent_memory(updated_at DESC);
          `);
        },
        catch: (cause) =>
          new MemoryError({ operation: 'initializeDatabase', cause }),
      });

    const loadMemories = (): Effect.Effect<
      Map<string, MemoryEntry>,
      MemoryError
    > =>
      Effect.try({
        try: () => {
          const cursor = sql.exec(`
            SELECT purpose, text, updated_at
            FROM agent_memory
            ORDER BY updated_at DESC
          `);

          memoriesCache.clear();
          const rows = [...cursor];

          for (const row of rows) {
            const entry: MemoryEntry = {
              purpose: Array.isArray(row)
                ? (row[0] as string)
                : (row as any).purpose,
              text: Array.isArray(row) ? (row[1] as string) : (row as any).text,
              updated_at: Array.isArray(row)
                ? (row[2] as number)
                : (row as any).updated_at,
            };
            memoriesCache.set(entry.purpose, entry);
          }

          console.log(`Loaded ${memoriesCache.size} memory entries`);
          return memoriesCache;
        },
        catch: (cause) => new MemoryError({ operation: 'loadMemories', cause }),
      });

    const writeMemory = (
      purpose: string,
      text: string
    ): Effect.Effect<void, MemoryError> =>
      Effect.try({
        try: () => {
          const timestamp = Date.now();

          sql.exec(
            `INSERT OR REPLACE INTO agent_memory (purpose, text, updated_at)
             VALUES (?, ?, ?)`,
            purpose,
            text,
            timestamp
          );

          memoriesCache.set(purpose, {
            purpose,
            text,
            updated_at: timestamp,
          });

          console.log(`Wrote memory for purpose: ${purpose}`);
        },
        catch: (cause) => new MemoryError({ operation: 'writeMemory', cause }),
      });

    const readMemory = (
      purpose: string
    ): Effect.Effect<MemoryEntry | null, MemoryError> =>
      Effect.try({
        try: () => {
          // Check cache first
          const cached = memoriesCache.get(purpose);
          if (cached) {
            return cached;
          }

          // Query database
          const cursor = sql.exec(
            `SELECT purpose, text, updated_at
             FROM agent_memory
             WHERE purpose = ?`,
            purpose
          );

          const rows = [...cursor];
          if (rows.length === 0) {
            return null;
          }

          const row = rows[0];
          const entry: MemoryEntry = {
            purpose: Array.isArray(row)
              ? (row[0] as string)
              : (row as any).purpose,
            text: Array.isArray(row) ? (row[1] as string) : (row as any).text,
            updated_at: Array.isArray(row)
              ? (row[2] as number)
              : (row as any).updated_at,
          };

          memoriesCache.set(purpose, entry);
          return entry;
        },
        catch: (cause) => new MemoryError({ operation: 'readMemory', cause }),
      });

    const deleteMemory = (purpose: string): Effect.Effect<void, MemoryError> =>
      Effect.try({
        try: () => {
          sql.exec(`DELETE FROM agent_memory WHERE purpose = ?`, purpose);
          memoriesCache.delete(purpose);
          console.log(`Deleted memory for purpose: ${purpose}`);
        },
        catch: (cause) => new MemoryError({ operation: 'deleteMemory', cause }),
      });

    const getAllMemories = (): Effect.Effect<MemoryEntry[], never> =>
      Effect.succeed(Array.from(memoriesCache.values()));

    const buildMemoryContext = (): Effect.Effect<string, never> =>
      Effect.gen(function* () {
        let context =
          '\n\n## Agent Memory\nYou have access to persistent memory storage that survives across conversations.\n\n';

        if (memoriesCache.size > 0) {
          // First, show directory of available blocks
          context += '### Available Memory Blocks\n';
          context +=
            'You currently have these memory blocks stored (use these exact purpose keys when calling memory_read):\n\n';

          const memories = Array.from(memoriesCache.values());
          memories.forEach((entry) => {
            const preview =
              entry.text.length > 60
                ? entry.text.substring(0, 60) + '...'
                : entry.text;
            const hasPrivate =
              /\[PRIVATE\]|\[CONFIDENTIAL\]|\[DO NOT SHARE\]|\[PERSONAL\]/i.test(
                entry.text
              );
            const privacyIndicator = hasPrivate ? '🔒' : '';
            context += `- \`${entry.purpose}\` ${privacyIndicator} - ${preview}\n`;
          });

          context += '\n### Current Memories (Full Content)\n\n';
          memories.forEach((entry, index) => {
            const date = new Date(entry.updated_at).toLocaleString();
            context += `${index + 1}. **${
              entry.purpose
            }** (last updated: ${date}):\n   ${entry.text}\n\n`;
          });
        } else {
          context += '### Current Memories\nNo memories stored yet.\n\n';
        }

        context += `### Memory Management Policy

**WHEN TO WRITE TO MEMORY (autonomous triggers):**
• User reveals personal information (name, role, company, preferences)
• User shares goals, current projects, or ongoing work
• User corrects previous information or clarifies facts
• User expresses preferences about how they want to interact
• You learn facts that will be useful in future conversations
• User asks you to remember something specific

**WHAT TO STORE:**
• User identity and background (name, role, company, location)
• Preferences (communication style, technical preferences, tools they use)
• Current context (active projects, current issues, ongoing tasks)
• Important facts that provide continuity (past decisions, constraints, requirements)
• Corrections to previous information
• Information with contextual metadata (private, confidential, sensitive, public, etc.)

**WHAT NOT TO STORE:**
• Transient chit-chat or greetings
• Obvious world knowledge or public facts
• Temporary session details that won't matter later
• Information already captured elsewhere

**HOW TO USE MEMORY TOOLS:**
• \`memory_write(purpose, text)\` - Store or update information. The 'purpose' is a short key (e.g., "user_profile", "project_context", "preferences"). The 'text' is the content to remember.
• \`memory_read(purpose)\` - Retrieve stored information by its purpose key.

**CRITICAL: Check the "Available Memory Blocks" directory above!**
- Don't guess what blocks exist - check the list above
- Use the EXACT purpose keys shown
- If asked about information, check if a relevant block exists before claiming you don't have it
- The directory shows you exactly what you have stored

**CRITICAL: Understand the difference between reading and writing!**
- \`memory_read\` only RETRIEVES data - it does NOT update or correct anything
- \`memory_write\` is required to CREATE or UPDATE data
- Tool responses explicitly tell you what operation was performed
- If user asks you to correct/update information, you MUST call \`memory_write\` after reading

**MEMORY BLOCK ORGANIZATION STRATEGY:**

**Core principle:** Use separate purpose keys for different categories of information.

**Recommended block structure:**

1. **user_profile** - Core identity only
2. **employment** - Professional/work information
3. **preferences** - Behavioral preferences
4. **technical_profile** - Technical expertise
5. **current_context** - Active work/projects
6. **health_info** - Health and medical (with privacy markers)
7. **project_[name]** - Specific projects

**STORING CONTEXTUAL METADATA:**
When users provide context about information (privacy level, sensitivity, conditions), preserve it in the memory:
• "This is private" → Include [PRIVATE] marker in the stored text
• "This is confidential" → Include [CONFIDENTIAL] marker
• "Don't share this" → Include [DO NOT SHARE] marker

**UPDATING EXISTING MEMORIES (CRITICAL):**
⚠️ **ALWAYS READ BEFORE WRITING when updating existing information!**

**Step-by-step process for updates:**
1. Use \`memory_read(purpose)\` to get current content
2. Merge new information with existing content (don't erase existing data)
3. Use \`memory_write(purpose, merged_content)\` to save the updated version`;

        return context;
      });

    return {
      initializeDatabase,
      loadMemories,
      writeMemory,
      readMemory,
      deleteMemory,
      getAllMemories,
      buildMemoryContext,
    } satisfies MemoryManagerService;
  })
);

/**
 * Convenience functions for using Memory Manager
 */
export const writeMemory = (purpose: string, text: string) =>
  Effect.gen(function* () {
    const memoryManager = yield* MemoryManagerService;
    return yield* memoryManager.writeMemory(purpose, text);
  });

export const readMemory = (purpose: string) =>
  Effect.gen(function* () {
    const memoryManager = yield* MemoryManagerService;
    return yield* memoryManager.readMemory(purpose);
  });

export const buildMemoryContext = () =>
  Effect.gen(function* () {
    const memoryManager = yield* MemoryManagerService;
    return yield* memoryManager.buildMemoryContext();
  });
