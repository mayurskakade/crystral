import { describe, it, expect } from 'vitest';
import {
  AgentConfigSchema,
  ProjectConfigSchema,
  WorkflowConfigSchema,
  CacheConfigSchema,
  RetryConfigSchema,
  GuardrailsConfigSchema,
  OutputConfigSchema,
  LoggingConfigSchema,
} from '../types/config.ts';
import { execute, result, assert, pass } from './helpers/test-logger.ts';

// ---------------------------------------------------------------------------
// 16.1 AgentConfigSchema
// ---------------------------------------------------------------------------

describe('16.1 AgentConfigSchema', () => {
  const validAgent = {
    version: 1 as const,
    name: 'my-agent',
    provider: 'openai' as const,
    model: 'gpt-4o',
    system_prompt: 'You are helpful.',
  };

  it('16.1.1 valid agent config parses successfully', () => {
    execute('AgentConfigSchema.parse(validAgent)');
    const r = AgentConfigSchema.parse(validAgent);
    result({ name: r.name });
    assert('r.name === "my-agent"');
    expect(r.name).toBe('my-agent');
    pass('16.1.1');
  });

  it('16.1.2 invalid provider throws ZodError', () => {
    execute('AgentConfigSchema.parse with invalid provider');
    assert('throws ZodError');
    expect(() => AgentConfigSchema.parse({ ...validAgent, provider: 'invalid' })).toThrow();
    pass('16.1.2');
  });

  it('16.1.3 temperature defaults to 1.0', () => {
    execute('AgentConfigSchema.parse without temperature → defaults to 1.0');
    const r = AgentConfigSchema.parse(validAgent);
    result({ temperature: r.temperature });
    assert('r.temperature === 1.0');
    expect(r.temperature).toBe(1.0);
    pass('16.1.3');
  });

  it('16.1.4 max_tokens defaults to 4096', () => {
    execute('AgentConfigSchema.parse without max_tokens → defaults to 4096');
    const r = AgentConfigSchema.parse(validAgent);
    result({ max_tokens: r.max_tokens });
    assert('r.max_tokens === 4096');
    expect(r.max_tokens).toBe(4096);
    pass('16.1.4');
  });

  it('16.1.5 tools defaults to empty array', () => {
    execute('AgentConfigSchema.parse without tools → defaults to []');
    const r = AgentConfigSchema.parse(validAgent);
    result({ tools: r.tools });
    assert('r.tools is empty array');
    expect(r.tools).toEqual([]);
    pass('16.1.5');
  });

  it('16.1.6 name with invalid characters throws', () => {
    execute('AgentConfigSchema.parse with name containing spaces');
    assert('throws ZodError');
    expect(() => AgentConfigSchema.parse({ ...validAgent, name: 'my agent' })).toThrow();
    pass('16.1.6');
  });

  it('16.1.7 all five providers are accepted', () => {
    execute('AgentConfigSchema.parse with each provider');
    const providers = ['openai', 'anthropic', 'groq', 'google', 'together'] as const;
    for (const provider of providers) {
      const r = AgentConfigSchema.parse({ ...validAgent, provider });
      expect(r.provider).toBe(provider);
    }
    pass('16.1.7');
  });
});

// ---------------------------------------------------------------------------
// 16.2 ProjectConfigSchema
// ---------------------------------------------------------------------------

describe('16.2 ProjectConfigSchema', () => {
  const validProject = {
    version: 1 as const,
    project: 'my-project',
  };

  it('16.2.1 valid project config parses successfully', () => {
    execute('ProjectConfigSchema.parse(validProject)');
    const r = ProjectConfigSchema.parse(validProject);
    result({ project: r.project });
    assert('r.project === "my-project"');
    expect(r.project).toBe('my-project');
    pass('16.2.1');
  });

  it('16.2.2 version must be 1', () => {
    execute('ProjectConfigSchema.parse with version: 2');
    assert('throws ZodError');
    expect(() => ProjectConfigSchema.parse({ ...validProject, version: 2 })).toThrow();
    pass('16.2.2');
  });

  it('16.2.3 project name with spaces throws', () => {
    execute('ProjectConfigSchema.parse with project: "my project"');
    assert('throws ZodError');
    expect(() => ProjectConfigSchema.parse({ ...validProject, project: 'my project' })).toThrow();
    pass('16.2.3');
  });

  it('16.2.4 profiles field is optional', () => {
    execute('ProjectConfigSchema.parse without profiles');
    const r = ProjectConfigSchema.parse(validProject);
    result({ profiles: r.profiles });
    assert('r.profiles === undefined');
    expect(r.profiles).toBeUndefined();
    pass('16.2.4');
  });

  it('16.2.5 studio port must be within valid range', () => {
    execute('ProjectConfigSchema.parse with studio.port: 1');
    assert('throws for port < 1024');
    expect(() =>
      ProjectConfigSchema.parse({ ...validProject, studio: { port: 1, open_browser: true, host: 'localhost' } }),
    ).toThrow();
    pass('16.2.5');
  });

  it('16.2.6 valid project with profiles and cache parses', () => {
    execute('ProjectConfigSchema.parse with profiles + cache');
    const r = ProjectConfigSchema.parse({
      ...validProject,
      cache: { enabled: true, ttl: 600 },
      profiles: {
        prod: { default_provider: 'openai', default_model: 'gpt-4o' },
      },
    });
    result({ hasCacheEnabled: r.cache?.enabled });
    assert('r.cache.enabled === true');
    expect(r.cache?.enabled).toBe(true);
    pass('16.2.6');
  });
});

// ---------------------------------------------------------------------------
// 16.3 WorkflowConfigSchema
// ---------------------------------------------------------------------------

describe('16.3 WorkflowConfigSchema', () => {
  const validWorkflow = {
    version: 1 as const,
    name: 'my-workflow',
    orchestrator: {
      provider: 'openai' as const,
      model: 'gpt-4o',
    },
    agents: [
      {
        name: 'step1',
        agent: 'my-agent',
        description: 'First step',
      },
    ],
  };

  it('16.3.1 valid workflow config parses successfully', () => {
    execute('WorkflowConfigSchema.parse(validWorkflow)');
    const r = WorkflowConfigSchema.parse(validWorkflow);
    result({ name: r.name });
    assert('r.name === "my-workflow"');
    expect(r.name).toBe('my-workflow');
    pass('16.3.1');
  });

  it('16.3.2 agents array must have at least one entry', () => {
    execute('WorkflowConfigSchema.parse with empty agents array');
    assert('throws ZodError');
    expect(() => WorkflowConfigSchema.parse({ ...validWorkflow, agents: [] })).toThrow();
    pass('16.3.2');
  });

  it('16.3.3 orchestrator strategy defaults to "auto"', () => {
    execute('WorkflowConfigSchema.parse without strategy → defaults to "auto"');
    const r = WorkflowConfigSchema.parse(validWorkflow);
    result({ strategy: r.orchestrator.strategy });
    assert('r.orchestrator.strategy === "auto"');
    expect(r.orchestrator.strategy).toBe('auto');
    pass('16.3.3');
  });

  it('16.3.4 max_iterations defaults to 20', () => {
    execute('WorkflowConfigSchema.parse → orchestrator.max_iterations === 20');
    const r = WorkflowConfigSchema.parse(validWorkflow);
    result({ max_iterations: r.orchestrator.max_iterations });
    assert('r.orchestrator.max_iterations === 20');
    expect(r.orchestrator.max_iterations).toBe(20);
    pass('16.3.4');
  });

  it('16.3.5 context defaults applied', () => {
    execute('WorkflowConfigSchema.parse → context.shared_memory === false');
    const r = WorkflowConfigSchema.parse(validWorkflow);
    result({ shared_memory: r.context.shared_memory });
    assert('r.context.shared_memory === false');
    expect(r.context.shared_memory).toBe(false);
    pass('16.3.5');
  });
});

// ---------------------------------------------------------------------------
// 16.4 Nested schemas
// ---------------------------------------------------------------------------

describe('16.4 Nested schemas', () => {
  it('16.4.1 CacheConfigSchema defaults enabled=false', () => {
    execute('CacheConfigSchema.parse({})');
    const r = CacheConfigSchema.parse({});
    result(r);
    assert('r.enabled === false');
    expect(r.enabled).toBe(false);
    pass('16.4.1');
  });

  it('16.4.2 CacheConfigSchema ttl defaults to 3600', () => {
    execute('CacheConfigSchema.parse({}) → ttl === 3600');
    const r = CacheConfigSchema.parse({});
    result({ ttl: r.ttl });
    assert('r.ttl === 3600');
    expect(r.ttl).toBe(3600);
    pass('16.4.2');
  });

  it('16.4.3 RetryConfigSchema defaults max_attempts=3', () => {
    execute('RetryConfigSchema.parse({}) → max_attempts === 3');
    const r = RetryConfigSchema.parse({});
    result({ max_attempts: r.max_attempts });
    assert('r.max_attempts === 3');
    expect(r.max_attempts).toBe(3);
    pass('16.4.3');
  });

  it('16.4.4 RetryConfigSchema backoff defaults to "exponential"', () => {
    execute('RetryConfigSchema.parse({}) → backoff === "exponential"');
    const r = RetryConfigSchema.parse({});
    result({ backoff: r.backoff });
    assert('r.backoff === "exponential"');
    expect(r.backoff).toBe('exponential');
    pass('16.4.4');
  });

  it('16.4.5 GuardrailsConfigSchema accepts input and output', () => {
    execute('GuardrailsConfigSchema.parse with input and output');
    const r = GuardrailsConfigSchema.parse({
      input: { max_length: 100, pii_action: 'block' },
      output: { max_length: 200, pii_action: 'none' },
    });
    result({ inputMaxLen: r.input?.max_length, outputMaxLen: r.output?.max_length });
    assert('r.input.max_length === 100 && r.output.max_length === 200');
    expect(r.input?.max_length).toBe(100);
    expect(r.output?.max_length).toBe(200);
    pass('16.4.5');
  });

  it('16.4.6 OutputConfigSchema defaults format to "text"', () => {
    execute('OutputConfigSchema.parse({}) → format === "text"');
    const r = OutputConfigSchema.parse({});
    result({ format: r.format });
    assert('r.format === "text"');
    expect(r.format).toBe('text');
    pass('16.4.6');
  });

  it('16.4.7 LoggingConfigSchema defaults level to "info"', () => {
    execute('LoggingConfigSchema.parse({}) → level === "info"');
    const r = LoggingConfigSchema.parse({});
    result({ level: r.level });
    assert('r.level === "info"');
    expect(r.level).toBe('info');
    pass('16.4.7');
  });
});
