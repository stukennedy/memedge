/**
 * Recursive Summarization System (Letta-inspired)
 * Implements hierarchical conversation summarization
 */
import { Effect } from 'effect';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { PersonaConfig, LlmConfig, Message } from '../shared/types';
import { StorageError } from '../shared/errors';
import { SqlStorageContext } from '../memory/memory';

export interface ConversationSummary {
  id: number;
  summary: string;
  summary_level: number; // 0=base, 1=first recursive, 2=second recursive, etc.
  message_count: number;
  parent_summary_id: number | null;
  created_at: number;
}

/**
 * Configuration for summarization
 */
export interface SummarizationConfig {
  baseSummaryThreshold: number; // Messages before creating base summary (default: 20)
  recursiveThreshold: number; // Number of summaries to trigger recursion (default: 10)
  maxLevel: number; // Maximum recursion level (default: 3)
  recentSummaryCount: number; // Number of recent summaries to load (default: 3)
}

const DEFAULT_CONFIG: SummarizationConfig = {
  baseSummaryThreshold: 20,
  recursiveThreshold: 10,
  maxLevel: 3,
  recentSummaryCount: 3,
};

/**
 * Helper to create LLM model
 */
function createLLMModel(config: LlmConfig): any {
  const { format, model_name: modelName, secret: apiKey } = config;

  switch (format) {
    case 'openai': {
      const provider = createOpenAI({ apiKey: apiKey || '' });
      return provider(modelName || 'gpt-4o-mini');
    }
    case 'gemini': {
      const provider = createGoogleGenerativeAI({ apiKey: apiKey || '' });
      return provider(modelName || 'gemini-2.0-flash-exp');
    }
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Initialize recursive summarization database
 */
export function initializeDatabase(): Effect.Effect<
  void,
  StorageError,
  SqlStorageContext
> {
  return Effect.gen(function* () {
    const { sql } = yield* SqlStorageContext;

    sql.exec(`
      CREATE TABLE IF NOT EXISTS conversation_summaries_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        summary TEXT NOT NULL,
        summary_level INTEGER NOT NULL,
        message_count INTEGER NOT NULL,
        parent_summary_id INTEGER,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (parent_summary_id) REFERENCES conversation_summaries_v2(id)
      );
      CREATE INDEX IF NOT EXISTS idx_level_created ON conversation_summaries_v2(summary_level, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_parent ON conversation_summaries_v2(parent_summary_id);
    `);

    console.log('Recursive summarization database initialized');
  });
}

/**
 * Create a base-level summary (level 0) from messages
 */
export function createBaseSummary(
  messages: Message[],
  persona: PersonaConfig
): Effect.Effect<number, StorageError, SqlStorageContext> {
  return Effect.gen(function* () {
    if (!persona.llm_config) {
      throw new Error('LLM config required for summarization');
    }

    const { sql } = yield* SqlStorageContext;
    const llmModel = createLLMModel(persona.llm_config);

    // Build conversation text
    const conversationText = messages
      .map(
        (msg) =>
          `${msg.role}: ${
            typeof msg.content === 'string' ? msg.content : '[tool result]'
          }`
      )
      .join('\n\n');

    console.log(`Creating base summary from ${messages.length} messages`);

    // Generate summary
    const result = yield* Effect.tryPromise({
      try: () =>
        generateText({
          model: llmModel,
          system:
            'You are a helpful assistant that creates concise summaries of conversations. Create a 2-3 sentence summary that captures the key topics discussed and any important outcomes or decisions.',
          messages: [
            {
              role: 'user',
              content: `Please summarize this conversation:\n\n${conversationText}`,
            },
          ],
          temperature: 0.3,
        }),
      catch: (error) =>
        new StorageError({
          operation: 'create base summary',
          cause: error,
        }),
    });

    // Store summary
    const timestamp = Date.now();
    sql.exec(
      `INSERT INTO conversation_summaries_v2 
       (summary, summary_level, message_count, parent_summary_id, created_at)
       VALUES (?, 0, ?, NULL, ?)`,
      result.text,
      messages.length,
      timestamp
    );

    // Get the ID of the inserted summary
    const cursor = sql.exec(`SELECT last_insert_rowid() as id`);
    const rows = [...cursor];
    const id = Array.isArray(rows[0])
      ? (rows[0][0] as number)
      : (rows[0] as any).id;

    console.log(
      `Created base summary ${id}: ${result.text.substring(0, 100)}...`
    );

    return id;
  });
}

/**
 * Create a recursive summary from multiple lower-level summaries
 */
export function createRecursiveSummary(
  summaries: ConversationSummary[],
  targetLevel: number,
  persona: PersonaConfig
): Effect.Effect<number, StorageError, SqlStorageContext> {
  return Effect.gen(function* () {
    if (!persona.llm_config) {
      throw new Error('LLM config required for summarization');
    }

    const { sql } = yield* SqlStorageContext;
    const llmModel = createLLMModel(persona.llm_config);

    // Build summary text
    const summaryText = summaries
      .map((s, i) => `Summary ${i + 1}: ${s.summary}`)
      .join('\n\n');

    console.log(
      `Creating level ${targetLevel} summary from ${summaries.length} level ${
        targetLevel - 1
      } summaries`
    );

    // Generate meta-summary
    const result = yield* Effect.tryPromise({
      try: () =>
        generateText({
          model: llmModel,
          system:
            'You are creating a higher-level summary that consolidates multiple conversation summaries. Create a concise 3-4 sentence summary that captures the key themes and outcomes across all the conversations.',
          messages: [
            {
              role: 'user',
              content: `Please create a consolidated summary of these conversation summaries:\n\n${summaryText}`,
            },
          ],
          temperature: 0.3,
        }),
      catch: (error) =>
        new StorageError({
          operation: 'create recursive summary',
          cause: error,
        }),
    });

    // Calculate total message count
    const totalMessages = summaries.reduce(
      (sum, s) => sum + s.message_count,
      0
    );

    // Store recursive summary
    const timestamp = Date.now();
    sql.exec(
      `INSERT INTO conversation_summaries_v2 
       (summary, summary_level, message_count, parent_summary_id, created_at)
       VALUES (?, ?, ?, NULL, ?)`,
      result.text,
      targetLevel,
      totalMessages,
      timestamp
    );

    // Get the ID of the inserted summary
    const cursor = sql.exec(`SELECT last_insert_rowid() as id`);
    const rows = [...cursor];
    const id = Array.isArray(rows[0])
      ? (rows[0][0] as number)
      : (rows[0] as any).id;

    console.log(
      `Created level ${targetLevel} summary ${id}: ${result.text.substring(
        0,
        100
      )}...`
    );

    return id;
  });
}

/**
 * Load recent summaries at each level for context
 */
export function loadSummariesForContext(
  config: SummarizationConfig = DEFAULT_CONFIG
): Effect.Effect<
  { base: ConversationSummary[]; recursive: ConversationSummary[] },
  StorageError,
  SqlStorageContext
> {
  return Effect.gen(function* () {
    const { sql } = yield* SqlStorageContext;

    // Load recent base summaries (level 0)
    const baseCursor = sql.exec(
      `SELECT id, summary, summary_level, message_count, parent_summary_id, created_at
       FROM conversation_summaries_v2
       WHERE summary_level = 0
       ORDER BY created_at DESC
       LIMIT ?`,
      config.recentSummaryCount
    );

    const baseSummaries: ConversationSummary[] = [];
    for (const row of baseCursor) {
      baseSummaries.push({
        id: Array.isArray(row) ? (row[0] as number) : (row as any).id,
        summary: Array.isArray(row) ? (row[1] as string) : (row as any).summary,
        summary_level: Array.isArray(row)
          ? (row[2] as number)
          : (row as any).summary_level,
        message_count: Array.isArray(row)
          ? (row[3] as number)
          : (row as any).message_count,
        parent_summary_id: Array.isArray(row)
          ? (row[4] as number | null)
          : (row as any).parent_summary_id,
        created_at: Array.isArray(row)
          ? (row[5] as number)
          : (row as any).created_at,
      });
    }

    // Load most recent recursive summaries (level 1+)
    const recursiveCursor = sql.exec(
      `SELECT id, summary, summary_level, message_count, parent_summary_id, created_at
       FROM conversation_summaries_v2
       WHERE summary_level > 0
       ORDER BY summary_level DESC, created_at DESC
       LIMIT 2`
    );

    const recursiveSummaries: ConversationSummary[] = [];
    for (const row of recursiveCursor) {
      recursiveSummaries.push({
        id: Array.isArray(row) ? (row[0] as number) : (row as any).id,
        summary: Array.isArray(row) ? (row[1] as string) : (row as any).summary,
        summary_level: Array.isArray(row)
          ? (row[2] as number)
          : (row as any).summary_level,
        message_count: Array.isArray(row)
          ? (row[3] as number)
          : (row as any).message_count,
        parent_summary_id: Array.isArray(row)
          ? (row[4] as number | null)
          : (row as any).parent_summary_id,
        created_at: Array.isArray(row)
          ? (row[5] as number)
          : (row as any).created_at,
      });
    }

    console.log(
      `Loaded ${baseSummaries.length} base summaries and ${recursiveSummaries.length} recursive summaries`
    );

    return {
      base: baseSummaries,
      recursive: recursiveSummaries,
    };
  });
}

/**
 * Build context string from summaries
 */
export function buildSummaryContext(summaries: {
  base: ConversationSummary[];
  recursive: ConversationSummary[];
}): string {
  if (summaries.base.length === 0 && summaries.recursive.length === 0) {
    return '';
  }

  let context = '\n\n## Conversation History\n\n';

  // Add recursive (high-level) summaries first
  if (summaries.recursive.length > 0) {
    context += '### Long-term Context\n';
    summaries.recursive.forEach((summary) => {
      const date = new Date(summary.created_at).toLocaleString();
      context += `- [Level ${summary.summary_level}, ${summary.message_count} messages, ${date}] ${summary.summary}\n`;
    });
    context += '\n';
  }

  // Add recent base summaries
  if (summaries.base.length > 0) {
    context += '### Recent Conversations\n';
    summaries.base.forEach((summary) => {
      const date = new Date(summary.created_at).toLocaleString();
      context += `- [${summary.message_count} messages, ${date}] ${summary.summary}\n`;
    });
  }

  return context;
}

/**
 * Check if we need to create recursive summaries
 * Returns the level and summaries to consolidate
 */
export function checkRecursiveSummarizationNeeded(
  config: SummarizationConfig = DEFAULT_CONFIG
): Effect.Effect<
  { needed: boolean; level?: number; summaries?: ConversationSummary[] },
  StorageError,
  SqlStorageContext
> {
  return Effect.gen(function* () {
    const { sql } = yield* SqlStorageContext;

    // Check each level starting from 0
    for (let level = 0; level < config.maxLevel; level++) {
      const cursor = sql.exec(
        `SELECT id, summary, summary_level, message_count, parent_summary_id, created_at
         FROM conversation_summaries_v2
         WHERE summary_level = ?
         AND parent_summary_id IS NULL
         ORDER BY created_at ASC
         LIMIT ?`,
        level,
        config.recursiveThreshold + 1
      );

      const summaries: ConversationSummary[] = [];
      for (const row of cursor) {
        summaries.push({
          id: Array.isArray(row) ? (row[0] as number) : (row as any).id,
          summary: Array.isArray(row)
            ? (row[1] as string)
            : (row as any).summary,
          summary_level: Array.isArray(row)
            ? (row[2] as number)
            : (row as any).summary_level,
          message_count: Array.isArray(row)
            ? (row[3] as number)
            : (row as any).message_count,
          parent_summary_id: Array.isArray(row)
            ? (row[4] as number | null)
            : (row as any).parent_summary_id,
          created_at: Array.isArray(row)
            ? (row[5] as number)
            : (row as any).created_at,
        });
      }

      // If we have enough summaries at this level, trigger recursion
      if (summaries.length >= config.recursiveThreshold) {
        console.log(
          `Found ${
            summaries.length
          } level ${level} summaries, triggering level ${
            level + 1
          } summarization`
        );
        return {
          needed: true,
          level: level + 1,
          summaries: summaries.slice(0, config.recursiveThreshold),
        };
      }
    }

    return { needed: false };
  });
}

/**
 * Mark summaries as consolidated by setting their parent_summary_id
 */
export function markSummariesConsolidated(
  summaryIds: number[],
  parentId: number
): Effect.Effect<void, StorageError, SqlStorageContext> {
  return Effect.gen(function* () {
    const { sql } = yield* SqlStorageContext;

    for (const id of summaryIds) {
      sql.exec(
        `UPDATE conversation_summaries_v2
         SET parent_summary_id = ?
         WHERE id = ?`,
        parentId,
        id
      );
    }

    console.log(
      `Marked ${summaryIds.length} summaries as consolidated into ${parentId}`
    );
  });
}
