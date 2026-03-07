import type { EmbedFn, VectorSearchResult, VectorStoreClient } from './base.js';

interface WeaviateConnection {
  /** Weaviate server URL, e.g. http://localhost:8080 */
  url: string;
  /** Weaviate class name (= collection), e.g. "Document" */
  class_name: string;
  /**
   * Property that holds the chunk text. Defaults to "content".
   * Must be a text property on the class.
   */
  text_key?: string;
  /**
   * Additional properties to request and surface in `metadata`.
   * Example: ["source", "title"]
   */
  properties?: string[];
  /** Optional env var for Weaviate API key (cloud / auth-enabled deployments) */
  api_key_env?: string;
}

interface WeaviateObject {
  _additional: { id: string; distance?: number; certainty?: number };
  [key: string]: unknown;
}

export class WeaviateConnector implements VectorStoreClient {
  private baseUrl: string;
  private className: string;
  private textKey: string;
  private properties: string[];
  private headers: Record<string, string>;
  private embedFn?: EmbedFn;

  constructor(connection: Record<string, unknown>, embedFn?: EmbedFn) {
    const c = connection as unknown as WeaviateConnection;
    if (!c.url) throw new Error('Weaviate connection requires `url`');
    if (!c.class_name) throw new Error('Weaviate connection requires `class_name`');

    this.baseUrl = c.url.replace(/\/$/, '');
    this.className = c.class_name;
    this.textKey = c.text_key ?? 'content';
    this.properties = c.properties ?? [];
    if (embedFn) this.embedFn = embedFn;

    this.headers = { 'Content-Type': 'application/json' };
    if (c.api_key_env) {
      const key = process.env[c.api_key_env];
      if (!key) throw new Error(`Weaviate API key not found in env var: ${c.api_key_env}`);
      this.headers['Authorization'] = `Bearer ${key}`;
    }
  }

  async search(query: string, topK: number, threshold = 0): Promise<VectorSearchResult[]> {
    const allProps = [this.textKey, 'source', ...this.properties].filter(
      (v, i, a) => a.indexOf(v) === i
    );
    const propsGql = allProps.join('\n        ');

    let nearClause: string;

    if (this.embedFn) {
      // nearVector — we embed externally
      const vector = await this.embedFn(query);
      const certainty = threshold; // Weaviate uses certainty = 1 - (distance/2)
      nearClause = `nearVector: { vector: [${vector.join(',')}], certainty: ${certainty} }`;
    } else {
      // nearText — Weaviate vectorizes internally (requires a vectorizer module)
      nearClause = `nearText: { concepts: ["${query.replace(/"/g, '\\"')}"], certainty: ${threshold} }`;
    }

    const gql = `{
  Get {
    ${this.className}(
      ${nearClause}
      limit: ${topK}
    ) {
        ${propsGql}
        _additional { id distance certainty }
    }
  }
}`;

    const response = await fetch(`${this.baseUrl}/v1/graphql`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ query: gql }),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => '');
      throw new Error(`Weaviate GraphQL query failed (${response.status}): ${err}`);
    }

    const data = await response.json() as {
      data?: { Get?: Record<string, WeaviateObject[]> };
      errors?: Array<{ message: string }>;
    };

    if (data.errors?.length) {
      throw new Error(`Weaviate GraphQL error: ${data.errors[0]?.message}`);
    }

    const objects = data.data?.Get?.[this.className] ?? [];

    return objects.map(obj => {
      // certainty ∈ [0,1]; distance ∈ [0,2] — normalise to score ∈ [0,1]
      const score = obj._additional.certainty
        ?? (obj._additional.distance !== undefined ? 1 - obj._additional.distance / 2 : 0);

      const { _additional, [this.textKey]: text, source, ...rest } = obj;
      void _additional;

      return {
        content: (text as string) ?? '',
        ...(source ? { source: source as string } : {}),
        score,
        ...(Object.keys(rest).length ? { metadata: rest } : {}),
      };
    });
  }
}
