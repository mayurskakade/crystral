# Workflows

Workflows orchestrate multiple agents to accomplish complex tasks. You define a
workflow in YAML, specifying an orchestrator and a set of specialist agents. The
orchestrator LLM decides which agents to call and in what order.

---

## Quick Start

### 1. Create your specialist agents

```yaml
# agents/research-agent.yaml
version: 1
name: research-agent
provider: openai
model: gpt-4o
system_prompt: |
  You are a research specialist. Gather information thoroughly.
```

```yaml
# agents/writing-agent.yaml
version: 1
name: writing-agent
provider: openai
model: gpt-4o
system_prompt: |
  You are a skilled writer. Produce clear, polished content.
```

### 2. Define the workflow

```yaml
# workflows/content-pipeline.yaml
version: 1
name: content-pipeline
description: Research, analyze, and produce content

orchestrator:
  provider: openai
  model: gpt-4o
  system_prompt: |
    You orchestrate content production. Delegate research tasks
    to the researcher and writing tasks to the writer.
    Synthesize their outputs into a final response.
  strategy: auto
  max_iterations: 20
  temperature: 0.7

agents:
  - name: researcher
    agent: research-agent
    description: Gathers information and data
  - name: writer
    agent: writing-agent
    description: Writes polished final content

context:
  shared_memory: true
  max_context_tokens: 8000
```

### 3. Run the workflow

```typescript
import { Crystral } from '@crystralai/sdk';

const client = new Crystral();
const workflow = client.loadWorkflow('content-pipeline');
const result = await workflow.run('Write an article about renewable energy trends');

console.log(result.content);
```

---

## Workflow YAML Reference

### `orchestrator` (required)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider` | `string` | Yes | LLM provider for the orchestrator |
| `model` | `string` | Yes | Model identifier |
| `system_prompt` | `string` | No | Instructions for the orchestrator |
| `strategy` | `string` | Yes | Orchestration strategy (`auto`) |
| `max_iterations` | `number` | No | Max tool loop iterations. Default: `20` |
| `temperature` | `number` | No | Sampling temperature |

### `agents` (required)

Array of agent references:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | How the orchestrator refers to this agent |
| `agent` | `string` | Yes | References `agents/<name>.yaml` |
| `description` | `string` | Yes | Shown to the orchestrator LLM |

### `context` (optional)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `shared_memory` | `boolean` | `false` | Pass parent context to sub-agents |
| `max_context_tokens` | `number` | `4000` | Max tokens for shared context |

---

## `SDKWorkflowRunResult`

| Field | Type | Description |
|-------|------|-------------|
| `content` | `string` | Final response from the orchestrator |
| `sessionId` | `string` | Session ID of the orchestrator |
| `agentResults` | `Array<{name, calls, lastResult?}>` | Per-agent call statistics |
| `usage.input` | `number` | Total input tokens across all agents |
| `usage.output` | `number` | Total output tokens |
| `usage.total` | `number` | Sum of input and output |
| `durationMs` | `number` | Total wall-clock time |

---

## Monitoring Delegations

Track agent delegations in real time:

```typescript
const result = await workflow.run('Analyze AI market trends', {
  onToken: (token) => process.stdout.write(token),
  onAgentDelegation: (parent, target, task) => {
    console.log(`\n[${parent} → ${target}] ${task}`);
  },
  onAgentDelegationResult: (parent, target, result, success) => {
    const status = success ? 'completed' : 'failed';
    console.log(`[${target}] ${status} (${result.length} chars)`);
  },
});

console.log('\n\nAgent statistics:');
for (const agent of result.agentResults) {
  console.log(`  ${agent.name}: ${agent.calls} calls`);
}
```

---

## How It Works Internally

1. `WorkflowEngine` reads the workflow YAML
2. It creates a virtual orchestrator `AgentConfig` with a system prompt listing all available agents
3. For each sub-agent, it creates an `AgentToolConfig` (tool named `delegate_{name}`)
4. It creates an `AgentRunner` and injects the virtual agent tools
5. The orchestrator LLM runs in a standard tool loop — it decides which agents to call
6. Each agent delegation spawns a new `AgentRunner` for the target agent
7. Results flow back through the tool loop
8. The orchestrator synthesizes a final response

This means **no new execution model** — workflows reuse the existing agent runner and tool loop.

---

## One-Shot Convenience

Skip the `loadWorkflow` step:

```typescript
const result = await client.runWorkflow('content-pipeline', 'Write about AI');
```

---

## Next Steps

- **Agent delegation details** → [tools.md](tools.md#agent-tool--delegation)
- **Error handling** → [error-handling.md](error-handling.md) (includes `CircularDelegationError`)
- **Streaming** → [streaming.md](streaming.md) (works with workflow `onToken` too)
