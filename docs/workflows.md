# Workflows

Workflows in Crystal AI orchestrate multiple agents to complete complex, multi-step tasks. Instead of defining explicit step graphs or DAGs, Crystal AI uses a **virtual orchestrator pattern**: a coordinator LLM decides which agents to call, in what order, and how to combine their outputs.

This approach is more flexible than rigid pipelines. The orchestrator can call agents in any order, skip agents based on conditions, call them multiple times, or adapt its plan based on intermediate results.

---

## How It Works

When you run a workflow, the engine:

1. Creates a **virtual orchestrator agent** using the `orchestrator` config (provider, model, system prompt).
2. Converts each listed agent into an **agent-type tool** named `delegate_<name>`.
3. Appends agent descriptions to the orchestrator's system prompt so the LLM knows what specialists are available.
4. Runs the orchestrator through the standard `AgentRunner` tool loop. The LLM decides which agents to call and synthesizes the final output.

No new execution model is introduced. The workflow engine reuses the existing agent runner, tool loop, and delegation infrastructure.

```
WorkflowEngine.run(task)
    |
    +--> Build virtual orchestrator AgentConfig
    |      - system_prompt includes agent descriptions
    |      - provider/model from orchestrator config
    |
    +--> Create delegate_<name> tool for each sub-agent
    |
    +--> AgentRunner.run(task)
    |      |
    |      +--> LLM calls delegate_researcher("gather data on X")
    |      |      \--> spawns research-agent AgentRunner
    |      |
    |      +--> LLM calls delegate_writer("write article using findings")
    |      |      \--> spawns writing-agent AgentRunner
    |      |
    |      +--> LLM synthesizes final response
    |
    +--> Return WorkflowRunResult with per-agent stats
```

---

## Workflow YAML Specification

Workflow files are stored in `workflows/<name>.yaml`.

### Top-Level Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `version` | integer | Yes | -- | Config schema version. Must be `1`. |
| `name` | string | Yes | -- | Workflow name. Must match the filename without extension. `[a-zA-Z0-9_-]`, max 64 chars. |
| `description` | string | No | -- | Human-readable description, max 512 chars. |
| `orchestrator` | object | Yes | -- | Orchestrator LLM configuration. See below. |
| `agents` | list | Yes | -- | Agent references. At least one required. |
| `context` | object | No | `{}` | Context-sharing settings. |

### `orchestrator` Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `provider` | string | Yes | -- | LLM provider (`openai`, `anthropic`, `groq`, `google`, `together`). |
| `model` | string | Yes | -- | Model identifier (e.g. `gpt-4o`, `gemini-2.5-flash`). |
| `base_url` | string (URL) | No | -- | Custom API base URL for OpenAI-compatible servers. |
| `system_prompt` | string | No | `""` | Instructions for the orchestrator. Agent descriptions are appended automatically. |
| `strategy` | string | No | `auto` | Execution hint: `auto`, `sequential`, or `parallel`. |
| `max_iterations` | integer | No | `20` | Maximum tool loop iterations (range: 1--100). |
| `temperature` | number | No | `0.7` | LLM temperature (range: 0.0--2.0). |

### `agents[]` Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | -- | Reference name used in the workflow (e.g. `researcher`). |
| `agent` | string | Yes | -- | Actual agent config name. Must match a file in `agents/<agent>.yaml`. |
| `description` | string | Yes | -- | Describes the agent's role. Included in the orchestrator's system prompt. Max 512 chars. |
| `depends_on` | list of strings | No | -- | Names of agents that must complete before this one runs. Used as hints in the system prompt. |
| `run_if` | string | No | -- | Condition expression. Agent is skipped if the condition evaluates to false. |
| `output_as` | string | No | -- | Variable name to store this agent's output. Referenced in `run_if` conditions of other agents. |

### `context` Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `shared_memory` | boolean | No | `false` | When `true`, enables `pass_context` on all delegate tools, giving sub-agents awareness of the broader conversation. |
| `max_context_tokens` | integer | No | `8000` | Maximum tokens for shared context (range: 100--1,000,000). |

---

## Strategy Types

The `strategy` field provides a hint to the orchestrator about how to coordinate agents.

| Strategy | Behavior |
|----------|----------|
| `auto` | The LLM decides the execution order freely based on the task and agent descriptions. This is the default and most flexible option. |
| `sequential` | The orchestrator is prompted to call agents one at a time in the listed order. Use this when each agent depends on the previous agent's output. |
| `parallel` | The orchestrator is prompted to call independent agents simultaneously. Useful when agents work on separate sub-tasks. |

> **Note:** The strategy is an instruction to the LLM, not a hard constraint enforced by the engine. The orchestrator LLM interprets the strategy via its system prompt. For strict ordering, combine `strategy: sequential` with explicit `depends_on` declarations and a detailed `system_prompt`.

---

## Agent Steps and Delegation

Each agent listed in `agents[]` becomes a tool named `delegate_<name>` with a single `task` parameter (type: string, required). When the orchestrator LLM calls this tool:

1. The workflow engine spawns a new `AgentRunner` for the referenced agent.
2. If `shared_memory` is enabled, the parent conversation context is passed to the sub-agent.
3. The sub-agent runs its own tool loop (it can use its own tools, RAG collections, and MCP servers).
4. The result is returned to the orchestrator as a tool result.

Circular delegation is prevented automatically. The engine maintains a call stack and throws `CircularDelegationError` if an agent attempts to delegate back to an ancestor in the chain.

---

## Input/Output Passing Between Steps

### Implicit Passing (via orchestrator)

By default, the orchestrator LLM handles data flow. It receives each agent's output as a tool result and includes relevant information when calling the next agent.

### Explicit Passing (via `output_as`)

Use `output_as` to name an agent's output. This stored output can then be referenced in `run_if` conditions on other agents.

```yaml
agents:
  - name: classifier
    agent: intent-classifier
    description: Classifies the user intent
    output_as: classification

  - name: refund_handler
    agent: refund-agent
    description: Processes refund requests
    run_if: "'refund' in classification"
    depends_on:
      - classifier
```

### Condition Expressions

The `run_if` field supports a simple expression language:

| Expression | Meaning |
|------------|---------|
| `always` | Always run (default behavior). |
| `never` | Never run. |
| `output_name == 'value'` | Equality check against a stored output. |
| `output_name != 'value'` | Inequality check. |
| `'value' in output_name` | Substring or membership check. |
| `condition1 and condition2` | Logical AND. |
| `condition1 or condition2` | Logical OR. |
| `not condition` | Logical NOT. |
| `output_name.field` | Dot-path access for nested values. |

---

## Complete Examples

### Simple Pipeline: Research and Write

```yaml
version: 1
name: blog-pipeline
description: Research a topic and write a blog post

orchestrator:
  provider: openai
  model: gpt-4o
  strategy: sequential
  max_iterations: 10
  temperature: 0.5
  system_prompt: |
    You coordinate blog post creation. First delegate research,
    then use those findings to delegate writing.

agents:
  - name: researcher
    agent: web-researcher
    description: Searches the web and gathers information on a topic
    output_as: research

  - name: writer
    agent: blog-writer
    description: Writes polished blog posts based on research findings
    depends_on:
      - researcher

context:
  shared_memory: true
  max_context_tokens: 8000
```

### Complex Multi-Agent Pipeline with Conditions

```yaml
version: 1
name: ad-template-pipeline
description: >
  Full creative pipeline for social media ad templates. Runs strategy analysis,
  copy writing, and template design in a strict sequential order.

orchestrator:
  provider: google
  model: gemini-2.5-flash
  temperature: 0.2
  max_iterations: 6
  strategy: sequential
  system_prompt: |
    You are a pipeline coordinator. Execute exactly 3 tool calls in order:
    1. delegate_strategist - pass the user's full brief
    2. delegate_copywriter - pass brief + strategy result
    3. delegate_designer - pass brief + strategy + copy
    After delegate_designer responds, output ONLY its raw JSON.

agents:
  - name: strategist
    agent: ad-strategist
    description: Analyzes the advertising brief and defines creative strategy
    output_as: strategy

  - name: copywriter
    agent: ad-copywriter
    description: Writes headlines, taglines, body copy and CTAs
    depends_on:
      - strategist
    output_as: copy

  - name: designer
    agent: ad-template-generator
    description: Generates production-ready HTML ad templates
    depends_on:
      - copywriter

context:
  shared_memory: true
  max_context_tokens: 12000
```

---

## Running Workflows

### CLI

```bash
crystalai run --workflow content-pipeline "Write an article about AI safety"
```

### TypeScript SDK

```typescript
import { Crystral } from '@crystralai/sdk';

const crystal = new Crystral();
const workflow = crystal.loadWorkflow('content-pipeline');

const result = await crystal.runWorkflow('content-pipeline', 'Write an article about AI safety', {
  onAgentDelegation: (parent, target, task) => {
    console.log(`[${parent}] -> delegating to ${target}`);
  },
  onAgentDelegationResult: (parent, target, result, success) => {
    console.log(`[${target}] completed (success: ${success})`);
  },
});

console.log(result.content);
console.log(`Duration: ${result.durationMs}ms`);
console.log(`Tokens: ${result.usage.totalTokens}`);

for (const agent of result.agentResults) {
  console.log(`  ${agent.name}: ${agent.calls} call(s)`);
}
```

### Workflow Run Result

The `WorkflowRunResult` object contains:

| Field | Type | Description |
|-------|------|-------------|
| `content` | string | Final output from the orchestrator. |
| `sessionId` | string | Session ID of the orchestrator run. |
| `agentResults` | array | Per-agent stats: `name`, `calls` count, and `lastResult`. |
| `usage.inputTokens` | number | Total input tokens across all agents. |
| `usage.outputTokens` | number | Total output tokens across all agents. |
| `usage.totalTokens` | number | Combined token count. |
| `durationMs` | number | Total wall-clock execution time in milliseconds. |

---

## Error Handling in Workflows

### Agent Failures

If a sub-agent fails (provider error, tool error, etc.), the error is returned to the orchestrator as a tool result. The orchestrator LLM can then decide how to proceed -- retry, skip, or report the failure.

### Circular Delegation

The engine maintains an agent call stack. If agent A delegates to agent B, which delegates back to A, a `CircularDelegationError` is thrown with the full chain (e.g. `orchestrator -> researcher -> orchestrator`).

### Iteration Limits

The `max_iterations` setting caps the number of tool loop iterations for the orchestrator. If the limit is reached, the orchestrator returns whatever content it has generated so far. Set this value based on the number of agents and expected delegation rounds.

### Condition Evaluation Failures

If a `run_if` condition references an `output_as` variable that has not been set (because the producing agent has not yet run), the condition evaluates to `false` and the agent is skipped. The orchestrator receives a message indicating the agent was skipped due to an unmet condition.

---

## Best Practices

1. **Write clear agent descriptions.** The orchestrator LLM relies on these to decide which agent to call. Vague descriptions lead to poor delegation decisions.

2. **Use `sequential` strategy with `depends_on` for pipelines.** When output from one agent feeds into the next, make dependencies explicit.

3. **Keep `max_iterations` reasonable.** Set it to roughly 2x the number of expected tool calls. Too low and the workflow may terminate early; too high and a confused orchestrator may loop.

4. **Use `shared_memory: true` for context-heavy workflows.** This ensures each sub-agent sees relevant context from prior steps.

5. **Test agents individually first.** Each agent referenced in a workflow should work correctly on its own before being composed into a workflow.

---

## Related Documentation

- [Agents Guide](./agents.md) -- Agent configuration and execution
- [Tools Guide](./tools.md) -- Tool types including agent delegation tools
