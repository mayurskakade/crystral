import type { VectorStoreConfig } from '../types/index.js';
import { createProvider } from '../providers/index.js';
import { resolveApiKey } from '../credentials/index.js';

// ── Public types ─────────────────────────────────────────────────────────────

export interface VectorSearchResult {
  /** Chunk / passage text returned from the vector store */
  content: string;
  /** Source document identifier (file path, URL, doc ID, etc.) */
  source?: string;
  /** Similarity score in [0, 1] */
  score: number;
  /** Any extra metadata the store returns */
  metadata?: Record<string, unknown>;
}

export interface VectorStoreClient {
  /**
   * Search the vector store for chunks similar to `query`.
   * @param query  Raw text — the connector embeds it if needed.
   * @param topK   Maximum number of results.
   * @param threshold  Minimum similarity score (0–1). Connector may ignore if unsupported.
   */
  search(query: string, topK: number, threshold?: number): Promise<VectorSearchResult[]>;
}

// ── Embed helper passed into connectors that need external embedding ──────────

export type EmbedFn = (text: string) => Promise<number[]>;

/**
 * Build an EmbedFn from the embedding_provider / embedding_model fields of a
 * VectorStoreConfig.  Returns undefined when neither field is set (Weaviate
 * nearText mode, for example).
 */
export function resolveEmbedFn(config: VectorStoreConfig): EmbedFn | undefined {
  if (!config.embedding_provider || !config.embedding_model) return undefined;

  const apiKey = resolveApiKey(config.embedding_provider);
  const provider = createProvider(config.embedding_provider, apiKey);
  const model = config.embedding_model;

  return (text: string) => provider.embed(text, model);
}

// ── Factory ───────────────────────────────────────────────────────────────────

export async function createVectorStore(config: VectorStoreConfig): Promise<VectorStoreClient> {
  const embedFn = resolveEmbedFn(config);

  switch (config.provider) {
    case 'pinecone': {
      const { PineconeConnector } = await import('./pinecone.js');
      return new PineconeConnector(config.connection, embedFn!);
    }
    case 'chroma': {
      const { ChromaConnector } = await import('./chroma.js');
      return new ChromaConnector(config.connection, embedFn!);
    }
    case 'qdrant': {
      const { QdrantConnector } = await import('./qdrant.js');
      return new QdrantConnector(config.connection, embedFn!);
    }
    case 'weaviate': {
      const { WeaviateConnector } = await import('./weaviate.js');
      return new WeaviateConnector(config.connection, embedFn);
    }
    case 'pgvector': {
      const { PgVectorConnector } = await import('./pgvector.js');
      return new PgVectorConnector(config.connection, embedFn!);
    }
    default: {
      const p: never = config.provider;
      throw new Error(`Unknown vector store provider: ${p}`);
    }
  }
}
