/**
 * Query methods for agent memory
 */

export interface AgentMemoryRow {
  purpose: string;
  text: string;
  updated_at: number;
}

/**
 * Query agent memory from SQL storage
 */
export async function queryAgentMemory(
  sql: SqlStorage
): Promise<AgentMemoryRow[]> {
  const cursor = sql.exec(`
    SELECT purpose, text, updated_at
    FROM agent_memory
    ORDER BY updated_at DESC
  `);

  const results: AgentMemoryRow[] = [];
  for (const row of cursor) {
    results.push({
      purpose: Array.isArray(row) ? row[0] : (row as any).purpose,
      text: Array.isArray(row) ? row[1] : (row as any).text,
      updated_at: Array.isArray(row) ? row[2] : (row as any).updated_at,
    });
  }

  return results;
}
