# Tools

Tools allow agents to take actions beyond generating text — calling REST APIs,
running JavaScript, or searching the web.

---

## Tool Types

| Type | Description |
|------|-------------|
| `rest_api` | Make an HTTP request to an external API |
| `javascript` | Execute a JavaScript snippet in a sandboxed context |
| `web_search` | Search the web (requires a search API key) |
| `agent` | Delegate a task to another agent (see [Agent Tool](#agent-tool--delegation)) |

---

## Declaring Tools in Agent YAML

Tools are declared in the `tools` array of your agent YAML:

```yaml
version: "1"
name: my-agent
provider: openai
model: gpt-4o

tools:
  - name: get_weather
    type: rest_api
    description: Get current weather for a city
    url: https://api.openweathermap.org/data/2.5/weather
    method: GET
    parameters:
      city:
        type: string
        description: City name
        required: true
      units:
        type: string
        description: Temperature units
        enum: [metric, imperial, standard]
        default: metric
```

The model decides when to call a tool based on its `description`.  Write clear,
specific descriptions so the model calls tools at the right times.

---

## `rest_api` Tool — Full YAML Reference

```yaml
- name: create_ticket        # Required. Unique name used by the model.
  type: rest_api             # Required.
  description: |             # Required. What the tool does (shown to the model).
    Create a support ticket in the ticketing system.
  url: https://api.example.com/tickets   # Required. Supports {{variable}} templates.
  method: POST               # Required. GET | POST | PUT | PATCH | DELETE
  headers:                   # Optional. Static or templated HTTP headers.
    Authorization: Bearer {{SUPPORT_TOKEN}}
    Content-Type: application/json
  body: |                    # Optional. Request body template (JSON string).
    {
      "title": "{{title}}",
      "description": "{{description}}",
      "priority": "{{priority}}"
    }
  parameters:                # Optional but recommended. Describes model-supplied args.
    title:
      type: string
      description: Short title for the ticket
      required: true
    description:
      type: string
      description: Detailed description of the issue
      required: true
    priority:
      type: string
      description: Ticket priority level
      enum: [low, medium, high, critical]
      default: medium
```

### URL and Body Templates

Use `{{variableName}}` in `url`, `headers`, and `body` fields.  Variables are
filled from two sources:

1. **Model-supplied arguments** — values the model provides when calling the tool
2. **`RunOptions.variables`** — static key/value pairs you pass at call time

```typescript
await agent.run('Create a ticket for the login bug', {
  variables: { SUPPORT_TOKEN: process.env.SUPPORT_TOKEN! },
});
```

---

## `javascript` Tool — Full YAML Reference

```yaml
- name: calculate_discount
  type: javascript
  description: Calculate the discounted price for a product
  code: |
    const price = parseFloat(args.price);
    const discount = parseFloat(args.discount_percent) / 100;
    const discounted = price * (1 - discount);
    return { original: price, discounted: Math.round(discounted * 100) / 100 };
  parameters:
    price:
      type: string
      description: Original price as a number string
      required: true
    discount_percent:
      type: string
      description: Discount percentage (0–100)
      required: true
```

The code runs in a sandboxed Node.js context.  Tool arguments are available via
the `args` object.  The `return` value is serialised to JSON and fed back to
the model.

---

## `web_search` Tool — Full YAML Reference

```yaml
- name: search
  type: web_search
  description: Search the web for up-to-date information
  parameters:
    query:
      type: string
      description: The search query
      required: true
    num_results:
      type: number
      description: Number of results to return (1–10)
      default: 5
```

Requires a search API key (e.g. `SERPER_API_KEY` or `BRAVE_API_KEY`) configured
in your environment.  See [providers.md](providers.md) for details.

---

## Parameter Schema Reference

Each parameter under `parameters` supports these fields:

| Field | Type | Description |
|-------|------|-------------|
| `type` | `string` | JSON Schema type: `string`, `number`, `boolean`, `array`, `object` |
| `description` | `string` | Explanation shown to the model — be precise |
| `required` | `boolean` | Whether the model must supply this argument. Default: `false` |
| `enum` | `string[]` | Restrict to a fixed set of values |
| `default` | any | Default value when the model omits the argument |
| `minimum` | `number` | Minimum value (for `number` type) |
| `maximum` | `number` | Maximum value (for `number` type) |
| `minLength` | `number` | Minimum string length |
| `maxLength` | `number` | Maximum string length |

---

## How Tool Results Flow Back

When the model decides to call a tool:

1. The model generates a tool-call request with name and arguments
2. Crystral executes the tool (HTTP request, JS evaluation, etc.)
3. The result is serialised to a string and added to the conversation as a
   `tool` role message
4. The model sees the result and continues generating

This loop repeats up to `RunOptions.maxToolIterations` times (default: 10).

Monitor this flow with the `onToolCall` and `onToolResult` callbacks in
[RunOptions](../README.md#runoptions).

---

## `agent` Tool — Delegation

The `agent` tool type delegates a task to another agent. The parent agent's LLM
decides when to delegate based on the tool description — just like any other tool.

```yaml
# tools/delegate-research.yaml
version: 1
name: delegate-research
description: Delegates research tasks to the research specialist
type: agent
agent_name: researcher          # references agents/researcher.yaml
pass_context: true              # forward parent conversation summary
timeout_ms: 120000              # max execution time for the sub-agent
max_iterations: 10              # max tool loop iterations for the sub-agent
parameters:
  - name: task
    type: string
    required: true
    description: The research task to perform
```

### Agent Tool Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `agent_name` | `string` | Yes | — | Name of the target agent (matches `agents/<name>.yaml`) |
| `pass_context` | `boolean` | No | `false` | Forward a summary of the parent conversation |
| `timeout_ms` | `number` | No | `120000` | Max execution time in ms (1000–600000) |
| `max_iterations` | `number` | No | `10` | Max tool loop iterations for the sub-agent (1–100) |

### Circular Delegation Protection

CrystalAI tracks the agent call stack. If agent A delegates to agent B, which
delegates back to agent A, a `CircularDelegationError` is thrown:

```
CircularDelegationError: Circular agent delegation detected: orchestrator → researcher → orchestrator
```

### Monitoring Delegations

Use the `onAgentDelegation` and `onAgentDelegationResult` callbacks:

```typescript
const result = await client.run('orchestrator', 'Analyze this data', {
  onAgentDelegation: (parent, target, task) => {
    console.log(`${parent} → ${target}: ${task}`);
  },
  onAgentDelegationResult: (parent, target, result, success) => {
    console.log(`${target}: ${success ? 'done' : 'failed'}`);
  },
});
```

See also: [Workflows guide](workflows.md) for multi-agent orchestration.
