import { describe, it, expect } from 'vitest';
import { validateProject } from '../validation/index.ts';
import { createTempProject, writeProjectConfig, writeAgent, writeYaml } from './helpers/fixtures.ts';
import { execute, result, assert, pass } from './helpers/test-logger.ts';

describe('10.1 valid config files pass validation', () => {
  it('10.1.1 valid project config passes', () => {
    const tmp = createTempProject();
    try {
      execute('writeProjectConfig + validateProject');
      writeProjectConfig(tmp.dir);
      const r = validateProject(tmp.dir);
      result({ valid: r.valid, errors: r.errors });
      assert('r.errors === 0 && r.valid === 1');
      expect(r.errors).toBe(0);
      expect(r.valid).toBeGreaterThanOrEqual(1);
      pass('10.1.1');
    } finally {
      tmp.cleanup();
    }
  });

  it('10.1.2 valid agent config passes', () => {
    const tmp = createTempProject();
    try {
      execute('writeProjectConfig + writeAgent + validateProject');
      writeProjectConfig(tmp.dir);
      writeAgent(tmp.dir, 'my-agent');
      const r = validateProject(tmp.dir);
      result({ valid: r.valid, errors: r.errors });
      assert('r.errors === 0');
      expect(r.errors).toBe(0);
      pass('10.1.2');
    } finally {
      tmp.cleanup();
    }
  });

  it('10.1.3 multiple valid files all pass', () => {
    const tmp = createTempProject();
    try {
      execute('writeProjectConfig + two agents + validateProject');
      writeProjectConfig(tmp.dir);
      writeAgent(tmp.dir, 'agent-one');
      writeAgent(tmp.dir, 'agent-two');
      const r = validateProject(tmp.dir);
      result({ valid: r.valid, errors: r.errors });
      assert('r.errors === 0 && r.valid >= 3');
      expect(r.errors).toBe(0);
      expect(r.valid).toBeGreaterThanOrEqual(3);
      pass('10.1.3');
    } finally {
      tmp.cleanup();
    }
  });

  it('10.1.4 no config files returns empty result', () => {
    const tmp = createTempProject();
    try {
      execute('validateProject on empty directory');
      const r = validateProject(tmp.dir);
      result({ files: r.files.length });
      assert('r.files.length === 0');
      expect(r.files.length).toBe(0);
      pass('10.1.4');
    } finally {
      tmp.cleanup();
    }
  });

  it('10.1.5 valid files counted correctly in .valid', () => {
    const tmp = createTempProject();
    try {
      execute('one valid project config → r.valid === 1');
      writeProjectConfig(tmp.dir);
      const r = validateProject(tmp.dir);
      result({ valid: r.valid });
      assert('r.valid === 1');
      expect(r.valid).toBe(1);
      pass('10.1.5');
    } finally {
      tmp.cleanup();
    }
  });
});

describe('10.2 invalid config files fail validation', () => {
  it('10.2.1 agent missing required provider field', () => {
    const tmp = createTempProject();
    try {
      execute('agent YAML missing provider → validation error');
      writeProjectConfig(tmp.dir);
      writeYaml(tmp.dir, 'agents/bad-agent.yaml', {
        version: 1,
        name: 'bad-agent',
        // missing provider and model
        system_prompt: 'test',
      });
      const r = validateProject(tmp.dir);
      result({ errors: r.errors });
      assert('r.errors >= 1');
      expect(r.errors).toBeGreaterThanOrEqual(1);
      pass('10.2.1');
    } finally {
      tmp.cleanup();
    }
  });

  it('10.2.2 agent with invalid provider value', () => {
    const tmp = createTempProject();
    try {
      execute('agent with provider: "invalid-provider" → validation error');
      writeProjectConfig(tmp.dir);
      writeYaml(tmp.dir, 'agents/bad-provider.yaml', {
        version: 1,
        name: 'bad-provider',
        provider: 'invalid-provider',
        model: 'gpt-4',
      });
      const r = validateProject(tmp.dir);
      result({ errors: r.errors });
      assert('r.errors >= 1');
      expect(r.errors).toBeGreaterThanOrEqual(1);
      pass('10.2.2');
    } finally {
      tmp.cleanup();
    }
  });

  it('10.2.3 project config missing version', () => {
    const tmp = createTempProject();
    try {
      execute('project config with no version field');
      writeYaml(tmp.dir, 'crystral.config.yaml', {
        project: 'test',
        // missing version
      });
      const r = validateProject(tmp.dir);
      result({ errors: r.errors });
      assert('r.errors >= 1');
      expect(r.errors).toBeGreaterThanOrEqual(1);
      pass('10.2.3');
    } finally {
      tmp.cleanup();
    }
  });

  it('10.2.4 non-YAML file content (plain text)', () => {
    const tmp = createTempProject();
    try {
      execute('agent file with plain text content');
      import('node:fs').then(fs => {
        fs.mkdirSync(`${tmp.dir}/agents`, { recursive: true });
        fs.writeFileSync(`${tmp.dir}/agents/text-agent.yaml`, 'this is not yaml at all ::::', 'utf-8');
      });
      // Just validate it doesn't throw
      assert('validateProject does not throw');
      expect(() => validateProject(tmp.dir)).not.toThrow();
      pass('10.2.4');
    } finally {
      tmp.cleanup();
    }
  });

  it('10.2.5 agent with temperature out of range', () => {
    const tmp = createTempProject();
    try {
      execute('agent with temperature: 5 (max is 2)');
      writeProjectConfig(tmp.dir);
      writeYaml(tmp.dir, 'agents/hot-agent.yaml', {
        version: 1,
        name: 'hot-agent',
        provider: 'openai',
        model: 'gpt-4',
        temperature: 5.0, // out of range (max 2)
      });
      const r = validateProject(tmp.dir);
      result({ errors: r.errors });
      assert('r.errors >= 1');
      expect(r.errors).toBeGreaterThanOrEqual(1);
      pass('10.2.5');
    } finally {
      tmp.cleanup();
    }
  });

  it('10.2.6 invalid files counted in .errors', () => {
    const tmp = createTempProject();
    try {
      execute('one invalid agent → r.errors === 1');
      writeProjectConfig(tmp.dir);
      writeYaml(tmp.dir, 'agents/broken.yaml', {
        version: 1,
        name: 'broken',
        // missing provider and model
      });
      const r = validateProject(tmp.dir);
      result({ errors: r.errors });
      assert('r.errors === 1');
      expect(r.errors).toBe(1);
      pass('10.2.6');
    } finally {
      tmp.cleanup();
    }
  });
});

describe('10.3 version warnings', () => {
  it('10.3.1 agent without version field gets a warning', () => {
    const tmp = createTempProject();
    try {
      execute('agent YAML without version field → warning');
      writeProjectConfig(tmp.dir);
      writeYaml(tmp.dir, 'agents/no-version.yaml', {
        name: 'no-version',
        provider: 'openai',
        model: 'gpt-4',
        // missing version
      });
      const r = validateProject(tmp.dir);
      result({ warnings: r.warnings });
      assert('r.warnings >= 1');
      expect(r.warnings).toBeGreaterThanOrEqual(1);
      pass('10.3.1');
    } finally {
      tmp.cleanup();
    }
  });

  it('10.3.2 project config without version field gets a warning', () => {
    const tmp = createTempProject();
    try {
      execute('project config without version → warning');
      writeYaml(tmp.dir, 'crystral.config.yaml', {
        project: 'my-project',
        // no version
      });
      const r = validateProject(tmp.dir);
      result({ warnings: r.warnings });
      assert('r.warnings >= 1');
      expect(r.warnings).toBeGreaterThanOrEqual(1);
      pass('10.3.2');
    } finally {
      tmp.cleanup();
    }
  });

  it('10.3.3 warning count aggregated across all files', () => {
    const tmp = createTempProject();
    try {
      execute('two agents without version → warnings === 2');
      writeProjectConfig(tmp.dir);
      writeYaml(tmp.dir, 'agents/a1.yaml', { name: 'a1', provider: 'openai', model: 'gpt-4' });
      writeYaml(tmp.dir, 'agents/a2.yaml', { name: 'a2', provider: 'openai', model: 'gpt-4' });
      const r = validateProject(tmp.dir);
      result({ warnings: r.warnings });
      assert('r.warnings === 2');
      expect(r.warnings).toBe(2);
      pass('10.3.3');
    } finally {
      tmp.cleanup();
    }
  });

  it('10.3.4 valid file with version has no warnings', () => {
    const tmp = createTempProject();
    try {
      execute('valid agent with version → 0 warnings');
      writeProjectConfig(tmp.dir);
      writeAgent(tmp.dir, 'ok-agent');
      const r = validateProject(tmp.dir);
      result({ warnings: r.warnings });
      assert('r.warnings === 0');
      expect(r.warnings).toBe(0);
      pass('10.3.4');
    } finally {
      tmp.cleanup();
    }
  });
});

describe('10.4 aggregate validation result', () => {
  it('10.4.1 files array contains one entry per validated file', () => {
    const tmp = createTempProject();
    try {
      execute('1 project + 2 agents → files.length === 3');
      writeProjectConfig(tmp.dir);
      writeAgent(tmp.dir, 'agent-a');
      writeAgent(tmp.dir, 'agent-b');
      const r = validateProject(tmp.dir);
      result({ filesCount: r.files.length });
      assert('r.files.length === 3');
      expect(r.files.length).toBe(3);
      pass('10.4.1');
    } finally {
      tmp.cleanup();
    }
  });

  it('10.4.2 file entry has correct type field', () => {
    const tmp = createTempProject();
    try {
      execute('project config file entry has type === "project"');
      writeProjectConfig(tmp.dir);
      const r = validateProject(tmp.dir);
      const projectEntry = r.files.find(f => f.file.includes('crystral.config'));
      result({ type: projectEntry?.type });
      assert('projectEntry.type === "project"');
      expect(projectEntry?.type).toBe('project');
      pass('10.4.2');
    } finally {
      tmp.cleanup();
    }
  });

  it('10.4.3 agent file entry has type === "agent"', () => {
    const tmp = createTempProject();
    try {
      execute('agent file entry has type === "agent"');
      writeProjectConfig(tmp.dir);
      writeAgent(tmp.dir, 'my-agent');
      const r = validateProject(tmp.dir);
      const agentEntry = r.files.find(f => f.type === 'agent');
      result({ type: agentEntry?.type, file: agentEntry?.file });
      assert('agentEntry.type === "agent"');
      expect(agentEntry?.type).toBe('agent');
      pass('10.4.3');
    } finally {
      tmp.cleanup();
    }
  });
});
