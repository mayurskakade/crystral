import type { AgentToolConfig } from '../types/index.js';
import type { ToolContext, ToolResult } from './executor.js';
import { loadAgentConfig } from '../config/loader.js';
import { CircularDelegationError } from '../errors/index.js';

/**
 * Execute an agent-type tool by delegating to another agent.
 *
 * The target agent is loaded from config, given a task message,
 * and run to completion. Circular delegation is prevented by
 * tracking the call stack through ToolContext.
 */
export async function executeAgentTool(
  config: AgentToolConfig,
  args: Record<string, unknown>,
  context: ToolContext
): Promise<ToolResult> {
  const targetName = config.agent_name;
  const callStack = context.agentCallStack ?? [];

  // Check for circular delegation
  if (callStack.includes(targetName)) {
    throw new CircularDelegationError(targetName, callStack);
  }

  // Notify delegation start
  const parentAgent = callStack.length > 0 ? callStack[callStack.length - 1]! : 'orchestrator';
  context.onAgentDelegation?.(parentAgent, targetName, String(args['task'] ?? ''));

  try {
    // Load target agent config
    const agentConfig = loadAgentConfig(targetName, context.cwd);

    // Build task message
    let taskMessage = String(args['task'] ?? '');

    // Optionally prepend parent context summary
    if (config.pass_context && context.parentMessages && context.parentMessages.length > 0) {
      const contextSummary = context.parentMessages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-5)
        .map(m => `[${m.role}]: ${m.content.slice(0, 500)}`)
        .join('\n');
      taskMessage = `Context from parent conversation:\n${contextSummary}\n\nTask: ${taskMessage}`;
    }

    // Dynamically import AgentRunner to avoid circular dependency at module level
    const { AgentRunner } = await import('../agent/runner.js');

    // Create and run the target agent
    const runner = new AgentRunner(agentConfig);
    const runOptions: Record<string, unknown> = {
      cwd: context.cwd,
      variables: context.variables,
      maxToolIterations: config.max_iterations,
      agentCallStack: [...callStack, targetName],
    };
    if (context.onAgentDelegation) {
      runOptions['onAgentDelegation'] = context.onAgentDelegation;
    }
    if (context.onAgentDelegationResult) {
      runOptions['onAgentDelegationResult'] = context.onAgentDelegationResult;
    }
    const result = await runner.run(taskMessage, runOptions as Parameters<typeof runner.run>[1]);

    const toolResult: ToolResult = {
      content: result.content,
      success: true,
    };

    // Notify delegation complete
    context.onAgentDelegationResult?.(parentAgent, targetName, result.content, true);

    return toolResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Notify delegation failure
    context.onAgentDelegationResult?.(parentAgent, targetName, errorMessage, false);

    if (error instanceof CircularDelegationError) {
      throw error;
    }

    return {
      content: `Agent delegation to '${targetName}' failed: ${errorMessage}`,
      success: false,
      error: errorMessage,
    };
  }
}
