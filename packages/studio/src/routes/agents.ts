import * as fs from 'node:fs';
import * as path from 'node:path';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import {
  listAgents,
  listTools,
  loadAgentConfig,
  writeAgentConfig,
  findProjectRoot,
  createAgentRunner,
} from '@crystral/core';
import type {
  AgentConfig,
  AgentRunOptions,
  OutputConfig,
  RetryConfig,
  FallbackProvider,
  GuardrailsConfig,
  CapabilitiesConfig,
  CacheConfig,
  LoggingConfig,
} from '@crystral/core';

export function createAgentsRouter(cwd: string): Hono {
  const app = new Hono();

  // GET /api/agents — list all agents
  app.get('/', (c) => {
    try {
      const names = listAgents(cwd);
      const agents = names.map((name) => {
        try {
          const config = loadAgentConfig(name, cwd);
          return {
            name: config.name,
            provider: config.provider,
            model: config.model,
            description: config.description,
            tools: config.tools,
            has_rag: !!config.rag,
            mcp_servers: config.mcp.length,
            output: config.output,
            retry: config.retry,
            fallback: config.fallback,
            guardrails: config.guardrails,
            capabilities: config.capabilities,
            cache: config.cache,
            logging: config.logging,
            extends: config.extends,
          };
        } catch {
          return { name, error: 'Failed to load config' };
        }
      });
      return c.json(agents);
    } catch (e) {
      return c.json({ error: String(e) }, 500);
    }
  });

  // GET /api/agents/:name — get agent details
  app.get('/:name', (c) => {
    const name = c.req.param('name');
    try {
      const config = loadAgentConfig(name, cwd);
      return c.json(config);
    } catch (e) {
      return c.json({ error: String(e) }, 404);
    }
  });

  // POST /api/agents/:name/run — run agent (non-streaming)
  app.post('/:name/run', async (c) => {
    const name = c.req.param('name');
    try {
      const body = await c.req.json<{ message: string; sessionId?: string; variables?: Record<string, string> }>();
      const config = loadAgentConfig(name, cwd);
      const runner = createAgentRunner(config);

      const runOpts: AgentRunOptions = {
        cwd,
      };
      if (body.sessionId) {
        runOpts.sessionId = body.sessionId;
      }
      if (body.variables) {
        runOpts.variables = body.variables;
      }

      const result = await runner.run(body.message, runOpts);

      return c.json({
        content: result.content,
        sessionId: result.sessionId,
        toolCalls: result.toolCalls.map((tc) => ({
          name: tc.name,
          args: tc.args,
          result: tc.result,
        })),
        usage: result.usage,
        durationMs: result.durationMs,
      });
    } catch (e) {
      return c.json({ error: String(e) }, 500);
    }
  });

  // POST /api/agents/:name/stream — run agent with SSE streaming
  app.post('/:name/stream', async (c) => {
    const name = c.req.param('name');
    try {
      const body = await c.req.json<{ message: string; sessionId?: string; variables?: Record<string, string> }>();
      const config = loadAgentConfig(name, cwd);
      const runner = createAgentRunner(config);

      return streamSSE(c, async (stream) => {
        const runOpts: AgentRunOptions = {
          cwd,
          stream: true,
          onToken: async (token: string) => {
            await stream.writeSSE({
              event: 'chunk',
              data: JSON.stringify({ type: 'chunk', content: token }),
            });
          },
          onToolCall: async (toolName: string, args: Record<string, unknown>) => {
            await stream.writeSSE({
              event: 'tool_call',
              data: JSON.stringify({ type: 'tool_call', name: toolName, args }),
            });
          },
          onToolResult: async (toolName: string, result) => {
            await stream.writeSSE({
              event: 'tool_result',
              data: JSON.stringify({ type: 'tool_result', name: toolName, result }),
            });
          },
        };
        if (body.sessionId) {
          runOpts.sessionId = body.sessionId;
        }
        if (body.variables) {
          runOpts.variables = body.variables;
        }

        const result = await runner.run(body.message, runOpts);

        await stream.writeSSE({
          event: 'done',
          data: JSON.stringify({
            type: 'done',
            content: result.content,
            sessionId: result.sessionId,
            usage: result.usage,
            durationMs: result.durationMs,
          }),
        });
      });
    } catch (e) {
      return c.json({ error: String(e) }, 500);
    }
  });

  // GET /api/agents/meta/tools — list available tools for agent form
  app.get('/meta/tools', (c) => {
    try {
      const tools = listTools(cwd);
      return c.json(tools);
    } catch (e) {
      return c.json({ error: String(e) }, 500);
    }
  });

  // POST /api/agents — create a new agent
  app.post('/', async (c) => {
    try {
      const body = await c.req.json<{
        name: string;
        provider: string;
        model: string;
        description?: string;
        system_prompt?: string;
        temperature?: number;
        max_tokens?: number;
        tools?: string[];
        output?: OutputConfig;
        retry?: RetryConfig;
        fallback?: FallbackProvider;
        guardrails?: GuardrailsConfig;
        capabilities?: CapabilitiesConfig;
        cache?: CacheConfig;
        logging?: LoggingConfig;
        extends?: string;
      }>();

      // Validate name format
      if (!body.name || !/^[a-zA-Z0-9_-]+$/.test(body.name) || body.name.length > 64) {
        return c.json({ error: 'Invalid agent name. Must be 1-64 chars, alphanumeric, hyphens, underscores.' }, 400);
      }

      // Check if agent already exists
      const existing = listAgents(cwd);
      if (existing.includes(body.name)) {
        return c.json({ error: `Agent '${body.name}' already exists.` }, 409);
      }

      // Build config incrementally (exactOptionalPropertyTypes)
      const config: AgentConfig = {
        version: 1,
        name: body.name,
        provider: body.provider as AgentConfig['provider'],
        model: body.model,
        system_prompt: body.system_prompt ?? '',
        temperature: body.temperature ?? 1.0,
        max_tokens: body.max_tokens ?? 4096,
        top_p: 1.0,
        presence_penalty: 0.0,
        frequency_penalty: 0.0,
        tools: body.tools ?? [],
        mcp: [],
      };
      if (body.description) {
        config.description = body.description;
      }
      if (body.output) {
        config.output = body.output;
      }
      if (body.retry) {
        config.retry = body.retry;
      }
      if (body.fallback) {
        config.fallback = body.fallback;
      }
      if (body.guardrails) {
        config.guardrails = body.guardrails;
      }
      if (body.capabilities) {
        config.capabilities = body.capabilities;
      }
      if (body.cache) {
        config.cache = body.cache;
      }
      if (body.logging) {
        config.logging = body.logging;
      }
      if (body.extends) {
        config.extends = body.extends;
      }

      writeAgentConfig(config, cwd);
      return c.json(config, 201);
    } catch (e) {
      return c.json({ error: String(e) }, 500);
    }
  });

  // PUT /api/agents/:name — update an existing agent
  app.put('/:name', async (c) => {
    const name = c.req.param('name');
    try {
      const existing = loadAgentConfig(name, cwd);
      const body = await c.req.json<{
        provider?: string;
        model?: string;
        description?: string;
        system_prompt?: string;
        temperature?: number;
        max_tokens?: number;
        tools?: string[];
        output?: OutputConfig;
        retry?: RetryConfig;
        fallback?: FallbackProvider;
        guardrails?: GuardrailsConfig;
        capabilities?: CapabilitiesConfig;
        cache?: CacheConfig;
        logging?: LoggingConfig;
        extends?: string;
      }>();

      // Merge fields
      if (body.provider !== undefined) existing.provider = body.provider as AgentConfig['provider'];
      if (body.model !== undefined) existing.model = body.model;
      if (body.description !== undefined) existing.description = body.description;
      if (body.system_prompt !== undefined) existing.system_prompt = body.system_prompt;
      if (body.temperature !== undefined) existing.temperature = body.temperature;
      if (body.max_tokens !== undefined) existing.max_tokens = body.max_tokens;
      if (body.tools !== undefined) existing.tools = body.tools;
      if (body.output !== undefined) existing.output = body.output;
      if (body.retry !== undefined) existing.retry = body.retry;
      if (body.fallback !== undefined) existing.fallback = body.fallback;
      if (body.guardrails !== undefined) existing.guardrails = body.guardrails;
      if (body.capabilities !== undefined) existing.capabilities = body.capabilities;
      if (body.cache !== undefined) existing.cache = body.cache;
      if (body.logging !== undefined) existing.logging = body.logging;
      if (body.extends !== undefined) existing.extends = body.extends;

      writeAgentConfig(existing, cwd);
      return c.json(existing);
    } catch (e) {
      const status = String(e).includes('not found') ? 404 : 500;
      return c.json({ error: String(e) }, status);
    }
  });

  // DELETE /api/agents/:name — delete an agent
  app.delete('/:name', (c) => {
    const name = c.req.param('name');
    try {
      const root = findProjectRoot(cwd);
      const agentsDir = root ? path.join(root, 'agents') : path.join(cwd, 'agents');
      const yamlPath = path.join(agentsDir, `${name}.yaml`);
      const ymlPath = path.join(agentsDir, `${name}.yml`);

      if (fs.existsSync(yamlPath)) {
        fs.unlinkSync(yamlPath);
      } else if (fs.existsSync(ymlPath)) {
        fs.unlinkSync(ymlPath);
      } else {
        return c.json({ error: `Agent '${name}' not found.` }, 404);
      }

      return c.json({ deleted: true });
    } catch (e) {
      return c.json({ error: String(e) }, 500);
    }
  });

  return app;
}
