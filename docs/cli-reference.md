# CLI Reference

Crystal AI provides programmatic APIs rather than a standalone CLI binary. Project management, agent execution, and development workflows are handled through the SDK, Studio, and simple Node.js scripts. This reference documents how to perform common CLI-like operations.

> **Note:** Crystal AI does not ship a global `crystral` CLI command. Instead, operations are performed through the SDK API, the Studio dashboard, or lightweight launcher scripts.

---

## Project Initialization

Crystal AI projects follow a conventional directory layout. Initialize a project by creating the required structure and configuration file.

### Manual initialization

```bash
mkdir my-project && cd my-project
mkdir agents tools workflows prompts tests schedules
touch .env
```

Create `crystral.config.yaml`:

```yaml
version: 1
project: my-project
studio:
  port: 4000
  open_browser: true
logging:
  level: info
  trace: false
  export: stdout
```

Create your first agent in `agents/assistant.yaml`:

```yaml
version: "1"
name: assistant
provider: openai
model: gpt-4o-mini
system_prompt: You are a helpful assistant.
```

Set your API key:

```bash
echo "OPENAI_API_KEY=sk-..." >> .env
```

### Script-based initialization

Create an `init.mjs` script for repeatable project setup:

```javascript
import fs from 'node:fs';
import path from 'node:path';
import { writeProjectConfig, writeAgentConfig } from '@crystralai/core';

const dirs = ['agents', 'tools', 'workflows', 'prompts', 'tests', 'schedules'];
dirs.forEach(d => fs.mkdirSync(d, { recursive: true }));

writeProjectConfig({ version: 1, project: path.basename(process.cwd()) });
writeAgentConfig({
  version: 1,
  name: 'assistant',
  provider: 'openai',
  model: 'gpt-4o-mini',
  system_prompt: 'You are a helpful assistant.',
  temperature: 1.0,
  max_tokens: 4096,
  top_p: 1.0,
  presence_penalty: 0.0,
  frequency_penalty: 0.0,
  tools: [],
  mcp: [],
});

console.log('Project initialized.');
```

```bash
node init.mjs
```

---

## Running Agents

### One-shot execution

Create a `run.mjs` script:

```javascript
import { Crystral } from '@crystralai/sdk';

const client = new Crystral();
const agentName = process.argv[2] || 'assistant';
const message = process.argv.slice(3).join(' ') || 'Hello!';

const result = await client.run(agentName, message, {
  stream: true,
  onToken: (token) => process.stdout.write(token),
});

console.log();
console.log(`[session: ${result.sessionId} | tokens: ${result.usage.total} | ${result.durationMs}ms]`);
```

```bash
node run.mjs assistant "What is the capital of France?"
```

### Interactive chat

Create a `chat.mjs` script for multi-turn conversations:

```javascript
import readline from 'node:readline';
import { Crystral } from '@crystralai/sdk';

const client = new Crystral();
const agentName = process.argv[2] || 'assistant';
const agent = client.loadAgent(agentName);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
let sessionId;

console.log(`Chatting with "${agentName}" (Ctrl+C to exit)\n`);

function prompt() {
  rl.question('You: ', async (input) => {
    if (!input.trim()) return prompt();

    const result = await agent.run(input, {
      sessionId,
      stream: true,
      onToken: (token) => process.stdout.write(token),
    });

    sessionId = result.sessionId;
    console.log(`\n[tokens: ${result.usage.total}]\n`);
    prompt();
  });
}

prompt();
```

```bash
node chat.mjs support-bot
```

---

## Starting the Studio

Create a `studio.mjs` script:

```javascript
import { startStudio } from '@crystralai/studio';

startStudio({ port: 4000, openBrowser: true, cwd: process.cwd() });
```

```bash
node studio.mjs
```

See the [Studio documentation](./studio.md) for full details.

---

## Validation

Validate all YAML configuration files in your project:

```javascript
import { Crystral } from '@crystralai/sdk';

const client = new Crystral();
const result = client.validate();

console.log(`Scanned ${result.files.length} files`);
console.log(`  Valid:    ${result.valid}`);
console.log(`  Errors:  ${result.errors}`);
console.log(`  Warnings: ${result.warnings}`);

result.files
  .filter(f => !f.valid)
  .forEach(f => {
    console.log(`\n  ${f.file}:`);
    f.errors.forEach(e => console.log(`    ERROR: ${e}`));
  });
```

Create a `validate.mjs` script:

```javascript
import { validateProject } from '@crystralai/sdk';

const result = validateProject();

if (result.errors > 0) {
  result.files.filter(f => !f.valid).forEach(f => {
    console.error(`${f.file}: ${f.errors.join(', ')}`);
  });
  process.exit(1);
}

console.log(`All ${result.valid} files valid.`);
```

```bash
node validate.mjs
```

---

## Running Tests

Execute test suites defined in `tests/*.yaml`:

```javascript
import { Crystral } from '@crystralai/sdk';

const client = new Crystral();
const suiteName = process.argv[2] || 'assistant-tests';

const result = await client.test(suiteName);

console.log(`Suite: ${suiteName}`);
console.log(`  Passed: ${result.passed}`);
console.log(`  Failed: ${result.failed}`);

result.results
  .filter(r => !r.passed)
  .forEach(r => {
    console.log(`  FAIL: ${r.name} -- ${r.error}`);
  });

process.exit(result.failed > 0 ? 1 : 0);
```

```bash
node test.mjs assistant-tests
```

---

## Dry Run

Inspect how an agent's configuration resolves without making LLM calls:

```javascript
import { dryRun } from '@crystralai/sdk';

const result = dryRun('assistant');

console.log('Agent:', result.agentName);
console.log('Provider:', result.provider);
console.log('Model:', result.model);
console.log('System prompt:', result.resolvedSystemPrompt);
console.log('Tools:', result.tools);
console.log('Warnings:', result.warnings);
```

```bash
node dry-run.mjs
```

---

## Querying Logs

Retrieve inference logs from the local SQLite database:

```javascript
import { Crystral } from '@crystralai/sdk';

const client = new Crystral();

// Last 20 logs for a specific agent
const logs = client.getLogs({
  agentName: 'support-bot',
  limit: 20,
  since: new Date(Date.now() - 24 * 60 * 60 * 1000),
});

console.log('Agent         | Duration | Tokens');
console.log('-'.repeat(45));
logs.forEach(log => {
  console.log(
    `${log.agentName.padEnd(14)}| ${String(log.durationMs).padEnd(9)}| ${log.usage?.totalTokens}`
  );
});
```

---

## Common Operations Reference

| Operation | How to Perform |
|-----------|---------------|
| Initialize project | Create directory structure + `crystral.config.yaml` |
| Run an agent | `client.run(agentName, message)` via SDK |
| Interactive chat | SDK with `readline` in a loop (see example above) |
| Start Studio | `startStudio()` from `@crystralai/studio` |
| Validate config | `client.validate()` or `validateProject()` |
| Run tests | `client.test(suiteName)` |
| Dry run | `agent.dryRun()` or `dryRun(agentName)` |
| Query logs | `client.getLogs(filter)` |
| List agents | `listAgents(cwd)` from `@crystralai/core` |
| List tools | `listTools(cwd)` from `@crystralai/core` |
| List workflows | `listWorkflows(cwd)` from `@crystralai/core` |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | API key for OpenAI models. |
| `ANTHROPIC_API_KEY` | API key for Anthropic models. |
| `GROQ_API_KEY` | API key for Groq models. |
| `GOOGLE_API_KEY` | API key for Google Gemini models. |
| `TOGETHER_API_KEY` | API key for Together AI models. |
| `CRYSTRAL_PROFILE` | Active environment profile name (maps to `profiles` in `crystral.config.yaml`). |

> **Tip:** Store API keys in a `.env` file at your project root. The SDK loads it automatically via `dotenv`.

---

## Project Configuration (`crystral.config.yaml`)

The project configuration file is optional but enables Studio settings, logging, and environment profiles.

```yaml
version: 1
project: my-project

studio:
  port: 4000
  open_browser: true

logging:
  level: info        # debug | info | warn | error
  trace: false       # Enable trace IDs in RunResult
  export: stdout     # stdout | file

profiles:
  development:
    provider: groq
    model: llama-3.3-70b-versatile
    temperature: 0.9
  production:
    provider: openai
    model: gpt-4o
    temperature: 0.3
```

Activate a profile:

```bash
CRYSTRAL_PROFILE=development node run.mjs assistant "Hello"
```

---

## Credential Resolution Order

When the SDK needs an API key, it resolves credentials in this order:

1. Environment variable (e.g. `OPENAI_API_KEY`)
2. Project `.env` file
3. Global credentials file (`~/.crystral/credentials`)

If no credential is found, a `CredentialNotFoundError` is thrown with the expected environment variable name.

---

## package.json Scripts

Add these scripts to your project's `package.json` for convenience:

```json
{
  "scripts": {
    "studio": "node studio.mjs",
    "chat": "node chat.mjs",
    "validate": "node validate.mjs",
    "test:agents": "node test.mjs"
  }
}
```

```bash
npm run studio
npm run chat -- support-bot
npm run validate
npm run test:agents -- assistant-tests
```

---

## Example Workflow: End-to-End

```bash
# 1. Create project structure
mkdir my-ai-app && cd my-ai-app
mkdir agents tools

# 2. Create config
cat > crystral.config.yaml << 'EOF'
version: 1
project: my-ai-app
EOF

# 3. Create an agent
cat > agents/assistant.yaml << 'EOF'
version: "1"
name: assistant
provider: openai
model: gpt-4o-mini
system_prompt: You are a helpful coding assistant.
EOF

# 4. Set API key
echo "OPENAI_API_KEY=sk-your-key-here" > .env

# 5. Install dependencies
npm init -y
npm install @crystralai/sdk @crystralai/studio

# 6. Create launcher scripts
cat > studio.mjs << 'EOF'
import { startStudio } from '@crystralai/studio';
startStudio({ port: 4000, openBrowser: true });
EOF

# 7. Launch the Studio
node studio.mjs
```
