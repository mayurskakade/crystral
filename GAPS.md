# Crystal AI — Feature Gaps

> Filtered through our core philosophy: **configuration-based, easy to integrate**.
> We intentionally exclude gaps that would push toward code-heavy, framework-bloated patterns.

---

## 1. Structured Output / Response Schema (HIGH)

**What's missing:** No way to enforce output format (JSON schema, enum, typed response) via YAML config.

**Why it matters for config-based AI:** Users should define expected output shape in YAML — not write parsing code. This is one of the most requested features in production agent setups.

**What it could look like:**
```yaml
output:
  format: json
  schema:
    type: object
    properties:
      summary: { type: string }
      sentiment: { type: string, enum: [positive, negative, neutral] }
    required: [summary, sentiment]
```

**LangChain equivalent:** `with_structured_output()`, Pydantic output parsers
**CrewAI equivalent:** `output_pydantic`, `output_json` on Task

---

## 2. Retry & Fallback Providers (HIGH)

**What's missing:** No YAML config for automatic retries, exponential backoff, or fallback to a different provider/model when one fails.

**Why it matters:** Production agents need resilience without writing retry logic. A config-first framework should handle this declaratively.

**What it could look like:**
```yaml
provider: openai
model: gpt-4o
retry:
  max_attempts: 3
  backoff: exponential
fallback:
  provider: anthropic
  model: claude-sonnet
```

**LangChain equivalent:** `with_fallbacks()`, `with_retry()` on runnables

---

## 3. Guardrails & Content Filtering (HIGH)

**What's missing:** No config for input/output validation, PII filtering, topic restriction, or content moderation — beyond web search safe_search.

**Why it matters:** Enterprise adoption requires safety controls without custom middleware. Guardrails should be declarative, not code.

**What it could look like:**
```yaml
guardrails:
  input:
    max_length: 5000
    block_topics: [violence, illegal_activity]
    pii_filter: redact
  output:
    must_include: [disclaimer]
    max_length: 2000
    content_filter: moderate
```

**LangChain equivalent:** LangChain guardrails, NeMo Guardrails integration
**CrewAI equivalent:** Not built-in either (opportunity to differentiate)

---

## 4. Prompt Templates & Variables (MEDIUM)

**What's missing:** System prompts support basic `{variable}` interpolation, but there's no reusable prompt template system, no partial templates, no template composition, and no way to version prompts independently from agents.

**Why it matters:** Teams reuse prompts across agents. A config-based framework should let you define prompt templates as standalone YAML files and reference them.

**What it could look like:**
```yaml
# prompts/customer-tone.yaml
version: 1
name: customer-tone
template: |
  You are a {role} for {company}.
  Always respond in a {tone} tone.
  {additional_instructions}
```
```yaml
# agents/support.yaml
system_prompt:
  template: customer-tone
  variables:
    role: support agent
    company: Acme Corp
    tone: friendly
```

**LangChain equivalent:** `PromptTemplate`, `ChatPromptTemplate`, prompt hub

---

## 5. Multi-Modal Input (MEDIUM)

**What's missing:** Messages are text-only. No support for image or audio input, even though OpenAI and Anthropic APIs support vision/audio natively.

**Why it matters:** Config-based agents should handle image input without code changes — just a YAML flag. Vision use cases (document analysis, screenshot QA) are increasingly common.

**What it could look like:**
```yaml
model: gpt-4o
capabilities:
  vision: true
  audio: false
```

**LangChain equivalent:** `HumanMessage` with `image_url` content blocks
**CrewAI equivalent:** Multimodal support via LangChain

---

## 6. LLM Response Caching (MEDIUM)

**What's missing:** No caching layer for LLM responses. Identical prompts always hit the provider API.

**Why it matters:** Saves cost and latency during development and for repetitive queries. Should be a single config toggle, not a code integration.

**What it could look like:**
```yaml
cache:
  enabled: true
  ttl: 3600          # seconds
  storage: sqlite    # reuse existing SQLite infra
  scope: session     # or global
```

**LangChain equivalent:** `SQLiteCache`, `InMemoryCache`, `RedisCache`

---

## 7. Environment Profiles (MEDIUM)

**What's missing:** No concept of dev/staging/prod profiles. All config is flat — same agent config regardless of environment.

**Why it matters:** Teams need different models, tokens, and providers per environment without duplicating YAML files. Config-based frameworks should make this trivial.

**What it could look like:**
```yaml
# crystral.yaml (project config)
profiles:
  dev:
    default_provider: groq
    default_model: llama-3.1-8b
  prod:
    default_provider: openai
    default_model: gpt-4o
```
```bash
crystral run support-agent --profile prod
```

---

## 8. Testing & Dry-Run Mode (MEDIUM)

**What's missing:** No mock providers, no dry-run mode, no test fixtures. No way to validate agent behavior without spending API credits.

**Why it matters:** Config-based agents should be testable config-first — define expected input/output pairs in YAML, run assertions without real LLM calls.

**What it could look like:**
```yaml
# tests/support-agent.test.yaml
agent: support-agent
tests:
  - input: "What's your return policy?"
    expect:
      contains: ["30 days", "refund"]
      max_tokens: 500
  - input: "DROP TABLE users"
    expect:
      not_contains: ["SQL", "database"]
```
```bash
crystral test                    # run all test YAMLs
crystral run support-agent --dry-run   # show prompt, tools, config without calling LLM
```

---

## 9. Workflow Conditional Logic & Routing (MEDIUM)

**What's missing:** Workflows rely entirely on LLM-driven orchestration. No declarative conditions, routing rules, or early-exit criteria in YAML.

**Why it matters:** Some workflows have deterministic steps that shouldn't depend on LLM judgment. Config-based routing keeps costs down and behavior predictable.

**What it could look like:**
```yaml
agents:
  - name: classifier
    agent: classify-agent
  - name: support
    agent: support-agent
    run_if: "classifier.output.category == 'support'"
  - name: sales
    agent: sales-agent
    run_if: "classifier.output.category == 'sales'"
```

**LangChain equivalent:** LangGraph conditional edges
**CrewAI equivalent:** Conditional task execution

---

## 10. Config Validation CLI (LOW)

**What's missing:** No explicit `crystral validate` command. Validation only happens at runtime when loading agents.

**Why it matters:** Config-first frameworks need a fast feedback loop. Validate YAML before deploying — catch typos, missing fields, bad references in CI/CD.

**What it could look like:**
```bash
crystral validate                     # validate all agents, tools, workflows
crystral validate agents/support.yaml # validate single file
```

---

## 11. Scheduling & Triggers (LOW)

**What's missing:** No cron/schedule config for periodic agent execution.

**Why it matters for config-based AI:** Recurring tasks (daily summaries, monitoring alerts) should be definable in YAML, not require external cron setup.

**What it could look like:**
```yaml
# schedules/daily-report.yaml
agent: report-agent
schedule: "0 9 * * *"    # every day at 9am
input: "Generate today's summary report"
```

**Note:** This is lower priority — can be handled externally. But having it in config reduces integration friction.

---

## 12. Observability & Log Levels (LOW)

**What's missing:** Inference logs exist but there's no configurable log level (debug/info/warn/error), no structured trace IDs, and no export to external observability tools.

**Why it matters:** Config-based debugging. Turn on verbose logging for one agent without code changes.

**What it could look like:**
```yaml
# crystral.yaml
logging:
  level: debug          # debug | info | warn | error
  trace: true           # add trace IDs to all operations
  export: stdout        # stdout | file | webhook
```

**LangChain equivalent:** LangSmith tracing, callback handlers

---

## 13. Agent Composition & Inheritance (LOW)

**What's missing:** No way to extend or compose agent configs. If 5 agents share the same provider, model, and base prompt, you repeat it 5 times.

**Why it matters:** DRY config. Inheritance is a natural pattern for YAML-based frameworks.

**What it could look like:**
```yaml
# agents/_base.yaml
provider: openai
model: gpt-4o
temperature: 0.7

# agents/support.yaml
extends: _base
name: support-agent
system_prompt: "You are a support agent..."
```

---

## Priority Summary

| Priority | Gap | Impact |
|----------|-----|--------|
| HIGH | Structured output schema | Core config feature, production blocker |
| HIGH | Retry & fallback providers | Production resilience, zero-code |
| HIGH | Guardrails & content filtering | Enterprise adoption |
| MEDIUM | Prompt templates & variables | Config reusability |
| MEDIUM | Multi-modal input | Growing use case, simple config flag |
| MEDIUM | LLM response caching | Cost & DX improvement |
| MEDIUM | Environment profiles | Team workflow essential |
| MEDIUM | Testing & dry-run | Config-first testing |
| MEDIUM | Workflow conditional routing | Predictable orchestration |
| LOW | Config validation CLI | CI/CD integration |
| LOW | Scheduling & triggers | Convenience, can be external |
| LOW | Observability & log levels | Debugging DX |
| LOW | Agent composition & inheritance | Config DRY-ness |
