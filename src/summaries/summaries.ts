import { generateText } from 'ai';
import type { PersonaConfig, LlmConfig } from '../shared/types';

export interface ConversationSummary {
  id: number;
  summary: string;
  created_at: number;
  message_count: number;
}

export class ConversationSummaryManager {
  private sql: SqlStorage;
  private recentSummaries: ConversationSummary[] = [];

  constructor(sql: SqlStorage) {
    this.sql = sql;
  }

  /**
   * Initialize the SQLite database table for conversation summaries
   */
  initializeDatabase() {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS conversation_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        summary TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        message_count INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_created_at ON conversation_summaries(created_at DESC);
    `);
  }

  /**
   * Load the most recent conversation summaries from storage
   */
  async loadRecentSummaries(limit: number = 3): Promise<ConversationSummary[]> {
    try {
      const cursor = this.sql.exec(`
        SELECT id, summary, created_at, message_count
        FROM conversation_summaries
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);

      this.recentSummaries = [];
      const rows = [...cursor];
      console.log(`  Raw cursor rows: ${rows.length} rows`);

      for (const row of rows) {
        console.log(`  Raw row:`, row, typeof row, Array.isArray(row));
        const summaryObj = {
          id: Array.isArray(row) ? (row[0] as number) : (row as any).id,
          summary: Array.isArray(row)
            ? (row[1] as string)
            : (row as any).summary,
          created_at: Array.isArray(row)
            ? (row[2] as number)
            : (row as any).created_at,
          message_count: Array.isArray(row)
            ? (row[3] as number)
            : (row as any).message_count,
        };
        console.log(
          `  Loaded summary ${summaryObj.id}: "${
            summaryObj.summary?.substring(0, 50) || 'EMPTY'
          }..."`
        );
        this.recentSummaries.push(summaryObj);
      }

      console.log(
        `Loaded ${this.recentSummaries.length} recent conversation summaries`
      );
      return this.recentSummaries;
    } catch (error) {
      console.error('Error loading recent summaries:', error);
      return [];
    }
  }

  /**
   * Get the currently loaded summaries
   */
  getRecentSummaries(): ConversationSummary[] {
    return this.recentSummaries;
  }

  /**
   * Generate and store a conversation summary
   */
  async summarizeAndStore(
    messages: any[],
    persona: PersonaConfig,
    getModel: (llmConfig: LlmConfig) => any
  ): Promise<void> {
    if (!persona.llm_config || messages.length === 0) {
      console.log('Cannot summarize: missing llm_config or no messages');
      return;
    }

    try {
      const llmConfig = persona.llm_config;
      const llmModel = getModel(llmConfig);

      // Build conversation text
      const conversationText = messages
        .map((msg: any) => `${msg.role}: ${msg.content}`)
        .join('\n\n');

      console.log(`Summarizing conversation with ${messages.length} messages`);

      // Generate summary
      const result = await generateText({
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
      });

      // Store summary in SQLite
      const timestamp = Date.now();
      this.sql.exec(
        `INSERT INTO conversation_summaries (summary, created_at, message_count)
         VALUES (?, ?, ?)`,
        result.text,
        timestamp,
        messages.length
      );

      console.log(
        `Stored conversation summary: ${result.text.substring(0, 100)}...`
      );

      // Reload summaries to include the new one
      await this.loadRecentSummaries();
    } catch (error) {
      console.error('Error summarizing conversation:', error);
    }
  }

  /**
   * Build a system prompt with conversation summaries included
   */
  buildSystemPromptWithContext(
    basePrompt: string,
    personality?: string
  ): string {
    let systemPrompt = basePrompt;

    if (personality) {
      systemPrompt += `\n\nPersonality: ${personality}`;
    }

    // Add recent conversation summaries to context
    console.log(
      `buildSystemPromptWithContext: recentSummaries.length = ${this.recentSummaries.length}`
    );
    if (this.recentSummaries.length > 0) {
      console.log(
        'buildSystemPromptWithContext: Adding summaries to system prompt'
      );
      systemPrompt += `\n\n## Previous Conversation Context\nHere are summaries of recent conversations with this user:\n\n`;
      this.recentSummaries.forEach((summary, index) => {
        console.log(
          `  Processing summary ${index + 1}:`,
          JSON.stringify(summary)
        );
        if (summary && summary.summary) {
          const date = new Date(summary.created_at).toLocaleString();
          systemPrompt += `${index + 1}. [${date}] ${summary.summary}\n`;
          console.log(
            `  Added summary ${index + 1}: ${summary.summary.substring(
              0,
              100
            )}...`
          );
        } else {
          console.log(`  Skipping summary ${index + 1} - no summary text`);
        }
      });
      systemPrompt += `\nUse this context to provide continuity and remember past interactions.`;
    } else {
      console.log(
        'buildSystemPromptWithContext: No summaries to add to context'
      );
    }

    console.log(
      `buildSystemPromptWithContext: Final system prompt length: ${systemPrompt.length} chars`
    );

    return systemPrompt;
  }
}
