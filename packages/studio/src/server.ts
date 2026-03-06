import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createAgentsRouter } from './routes/agents.js';
import { createToolsRouter } from './routes/tools.js';
import { createWorkflowsRouter } from './routes/workflows.js';
import { createSessionsRouter } from './routes/sessions.js';
import { createLogsRouter } from './routes/logs.js';
import { createRAGRouter } from './routes/rag.js';
import { createProvidersRouter } from './routes/providers.js';
import { createPromptsRouter } from './routes/prompts.js';
import { createTestsRouter } from './routes/tests.js';
import { createValidateRouter } from './routes/validate.js';
import { createSchedulesRouter } from './routes/schedules.js';
import { getDashboardHTML } from './ui/dashboard.js';

/**
 * Create the Hono app with all routes mounted
 */
export function createStudioApp(cwd: string): Hono {
  const app = new Hono();

  // CORS for localhost development
  app.use('/api/*', cors({
    origin: ['http://localhost:4000', 'http://127.0.0.1:4000'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowHeaders: ['Content-Type'],
  }));

  // Dashboard UI
  app.get('/', (c) => {
    return c.html(getDashboardHTML());
  });

  // API routes
  app.route('/api/agents', createAgentsRouter(cwd));
  app.route('/api/tools', createToolsRouter(cwd));
  app.route('/api/workflows', createWorkflowsRouter(cwd));
  app.route('/api/sessions', createSessionsRouter(cwd));
  app.route('/api/logs', createLogsRouter(cwd));
  app.route('/api/rag', createRAGRouter(cwd));
  app.route('/api/providers', createProvidersRouter(cwd));
  app.route('/api/prompts', createPromptsRouter(cwd));
  app.route('/api/tests', createTestsRouter(cwd));
  app.route('/api/validate', createValidateRouter(cwd));
  app.route('/api/schedules', createSchedulesRouter(cwd));

  // Health check
  app.get('/api/health', (c) => {
    return c.json({ status: 'ok', cwd });
  });

  return app;
}
