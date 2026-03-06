import { Hono } from 'hono';
import {
  listWorkflows,
  loadWorkflowConfig,
  WorkflowEngine,
} from '@crystralai/core';
import type { WorkflowRunOptions } from '@crystralai/core';

export function createWorkflowsRouter(cwd: string): Hono {
  const app = new Hono();

  // GET /api/workflows — list all workflows
  app.get('/', (c) => {
    try {
      const names = listWorkflows(cwd);
      const workflows = names.map((name) => {
        try {
          const config = loadWorkflowConfig(name, cwd);
          return {
            name: config.name,
            description: config.description,
            strategy: config.orchestrator.strategy,
            agents: config.agents.map((a) => ({
              name: a.name,
              agent: a.agent,
              description: a.description,
              run_if: a.run_if,
              output_as: a.output_as,
            })),
          };
        } catch {
          return { name, error: 'Failed to load config' };
        }
      });
      return c.json(workflows);
    } catch (e) {
      return c.json({ error: String(e) }, 500);
    }
  });

  // GET /api/workflows/:name — get workflow details
  app.get('/:name', (c) => {
    const name = c.req.param('name');
    try {
      const config = loadWorkflowConfig(name, cwd);
      return c.json(config);
    } catch (e) {
      return c.json({ error: String(e) }, 404);
    }
  });

  // POST /api/workflows/:name/run — run a workflow
  app.post('/:name/run', async (c) => {
    const name = c.req.param('name');
    try {
      const body = await c.req.json<{ task: string; variables?: Record<string, string> }>();
      const config = loadWorkflowConfig(name, cwd);
      const engine = new WorkflowEngine(config);

      const runOpts: WorkflowRunOptions = {
        cwd,
      };
      if (body.variables) {
        runOpts.variables = body.variables;
      }

      const result = await engine.run(body.task, runOpts);

      return c.json({
        content: result.content,
        sessionId: result.sessionId,
        agentResults: result.agentResults,
        usage: result.usage,
        durationMs: result.durationMs,
      });
    } catch (e) {
      return c.json({ error: String(e) }, 500);
    }
  });

  return app;
}
