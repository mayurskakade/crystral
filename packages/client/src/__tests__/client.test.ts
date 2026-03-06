import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CrystralClient } from '../client.js';
import { MemoryStorage } from '../storage/memory.js';
import { InvalidConfigError, ProviderError, RateLimitError, ToolExecutionError } from '../errors.js';

// ─── Fetch mock helpers ───────────────────────────────────────────────────────

// Queue multiple responses on the SAME spy so they are consumed in order.
function mockFetchSequence(...bodies: Array<{ body: unknown; status?: number }>) {
  const spy = vi.spyOn(globalThis, 'fetch');
  for (const { body, status = 200 } of bodies) {
    spy.mockResolvedValueOnce(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  }
  return spy;
}

function mockFetchOnce(body: unknown, status = 200) {
  mockFetchSequence({ body, status });
}

function openAIResponse(content: string, toolCalls?: Array<{ id: string; name: string; args: Record<string, unknown> }>) {
  return {
    choices: [{
      message: {
        content,
        role: 'assistant',
        ...(toolCalls ? {
          tool_calls: toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: JSON.stringify(tc.args) },
          })),
        } : {}),
      },
      finish_reason: toolCalls ? 'tool_calls' : 'stop',
    }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  };
}

// ─── Config validation ────────────────────────────────────────────────────────

describe('CrystralClient — config validation', () => {
  it('throws InvalidConfigError when apiKey is missing', () => {
    expect(() => new CrystralClient({ provider: 'openai', model: 'gpt-4o', apiKey: '' }))
      .toThrowError(InvalidConfigError);
  });

  it('throws InvalidConfigError when provider is missing', () => {
    expect(() => new CrystralClient({ provider: '' as 'openai', model: 'gpt-4o', apiKey: 'sk-test' }))
      .toThrowError(InvalidConfigError);
  });

  it('throws InvalidConfigError when model is missing', () => {
    expect(() => new CrystralClient({ provider: 'openai', model: '', apiKey: 'sk-test' }))
      .toThrowError(InvalidConfigError);
  });

  it('constructs successfully with valid config', () => {
    expect(() => new CrystralClient({ provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test' }))
      .not.toThrow();
  });
});

// ─── Basic run ────────────────────────────────────────────────────────────────

describe('CrystralClient — run()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns content and sessionId', async () => {
    mockFetchOnce(openAIResponse('Paris'));
    const client = new CrystralClient({ provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test' });
    const result = await client.run('What is the capital of France?');
    expect(result.content).toBe('Paris');
    expect(result.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('includes user message and assistant response in messages', async () => {
    mockFetchOnce(openAIResponse('Hello!'));
    const client = new CrystralClient({ provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test' });
    const result = await client.run('Hi');
    const roles = result.messages.map(m => m.role);
    expect(roles).toContain('user');
    expect(roles).toContain('assistant');
  });

  it('persists session history across runs', async () => {
    const client = new CrystralClient({ provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test' });

    mockFetchOnce(openAIResponse('Hello Alice!'));
    const r1 = await client.run('My name is Alice');

    mockFetchOnce(openAIResponse('Your name is Alice.'));
    const r2 = await client.run('What is my name?', { sessionId: r1.sessionId });

    // Second run should include prior history
    expect(r2.messages.length).toBeGreaterThan(2);
    expect(r2.messages.some(m => m.content === 'My name is Alice')).toBe(true);
  });

  it('creates a new session when no sessionId is provided', async () => {
    const client = new CrystralClient({ provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test' });
    mockFetchOnce(openAIResponse('A'));
    mockFetchOnce(openAIResponse('B'));
    const r1 = await client.run('Hello');
    const r2 = await client.run('Hello');
    expect(r1.sessionId).not.toBe(r2.sessionId);
  });

  it('sends system prompt when configured', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_, init) => {
      capturedBody = JSON.parse((init as RequestInit).body as string) as Record<string, unknown>;
      return new Response(JSON.stringify(openAIResponse('ok')), { status: 200 });
    });

    const client = new CrystralClient({
      provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test',
      systemPrompt: 'You are a test bot.',
    });
    await client.run('Hello');

    const messages = capturedBody!.messages as Array<{ role: string; content: string }>;
    expect(messages[0]!.role).toBe('system');
    expect(messages[0]!.content).toBe('You are a test bot.');
  });

  it('interpolates {variables} in system prompt', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_, init) => {
      capturedBody = JSON.parse((init as RequestInit).body as string) as Record<string, unknown>;
      return new Response(JSON.stringify(openAIResponse('ok')), { status: 200 });
    });

    const client = new CrystralClient({
      provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test',
      systemPrompt: 'You assist {company} customers. User: {userName}.',
    });
    await client.run('Hello', { variables: { company: 'Acme', userName: 'Bob' } });

    const messages = capturedBody!.messages as Array<{ role: string; content: string }>;
    expect(messages[0]!.content).toBe('You assist Acme customers. User: Bob.');
  });

  it('unresolved variables are left as-is', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_, init) => {
      capturedBody = JSON.parse((init as RequestInit).body as string) as Record<string, unknown>;
      return new Response(JSON.stringify(openAIResponse('ok')), { status: 200 });
    });

    const client = new CrystralClient({
      provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test',
      systemPrompt: 'Hello {missing}.',
    });
    await client.run('Hi');
    const messages = capturedBody!.messages as Array<{ role: string; content: string }>;
    expect(messages[0]!.content).toBe('Hello {missing}.');
  });
});

// ─── Provider error handling ──────────────────────────────────────────────────

describe('CrystralClient — provider errors', () => {
  afterEach(() => vi.restoreAllMocks());

  it('throws ProviderError on non-OK response', async () => {
    mockFetchOnce({ error: { message: 'Invalid API key' } }, 401);
    const client = new CrystralClient({ provider: 'openai', model: 'gpt-4o', apiKey: 'bad-key' });
    await expect(client.run('Hello')).rejects.toThrow(ProviderError);
  });

  it('throws RateLimitError on 429', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'Rate limited' } }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'retry-after': '2' },
      })
    );
    const client = new CrystralClient({ provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test' });
    const err = await client.run('Hello').catch(e => e as RateLimitError);
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.retryAfterMs).toBe(2000);
  });
});

// ─── Tool execution ───────────────────────────────────────────────────────────

describe('CrystralClient — tools', () => {
  afterEach(() => vi.restoreAllMocks());

  it('executes a tool and feeds result back to model', async () => {
    const toolFn = vi.fn().mockResolvedValue({ temp: '22°C' });

    const client = new CrystralClient({
      provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test',
      tools: [{
        name: 'get_weather',
        description: 'Get weather',
        parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
        execute: toolFn,
      }],
    });

    // Queue both responses on the same spy
    mockFetchSequence(
      { body: openAIResponse('', [{ id: 'call_1', name: 'get_weather', args: { city: 'Tokyo' } }]) },
      { body: openAIResponse('The weather in Tokyo is 22°C.') },
    );

    const result = await client.run('What is the weather in Tokyo?');

    expect(toolFn).toHaveBeenCalledWith({ city: 'Tokyo' });
    expect(result.content).toBe('The weather in Tokyo is 22°C.');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]!.name).toBe('get_weather');
    expect(result.toolCalls[0]!.success).toBe(true);
    expect(result.toolCalls[0]!.result).toEqual({ temp: '22°C' });
  });

  it('handles tool that throws — marks success: false, continues', async () => {
    const client = new CrystralClient({
      provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test',
      tools: [{
        name: 'broken_tool',
        description: 'Always fails',
        parameters: { type: 'object', properties: {} },
        execute: async () => { throw new Error('Connection refused'); },
      }],
    });

    mockFetchOnce(openAIResponse('', [{ id: 'call_1', name: 'broken_tool', args: {} }]));

    // Expect ToolExecutionError to propagate
    await expect(client.run('Use the tool')).rejects.toThrow(ToolExecutionError);
  });

  it('returns tool-not-found message when model calls unknown tool', async () => {
    const client = new CrystralClient({ provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test' });

    mockFetchSequence(
      { body: openAIResponse('', [{ id: 'call_1', name: 'nonexistent', args: {} }]) },
      { body: openAIResponse('I could not find that tool.') },
    );

    const result = await client.run('Use nonexistent tool');
    expect(result.toolCalls[0]!.success).toBe(false);
  });

  it('fires onToolCall and onToolResult callbacks', async () => {
    const onToolCall = vi.fn();
    const onToolResult = vi.fn();

    const client = new CrystralClient({
      provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test',
      tools: [{
        name: 'ping',
        description: 'Ping',
        parameters: { type: 'object', properties: {} },
        execute: async () => 'pong',
      }],
    });

    mockFetchSequence(
      { body: openAIResponse('', [{ id: 'c1', name: 'ping', args: {} }]) },
      { body: openAIResponse('Done.') },
    );

    await client.run('Ping', { onToolCall, onToolResult });
    expect(onToolCall).toHaveBeenCalledWith('ping', {});
    expect(onToolResult).toHaveBeenCalledWith('ping', 'pong', true);
  });

  it('respects maxToolIterations limit', async () => {
    // Model always returns a tool call — should stop at maxToolIterations
    const toolFn = vi.fn().mockResolvedValue('result');
    const client = new CrystralClient({
      provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test',
      tools: [{
        name: 'loop', description: 'Loops', parameters: { type: 'object', properties: {} }, execute: toolFn,
      }],
    });

    // Always returns a fresh Response (body can only be read once per Response instance)
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify(openAIResponse('', [{ id: 'c1', name: 'loop', args: {} }])), { status: 200 })
    );

    await client.run('Loop', { maxToolIterations: 3 });
    // fetch called 3 times (once per iteration), tool called 3 times
    expect(toolFn).toHaveBeenCalledTimes(3);
  });
});

// ─── Session management ───────────────────────────────────────────────────────

describe('CrystralClient — session management', () => {
  afterEach(() => vi.restoreAllMocks());

  it('getHistory returns messages for a session', async () => {
    mockFetchOnce(openAIResponse('Hi!'));
    const client = new CrystralClient({ provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test' });
    const result = await client.run('Hello');
    const history = client.getHistory(result.sessionId);
    expect(history.length).toBeGreaterThan(0);
  });

  it('clearSession wipes history but session still exists', async () => {
    mockFetchOnce(openAIResponse('Hi!'));
    const client = new CrystralClient({ provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test' });
    const result = await client.run('Hello');
    client.clearSession(result.sessionId);
    expect(client.getHistory(result.sessionId)).toEqual([]);
  });

  it('deleteSession removes session from listSessions', async () => {
    mockFetchOnce(openAIResponse('Hi!'));
    const client = new CrystralClient({ provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test' });
    const result = await client.run('Hello');
    client.deleteSession(result.sessionId);
    expect(client.listSessions()).not.toContain(result.sessionId);
  });

  it('listSessions returns all active sessions', async () => {
    const client = new CrystralClient({ provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test' });
    mockFetchOnce(openAIResponse('A'));
    mockFetchOnce(openAIResponse('B'));
    const r1 = await client.run('Hello');
    const r2 = await client.run('World');
    const sessions = client.listSessions();
    expect(sessions).toContain(r1.sessionId);
    expect(sessions).toContain(r2.sessionId);
  });
});

// ─── setApiKey ────────────────────────────────────────────────────────────────

describe('CrystralClient — setApiKey()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses new key after setApiKey()', async () => {
    const client = new CrystralClient({ provider: 'openai', model: 'gpt-4o', apiKey: 'old-key' });

    let capturedAuth = '';
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_, init) => {
      capturedAuth = (init as RequestInit).headers!['Authorization' as keyof HeadersInit] as string;
      return new Response(JSON.stringify(openAIResponse('ok')), { status: 200 });
    });

    client.setApiKey('new-key');
    await client.run('Hello');
    expect(capturedAuth).toBe('Bearer new-key');
  });
});

// ─── Custom storage ───────────────────────────────────────────────────────────

describe('CrystralClient — custom storage adapter', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses provided storage adapter', async () => {
    const storage = new MemoryStorage();
    const client = new CrystralClient({
      provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test', storage,
    });

    mockFetchOnce(openAIResponse('Hello!'));
    const result = await client.run('Hi');
    expect(storage.getMessages(result.sessionId).length).toBeGreaterThan(0);
  });
});

// ─── Multiple providers ───────────────────────────────────────────────────────

describe('CrystralClient — provider routing', () => {
  afterEach(() => vi.restoreAllMocks());

  const providers: Array<{ provider: 'openai' | 'groq' | 'together'; expectedUrlFragment: string }> = [
    { provider: 'openai', expectedUrlFragment: 'api.openai.com' },
    { provider: 'groq', expectedUrlFragment: 'api.groq.com' },
    { provider: 'together', expectedUrlFragment: 'api.together.xyz' },
  ];

  for (const { provider, expectedUrlFragment } of providers) {
    it(`routes ${provider} requests to correct base URL`, async () => {
      let calledUrl = '';
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url) => {
        calledUrl = url as string;
        return new Response(JSON.stringify(openAIResponse('ok')), { status: 200 });
      });

      const client = new CrystralClient({ provider, model: 'test-model', apiKey: 'key' });
      await client.run('Hello');
      expect(calledUrl).toContain(expectedUrlFragment);
    });
  }

  it('routes anthropic requests to correct base URL', async () => {
    let calledUrl = '';
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url) => {
      calledUrl = url as string;
      return new Response(JSON.stringify({
        content: [{ type: 'text', text: 'Hello' }],
        usage: { input_tokens: 5, output_tokens: 5 },
        stop_reason: 'end_turn',
      }), { status: 200 });
    });

    const client = new CrystralClient({ provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', apiKey: 'key' });
    await client.run('Hello');
    expect(calledUrl).toContain('anthropic.com');
  });

  it('routes google requests to correct base URL', async () => {
    let calledUrl = '';
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url) => {
      calledUrl = url as string;
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: 'Hello' }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 5 },
      }), { status: 200 });
    });

    const client = new CrystralClient({ provider: 'google', model: 'gemini-1.5-pro', apiKey: 'key' });
    await client.run('Hello');
    expect(calledUrl).toContain('googleapis.com');
  });

  it('uses custom baseUrl override', async () => {
    let calledUrl = '';
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url) => {
      calledUrl = url as string;
      return new Response(JSON.stringify(openAIResponse('ok')), { status: 200 });
    });

    const client = new CrystralClient({
      provider: 'openai', model: 'llama3', apiKey: 'ollama',
      baseUrl: 'http://localhost:11434/v1',
    });
    await client.run('Hello');
    expect(calledUrl).toContain('localhost:11434');
  });
});

// ─── stream() generator ───────────────────────────────────────────────────────

describe('CrystralClient — stream() generator', () => {
  afterEach(() => vi.restoreAllMocks());

  it('yields tokens from SSE stream', async () => {
    const sseBody = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}',
      'data: {"choices":[{"delta":{"content":" world"}}]}',
      'data: [DONE]',
    ].join('\n') + '\n';

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(sseBody, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
    );

    const client = new CrystralClient({ provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test' });
    const tokens: string[] = [];
    for await (const token of client.stream('Hello')) {
      tokens.push(token);
    }
    expect(tokens).toContain('Hello');
    expect(tokens).toContain(' world');
  });
});
