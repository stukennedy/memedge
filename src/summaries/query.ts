/**
 * Query methods for conversation summaries
 */

export interface ConversationSummaryRow {
  id: string;
  summary: string;
  created_at: number;
  message_count: number;
}

/**
 * Query conversation summaries from SQL storage
 */
export async function queryConversationSummaries(
  sql: SqlStorage
): Promise<ConversationSummaryRow[]> {
  // Ensure table exists before querying
  sql.exec(`
    CREATE TABLE IF NOT EXISTS conversation_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      summary TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      message_count INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_created_at ON conversation_summaries(created_at DESC);
  `);

  const cursor = sql.exec(`
    SELECT id, summary, created_at, message_count
    FROM conversation_summaries
    ORDER BY created_at DESC
  `);

  const results: ConversationSummaryRow[] = [];
  for (const row of cursor) {
    results.push({
      id: Array.isArray(row) ? row[0] : (row as any).id,
      summary: Array.isArray(row) ? row[1] : (row as any).summary,
      created_at: Array.isArray(row) ? row[2] : (row as any).created_at,
      message_count: Array.isArray(row) ? row[3] : (row as any).message_count,
    });
  }

  return results;
}
