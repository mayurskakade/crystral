# RAG (Retrieval-Augmented Generation)

RAG in Crystal AI gives agents access to a knowledge base by retrieving relevant document chunks at query time and injecting them into the LLM prompt. Crystal AI supports two approaches:

1. **Built-in local RAG** -- Documents are chunked, embedded, and stored in a local SQLite database using `sqlite-vec` for vector similarity search.
2. **External vector stores** -- Connect to managed vector databases (Pinecone, Chroma, Qdrant, Weaviate, pgvector) via the `VectorStoreConfig`.

This guide covers both approaches.

---

## How RAG Works

```
User query: "How do I reset my password?"
        |
        v
1. Embed the query using the configured embedding provider
        |
        v
2. Search the vector store for similar chunks (cosine similarity)
        |
        v
3. Filter results by match_threshold (default: 0.7)
        |
        v
4. Inject top match_count results into the agent's system prompt:
   "Relevant Knowledge Base Information:
    [Source 1: account-guide.md]
    To reset your password, navigate to Settings > Security..."
        |
        v
5. Agent generates a response grounded in the retrieved context
```

The RAG context is injected between the system prompt and the conversation history. The agent sees it as additional context, not as user messages.

---

## Local RAG: Collection Configuration

### Directory Structure

Local RAG collections are directories inside `rag/` at the project root:

```
my-project/
  rag/
    product-docs/
      getting-started.md
      api-reference.md
      faq.txt
      .crystalai-rag.yaml    # optional config overrides
    support-runbooks/
      escalation.md
      troubleshooting.pdf
```

The collection name is the directory name. All documents inside are discovered and indexed automatically.

### Collection Config: `rag/<name>/.crystalai-rag.yaml`

This file is optional. If absent, all defaults apply.

```yaml
version: 1
name: product-docs

embedding_provider: openai
embedding_model: text-embedding-3-small

chunk_size: 512
chunk_overlap: 64

include:
  - "**/*.md"
  - "**/*.txt"
  - "**/*.pdf"

exclude:
  - "**/drafts/**"
  - "**/*-old.md"
```

### Field Reference

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `version` | integer | Yes | -- | Must be `1`. |
| `name` | string | Yes | -- | Must match the directory name. |
| `embedding_provider` | string | No | `openai` | Provider for generating embeddings. One of: `openai`, `anthropic`, `groq`, `google`, `together`. |
| `embedding_model` | string | No | `text-embedding-3-small` | Embedding model identifier. |
| `chunk_size` | integer | No | `512` | Approximate chunk size in tokens (1 token ~ 4 characters). Range: 64--8192. |
| `chunk_overlap` | integer | No | `64` | Overlap between consecutive chunks in tokens. Must be less than `chunk_size`. Range: 0 to `chunk_size / 2`. |
| `include` | list of globs | No | `["**/*.md", "**/*.txt", "**/*.pdf"]` | File patterns to include. |
| `exclude` | list of globs | No | `[]` | File patterns to exclude. |

> **Warning:** Setting `chunk_overlap` greater than or equal to `chunk_size` produces a validation error:
> `'chunk_overlap' (200) must be less than 'chunk_size' (100) in rag/product-docs/.crystalai-rag.yaml`

---

## Supported Document Types

| Extension | Parser | Notes |
|-----------|--------|-------|
| `.md`, `.mdx` | Plain text | Markdown formatting is preserved in chunks. |
| `.txt` | Plain text | Read as-is. |
| `.pdf` | Text extraction | Uses `pdf-parse`. No OCR support. |
| `.html`, `.htm` | Tag stripping | HTML tags removed, text content extracted. |
| `.json`, `.yaml`, `.yml`, `.csv` | Plain text | Read as text. |
| `.ts`, `.js`, `.py`, `.go`, `.rs`, `.java` | Plain text | Source code files are supported. |

Unsupported file types are skipped with a warning: `Skipping unsupported file type: diagram.excalidraw`

---

## Indexing Documents

### CLI

```bash
# Index a specific collection
crystalai rag index product-docs

# The indexer will:
# 1. Scan for matching files
# 2. Read and chunk each document
# 3. Generate embeddings via the configured provider
# 4. Store chunks and embeddings in .crystalai/agents.db
```

### Indexing Pipeline

The indexing process runs in five phases:

1. **Scanning** -- Discover files matching include/exclude patterns.
2. **Reading** -- Load file contents based on file type.
3. **Chunking** -- Split documents using a recursive character splitter with the configured `chunk_size` and `chunk_overlap`.
4. **Embedding** -- Generate vector embeddings in batches of 100 via the configured provider.
5. **Storing** -- Write chunks and embeddings to SQLite.

> **Note:** Indexing clears all existing chunks for the collection before re-indexing. This ensures the index is always consistent with the current documents.

### Programmatic Indexing

```typescript
import { Crystral } from '@crystralai/sdk';

const crystal = new Crystral();

// Trigger indexing via the Studio API
// POST /api/rag/:name/index
```

### Indexing Progress

The indexer reports progress through a callback:

```typescript
interface IndexingProgress {
  phase: 'scanning' | 'reading' | 'chunking' | 'embedding' | 'storing';
  totalFiles: number;
  processedFiles: number;
  currentFile?: string;
  totalChunks: number;
  embeddedChunks: number;
  totalTokens: number;
  error?: string;
}
```

### Indexing Result

```typescript
interface IndexingResult {
  fileCount: number;      // Number of files indexed
  chunkCount: number;     // Number of chunks created
  totalTokens: number;    // Total embedding tokens used
  durationMs: number;     // Total time in milliseconds
  errors: Array<{         // Per-file errors (non-fatal)
    file: string;
    error: string;
  }>;
}
```

---

## Vector Search with sqlite-vec

Crystal AI uses [sqlite-vec](https://github.com/asg017/sqlite-vec) for local vector similarity search. Embeddings are stored in a virtual table using the `vec0` module.

### Storage Schema

```sql
CREATE TABLE rag_chunks (
  id            TEXT PRIMARY KEY,
  collection    TEXT NOT NULL,
  document_path TEXT NOT NULL,
  content       TEXT NOT NULL,
  chunk_index   INTEGER,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE VIRTUAL TABLE rag_embeddings USING vec0(
  chunk_id   TEXT PRIMARY KEY,
  embedding  float[1536]
);
```

The embedding dimension (`float[1536]`) is determined by the embedding model at index time. Different collections can use different dimensions.

### Search Process

1. The user query is embedded using the same provider and model used during indexing.
2. `sqlite-vec` performs cosine similarity search against stored embeddings.
3. Results are filtered by `match_threshold` and limited to `match_count`.
4. Matching chunks are formatted and injected into the agent's system prompt.

### Search Result Format

```typescript
interface RAGResult {
  chunk_id: string;
  content: string;
  document_path: string;
  similarity: number;  // 0.0 to 1.0
}
```

---

## Embedding Providers and Models

Crystal AI supports embeddings from any provider that implements the `embed()` method:

| Provider | Embedding Models | Dimensions |
|----------|-----------------|------------|
| `openai` | `text-embedding-3-small`, `text-embedding-3-large`, `text-embedding-ada-002` | 1536 / 3072 / 1536 |
| `google` | `text-embedding-004`, `embedding-001` | 768 |

> **Note:** Not all providers support embeddings. `anthropic`, `groq`, and `together` support chat completions only. Use `openai` or `google` for embedding generation.

---

## Chunk Size and Overlap Configuration

Choosing the right chunk size and overlap affects retrieval quality:

| Setting | Small (128--256) | Medium (512) | Large (1024--2048) |
|---------|-----------------|--------------|-------------------|
| **Precision** | High -- answers are specific | Balanced | Lower -- chunks contain noise |
| **Recall** | Lower -- context may be split | Balanced | Higher -- more context per chunk |
| **Token cost** | Higher per query (more chunks needed) | Balanced | Lower per query |
| **Best for** | FAQ, structured data | General documentation | Long-form articles, code |

The `chunk_overlap` ensures continuity between chunks. A value of 10--15% of `chunk_size` is a good starting point (e.g., `chunk_size: 512`, `chunk_overlap: 64`).

---

## Attaching Collections to Agents

### Local RAG (Legacy In-House Indexing)

```yaml
# agents/support-bot.yaml
version: 1
name: support-bot
provider: openai
model: gpt-4o
system_prompt: |
  You are a customer support agent. Use the knowledge base
  to answer questions accurately.

rag:
  collections:
    - product-docs
    - support-runbooks
  embedding_provider: openai
  embedding_model: text-embedding-3-small
  match_threshold: 0.7
  match_count: 5
```

### External Vector Stores

Crystal AI also supports connecting to external vector databases via `VectorStoreConfig`:

```yaml
# agents/support-bot.yaml
version: 1
name: support-bot
provider: openai
model: gpt-4o

rag:
  provider: pinecone
  embedding_provider: openai
  embedding_model: text-embedding-3-small
  match_count: 5
  match_threshold: 0.7
  connection:
    host: my-index-abc123.svc.pinecone.io
    api_key_env: PINECONE_API_KEY
    namespace: product-docs
```

### Supported External Providers

| Provider | Connection Fields |
|----------|-------------------|
| `pinecone` | `host`, `api_key_env`, `namespace` (optional) |
| `chroma` | `url`, `collection`, `api_key_env` (optional) |
| `qdrant` | `url`, `collection`, `api_key_env` (optional), `vector_name` (optional) |
| `weaviate` | `url`, `class_name`, `text_key` (optional), `properties` (optional), `api_key_env` (optional) |
| `pgvector` | `connection_string_env`, `table`, `content_column` (optional), `embedding_column` (optional), `source_column` (optional) |

### RAG Agent Config Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `rag.collections` | list of strings | Yes (local) | -- | Collection names matching `rag/<name>/` directories. |
| `rag.provider` | string | Yes (external) | -- | Vector database provider. |
| `rag.embedding_provider` | string | Yes | -- | Provider for query embedding generation. |
| `rag.embedding_model` | string | Yes | -- | Embedding model name. |
| `rag.match_threshold` | number | No | `0.7` | Minimum similarity score (0.0--1.0). |
| `rag.match_count` | integer | No | `5` | Maximum number of chunks to retrieve (1--50). |
| `rag.connection` | object | Yes (external) | -- | Provider-specific connection settings. |

---

## Complete Example: End-to-End RAG Setup

### 1. Create the collection directory

```bash
mkdir -p rag/product-docs
```

### 2. Add documents

```bash
cp docs/*.md rag/product-docs/
```

### 3. Configure the collection (optional)

```yaml
# rag/product-docs/.crystalai-rag.yaml
version: 1
name: product-docs
embedding_provider: openai
embedding_model: text-embedding-3-large
chunk_size: 1024
chunk_overlap: 128
include:
  - "**/*.md"
  - "docs/**/*.txt"
exclude:
  - "drafts/**"
  - "**/*-old.md"
```

### 4. Index the collection

```bash
crystalai rag index product-docs
```

### 5. Test the search

```bash
crystalai rag search product-docs "how to authenticate"
```

### 6. Attach to an agent

```yaml
# agents/docs-assistant.yaml
version: 1
name: docs-assistant
provider: openai
model: gpt-4o
system_prompt: |
  You are a documentation assistant. Answer questions using
  the product documentation. Cite sources when possible.
temperature: 0.3
rag:
  collections:
    - product-docs
  embedding_provider: openai
  embedding_model: text-embedding-3-large
  match_threshold: 0.75
  match_count: 4
```

### 7. Run the agent

```bash
crystalai run docs-assistant "How do I set up authentication?"
```

---

## Performance Tips

1. **Choose the right embedding model.** `text-embedding-3-small` is fast and cheap. `text-embedding-3-large` provides higher quality at 2x the cost and dimension size.

2. **Tune `match_threshold`.** Start at `0.7`. Lower it (e.g., `0.5`) if the agent misses relevant results. Raise it (e.g., `0.85`) if irrelevant chunks are retrieved.

3. **Adjust `match_count` to your context window.** Each retrieved chunk consumes tokens. If your model has a small context window, use fewer matches (2--3). For large context models, 5--10 works well.

4. **Use appropriate `chunk_size` for your content.** Technical documentation works well with 512--1024 tokens. FAQ-style content benefits from smaller chunks (128--256).

5. **Re-index after document changes.** The index is not updated automatically. Run `crystalai rag index <collection>` whenever source documents change.

6. **Keep the `.crystalai/` directory out of version control.** The database file (`agents.db`) can be regenerated from source documents and should be listed in `.gitignore`.

7. **Use `exclude` patterns to skip noise.** Exclude drafts, generated files, and build artifacts to keep the index focused on relevant content.

8. **For large-scale deployments, use external vector stores.** Local `sqlite-vec` performs well for thousands to low millions of vectors. For production workloads with millions of documents, connect to Pinecone, Qdrant, or another managed vector database.

---

## Errors and Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `RAG collection 'X' has not been indexed yet` | Collection directory exists but no embeddings in the database. | Run `crystalai rag index X`. |
| `No API key found for provider 'openai'` | Embedding provider credentials not configured. | Run `crystalai auth add openai` or set `OPENAI_API_KEY`. |
| `chunk_overlap must be less than chunk_size` | Invalid chunking configuration. | Reduce `chunk_overlap` to be less than `chunk_size`. |
| `Skipping unsupported file type` | File extension not in the supported list. | Convert the file to a supported format or add it to `exclude`. |

---

## Related Documentation

- [Agents Guide](./agents.md) -- Agent configuration including RAG settings
- [Tools Guide](./tools.md) -- Tool types available to agents
