/**
 * @packageDocumentation
 * @crystralai/sdk — TypeScript SDK for the Crystral local-first AI agent framework.
 *
 * The SDK provides a clean, developer-friendly API on top of `@crystralai/core`.
 * Use the {@link Crystral} client to load agents, run queries, stream responses,
 * manage multi-turn sessions, and retrieve inference logs.
 *
 * @example Basic usage
 * ```typescript
 * import { Crystral } from '@crystralai/sdk';
 *
 * const client = new Crystral();
 * const result = await client.run('my-agent', 'What is the capital of France?');
 * console.log(result.content); // "Paris"
 * ```
 */

// Re-export types from core
export type {
  // Config types
  AgentConfig,
  ToolConfig,
  AgentToolConfig,
  MCPServerConfig,
  WorkflowConfig,
  RAGCollectionConfig,
  RAGConfig,
  // New config types (Phase 1 & 2)
  OutputConfig,
  RetryConfig,
  FallbackProvider,
  GuardrailsConfig,
  GuardrailsInputConfig,
  GuardrailsOutputConfig,
  CapabilitiesConfig,
  CacheConfig,
  LoggingConfig,
  ProfileConfig,
  PromptTemplateConfig,
  ScheduleConfig,
  TestSuiteConfig,
  TestCase,
  TestExpect,
  SystemPromptTemplate,
  // Runtime types
  Message,
  Session,
  ToolCall,
  InferenceLog,
  AgentDelegationEvent,
  AgentDelegationResultEvent,
  ImageInput,
  GuardrailResult,
  ProviderUsed,
  // Provider types
  Provider,
  CompletionOptions,
  CompletionResult,
} from '@crystralai/core';

// Re-export new result types from core modules
export type {
  TestSuiteResult,
  TestResult,
} from '@crystralai/core';

export type {
  ValidationResult,
  ValidationFileResult,
} from '@crystralai/core';

export type {
  DryRunResult,
} from '@crystralai/core';

/**
 * Base error class for all Crystral errors.
 * All SDK errors extend this class, so you can catch any Crystral error with
 * a single `instanceof CrystralError` check.
 *
 * @example
 * ```typescript
 * import { CrystralError } from '@crystralai/sdk';
 *
 * try {
 *   await client.run('agent', 'Hello');
 * } catch (err) {
 *   if (err instanceof CrystralError) {
 *     console.error(`[${err.code}] ${err.message}`);
 *   }
 * }
 * ```
 */
export { CrystralError } from '@crystralai/core';

/**
 * Thrown when an agent YAML file cannot be found at the expected path.
 *
 * The expected path follows the convention: `<cwd>/agents/<name>.yaml`
 * (or `<name>/index.yaml` for directory-style agents).
 *
 * @example
 * ```typescript
 * import { AgentNotFoundError } from '@crystralai/sdk';
 *
 * try {
 *   const agent = client.loadAgent('nonexistent');
 * } catch (err) {
 *   if (err instanceof AgentNotFoundError) {
 *     console.error(`Agent "${err.agentName}" not found. Check agents/ directory.`);
 *   }
 * }
 * ```
 */
export { AgentNotFoundError } from '@crystralai/core';

/**
 * Thrown when an agent YAML references a tool that is not registered.
 *
 * @example
 * ```typescript
 * import { ToolNotFoundError } from '@crystralai/sdk';
 *
 * try {
 *   await agent.run('Use the missing tool');
 * } catch (err) {
 *   if (err instanceof ToolNotFoundError) {
 *     console.error(`Tool "${err.toolName}" is not defined in this agent.`);
 *   }
 * }
 * ```
 */
export { ToolNotFoundError } from '@crystralai/core';

/**
 * Thrown when a tool invocation fails at runtime (e.g. network error in a
 * `rest_api` tool, JavaScript exception in a `javascript` tool).
 *
 * @example
 * ```typescript
 * import { ToolExecutionError } from '@crystralai/sdk';
 *
 * try {
 *   await agent.run('Fetch the latest prices');
 * } catch (err) {
 *   if (err instanceof ToolExecutionError) {
 *     console.error(`Tool "${err.toolName}" failed: ${err.message}`);
 *   }
 * }
 * ```
 */
export { ToolExecutionError } from '@crystralai/core';

/**
 * Thrown when the underlying LLM provider returns an error response.
 * Inspect `error.code` for machine-readable categorisation.
 *
 * @example
 * ```typescript
 * import { ProviderError } from '@crystralai/sdk';
 *
 * try {
 *   await agent.run('Hello');
 * } catch (err) {
 *   if (err instanceof ProviderError) {
 *     console.error(`Provider error (${err.code}): ${err.message}`);
 *   }
 * }
 * ```
 */
export { ProviderError } from '@crystralai/core';

/**
 * Thrown when the LLM provider returns HTTP 429 (Too Many Requests).
 * Check `error.retryAfterMs` to implement exponential back-off.
 *
 * @example
 * ```typescript
 * import { RateLimitError } from '@crystralai/sdk';
 *
 * try {
 *   await agent.run('Hello');
 * } catch (err) {
 *   if (err instanceof RateLimitError) {
 *     const wait = err.retryAfterMs ?? 5000;
 *     console.warn(`Rate limited. Retrying in ${wait}ms...`);
 *     await new Promise(r => setTimeout(r, wait));
 *   }
 * }
 * ```
 */
export { RateLimitError } from '@crystralai/core';

/**
 * Thrown when a required API key or credential cannot be found.
 * Crystral resolves credentials in this order:
 * 1. Environment variable (e.g. `OPENAI_API_KEY`)
 * 2. Project `.env` file
 * 3. Global credentials file (`~/.crystral/credentials`)
 *
 * @example
 * ```typescript
 * import { CredentialNotFoundError } from '@crystralai/sdk';
 *
 * try {
 *   await agent.run('Hello');
 * } catch (err) {
 *   if (err instanceof CredentialNotFoundError) {
 *     console.error(`Missing credential: set ${err.envVarName} in your environment.`);
 *   }
 * }
 * ```
 */
export { CredentialNotFoundError } from '@crystralai/core';

/**
 * Thrown when an agent YAML file fails schema validation.
 * The `message` property contains the specific field and constraint that failed.
 *
 * @example
 * ```typescript
 * import { ValidationError } from '@crystralai/sdk';
 *
 * try {
 *   const agent = client.loadAgent('bad-config');
 * } catch (err) {
 *   if (err instanceof ValidationError) {
 *     console.error(`YAML validation failed: ${err.message}`);
 *   }
 * }
 * ```
 */
export { ValidationError } from '@crystralai/core';

/**
 * Thrown when an agent delegation creates a circular call chain.
 * For example, if agent A delegates to agent B which delegates back to agent A.
 *
 * @example
 * ```typescript
 * import { CircularDelegationError } from '@crystralai/sdk';
 *
 * try {
 *   await workflow.run('Do something');
 * } catch (err) {
 *   if (err instanceof CircularDelegationError) {
 *     console.error(`Circular delegation: ${err.callStack.join(' → ')}`);
 *   }
 * }
 * ```
 */
export { CircularDelegationError } from '@crystralai/core';

/**
 * Thrown when a guardrail check blocks input or output.
 *
 * @example
 * ```typescript
 * import { GuardrailError } from '@crystralai/sdk';
 *
 * try {
 *   await agent.run('Some blocked input');
 * } catch (err) {
 *   if (err instanceof GuardrailError) {
 *     console.error(`Guardrail (${err.guardrailType}): ${err.message}`);
 *   }
 * }
 * ```
 */
export { GuardrailError } from '@crystralai/core';

// Re-export new functions from core
export {
  /** Validate all YAML config files in the project against their Zod schemas. */
  validateProject,
} from '@crystralai/core';

export {
  /** Run every test case in a test suite and return aggregated results. */
  runTestSuite,
} from '@crystralai/core';

export {
  /** Load agent config, resolve inheritance, resolve system prompt, and return a summary without making LLM calls. */
  dryRun,
} from '@crystralai/core';

export {
  /** Resolve a system prompt (string or template reference) to a final string. */
  resolveSystemPrompt,
} from '@crystralai/core';

export {
  /** Load a prompt template config from prompts/<name>.yaml */
  loadPromptTemplate,
  /** List all prompt templates in the project */
  listPromptTemplates,
  /** Write a prompt template config to prompts/<name>.yaml */
  writePromptTemplate,
  /** Load a test suite config from tests/<name>.yaml */
  loadTestSuite,
  /** List all test suites in the project */
  listTestSuites,
  /** Load a schedule config from schedules/<name>.yaml */
  loadScheduleConfig,
  /** List all schedules in the project */
  listSchedules,
} from '@crystralai/core';

// Import internal classes
import {
  AgentRunner,
  createAgentRunner,
  loadAgentConfig,
  loadWorkflowConfig,
  WorkflowEngine,
  SQLiteStorage,
  validateProject,
  runTestSuite,
  dryRun,
  loadPromptTemplate,
  loadTestSuite,
} from '@crystralai/core';
import type {
  AgentConfig,
  WorkflowConfig,
  Message,
  InferenceLog,
  ImageInput,
  PromptTemplateConfig,
  ValidationResult,
  TestSuiteResult,
  DryRunResult,
} from '@crystralai/core';

/**
 * Options passed to the {@link Crystral} constructor.
 *
 * @example
 * ```typescript
 * const client = new Crystral({ cwd: '/path/to/my/project' });
 * ```
 */
export interface CrystralOptions {
  /**
   * Working directory used to resolve agent YAML files and RAG collections.
   * Defaults to `process.cwd()` when omitted.
   *
   * Set this explicitly when the SDK is consumed from a different directory
   * than the one that contains your `agents/` folder.
   */
  cwd?: string;
}

/**
 * Filter criteria for {@link Crystral.getLogs}.
 * All fields are optional; omit a field to skip that filter.
 *
 * @example
 * ```typescript
 * // Last 20 logs for the "assistant" agent from the past hour
 * const logs = client.getLogs({
 *   agentName: 'assistant',
 *   limit: 20,
 *   since: new Date(Date.now() - 60 * 60 * 1000),
 * });
 * ```
 */
export interface GetLogsFilter {
  /**
   * Restrict results to a specific agent.
   * Must match the `name` field in the agent's YAML file exactly.
   */
  agentName?: string;

  /**
   * Maximum number of log entries to return.
   * Logs are returned in reverse-chronological order (newest first).
   */
  limit?: number;

  /**
   * Return only logs recorded after this timestamp.
   * Useful for incremental polling or time-windowed analytics.
   */
  since?: Date;
}

/**
 * Options controlling how an agent run behaves.
 * Pass this as the second argument to {@link Agent.run} or the third argument
 * to {@link Crystral.run}.
 *
 * @example
 * ```typescript
 * const result = await agent.run('Hello', {
 *   sessionId: 'user-123',
 *   stream: true,
 *   onToken: (t) => process.stdout.write(t),
 *   maxToolIterations: 5,
 * });
 * ```
 */
export interface RunOptions {
  /**
   * Resume an existing conversation by providing the `sessionId` returned by a
   * previous {@link RunResult}.  When omitted a new session is created
   * automatically and its ID is included in the result.
   */
  sessionId?: string;

  /**
   * Key/value pairs injected into tool URL and body templates at runtime,
   * and also used to resolve prompt template variables.
   * For example, `{ userId: '42' }` would replace `{{userId}}` in a
   * `rest_api` tool's URL template or `{userId}` in a prompt template.
   */
  variables?: Record<string, string>;

  /**
   * Hard cap on the number of tool-call / tool-result cycles per run.
   * Prevents infinite loops when the model repeatedly invokes tools.
   * Defaults to `10`.
   */
  maxToolIterations?: number;

  /**
   * When `true`, the response is delivered token-by-token via the
   * {@link RunOptions.onToken} callback while the run is in progress.
   * The final {@link RunResult.content} still contains the complete text.
   *
   * @defaultValue false
   */
  stream?: boolean;

  /**
   * Called once for each token when {@link RunOptions.stream} is `true`.
   * Write tokens directly to stdout for a CLI-style streaming experience:
   *
   * ```typescript
   * onToken: (token) => process.stdout.write(token)
   * ```
   */
  onToken?: (token: string) => void;

  /**
   * Called immediately before the model's tool call is executed.
   * Useful for logging or showing a "thinking..." indicator in a UI.
   *
   * @param name - The tool name as declared in the agent YAML
   * @param args - Parsed arguments the model passed to the tool
   */
  onToolCall?: (name: string, args: Record<string, unknown>) => void;

  /**
   * Called after a tool has finished executing.
   *
   * @param name - The tool name
   * @param result - Execution result with `content` (string) and `success` flag
   */
  onToolResult?: (name: string, result: { content: string; success: boolean }) => void;

  /**
   * Called when an agent delegates a task to another agent.
   *
   * @param parentAgent - The name of the delegating agent
   * @param targetAgent - The name of the agent being delegated to
   * @param task - The task being delegated
   */
  onAgentDelegation?: (parentAgent: string, targetAgent: string, task: string) => void;

  /**
   * Called when an agent delegation completes.
   *
   * @param parentAgent - The name of the delegating agent
   * @param targetAgent - The name of the agent that was delegated to
   * @param result - The result of the delegation
   * @param success - Whether the delegation was successful
   */
  onAgentDelegationResult?: (parentAgent: string, targetAgent: string, result: string, success: boolean) => void;

  /**
   * Environment profile to apply (overrides agent defaults with profile settings).
   * If not specified, falls back to the `CRYSTRAL_PROFILE` environment variable.
   */
  profile?: string;

  /**
   * Multimodal image inputs to include with the user message.
   * Requires the agent to have `capabilities.vision: true` configured.
   */
  images?: ImageInput[];
}

/**
 * The value returned by {@link Agent.run} and {@link Crystral.run}.
 *
 * @example
 * ```typescript
 * const result = await client.run('assistant', 'Summarise this document');
 * console.log(result.content);           // The model's reply
 * console.log(result.sessionId);         // Use for follow-up turns
 * console.log(result.usage.total);       // Total tokens consumed
 * console.log(result.durationMs);        // Wall-clock execution time
 * ```
 */
export interface RunResult {
  /**
   * The final text response from the agent.
   * When streaming was enabled this is identical to the concatenation of all
   * tokens received via {@link RunOptions.onToken}.
   */
  content: string;

  /**
   * Opaque identifier for the conversation session.
   * Pass this as {@link RunOptions.sessionId} to continue the conversation in a
   * subsequent call.  Sessions are persisted to SQLite and survive process
   * restarts.
   */
  sessionId: string;

  /**
   * Ordered list of all messages in the conversation up to and including this
   * run (system prompt, prior turns, current turn).
   */
  messages: Message[];

  /**
   * All tool calls made during this run, in the order they were invoked.
   * Each entry includes the tool name, the arguments the model supplied, and
   * the result that was fed back to the model.
   */
  toolCalls: Array<{
    /** Tool name as declared in agent YAML */
    name: string;
    /** Arguments provided by the model */
    args: Record<string, unknown>;
    /** Execution result */
    result: { content: string; success: boolean };
  }>;

  /**
   * The RAG context string that was injected into the prompt, if the agent has
   * a RAG collection configured and relevant documents were found.
   * `undefined` when no RAG retrieval occurred.
   */
  ragContext?: string;

  /**
   * Token usage for this run.  Use this for cost accounting and quota tracking.
   */
  usage: {
    /** Tokens in the prompt (system + history + user message + RAG context) */
    input: number;
    /** Tokens in the model's completion */
    output: number;
    /** Sum of input and output */
    total: number;
  };

  /**
   * Wall-clock execution time for this run in milliseconds, including LLM
   * latency, tool execution, and RAG retrieval.
   */
  durationMs: number;

  /**
   * Parsed structured output from the agent, if the agent has an `output`
   * config with `format: json`. Contains the parsed JSON object.
   * `undefined` when no structured output is configured or parsing failed.
   */
  parsed?: unknown;

  /**
   * Whether this response was served from cache.
   * Only present when the agent has caching enabled.
   */
  cached?: boolean;

  /**
   * Trace ID for observability, present when the agent has `logging.trace: true`.
   * Use this to correlate logs and spans across agent runs.
   */
  traceId?: string;

  /**
   * Which provider and model actually served this response.
   * May differ from the agent's configured provider/model when a fallback
   * provider was used after the primary provider failed.
   */
  providerUsed?: { provider: string; model: string };

  /**
   * Guardrail check results for this run.
   * Only present when the agent has guardrails configured.
   */
  guardrails?: {
    /** Whether the input was blocked by an input guardrail */
    inputBlocked?: boolean;
    /** Whether the output was blocked by an output guardrail */
    outputBlocked?: boolean;
    /** Whether PII was redacted from input or output */
    piiRedacted?: boolean;
  };
}

/**
 * A configured agent instance loaded from a YAML file.
 *
 * Obtain an `Agent` via {@link Crystral.loadAgent}.  The instance is
 * lightweight: it holds the parsed configuration and an {@link AgentRunner}
 * but does not open any network connections until {@link Agent.run} is called.
 *
 * @example
 * ```typescript
 * const client = new Crystral();
 * const agent = client.loadAgent('support-bot');
 *
 * // First turn — starts a new session
 * const r1 = await agent.run('Hi, I need help with my order');
 *
 * // Second turn — continues the same session
 * const r2 = await agent.run('Order #12345', { sessionId: r1.sessionId });
 * ```
 */
export class Agent {
  private runner: AgentRunner;
  private config: AgentConfig;
  private agentCwd: string | undefined;

  /** @internal */
  constructor(config: AgentConfig, cwd?: string) {
    this.config = config;
    this.agentCwd = cwd;
    this.runner = createAgentRunner(config);
  }

  /**
   * The agent's unique name, as declared in its YAML file.
   * Used when referencing the agent via {@link Crystral.run} or log filters.
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * The LLM provider this agent is configured to use
   * (e.g. `"openai"`, `"anthropic"`, `"groq"`).
   */
  get provider(): string {
    return this.config.provider;
  }

  /**
   * The specific model identifier this agent uses
   * (e.g. `"gpt-4o"`, `"claude-3-5-sonnet-20241022"`).
   */
  get model(): string {
    return this.config.model;
  }

  /**
   * Send a message to the agent and receive a response.
   *
   * Under the hood this method:
   * 1. Retrieves relevant RAG context (if configured)
   * 2. Appends the user message to the conversation history
   * 3. Calls the LLM provider
   * 4. Executes any tool calls returned by the model (up to {@link RunOptions.maxToolIterations})
   * 5. Returns the final {@link RunResult}
   *
   * @param message - The user message to send
   * @param options - Optional run configuration (session, streaming, callbacks, etc.)
   * @returns A promise that resolves to the agent's {@link RunResult}
   *
   * @throws {@link CredentialNotFoundError} if the required API key is missing
   * @throws {@link ProviderError} if the LLM provider returns an error
   * @throws {@link RateLimitError} if the provider rate-limits the request
   * @throws {@link ToolExecutionError} if a tool invocation fails
   *
   * @example Simple query
   * ```typescript
   * const result = await agent.run('What is 2 + 2?');
   * console.log(result.content); // "4"
   * ```
   *
   * @example Streaming
   * ```typescript
   * const result = await agent.run('Write a poem', {
   *   stream: true,
   *   onToken: (t) => process.stdout.write(t),
   * });
   * ```
   */
  async run(message: string, options?: RunOptions): Promise<RunResult> {
    const runOptions = { ...options };
    if (options?.images) {
      runOptions.images = options.images;
    }
    const result = await this.runner.run(message, runOptions);

    return {
      content: result.content,
      sessionId: result.sessionId,
      messages: result.messages,
      toolCalls: result.toolCalls,
      ...(result.ragContext ? { ragContext: result.ragContext } : {}),
      usage: {
        input: result.usage.inputTokens,
        output: result.usage.outputTokens,
        total: result.usage.totalTokens,
      },
      durationMs: result.durationMs,
      ...(result.parsed !== undefined ? { parsed: result.parsed } : {}),
      ...(result.cached !== undefined ? { cached: result.cached } : {}),
      ...(result.traceId ? { traceId: result.traceId } : {}),
      ...(result.providerUsed ? { providerUsed: result.providerUsed } : {}),
      ...(result.guardrails ? { guardrails: result.guardrails } : {}),
    };
  }

  /**
   * Perform a dry run: load and resolve all config for this agent without
   * making any LLM calls. Useful for debugging configuration issues.
   *
   * @returns A {@link DryRunResult} with resolved config, tools, system prompt, and warnings
   */
  dryRun(): DryRunResult {
    return dryRun(this.config.name, this.agentCwd);
  }

  /**
   * Return all messages in the current in-memory conversation history.
   *
   * This reflects the messages accumulated since the last {@link Agent.clearSession}
   * call (or since the agent was constructed).  It does **not** query the
   * persistent SQLite store — use {@link Crystral.getLogs} for persisted records.
   *
   * @returns Ordered array of {@link Message} objects (system, user, assistant, tool)
   *
   * @example
   * ```typescript
   * const history = agent.getHistory();
   * history.forEach(m => console.log(`[${m.role}] ${m.content}`));
   * ```
   */
  getHistory(): Message[] {
    return this.runner.getHistory();
  }

  /**
   * Discard the in-memory conversation history and reset to a clean state.
   *
   * After calling this method the next {@link Agent.run} call will start a
   * brand-new session (the old session data remains in SQLite and can still
   * be accessed via {@link Crystral.getLogs}).
   *
   * @example
   * ```typescript
   * // Start a fresh conversation
   * agent.clearSession();
   * const result = await agent.run('Hello again!');
   * ```
   */
  clearSession(): void {
    this.runner.clearSession();
  }
}

/**
 * Options controlling how a workflow run behaves.
 *
 * @example
 * ```typescript
 * const result = await workflow.run('Research AI trends', {
 *   onAgentDelegation: (parent, target, task) => {
 *     console.log(`${parent} → ${target}: ${task}`);
 *   },
 * });
 * ```
 */
export interface SDKWorkflowRunOptions {
  /** Working directory */
  cwd?: string;
  /** Variables for tool templates */
  variables?: Record<string, string>;
  /** Callback for streaming tokens from the orchestrator */
  onToken?: (token: string) => void;
  /** Called when an agent delegation starts */
  onAgentDelegation?: (parentAgent: string, targetAgent: string, task: string) => void;
  /** Called when an agent delegation completes */
  onAgentDelegationResult?: (parentAgent: string, targetAgent: string, result: string, success: boolean) => void;
}

/**
 * The result returned by a workflow run.
 *
 * @example
 * ```typescript
 * const result = await workflow.run('Analyze this data');
 * console.log(result.content);
 * console.log(result.agentResults); // Per-agent call stats
 * ```
 */
export interface SDKWorkflowRunResult {
  /** Final content from the orchestrator */
  content: string;
  /** Session ID of the orchestrator */
  sessionId: string;
  /** Per-agent call statistics */
  agentResults: Array<{
    name: string;
    calls: number;
    lastResult?: string;
  }>;
  /** Token usage across all agents */
  usage: {
    input: number;
    output: number;
    total: number;
  };
  /** Total execution time in ms */
  durationMs: number;
}

/**
 * A configured workflow instance loaded from a YAML file.
 *
 * Obtain a `Workflow` via {@link Crystral.loadWorkflow}. The instance wraps
 * a {@link WorkflowEngine} and provides a clean SDK interface.
 *
 * @example
 * ```typescript
 * const client = new Crystral();
 * const workflow = client.loadWorkflow('content-pipeline');
 * const result = await workflow.run('Write an article about AI');
 * console.log(result.content);
 * ```
 */
export class Workflow {
  private engine: WorkflowEngine;
  private config: WorkflowConfig;

  /** @internal */
  constructor(config: WorkflowConfig) {
    this.config = config;
    this.engine = new WorkflowEngine(config);
  }

  /** The workflow's unique name */
  get name(): string {
    return this.config.name;
  }

  /** The workflow's description */
  get description(): string | undefined {
    return this.config.description;
  }

  /** The orchestrator's strategy (auto, sequential, or parallel) */
  get strategy(): string {
    return this.config.orchestrator.strategy;
  }

  /** List of agent references in this workflow */
  get agents(): Array<{ name: string; agent: string; description: string }> {
    return this.engine.agents;
  }

  /**
   * Run the workflow with a task message.
   *
   * The orchestrator agent will delegate tasks to sub-agents and synthesize
   * their outputs into a final response.
   *
   * @param task - The task to accomplish
   * @param options - Optional workflow run configuration
   * @returns A promise resolving to the workflow's result
   */
  async run(task: string, options?: SDKWorkflowRunOptions): Promise<SDKWorkflowRunResult> {
    const result = await this.engine.run(task, options);

    return {
      content: result.content,
      sessionId: result.sessionId,
      agentResults: result.agentResults,
      usage: {
        input: result.usage.inputTokens,
        output: result.usage.outputTokens,
        total: result.usage.totalTokens,
      },
      durationMs: result.durationMs,
    };
  }
}

/**
 * The primary entry point for the Crystral SDK.
 *
 * `Crystral` is a lightweight client that locates agent configuration files,
 * instantiates {@link Agent} objects, and provides convenience methods for
 * one-shot runs and log retrieval.
 *
 * A single client instance can be shared across your entire application.
 * The {@link crystral} named export provides a zero-configuration default
 * instance backed by `process.cwd()`.
 *
 * @example Minimal setup
 * ```typescript
 * import { Crystral } from '@crystralai/sdk';
 *
 * const client = new Crystral();
 * const result = await client.run('my-agent', 'Hello!');
 * console.log(result.content);
 * ```
 *
 * @example Explicit working directory
 * ```typescript
 * const client = new Crystral({ cwd: '/opt/myapp' });
 * ```
 */
export class Crystral {
  private cwd?: string;

  /**
   * Create a new Crystral client.
   *
   * @param options - Optional {@link CrystralOptions} to configure the client
   */
  constructor(options?: CrystralOptions) {
    if (options?.cwd) {
      this.cwd = options.cwd;
    }
  }

  /**
   * Load an agent by name from the `agents/` directory relative to
   * {@link CrystralOptions.cwd} (or `process.cwd()`).
   *
   * The method looks for the agent configuration at:
   * - `<cwd>/agents/<name>.yaml`
   * - `<cwd>/agents/<name>/index.yaml`
   *
   * @param name - Agent name (must match the filename without `.yaml`)
   * @returns A ready-to-use {@link Agent} instance
   *
   * @throws {@link AgentNotFoundError} when no matching YAML file is found
   * @throws {@link ValidationError} when the YAML fails schema validation
   *
   * @example
   * ```typescript
   * const agent = client.loadAgent('support-bot');
   * const result = await agent.run('I need a refund');
   * ```
   */
  loadAgent(name: string): Agent {
    const config = loadAgentConfig(name, this.cwd);
    return new Agent(config, this.cwd);
  }

  /**
   * One-shot convenience method: load an agent and run it with a single call.
   *
   * Equivalent to:
   * ```typescript
   * client.loadAgent(agentName).run(message, options)
   * ```
   *
   * Use this when you don't need to reuse the {@link Agent} object.  For
   * multi-turn conversations, load the agent once with {@link Crystral.loadAgent}
   * and call {@link Agent.run} directly.
   *
   * @param agentName - Name of the agent to load (see {@link Crystral.loadAgent})
   * @param message - The user message to send
   * @param options - Optional {@link RunOptions}
   * @returns A promise resolving to the {@link RunResult}
   *
   * @throws {@link AgentNotFoundError} if the agent YAML does not exist
   * @throws {@link CredentialNotFoundError} if the required API key is missing
   * @throws {@link ProviderError} if the LLM provider returns an error
   *
   * @example
   * ```typescript
   * const result = await client.run('assistant', 'Summarise this PR', {
   *   stream: true,
   *   onToken: (t) => process.stdout.write(t),
   * });
   * ```
   */
  async run(agentName: string, message: string, options?: RunOptions): Promise<RunResult> {
    const agent = this.loadAgent(agentName);
    return agent.run(message, options);
  }

  /**
   * Retrieve inference logs persisted by previous agent runs.
   *
   * Every call to {@link Agent.run} (or {@link Crystral.run}) automatically
   * appends a log entry to a local SQLite database.  Use this method to query
   * that history for monitoring, debugging, or cost tracking.
   *
   * @param filter - Optional {@link GetLogsFilter} to narrow results
   * @returns Array of {@link InferenceLog} entries, newest first
   *
   * @example Retrieve all logs
   * ```typescript
   * const logs = client.getLogs();
   * logs.forEach(l => console.log(l.agentName, l.durationMs, l.usage));
   * ```
   *
   * @example Filter by agent and time window
   * ```typescript
   * const logs = client.getLogs({
   *   agentName: 'support-bot',
   *   since: new Date('2026-01-01'),
   *   limit: 100,
   * });
   * ```
   */
  /**
   * Load a workflow by name from the `workflows/` directory.
   *
   * @param name - Workflow name (must match the filename without `.yaml`)
   * @returns A ready-to-use {@link Workflow} instance
   *
   * @throws {@link ValidationError} when the YAML fails schema validation or is not found
   *
   * @example
   * ```typescript
   * const workflow = client.loadWorkflow('content-pipeline');
   * const result = await workflow.run('Write about AI');
   * ```
   */
  loadWorkflow(name: string): Workflow {
    const config = loadWorkflowConfig(name, this.cwd);
    return new Workflow(config);
  }

  /**
   * One-shot convenience method: load a workflow and run it with a single call.
   *
   * @param workflowName - Name of the workflow to load
   * @param task - The task to accomplish
   * @param options - Optional {@link SDKWorkflowRunOptions}
   * @returns A promise resolving to the {@link SDKWorkflowRunResult}
   *
   * @example
   * ```typescript
   * const result = await client.runWorkflow('content-pipeline', 'Write about AI');
   * console.log(result.content);
   * ```
   */
  async runWorkflow(workflowName: string, task: string, options?: SDKWorkflowRunOptions): Promise<SDKWorkflowRunResult> {
    const workflow = this.loadWorkflow(workflowName);
    return workflow.run(task, options);
  }

  getLogs(filter?: GetLogsFilter): InferenceLog[] {
    const storage = SQLiteStorage.getInstance(this.cwd);
    return storage.getLogs(filter);
  }

  /**
   * Validate all YAML config files in the project against their Zod schemas.
   *
   * Scans agents, tools, workflows, prompts, tests, schedules, and the
   * project config file for schema violations.
   *
   * @returns A {@link ValidationResult} with per-file results, counts of valid/error/warning files
   *
   * @example
   * ```typescript
   * const result = client.validate();
   * if (result.errors > 0) {
   *   result.files.filter(f => !f.valid).forEach(f => {
   *     console.error(`${f.file}: ${f.errors.join(', ')}`);
   *   });
   * }
   * ```
   */
  validate(): ValidationResult {
    return validateProject(this.cwd);
  }

  /**
   * Load and run a test suite by name.
   *
   * Loads the test suite config from `tests/<suiteName>.yaml`, creates an
   * agent runner for the suite's target agent, and runs all test cases.
   *
   * @param suiteName - Name of the test suite (must match the filename without `.yaml`)
   * @returns A promise resolving to the {@link TestSuiteResult}
   *
   * @example
   * ```typescript
   * const result = await client.test('my-agent-tests');
   * console.log(`${result.passed}/${result.passed + result.failed} tests passed`);
   * ```
   */
  async test(suiteName: string): Promise<TestSuiteResult> {
    const suiteConfig = loadTestSuite(suiteName, this.cwd);
    const agentConfig = loadAgentConfig(suiteConfig.agent, this.cwd);
    const runner = createAgentRunner(agentConfig);

    // Adapt AgentRunner to TestableAgentRunner interface
    const testableRunner = {
      async run(input: string, options?: { variables?: Record<string, string> }) {
        const result = await runner.run(input, options);
        const ret: {
          response: string;
          parsed?: unknown;
          guardrails?: { inputBlocked?: boolean };
        } = {
          response: result.content,
        };
        if (result.parsed !== undefined) {
          ret.parsed = result.parsed;
        }
        if (result.guardrails && result.guardrails.inputBlocked !== undefined) {
          ret.guardrails = { inputBlocked: result.guardrails.inputBlocked };
        }
        return ret;
      },
    };

    return runTestSuite(suiteConfig, testableRunner);
  }

  /**
   * Load a prompt template by name from the `prompts/` directory.
   *
   * @param name - Prompt template name (must match the filename without `.yaml`)
   * @returns The parsed {@link PromptTemplateConfig}
   *
   * @example
   * ```typescript
   * const template = client.loadPrompt('customer-support');
   * console.log(template.template);
   * ```
   */
  loadPrompt(name: string): PromptTemplateConfig {
    return loadPromptTemplate(name, this.cwd);
  }
}

/**
 * Default export — the {@link Crystral} class for named and default import styles.
 *
 * @example
 * ```typescript
 * import Crystral from '@crystralai/sdk';
 * const client = new Crystral();
 * ```
 */
export default Crystral;

/**
 * A pre-constructed {@link Crystral} client backed by `process.cwd()`.
 *
 * Import this when you want a zero-config singleton and don't need a custom
 * working directory.
 *
 * @example
 * ```typescript
 * import { crystral } from '@crystralai/sdk';
 * const result = await crystral.run('my-agent', 'Hello!');
 * ```
 */
export const crystral = new Crystral();
