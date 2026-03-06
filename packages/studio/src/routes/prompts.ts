import * as fs from 'node:fs';
import * as path from 'node:path';
import { Hono } from 'hono';
import {
  listPromptTemplates,
  loadPromptTemplate,
  writePromptTemplate,
  findProjectRoot,
} from '@crystralai/core';
import type { PromptTemplateConfig } from '@crystralai/core';

export function createPromptsRouter(cwd: string): Hono {
  const app = new Hono();

  // GET /api/prompts — list all prompt templates
  app.get('/', (c) => {
    try {
      const names = listPromptTemplates(cwd);
      const prompts = names.map((name) => {
        try {
          const config = loadPromptTemplate(name, cwd);
          return {
            name: config.name,
            description: config.description,
            defaults: config.defaults,
          };
        } catch {
          return { name, error: 'Failed to load config' };
        }
      });
      return c.json(prompts);
    } catch (e) {
      return c.json({ error: String(e) }, 500);
    }
  });

  // GET /api/prompts/:name — get prompt template detail
  app.get('/:name', (c) => {
    const name = c.req.param('name');
    try {
      const config = loadPromptTemplate(name, cwd);
      return c.json(config);
    } catch (e) {
      return c.json({ error: String(e) }, 404);
    }
  });

  // POST /api/prompts — create a new prompt template
  app.post('/', async (c) => {
    try {
      const body = await c.req.json<{
        name: string;
        description?: string;
        template: string;
        defaults?: Record<string, string>;
      }>();

      // Validate name format
      if (!body.name || !/^[a-zA-Z0-9_-]+$/.test(body.name) || body.name.length > 64) {
        return c.json({ error: 'Invalid prompt template name. Must be 1-64 chars, alphanumeric, hyphens, underscores.' }, 400);
      }

      if (!body.template) {
        return c.json({ error: 'Template text is required.' }, 400);
      }

      // Check if template already exists
      const existing = listPromptTemplates(cwd);
      if (existing.includes(body.name)) {
        return c.json({ error: `Prompt template '${body.name}' already exists.` }, 409);
      }

      const config: PromptTemplateConfig = {
        version: 1,
        name: body.name,
        template: body.template,
      };
      if (body.description) {
        config.description = body.description;
      }
      if (body.defaults) {
        config.defaults = body.defaults;
      }

      writePromptTemplate(config, cwd);
      return c.json(config, 201);
    } catch (e) {
      return c.json({ error: String(e) }, 500);
    }
  });

  // PUT /api/prompts/:name — update a prompt template
  app.put('/:name', async (c) => {
    const name = c.req.param('name');
    try {
      const existing = loadPromptTemplate(name, cwd);
      const body = await c.req.json<{
        description?: string;
        template?: string;
        defaults?: Record<string, string>;
      }>();

      if (body.description !== undefined) existing.description = body.description;
      if (body.template !== undefined) existing.template = body.template;
      if (body.defaults !== undefined) existing.defaults = body.defaults;

      writePromptTemplate(existing, cwd);
      return c.json(existing);
    } catch (e) {
      const status = String(e).includes('not found') ? 404 : 500;
      return c.json({ error: String(e) }, status);
    }
  });

  // DELETE /api/prompts/:name — delete a prompt template
  app.delete('/:name', (c) => {
    const name = c.req.param('name');
    try {
      const root = findProjectRoot(cwd);
      const promptsDir = root ? path.join(root, 'prompts') : path.join(cwd, 'prompts');
      const yamlPath = path.join(promptsDir, `${name}.yaml`);
      const ymlPath = path.join(promptsDir, `${name}.yml`);

      if (fs.existsSync(yamlPath)) {
        fs.unlinkSync(yamlPath);
      } else if (fs.existsSync(ymlPath)) {
        fs.unlinkSync(ymlPath);
      } else {
        return c.json({ error: `Prompt template '${name}' not found.` }, 404);
      }

      return c.json({ deleted: true });
    } catch (e) {
      return c.json({ error: String(e) }, 500);
    }
  });

  return app;
}
