import { describe, it, expect } from 'vitest';
import { dryRun } from '../testing/dry-run.ts';
import { createTempProject, writeProjectConfig, writeAgent, writeYaml, writePrompt } from './helpers/fixtures.ts';
import { execute, result, assert, pass } from './helpers/test-logger.ts';

describe('8.4 dryRun resolves config', () => {
  it('8.4.1 dryRun returns agent name', () => {
    const tmp = createTempProject();
    try {
      execute('dryRun("my-agent", tmp.dir)');
      writeProjectConfig(tmp.dir);
      writeAgent(tmp.dir, 'my-agent', { system_prompt: 'You are helpful.' });
      const r = dryRun('my-agent', tmp.dir);
      result({ agent: r.agent });
      assert('r.agent === "my-agent"');
      expect(r.agent).toBe('my-agent');
      pass('8.4.1');
    } finally {
      tmp.cleanup();
    }
  });

  it('8.4.2 dryRun returns resolvedConfig with provider', () => {
    const tmp = createTempProject();
    try {
      execute('dryRun("my-agent") → resolvedConfig.provider');
      writeProjectConfig(tmp.dir);
      writeAgent(tmp.dir, 'my-agent', { system_prompt: 'test' });
      const r = dryRun('my-agent', tmp.dir);
      result({ provider: r.resolvedConfig.provider });
      assert('r.resolvedConfig.provider === "openai"');
      expect(r.resolvedConfig.provider).toBe('openai');
      pass('8.4.2');
    } finally {
      tmp.cleanup();
    }
  });

  it('8.4.3 dryRun returns systemPrompt string', () => {
    const tmp = createTempProject();
    try {
      execute('dryRun("my-agent") → systemPrompt is a string');
      writeProjectConfig(tmp.dir);
      writeAgent(tmp.dir, 'my-agent', { system_prompt: 'You are a test agent.' });
      const r = dryRun('my-agent', tmp.dir);
      result({ systemPrompt: r.systemPrompt });
      assert('r.systemPrompt === "You are a test agent."');
      expect(r.systemPrompt).toBe('You are a test agent.');
      pass('8.4.3');
    } finally {
      tmp.cleanup();
    }
  });

  it('8.4.4 dryRun returns tools list', () => {
    const tmp = createTempProject();
    try {
      execute('dryRun("agent-with-tools") → r.tools includes tool names');
      writeProjectConfig(tmp.dir);
      writeAgent(tmp.dir, 'agent-with-tools', {
        system_prompt: 'test',
        tools: ['search', 'calculator'],
      });
      const r = dryRun('agent-with-tools', tmp.dir);
      result({ tools: r.tools });
      assert('r.tools === ["search", "calculator"]');
      expect(r.tools).toEqual(['search', 'calculator']);
      pass('8.4.4');
    } finally {
      tmp.cleanup();
    }
  });

  it('8.4.5 dryRun with prompt template resolves systemPrompt', () => {
    const tmp = createTempProject();
    try {
      execute('dryRun with template system_prompt → resolves to string');
      writeProjectConfig(tmp.dir);
      writePrompt(tmp.dir, 'greeting', {
        template: 'Hello, {name}!',
        defaults: { name: 'World' },
      });
      writeYaml(tmp.dir, 'agents/tmpl-agent.yaml', {
        version: 1,
        name: 'tmpl-agent',
        provider: 'openai',
        model: 'gpt-4o',
        system_prompt: { template: 'greeting' },
      });
      const r = dryRun('tmpl-agent', tmp.dir);
      result({ systemPrompt: r.systemPrompt });
      assert('r.systemPrompt === "Hello, World!"');
      expect(r.systemPrompt).toBe('Hello, World!');
      pass('8.4.5');
    } finally {
      tmp.cleanup();
    }
  });
});

describe('8.5 dryRun error cases', () => {
  it('8.5.1 dryRun throws when agent not found', () => {
    const tmp = createTempProject();
    try {
      execute('dryRun("nonexistent", tmp.dir) should throw');
      writeProjectConfig(tmp.dir);
      assert('throws AgentNotFoundError');
      expect(() => dryRun('nonexistent', tmp.dir)).toThrow();
      pass('8.5.1');
    } finally {
      tmp.cleanup();
    }
  });

  it('8.5.2 dryRun on agent with empty system_prompt adds warning', () => {
    const tmp = createTempProject();
    try {
      execute('dryRun on agent with empty system_prompt → r.warnings includes empty prompt warning');
      writeProjectConfig(tmp.dir);
      writeAgent(tmp.dir, 'empty-prompt-agent', { system_prompt: '' });
      const r = dryRun('empty-prompt-agent', tmp.dir);
      result({ warnings: r.warnings });
      assert('r.warnings includes empty system prompt warning');
      expect(r.warnings.some(w => w.toLowerCase().includes('system prompt') || w.toLowerCase().includes('empty'))).toBe(true);
      pass('8.5.2');
    } finally {
      tmp.cleanup();
    }
  });

  it('8.5.3 dryRun on agent with no tools adds warning', () => {
    const tmp = createTempProject();
    try {
      execute('dryRun on agent with no tools → r.warnings includes no-tools warning');
      writeProjectConfig(tmp.dir);
      writeAgent(tmp.dir, 'no-tools-agent', { system_prompt: 'test', tools: [] });
      const r = dryRun('no-tools-agent', tmp.dir);
      result({ warnings: r.warnings });
      assert('r.warnings includes "no tools" warning');
      expect(r.warnings.some(w => w.toLowerCase().includes('tool'))).toBe(true);
      pass('8.5.3');
    } finally {
      tmp.cleanup();
    }
  });
});
