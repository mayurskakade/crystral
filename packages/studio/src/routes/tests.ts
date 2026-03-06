import { Hono } from 'hono';
import {
  listTestSuites,
  loadTestSuite,
  loadAgentConfig,
  createAgentRunner,
  runTestSuite,
} from '@crystralai/core';

export function createTestsRouter(cwd: string): Hono {
  const app = new Hono();

  // GET /api/tests — list all test suites
  app.get('/', (c) => {
    try {
      const names = listTestSuites(cwd);
      const suites = names.map((name) => {
        try {
          const config = loadTestSuite(name, cwd);
          return {
            name: config.name,
            agent: config.agent,
            mock: config.mock,
            testCount: config.tests.length,
          };
        } catch {
          return { name, error: 'Failed to load config' };
        }
      });
      return c.json(suites);
    } catch (e) {
      return c.json({ error: String(e) }, 500);
    }
  });

  // GET /api/tests/:name — get test suite detail
  app.get('/:name', (c) => {
    const name = c.req.param('name');
    try {
      const config = loadTestSuite(name, cwd);
      return c.json(config);
    } catch (e) {
      return c.json({ error: String(e) }, 404);
    }
  });

  // POST /api/tests/:name/run — run a test suite
  app.post('/:name/run', async (c) => {
    const name = c.req.param('name');
    try {
      const suiteConfig = loadTestSuite(name, cwd);
      const agentConfig = loadAgentConfig(suiteConfig.agent, cwd);
      const runner = createAgentRunner(agentConfig);

      // Adapt the agent runner to the TestableAgentRunner interface
      const testableRunner = {
        async run(input: string, options?: { variables?: Record<string, string> }) {
          const runOpts: { cwd: string; variables?: Record<string, string> } = { cwd };
          if (options?.variables) {
            runOpts.variables = options.variables;
          }
          const result = await runner.run(input, runOpts);
          const ret: { response: string; parsed?: unknown; guardrails?: { inputBlocked?: boolean } } = {
            response: result.content,
          };
          return ret;
        },
      };

      const runOpts: { mock?: boolean } = {};
      if (suiteConfig.mock !== undefined) {
        runOpts.mock = suiteConfig.mock;
      }
      const result = await runTestSuite(suiteConfig, testableRunner, runOpts);

      return c.json(result);
    } catch (e) {
      return c.json({ error: String(e) }, 500);
    }
  });

  return app;
}
