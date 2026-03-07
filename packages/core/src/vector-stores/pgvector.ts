import type { EmbedFn, VectorSearchResult, VectorStoreClient } from './base.js';

interface PgVectorConnection {
  /** Environment variable name that holds the PostgreSQL connection string */
  connection_string_env: string;
  /** Table name, e.g. "documents" */
  table: string;
  /** Column holding the text content. Defaults to "content" */
  content_column?: string;
  /** Column holding the pgvector embedding. Defaults to "embedding" */
  embedding_column?: string;
  /** Column holding the source/document identifier (optional) */
  source_column?: string;
}

export class PgVectorConnector implements VectorStoreClient {
  private connectionString: string;
  private table: string;
  private contentCol: string;
  private embeddingCol: string;
  private sourceCol?: string;
  private embedFn: EmbedFn;

  constructor(connection: Record<string, unknown>, embedFn: EmbedFn) {
    const c = connection as unknown as PgVectorConnection;
    if (!c.connection_string_env) throw new Error('pgvector connection requires `connection_string_env`');
    if (!c.table) throw new Error('pgvector connection requires `table`');

    const connStr = process.env[c.connection_string_env];
    if (!connStr) throw new Error(`PostgreSQL connection string not found in env var: ${c.connection_string_env}`);

    this.connectionString = connStr;
    this.table = c.table;
    this.contentCol = c.content_column ?? 'content';
    this.embeddingCol = c.embedding_column ?? 'embedding';
    if (c.source_column) { this.sourceCol = c.source_column; }
    this.embedFn = embedFn;
  }

  async search(query: string, topK: number, threshold = 0): Promise<VectorSearchResult[]> {
    type PgClient = {
      connect(): Promise<void>;
      query<R extends Record<string, unknown>>(sql: string, params: unknown[]): Promise<{ rows: R[] }>;
      end(): Promise<void>;
    };
    type PgClientConstructor = new (config: { connectionString: string }) => PgClient;

    let Client: PgClientConstructor;
    try {
      // pg is an optional peer dependency — dynamic import so the package doesn't
      // require it for users who don't use pgvector.
      // Use a variable so tsc doesn't statically resolve the optional peer dep
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pg = await import(/* @vite-ignore */ ('pg' as string)) as any;
      Client = pg.Client ?? pg.default?.Client;
      if (!Client) throw new Error('no Client export');
    } catch {
      throw new Error(
        'pgvector connector requires the `pg` package. Install it: npm install pg'
      );
    }

    const vector = await this.embedFn(query);
    const vectorLiteral = `[${vector.join(',')}]`;

    const sourceSelect = this.sourceCol ? `, ${this.sourceCol} AS source` : '';
    // cosine distance operator: <=>  (pgvector ≥ 0.5)
    // score = 1 - cosine_distance so higher is more similar
    const sql = `
      SELECT
        ${this.contentCol} AS content
        ${sourceSelect},
        1 - (${this.embeddingCol} <=> $1::vector) AS score
      FROM ${this.table}
      WHERE 1 - (${this.embeddingCol} <=> $1::vector) >= $2
      ORDER BY ${this.embeddingCol} <=> $1::vector
      LIMIT $3
    `;

    const client = new Client({ connectionString: this.connectionString });
    await client.connect();
    try {
      const result = await client.query<Record<string, unknown>>(sql, [vectorLiteral, threshold, topK]);
      return result.rows.map(row => {
        const source = row['source'] as string | undefined;
        return {
          content: (row['content'] as string) ?? '',
          score: Number(row['score']),
          ...(source ? { source } : {}),
        };
      });
    } finally {
      await client.end();
    }
  }
}
