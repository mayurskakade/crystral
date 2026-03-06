import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import { Hono } from 'hono';
import {
  listSchedules,
  loadScheduleConfig,
  findProjectRoot,
} from '@crystralai/core';

export function createSchedulesRouter(cwd: string): Hono {
  const app = new Hono();

  // GET /api/schedules — list all schedules
  app.get('/', (c) => {
    try {
      const names = listSchedules(cwd);
      const schedules = names.map((name) => {
        try {
          const config = loadScheduleConfig(name, cwd);
          return {
            name: config.name,
            agent: config.agent,
            schedule: config.schedule,
            input: config.input,
            enabled: config.enabled,
          };
        } catch {
          return { name, error: 'Failed to load config' };
        }
      });
      return c.json(schedules);
    } catch (e) {
      return c.json({ error: String(e) }, 500);
    }
  });

  // POST /api/schedules/:name/toggle — toggle schedule enabled/disabled
  app.post('/:name/toggle', async (c) => {
    const name = c.req.param('name');
    try {
      const root = findProjectRoot(cwd);
      const schedulesDir = root ? path.join(root, 'schedules') : path.join(cwd, 'schedules');
      const yamlPath = path.join(schedulesDir, `${name}.yaml`);
      const ymlPath = path.join(schedulesDir, `${name}.yml`);

      let filePath: string;
      if (fs.existsSync(yamlPath)) {
        filePath = yamlPath;
      } else if (fs.existsSync(ymlPath)) {
        filePath = ymlPath;
      } else {
        return c.json({ error: `Schedule '${name}' not found.` }, 404);
      }

      // Read and parse the YAML file
      const content = fs.readFileSync(filePath, 'utf-8');
      const raw = yaml.load(content) as Record<string, unknown>;

      // Toggle the enabled field
      const currentEnabled = raw['enabled'] !== false; // default true
      raw['enabled'] = !currentEnabled;

      // Write back
      const updatedContent = yaml.dump(raw, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        quotingType: '"',
        forceQuotes: false,
      });
      fs.writeFileSync(filePath, updatedContent, 'utf-8');

      return c.json({ name, enabled: raw['enabled'] });
    } catch (e) {
      return c.json({ error: String(e) }, 500);
    }
  });

  return app;
}
