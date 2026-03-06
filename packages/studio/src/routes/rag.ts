import { Hono } from 'hono';
import { listRAGCollections, loadRAGCollectionConfig, SQLiteStorage } from '@crystral/core';

export function createRAGRouter(cwd: string): Hono {
  const app = new Hono();

  // GET /api/rag — list all RAG collections
  app.get('/', (c) => {
    try {
      const names = listRAGCollections(cwd);
      const storage = SQLiteStorage.getInstance(cwd);
      const collections = names.map((name) => {
        try {
          const config = loadRAGCollectionConfig(name, cwd);
          const stats = storage.getCollectionStats(name);
          return {
            name: config.name,
            embedding_provider: config.embedding_provider,
            embedding_model: config.embedding_model,
            chunk_size: config.chunk_size,
            chunks: stats.chunks,
            documents: stats.documents.length,
            ...(stats.lastIndexed ? { lastIndexed: stats.lastIndexed.toISOString() } : {}),
          };
        } catch {
          return { name, error: 'Failed to load config' };
        }
      });
      return c.json(collections);
    } catch (e) {
      return c.json({ error: String(e) }, 500);
    }
  });

  // GET /api/rag/:name — get RAG collection details
  app.get('/:name', (c) => {
    const name = c.req.param('name');
    try {
      const config = loadRAGCollectionConfig(name, cwd);
      const storage = SQLiteStorage.getInstance(cwd);
      const stats = storage.getCollectionStats(name);
      return c.json({
        ...config,
        stats: {
          chunks: stats.chunks,
          documents: stats.documents,
          ...(stats.lastIndexed ? { lastIndexed: stats.lastIndexed.toISOString() } : {}),
        },
      });
    } catch (e) {
      return c.json({ error: String(e) }, 404);
    }
  });

  return app;
}
