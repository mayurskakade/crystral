import { describe, it, expect } from 'vitest';
import { loadAgentConfig } from '../config/loader.ts';
import { createTempProject, writeProjectConfig, writeAgent, writeYaml } from './helpers/fixtures.ts';
import { execute, result, assert, pass } from './helpers/test-logger.ts';

describe('13.1 agent extends merging', () => {
  it('13.1.1 child agent inherits model from base when child has different model', () => {
    const tmp = createTempProject();
    try {
      execute('writeAgent base + child extends base → child keeps its own model');
      writeProjectConfig(tmp.dir);
      writeAgent(tmp.dir, 'base-agent', {
        model: 'gpt-4o',
        system_prompt: 'You are a base agent.',
      });
      writeYaml(tmp.dir, 'agents/child-agent.yaml', {
        version: 1,
        name: 'child-agent',
        provider: 'openai',
        model: 'gpt-4o-mini',
        extends: 'base-agent',
        system_prompt: 'Child agent prompt.',
      });
      const r = loadAgentConfig('child-agent', tmp.dir);
      result({ name: r.name, model: r.model });
      assert('r.name === "child-agent" && r.model === "gpt-4o-mini"');
      expect(r.name).toBe('child-agent');
      expect(r.model).toBe('gpt-4o-mini');
      pass('13.1.1');
    } finally {
      tmp.cleanup();
    }
  });

  it('13.1.2 child overrides system_prompt from base', () => {
    const tmp = createTempProject();
    try {
      execute('child overrides system_prompt');
      writeProjectConfig(tmp.dir);
      writeAgent(tmp.dir, 'base2', {
        system_prompt: 'Base system prompt',
        model: 'gpt-4o',
      });
      writeYaml(tmp.dir, 'agents/child2.yaml', {
        version: 1,
        name: 'child2',
        provider: 'openai',
        model: 'gpt-4o',
        extends: 'base2',
        system_prompt: 'Child system prompt',
      });
      const r = loadAgentConfig('child2', tmp.dir);
      result({ system_prompt: r.system_prompt });
      assert('r.system_prompt === "Child system prompt"');
      expect(r.system_prompt).toBe('Child system prompt');
      pass('13.1.2');
    } finally {
      tmp.cleanup();
    }
  });

  it('13.1.3 child inherits tools from base when not overriding', () => {
    const tmp = createTempProject();
    try {
      execute('base with tools, child without tools override → inherits');
      writeProjectConfig(tmp.dir);
      writeAgent(tmp.dir, 'tool-base', {
        model: 'gpt-4o',
        tools: ['tool1', 'tool2'],
      });
      writeYaml(tmp.dir, 'agents/tool-child.yaml', {
        version: 1,
        name: 'tool-child',
        provider: 'openai',
        model: 'gpt-4o',
        extends: 'tool-base',
        system_prompt: 'child',
      });
      const r = loadAgentConfig('tool-child', tmp.dir);
      result({ tools: r.tools });
      assert('r.tools === ["tool1", "tool2"] inherited from base');
      expect(r.tools).toEqual(['tool1', 'tool2']);
      pass('13.1.3');
    } finally {
      tmp.cleanup();
    }
  });

  it('13.1.4 child replaces tools list entirely when set', () => {
    const tmp = createTempProject();
    try {
      execute('child declares own tools → replaces base tools');
      writeProjectConfig(tmp.dir);
      writeAgent(tmp.dir, 'tool-base2', {
        model: 'gpt-4o',
        tools: ['old-tool'],
      });
      writeYaml(tmp.dir, 'agents/tool-child2.yaml', {
        version: 1,
        name: 'tool-child2',
        provider: 'openai',
        model: 'gpt-4o',
        extends: 'tool-base2',
        system_prompt: 'child',
        tools: ['new-tool'],
      });
      const r = loadAgentConfig('tool-child2', tmp.dir);
      result({ tools: r.tools });
      assert('r.tools === ["new-tool"]');
      expect(r.tools).toEqual(['new-tool']);
      pass('13.1.4');
    } finally {
      tmp.cleanup();
    }
  });
});

describe('13.2 circular inheritance detection', () => {
  it('13.2.1 direct circular extends throws', () => {
    const tmp = createTempProject();
    try {
      execute('a extends b, b extends a → throws circular error');
      writeProjectConfig(tmp.dir);
      writeYaml(tmp.dir, 'agents/circular-a.yaml', {
        version: 1,
        name: 'circular-a',
        provider: 'openai',
        model: 'gpt-4o',
        extends: 'circular-b',
      });
      writeYaml(tmp.dir, 'agents/circular-b.yaml', {
        version: 1,
        name: 'circular-b',
        provider: 'openai',
        model: 'gpt-4o',
        extends: 'circular-a',
      });
      assert('loadAgentConfig throws for circular extends');
      expect(() => loadAgentConfig('circular-a', tmp.dir)).toThrow();
      pass('13.2.1');
    } finally {
      tmp.cleanup();
    }
  });

  it('13.2.2 self-referencing extends throws', () => {
    const tmp = createTempProject();
    try {
      execute('agent extends itself → throws');
      writeProjectConfig(tmp.dir);
      writeYaml(tmp.dir, 'agents/self-ref.yaml', {
        version: 1,
        name: 'self-ref',
        provider: 'openai',
        model: 'gpt-4o',
        extends: 'self-ref',
      });
      assert('loadAgentConfig throws for self-reference');
      expect(() => loadAgentConfig('self-ref', tmp.dir)).toThrow();
      pass('13.2.2');
    } finally {
      tmp.cleanup();
    }
  });
});
