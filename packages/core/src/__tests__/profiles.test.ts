import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getActiveProfile, applyProfile } from '../profiles/index.ts';
import type { AgentConfig, ProjectConfig } from '../types/index.ts';
import { execute, result, assert, pass } from './helpers/test-logger.ts';

function baseAgent(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    version: 1,
    name: 'test-agent',
    provider: 'openai',
    model: 'gpt-4o',
    system_prompt: 'You are a helper.',
    temperature: 1.0,
    max_tokens: 4096,
    top_p: 1.0,
    presence_penalty: 0,
    frequency_penalty: 0,
    tools: [],
    mcp: [],
    ...overrides,
  };
}

function baseProject(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    version: 1,
    project: 'test-project',
    ...overrides,
  };
}

describe('9.1 getActiveProfile', () => {
  beforeEach(() => { delete process.env['CRYSTRAL_PROFILE']; });
  afterEach(() => { delete process.env['CRYSTRAL_PROFILE']; });

  it('9.1.1 returns explicit profile name', () => {
    execute("getActiveProfile(project, 'production')");
    const r = getActiveProfile(baseProject(), 'production');
    result(r);
    assert('r === "production"');
    expect(r).toBe('production');
    pass('9.1.1');
  });

  it('9.1.2 returns env CRYSTRAL_PROFILE when no explicit name', () => {
    execute('CRYSTRAL_PROFILE=staging, getActiveProfile(project)');
    process.env['CRYSTRAL_PROFILE'] = 'staging';
    const r = getActiveProfile(baseProject());
    result(r);
    assert('r === "staging"');
    expect(r).toBe('staging');
    pass('9.1.2');
  });

  it('9.1.3 returns undefined when no env and no explicit name', () => {
    execute('getActiveProfile(project) with no env set');
    const r = getActiveProfile(baseProject());
    result(r);
    assert('r === undefined');
    expect(r).toBeUndefined();
    pass('9.1.3');
  });
});

describe('9.2 applyProfile', () => {
  beforeEach(() => { delete process.env['CRYSTRAL_PROFILE']; });
  afterEach(() => { delete process.env['CRYSTRAL_PROFILE']; });

  it('9.2.1 applies cache from profile when agent has none', () => {
    execute('applyProfile(agent, project with cache profile)');
    const project = baseProject({
      profiles: {
        dev: { cache: { enabled: true, ttl: 60 } },
      },
    });
    const agent = baseAgent();
    const r = applyProfile(agent, project, 'dev');
    result({ cache: r.cache });
    assert('r.cache.enabled === true');
    expect(r.cache?.enabled).toBe(true);
    pass('9.2.1');
  });

  it('9.2.2 applies logging from profile when agent has none', () => {
    execute('applyProfile(agent, project with logging profile)');
    const project = baseProject({
      profiles: {
        dev: { logging: { level: 'debug', trace: true, export: 'stdout' } },
      },
    });
    const agent = baseAgent();
    const r = applyProfile(agent, project, 'dev');
    result({ level: r.logging?.level });
    assert('r.logging.level === "debug"');
    expect(r.logging?.level).toBe('debug');
    pass('9.2.2');
  });

  it('9.2.3 profile not found — returns agent unchanged', () => {
    execute('applyProfile with non-existent profile name');
    const project = baseProject();
    const agent = baseAgent();
    const r = applyProfile(agent, project, 'nonexistent');
    result({ name: r.name });
    assert('r === original agent');
    expect(r).toEqual(agent);
    pass('9.2.3');
  });

  it('9.2.4 no profiles in project — returns agent unchanged', () => {
    execute('applyProfile with project that has no profiles');
    const project = baseProject();
    const agent = baseAgent();
    const r = applyProfile(agent, project, 'dev');
    result({ name: r.name });
    assert('r === original agent');
    expect(r).toEqual(agent);
    pass('9.2.4');
  });

  it('9.2.5 no profile name and no env — returns agent unchanged', () => {
    execute('applyProfile with no profile name and no CRYSTRAL_PROFILE env');
    const project = baseProject({
      profiles: { dev: { cache: { enabled: true, ttl: 60 } } },
    });
    const agent = baseAgent();
    const r = applyProfile(agent, project);
    result({ cache: r.cache });
    assert('r.cache === undefined (no profile active)');
    expect(r.cache).toBeUndefined();
    pass('9.2.5');
  });
});

describe('9.3 agent overrides profile', () => {
  beforeEach(() => { delete process.env['CRYSTRAL_PROFILE']; });
  afterEach(() => { delete process.env['CRYSTRAL_PROFILE']; });

  it('9.3.1 agent cache overrides profile cache', () => {
    execute('agent has cache={enabled:false}, profile has cache={enabled:true}');
    const project = baseProject({
      profiles: { prod: { cache: { enabled: true, ttl: 3600 } } },
    });
    const agent = baseAgent({ cache: { enabled: false, ttl: 0 } });
    const r = applyProfile(agent, project, 'prod');
    result({ cache: r.cache });
    assert('r.cache.enabled === false (agent wins)');
    expect(r.cache?.enabled).toBe(false);
    pass('9.3.1');
  });

  it('9.3.2 agent logging overrides profile logging', () => {
    execute('agent has logging=error, profile has logging=debug');
    const project = baseProject({
      profiles: { prod: { logging: { level: 'debug', trace: false, export: 'stdout' } } },
    });
    const agent = baseAgent({ logging: { level: 'error', trace: false, export: 'stdout' } });
    const r = applyProfile(agent, project, 'prod');
    result({ level: r.logging?.level });
    assert('r.logging.level === "error" (agent wins)');
    expect(r.logging?.level).toBe('error');
    pass('9.3.2');
  });

  it('9.3.3 agent guardrails override profile guardrails', () => {
    execute('agent has guardrails, profile also has guardrails — agent wins');
    const project = baseProject({
      profiles: {
        prod: {
          guardrails: {
            input: { max_length: 100, pii_action: 'none' },
          },
        },
      },
    });
    const agent = baseAgent({
      guardrails: {
        input: { max_length: 500, pii_action: 'block' },
      },
    });
    const r = applyProfile(agent, project, 'prod');
    result({ maxLength: r.guardrails?.input?.max_length });
    assert('r.guardrails.input.max_length === 500 (agent wins)');
    expect(r.guardrails?.input?.max_length).toBe(500);
    pass('9.3.3');
  });
});
