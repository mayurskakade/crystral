# RAG (Retrieval-Augmented Generation)

RAG lets an agent answer questions about your documents by retrieving the most
relevant chunks and injecting them into the prompt before calling the LLM.

---

## When to Use RAG

Use RAG when you want the agent to:

- Answer questions about internal documentation, wikis, or knowledge bases
- Reference large bodies of text that don't fit in a single context window
- Ground responses in specific, versioned source material

---

## Project Structure

RAG collections live in a `rag/` directory alongside your `agents/` directory:

```
my-project/
├── agents/
│   └── docs-assistant.yaml
└── rag/
    └── my-docs/
        ├── .crystral-rag.yaml     ← collection config
        ├── getting-started.md
        ├── api-reference.md
        └── faq.txt
```

---

## Collection Configuration

Create `rag/my-docs/.crystral-rag.yaml`:

```yaml
name: my-docs
description: Product documentation for Acme Corp
embedding_provider: openai
embedding_model: text-embedding-3-small

# File types to index (defaults shown)
include:
  - "**/*.md"
  - "**/*.txt"
  - "**/*.pdf"

# Chunking settings
chunk_size: 512       # Characters per chunk. Default: 512.
chunk_overlap: 64     # Overlap between adjacent chunks. Default: 64.
```

---

## Configuring an Agent to Use a Collection

Add a `rag` block to your agent YAML:

```yaml
version: "1"
name: docs-assistant
provider: openai
model: gpt-4o
system_prompt: |
  You are a documentation assistant. Answer questions using only the
  provided context. If the answer is not in the context, say so.

rag:
  collection: my-docs       # Must match the directory name under rag/
  match_threshold: 0.75     # Minimum similarity score (0.0–1.0). Default: 0.7
  match_count: 5            # Maximum chunks to retrieve. Default: 5.
```

When the agent runs, Crystral:
1. Embeds the user's message using the collection's embedding model
2. Finds the `match_count` most similar chunks above `match_threshold`
3. Injects them into the prompt as context
4. The retrieved text is available in `RunResult.ragContext`

---

## Supported File Types

Out of the box Crystral indexes:

| Extension | Notes |
|-----------|-------|
| `.md` | Markdown — stripped of syntax before embedding |
| `.txt` | Plain text |
| `.pdf` | Text extracted from PDF (scanned PDFs require OCR) |

Add entries to `include` in `.crystral-rag.yaml` to customise which files are
indexed.

---

## Embedding Providers

| Provider | Value | Model Example | Environment Variable |
|----------|-------|---------------|----------------------|
| OpenAI | `openai` | `text-embedding-3-small` | `OPENAI_API_KEY` |
| Google | `google` | `text-embedding-004` | `GOOGLE_API_KEY` |

The embedding provider is set per-collection in `.crystral-rag.yaml` and can
differ from the agent's LLM provider.

---

## Building the Index

Run the index build command before using a RAG agent for the first time, or
after adding new documents:

```bash
npx crystral index my-docs
# or with the CLI
crystral index rag/my-docs
```

The index is stored in the collection directory as a local vector store and is
never sent to any remote server.

---

## Tuning Retrieval Quality

| Parameter | Effect |
|-----------|--------|
| Raise `match_threshold` | Fewer, more relevant chunks; may miss useful content |
| Lower `match_threshold` | More chunks retrieved; may include noise |
| Raise `match_count` | More context in the prompt; higher token cost |
| Lower `match_count` | Fewer tokens; faster and cheaper; may miss relevant info |
| Lower `chunk_size` | Finer granularity; better for precise fact lookup |
| Raise `chunk_size` | More context per chunk; better for prose/summaries |

Start with the defaults and adjust based on answer quality.

---

## Inspecting Retrieved Context

The retrieved context is available in `RunResult.ragContext`:

```typescript
const result = await client.run('docs-assistant', 'How do I configure authentication?');

if (result.ragContext) {
  console.log('Retrieved context:\n', result.ragContext);
}
```

`ragContext` is `undefined` when no relevant chunks were found above the
configured threshold.
