# @crystralai/studio

Local development dashboard for Crystral — visual agent interaction, session browsing, and log viewing.

## Installation

```bash
npm install @crystralai/studio
# or
pnpm add @crystralai/studio
```

## Usage

```typescript
import { startStudio } from '@crystralai/studio';

// Start the dashboard server (default: http://127.0.0.1:4000)
await startStudio({
  port: 4000,
  cwd: process.cwd(),   // directory containing your agents/ folder
  openBrowser: true,    // auto-open browser on start
});
```

## API

### `startStudio(options?)`

Starts the Studio HTTP server and prints a banner.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | `number` | `4000` | Port to listen on |
| `host` | `string` | `'127.0.0.1'` | Host to bind to |
| `cwd` | `string` | `process.cwd()` | Working directory for config resolution |
| `openBrowser` | `boolean` | `false` | Open browser automatically on start |

### `createStudioServer(options?)`

Returns the Hono app without starting the server. Useful for embedding in an existing HTTP server or for testing.

```typescript
import { createStudioServer } from '@crystralai/studio';

const app = createStudioServer({ cwd: '/path/to/project' });
// mount `app` in your own server
```

## Requirements

- Node.js ≥ 18
- A Crystral project with an `agents/` directory

## License

MIT © [Mayur Kakade](https://github.com/mayurskakade)
