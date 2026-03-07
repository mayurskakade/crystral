# Ad Template Generator

AI-powered social media post template generator built with **Crystal AI**.

Demonstrates: `GoogleProvider`, `withRetry`, `Logger`, `hashCacheKey` from `@crystralai/core`.

## Stack

| Layer | Tech |
|-------|------|
| AI    | Gemini 2.5 Pro via `@crystralai/core` `GoogleProvider` |
| Server | NestJS (port 3001) |
| Client | Next.js 15 + Tailwind CSS (port 3000) |
| Export | `html-to-image` (PNG/JPG/WebP) + FFmpeg.wasm (MP4/WebM) |

## Quick Start

### 1. Install dependencies

From the monorepo root:

```bash
pnpm install
pnpm build:core
```

### 2. Set up environment

```bash
cp examples/ad-template-generator/.env.example examples/ad-template-generator/server/.env
# Edit server/.env and add your GEMINI_API_KEY
```

### 3. Start the server

```bash
cd examples/ad-template-generator/server
pnpm dev
```

### 4. Start the client

```bash
cd examples/ad-template-generator/client
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

- **Static templates** — HTML + Tailwind CSS, exported as PNG/JPG/WebP
- **Animated templates** — CSS `@keyframes` animations, exported as MP4/WebM
- **Product context** — Feed product details for on-brand copy
- **Reference image** — Upload a reference for style inspiration
- **Live editor** — Swap colors, edit text in real-time without re-generating
- **Brand kit** — Apply unified colors + font to all templates at once
- **Export** — Download any template as image or video

## Crystal AI Usage

```typescript
import { GoogleProvider, withRetry, Logger, hashCacheKey } from '@crystralai/core';

// Gemini API call with retry
const result = await withRetry(
  () => provider.complete(messages, 'gemini-2.5-pro-preview-03-25', {
    response_format: { type: 'json_object' },
    max_tokens: 8192,
  }),
  { max_attempts: 3, backoff: 'exponential', retry_on: ['rate_limit', 'server_error'] },
);

// Cache by request hash
const cacheKey = hashCacheKey({ prompt, type, count });
```
