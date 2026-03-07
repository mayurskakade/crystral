import type { EmbedFn, VectorSearchResult, VectorStoreClient } from './base.js';

interface QdrantConnection {
  /** Qdrant server URL, e.g. http://localhost:6333 or https://xyz.qdrant.tech */
  url: string;
  /** Collection name */
  collection: string;
  /** Optional env var name for Qdrant API key */
  api_key_env?: string;
  /** Named vector to query when the collection uses named vectors (optional) */
  vector_name?: string;
}

interface QdrantScoredPoint {
  id: string | number;
  score: number;
  payload?: Record<string, unknown>;
}

export class QdrantConnector implements VectorStoreClient {
  private baseUrl: string;
  private collection: string;
  private vectorName?: string;
  private headers: Record<string, string>;
  private embedFn: EmbedFn;

  constructor(connection: Record<string, unknown>, embedFn: EmbedFn) {
    const c = connection as unknown as QdrantConnection;
    if (!c.url) throw new Error('Qdrant connection requires `url`');
    if (!c.collection) throw new Error('Qdrant connection requires `collection`');

    this.baseUrl = c.url.replace(/\/$/, '');
    this.collection = c.collection;
    if (c.vector_name) this.vectorName = c.vector_name;
    this.embedFn = embedFn;

    this.headers = { 'Content-Type': 'application/json' };
    if (c.api_key_env) {
      const key = process.env[c.api_key_env];
      if (!key) throw new Error(`Qdrant API key not found in env var: ${c.api_key_env}`);
      this.headers['api-key'] = key;
    }
  }

  async search(query: string, topK: number, threshold = 0): Promise<VectorSearchResult[]> {
    const vector = await this.embedFn(query);

    // Support both plain vector and named-vector collections
    const queryVector = this.vectorName
      ? { name: this.vectorName, vector }
      : vector;

    const response = await fetch(
      `${this.baseUrl}/collections/${encodeURIComponent(this.collection)}/points/search`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          vector: queryVector,
          limit: topK,
          score_threshold: threshold,
          with_payload: true,
          with_vector: false,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text().catch(() => '');
      throw new Error(`Qdrant search failed (${response.status}): ${err}`);
    }

    const data = await response.json() as { result: QdrantScoredPoint[] };

    return (data.result ?? []).map(p => ({
      content: (p.payload?.text ?? p.payload?.content ?? p.payload?.chunk ?? '') as string,
      source: (p.payload?.source as string | undefined) ?? String(p.id),
      score: p.score,
      ...(p.payload ? { metadata: p.payload } : {}),
    }));
  }
}
