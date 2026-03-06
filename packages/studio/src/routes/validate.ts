import { Hono } from 'hono';
import { validateProject } from '@crystralai/core';

export function createValidateRouter(cwd: string): Hono {
  const app = new Hono();

  // POST /api/validate — validate all project configs
  app.post('/', (c) => {
    try {
      const report = validateProject(cwd);
      return c.json(report);
    } catch (e) {
      return c.json({ error: String(e) }, 500);
    }
  });

  return app;
}
