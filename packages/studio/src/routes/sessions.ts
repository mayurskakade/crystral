import { Hono } from 'hono';
import { SQLiteStorage } from '@crystralai/core';

export function createSessionsRouter(cwd: string): Hono {
  const app = new Hono();

  function getStorage(): SQLiteStorage {
    return SQLiteStorage.getInstance(cwd);
  }

  // GET /api/sessions — list all sessions
  app.get('/', (c) => {
    try {
      const agent = c.req.query('agent');
      const storage = getStorage();
      const sessions = storage.listSessions(agent);
      return c.json(sessions);
    } catch (e) {
      return c.json({ error: String(e) }, 500);
    }
  });

  // GET /api/sessions/:id/messages — get messages for a session
  app.get('/:id/messages', (c) => {
    const id = c.req.param('id');
    try {
      const storage = getStorage();
      const session = storage.getSession(id);
      if (!session) {
        return c.json({ error: 'Session not found' }, 404);
      }
      const messages = storage.getMessages(id);
      return c.json({ session, messages });
    } catch (e) {
      return c.json({ error: String(e) }, 500);
    }
  });

  // DELETE /api/sessions/:id — delete a session
  app.delete('/:id', (c) => {
    const id = c.req.param('id');
    try {
      const storage = getStorage();
      const session = storage.getSession(id);
      if (!session) {
        return c.json({ error: 'Session not found' }, 404);
      }
      storage.deleteSession(id);
      return c.json({ deleted: true });
    } catch (e) {
      return c.json({ error: String(e) }, 500);
    }
  });

  return app;
}
