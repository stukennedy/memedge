# Memory Tools Comparison

[← Back to Semantic Search](04-semantic-search.md) | [Next: Recursive Summarization →](06-recursive-summarization.md)

---

## Memedge Memory Tools

### Basic Tools (Key-Value Store)

**`memory_read(purpose: string)`**
- Reads a memory by purpose key
- Returns: `{ purpose, text, updated_at }` or `null`
- Use case: Simple retrieval

**`memory_write(purpose: string, text: string)`**
- Stores or updates memory
- **Critical**: Requires read-before-write for updates to prevent data loss
- Supports privacy markers (`[PRIVATE]`, `[CONFIDENTIAL]`)
- Returns: Operation confirmation (create/update)

### Enhanced Tools (Block System)

**`memory_get_block(block_id: string)`**
- Retrieves full block by ID
- Returns: `MemoryBlock` object
- Use case: Structured memory access

**`memory_insert(block_id: string, content: string, position?: 'start' | 'end')`**
- Adds content to existing block without overwriting
- Position control (append or prepend)
- Returns: Success confirmation

**`memory_replace(block_id: string, old_content: string, new_content: string)`**
- Precise content replacement within block
- Requires exact match of old content
- Returns: Success confirmation

**`memory_rethink(block_id: string, new_content: string, reason?: string)`**
- Complete block rewrite for reorganization
- Optional reason logging
- Use case: Block condensing, restructuring

**`memory_create_block(block_id: string, label: string, content: string, type?: 'core' | 'archival')`**
- Creates custom memory blocks
- Flexible categorization
- Returns: New block object

**`memory_list_blocks(type?: 'core' | 'archival')`**
- Lists all blocks with metadata
- Optional type filtering
- Returns: Array of blocks with IDs and labels

**`memory_search(query: string, blocks?: string[], limit?: number)`**
- Semantic search across all memory
- Optional block filtering
- Returns: Ranked results with scores

**`archival_insert(content: string, metadata?: Record<string, any>)`**
- Stores in long-term archival
- Optional metadata tagging
- Returns: Archival entry ID

**`archival_search(query: string, limit?: number)`**
- Semantic search in archival
- Configurable result count
- Returns: Ranked archival entries

---

## Letta's Memory Tools

### Core Memory Tools

**`core_memory_append(name: string, content: string)`**
- Appends to core memory block
- Blocks: 'human', 'persona', 'system'
- Returns: Success message

**`core_memory_replace(name: string, old_content: string, new_content: string)`**
- Replaces content in core block
- Requires exact string match
- Returns: Success message

**`send_message(message: string)`**
- Sends message to user
- Also used for inner monologue
- Returns: Message ID

### Archival Tools

**`archival_memory_insert(content: string)`**
- Inserts into archival memory
- Automatically embedded
- Returns: Insert confirmation

**`archival_memory_search(query: string, page: int)`**
- Searches archival memory
- Paginated results
- Returns: List of matches with scores

### Recall Tools

**`conversation_search(query: string, page: int)`**
- Searches past conversation history
- Separate from archival
- Returns: Historical messages

**`conversation_search_date(start_date: str, end_date: str)`**
- Time-based conversation search
- Date range filtering
- Returns: Messages in range

---

## Tool Comparison Table

| Tool Category | Memedge | Letta | Winner |
|--------------|---------|-------|---------|
| **Core CRUD** | read, write, get_block | append, replace | 🤝 Tie |
| **Block Operations** | insert, replace, rethink | append, replace | 👉 Memedge (more options) |
| **Block Management** | create_block, list_blocks | Fixed blocks | 👉 Memedge (flexible) |
| **Search** | memory_search (unified) | Multiple search tools | 👉 Memedge (simpler) |
| **Archival** | archival_insert, archival_search | archival_memory_insert, archival_memory_search | 🤝 Tie |
| **Privacy** | Built-in markers | Not included | 👉 Memedge |
| **Conversation History** | Integrated in summaries | Separate conversation_search | 👉 Letta (more explicit) |
| **Tool Count** | 11 tools | ~7 core tools | 👉 Memedge (more comprehensive) |

**Winner: Memedge** - More tool variety, flexible blocks, built-in privacy, unified search.

---

[← Back to Semantic Search](04-semantic-search.md) | [Next: Recursive Summarization →](06-recursive-summarization.md)

