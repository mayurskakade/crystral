import type { EmbedFn, VectorSearchResult, VectorStoreClient } from './base.js';

interface PineconeConnection {
  /** Full Pinecone index host, e.g. https://my-index-abc123.svc.us-east-1.pinecone.io */
  host: string;
  /** Environment variable name that holds the Pinecone API key */
  api_key_env: string;
  /** Pinecone namespace (optional) */
  namespace?: string;
}

interface PineconeMatch {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export class PineconeConnector implements VectorStoreClient {
  private host: string;
  private apiKey: string;
  private namespace: string;
  private embedFn: EmbedFn;

  constructor(connection: Record<string, unknown>, embedFn: EmbedFn) {
    const c = connection as unknown as PineconeConnection;
    if (!c.host) throw new Error('Pinecone connection requires `host`');
    if (!c.api_key_env) throw new Error('Pinecone connection requires `api_key_env`');

    const apiKey = process.env[c.api_key_env];
    if (!apiKey) throw new Error(`Pinecone API key not found in env var: ${c.api_key_env}`);

    this.host = c.host.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.namespace = c.namespace ?? '';
    this.embedFn = embedFn;
  }

  async search(query: string, topK: number, threshold = 0): Promise<VectorSearchResult[]> {
    const vector = await this.embedFn(query);

    const body: Record<string, unknown> = {
      vector,
      topK,
      includeMetadata: true,
      includeValues: false,
    };
    if (this.namespace) body.namespace = this.namespace;

    const response = await fetch(`${this.host}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => '');
      throw new Error(`Pinecone query failed (${response.status}): ${err}`);
    }

    const data = await response.json() as { matches: PineconeMatch[] };

    return (data.matches ?? [])
      .filter(m => m.score >= threshold)
      .map(m => ({
        content: (m.metadata?.text ?? m.metadata?.content ?? m.metadata?.chunk ?? '') as string,
        ...(m.metadata?.source ? { source: m.metadata.source as string } : { source: m.id }),
        score: m.score,
        ...(m.metadata ? { metadata: m.metadata } : {}),
      }));
  }
}
