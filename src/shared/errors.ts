/**
 * Shared error types used across Memedge
 */
import { Data } from 'effect';

/**
 * Storage error
 */
export class StorageError extends Data.TaggedError('StorageError')<{
  operation: string;
  cause?: unknown;
}> {}

/**
 * Memory error
 */
export class MemoryError extends Data.TaggedError('MemoryError')<{
  operation: string;
  cause?: unknown;
}> {}

/**
 * Memory not found error
 */
export class MemoryNotFoundError extends Data.TaggedError(
  'MemoryNotFoundError'
)<{
  purpose: string;
}> {}
