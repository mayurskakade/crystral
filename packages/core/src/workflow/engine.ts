import type { AgentConfig, AgentToolConfig, ToolConfig, WorkflowConfig } from '../types/index.js';
import type { AgentRunOptions } from '../agent/runner.js';
import { loadWorkflowConfig } from '../config/loader.js';
import { AgentRunner } from '../agent/runner.js';
import { evaluateCondition } from './conditionals.js';

/**
 * Result of a workflow run
 */
export interface WorkflowRunResult {
  /** Final content from the orchestrator */
  content: string;
  /** Session ID of the orchestrator */
  sessionId: string;
  /** Aggregated results per sub-agent */
  agentResults: Array<{
    name: string;
    calls: number;
    lastResult?: string;
  }>;
  /** Token usage across all agents */
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  /** Total execution time in ms */
  durationMs: number;
}

/**
 * Options for running a workflow
 */
export interface WorkflowRunOptions {
  /** Working directory */
  cwd?: string;
  /** Variables for tool templates */
  variables?: Record<string, string>;
  /** Callback for streaming tokens */
  onToken?: (token: string) => void;
  /** Callback when an agent delegation starts */
  onAgentDelegation?: (parentAgent: string, targetAgent: string, task: string) => void;
  /** Callback when an agent delegation completes */
  onAgentDelegationResult?: (parentAgent: string, targetAgent: string, result: string, success: boolean) => void;
}

/**
 * Workflow engine that orchestrates multi-agent workflows.
 *
 * Takes a WorkflowConfig, builds a virtual orchestrator agent with
 * agent-type tools for each sub-agent, and runs it.
 */
export class WorkflowEngine {
  private config: WorkflowConfig;

  constructor(config: WorkflowConfig) {
    this.config = config;
  }

  /** Workflow name */
  get name(): string {
    return this.config.name;
  }

  /** Workflow description */
  get description(): string | undefined {
    return this.config.description;
  }

  /** List of configured agent references */
  get agents(): Array<{ name: string; agent: string; description: string }> {
    return this.config.agents.map(a => ({
      name: a.name,
      agent: a.agent,
      description: a.description,
    }));
  }

  /** Orchestrator strategy */
  get strategy(): string {
    return this.config.orchestrator.strategy;
  }

  /**
   * Run the workflow with a task message.
   */
  async run(task: string, options?: WorkflowRunOptions): Promise<WorkflowRunResult> {
    const startTime = Date.now();

    // Track per-agent results
    const agentTracker = new Map<string, { calls: number; lastResult?: string }>();
    for (const agent of this.config.agents) {
      agentTracker.set(agent.name, { calls: 0 });
    }

    // Track output_as results for conditional evaluation
    const outputsMap: Record<string, unknown> = {};

    // Build agent descriptions for the system prompt
    const agentDescriptions = this.config.agents
      .map(a => {
        let desc = `- ${a.name}: ${a.description}`;
        if (a.run_if) desc += ` [condition: ${a.run_if}]`;
        if (a.output_as) desc += ` [output stored as: ${a.output_as}]`;
        return desc;
      })
      .join('\n');

    // Build orchestrator system prompt
    const basePrompt = this.config.orchestrator.system_prompt || 'You are a workflow orchestrator.';
    const systemPrompt = `${basePrompt}

You have the following specialist agents available as tools:
${agentDescriptions}

Delegate tasks to the appropriate agents and synthesize their outputs into a final response.
Each agent tool accepts a "task" parameter describing what you need them to do.
Some agents have conditions (run_if) that determine whether they should be executed. Respect these conditions based on prior agent outputs.`;

    // Build virtual orchestrator AgentConfig
    const orchestratorConfig: AgentConfig = {
      version: 1,
      name: `${this.config.name}-orchestrator`,
      provider: this.config.orchestrator.provider,
      model: this.config.orchestrator.model,
      system_prompt: systemPrompt,
      temperature: this.config.orchestrator.temperature,
      max_tokens: 4096,
      top_p: 1.0,
      presence_penalty: 0.0,
      frequency_penalty: 0.0,
      tools: [],
      mcp: [],
    };

    // Create AgentToolConfig entries for each sub-agent
    const agentToolConfigs: ToolConfig[] = this.config.agents.map(agent => ({
      version: 1,
      name: `delegate_${agent.name}`,
      description: `Delegate a task to the ${agent.name} agent: ${agent.description}`,
      type: 'agent' as const,
      agent_name: agent.agent,
      pass_context: this.config.context.shared_memory,
      timeout_ms: 120000,
      max_iterations: 10,
      parameters: [
        {
          name: 'task',
          type: 'string' as const,
          required: true,
          description: `The task to delegate to the ${agent.name} agent`,
        },
      ],
    } satisfies AgentToolConfig));

    // Create the orchestrator runner
    const runner = new AgentRunner(orchestratorConfig);

    // Inject virtual agent tools
    runner.injectToolConfigs(agentToolConfigs);

    // Delegation tracking callbacks
    const onDelegation = (parent: string, target: string, delegationTask: string) => {
      // Check run_if condition before delegation
      for (const [name] of agentTracker) {
        const agentRef = this.config.agents.find(a => a.name === name);
        if (agentRef && agentRef.agent === target && agentRef.run_if) {
          const conditionResult = evaluateCondition(agentRef.run_if, outputsMap);
          if (!conditionResult) {
            // Log skipped agent - the orchestrator will see the tool result as skipped
            options?.onAgentDelegationResult?.(parent, target, `Skipped: condition '${agentRef.run_if}' evaluated to false`, false);
            return; // Skip delegation
          }
        }
      }

      for (const [name, entry] of agentTracker) {
        const agentRef = this.config.agents.find(a => a.name === name);
        if (agentRef && agentRef.agent === target) {
          entry.calls++;
        }
      }
      options?.onAgentDelegation?.(parent, target, delegationTask);
    };

    const onDelegationResult = (parent: string, target: string, result: string, success: boolean) => {
      for (const [name, entry] of agentTracker) {
        const agentRef = this.config.agents.find(a => a.name === name);
        if (agentRef && agentRef.agent === target) {
          entry.lastResult = result;

          // Store result in outputsMap if output_as is defined
          if (agentRef.output_as) {
            outputsMap[agentRef.output_as] = result;
          }
        }
      }
      options?.onAgentDelegationResult?.(parent, target, result, success);
    };

    // Build run options conditionally to satisfy exactOptionalPropertyTypes
    const runOptions: AgentRunOptions = {
      maxToolIterations: this.config.orchestrator.max_iterations,
      agentCallStack: [orchestratorConfig.name],
      onAgentDelegation: onDelegation,
      onAgentDelegationResult: onDelegationResult,
    };
    if (options?.cwd) {
      runOptions.cwd = options.cwd;
    }
    if (options?.variables) {
      runOptions.variables = options.variables;
    }
    if (options?.onToken) {
      runOptions.stream = true;
      runOptions.onToken = options.onToken;
    }

    // Run the orchestrator
    const result = await runner.run(task, runOptions);

    const durationMs = Date.now() - startTime;

    // Build agentResults, filtering undefined lastResult to satisfy exactOptionalPropertyTypes
    const agentResults: Array<{ name: string; calls: number; lastResult?: string }> = [];
    for (const [name, entry] of agentTracker) {
      const item: { name: string; calls: number; lastResult?: string } = {
        name,
        calls: entry.calls,
      };
      if (entry.lastResult !== undefined) {
        item.lastResult = entry.lastResult;
      }
      agentResults.push(item);
    }

    return {
      content: result.content,
      sessionId: result.sessionId,
      agentResults,
      usage: {
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        totalTokens: result.usage.totalTokens,
      },
      durationMs,
    };
  }
}

/**
 * Convenience function to load and run a workflow by name
 */
export async function runWorkflow(
  name: string,
  task: string,
  options?: WorkflowRunOptions & { cwd?: string }
): Promise<WorkflowRunResult> {
  const config = loadWorkflowConfig(name, options?.cwd);
  const engine = new WorkflowEngine(config);
  return engine.run(task, options);
}
