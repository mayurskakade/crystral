import { Hono } from 'hono';
import { SQLiteStorage } from '@crystralai/core';

export function createLogsRouter(cwd: string): Hono {
  const app = new Hono();

  // GET /api/logs — get inference logs
  app.get('/', (c) => {
    try {
      const storage = SQLiteStorage.getInstance(cwd);
      const agent = c.req.query('agent');
      const limitStr = c.req.query('limit');
      const since = c.req.query('since');

      const filter: { agentName?: string; limit?: number; since?: Date } = {};
      if (agent) {
        filter.agentName = agent;
      }
      if (limitStr) {
        filter.limit = parseInt(limitStr, 10);
      }
      if (since) {
        filter.since = new Date(since);
      }

      const logs = storage.getLogs(filter);
      return c.json(logs);
    } catch (e) {
      return c.json({ error: String(e) }, 500);
    }
  });

  return app;
}
