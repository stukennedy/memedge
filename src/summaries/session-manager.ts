/**
 * Session summarization utilities
 */

/**
 * Check if conversation should be summarized
 */
export function shouldSummarize(
  sessionCount: number,
  messageCount: number,
  hasPersona: boolean
): boolean {
  return sessionCount === 0 && messageCount > 0 && hasPersona;
}

/**
 * NOTE: The summarizeSession function is agent-specific and depends on
 * StateManager which is not part of memedge. Implement this in your agent.
 */
