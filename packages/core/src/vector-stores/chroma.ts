import type { EmbedFn, VectorSearchResult, VectorStoreClient } from './base.js';

interface ChromaConnection {
  /** Chroma server URL, e.g. http://localhost:8000 */
  url: string;
  /** Collection name */
  collection: string;
  /** Optional env var name for Chroma API key (cloud / authenticated deployments) */
  api_key_env?: string;
}

interface ChromaQueryResponse {
  ids: string[][];
  distances: number[][];
  metadatas: Array<Array<Record<string, unknown> | null>>;
  documents: Array<Array<string | null>>;
}

export class ChromaConnector implements VectorStoreClient {
  private baseUrl: string;
  private collection: string;
  private headers: Record<string, string>;
  private embedFn: EmbedFn;

  constructor(connection: Record<string, unknown>, embedFn: EmbedFn) {
    const c = connection as unknown as ChromaConnection;
    if (!c.url) throw new Error('Chroma connection requires `url`');
    if (!c.collection) throw new Error('Chroma connection requires `collection`');

    this.baseUrl = c.url.replace(/\/$/, '');
    this.collection = c.collection;
    this.embedFn = embedFn;

    this.headers = { 'Content-Type': 'application/json' };
    if (c.api_key_env) {
      const key = process.env[c.api_key_env];
      if (!key) throw new Error(`Chroma API key not found in env var: ${c.api_key_env}`);
      this.headers['Authorization'] = `Bearer ${key}`;
    }
  }

  async search(query: string, topK: number, threshold = 0): Promise<VectorSearchResult[]> {
    const vector = await this.embedFn(query);

    // Resolve collection ID (Chroma v0.4+ uses UUIDs internally)
    const collectionId = await this.resolveCollectionId();

    const response = await fetch(`${this.baseUrl}/api/v1/collections/${collectionId}/query`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        query_embeddings: [vector],
        n_results: topK,
        include: ['documents', 'metadatas', 'distances'],
      }),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => '');
      throw new Error(`Chroma query failed (${response.status}): ${err}`);
    }

    const data = await response.json() as ChromaQueryResponse;

    const ids = data.ids[0] ?? [];
    const distances = data.distances[0] ?? [];
    const metadatas = data.metadatas[0] ?? [];
    const documents = data.documents[0] ?? [];

    return ids
      .map((id, i) => {
        const distance = distances[i] ?? 0;
        const score = 1 / (1 + distance);
        const meta = metadatas[i] ?? {};
        const source = (meta.source as string | undefined) ?? id;
        return {
          content: documents[i] ?? (meta.content as string) ?? '',
          score,
          source,
          ...(Object.keys(meta).length ? { metadata: meta } : {}),
        };
      })
      .filter(r => r.score >= threshold);
  }

  private async resolveCollectionId(): Promise<string> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/collections/${encodeURIComponent(this.collection)}`,
      { headers: this.headers }
    );
    if (!response.ok) {
      throw new Error(`Chroma collection '${this.collection}' not found (${response.status})`);
    }
    const data = await response.json() as { id: string };
    return data.id;
  }
}
