import { Hono } from 'hono';
import { listTools, loadToolConfig } from '@crystral/core';

export function createToolsRouter(cwd: string): Hono {
  const app = new Hono();

  // GET /api/tools — list all tools
  app.get('/', (c) => {
    try {
      const names = listTools(cwd);
      const tools = names.map((name) => {
        try {
          const config = loadToolConfig(name, cwd);
          return {
            name: config.name,
            type: config.type,
            description: config.description,
            parameters: config.parameters,
          };
        } catch {
          return { name, error: 'Failed to load config' };
        }
      });
      return c.json(tools);
    } catch (e) {
      return c.json({ error: String(e) }, 500);
    }
  });

  // GET /api/tools/:name — get tool details
  app.get('/:name', (c) => {
    const name = c.req.param('name');
    try {
      const config = loadToolConfig(name, cwd);
      return c.json(config);
    } catch (e) {
      return c.json({ error: String(e) }, 404);
    }
  });

  return app;
}
