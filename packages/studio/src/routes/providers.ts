import { Hono } from 'hono';
import { hasApiKey, getApiKeySource, listGlobalCredentials, saveGlobalCredential, removeGlobalCredential } from '@crystralai/core';

const KNOWN_PROVIDERS = ['openai', 'anthropic', 'groq', 'google', 'together'] as const;

export function createProvidersRouter(cwd: string): Hono {
  const app = new Hono();

  // GET /api/providers — list providers and their credential status
  app.get('/', (c) => {
    try {
      const providers = KNOWN_PROVIDERS.map((provider) => ({
        name: provider,
        configured: hasApiKey(provider, cwd),
        source: getApiKeySource(provider, cwd),
      }));

      const globalCredentials = listGlobalCredentials();

      return c.json({
        providers,
        credentials: globalCredentials,
      });
    } catch (e) {
      return c.json({ error: String(e) }, 500);
    }
  });

  // POST /api/providers/:name — save API key
  app.post('/:name', async (c) => {
    const name = c.req.param('name');
    try {
      const body = await c.req.json<{ apiKey: string }>();

      if (!body.apiKey || typeof body.apiKey !== 'string' || body.apiKey.trim().length === 0) {
        return c.json({ error: 'apiKey is required and must be a non-empty string.' }, 400);
      }

      saveGlobalCredential(name, body.apiKey.trim());
      return c.json({ saved: true });
    } catch (e) {
      return c.json({ error: String(e) }, 500);
    }
  });

  // DELETE /api/providers/:name — remove API key
  app.delete('/:name', (c) => {
    const name = c.req.param('name');
    try {
      const removed = removeGlobalCredential(name);
      if (!removed) {
        return c.json({ error: `No credential found for provider '${name}'.` }, 404);
      }
      return c.json({ removed: true });
    } catch (e) {
      return c.json({ error: String(e) }, 500);
    }
  });

  return app;
}
