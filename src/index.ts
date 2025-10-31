/**
 * Memedge - Advanced Memory Management for LLM Agents
 *
 * A Letta-inspired memory system with:
 * - Structured memory blocks (core & archival)
 * - Semantic search with Cloudflare AI embeddings
 * - Recursive summarization for conversation history
 * - Privacy-aware memory markers
 * - Built for Cloudflare Workers with Durable Objects
 */

// Memory services
export * from './memory';

// Summarization services
export * from './summaries';

// Memory tools for LLM function calling
export * from './tools';

// Shared types and errors
export * from './shared';

// Version
export const VERSION = '1.0.0';
