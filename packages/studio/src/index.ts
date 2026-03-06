import { exec } from 'node:child_process';
import { serve } from '@hono/node-server';
import { createStudioApp } from './server.js';

export interface StudioOptions {
  /** Port to listen on (default: 4000) */
  port?: number;
  /** Host to bind to (default: '127.0.0.1') */
  host?: string;
  /** Working directory for config resolution (default: process.cwd()) */
  cwd?: string;
  /** Open browser on start (default: false) */
  openBrowser?: boolean;
}

/**
 * Create the Studio Hono app without starting the server.
 * Useful for testing or embedding in another server.
 */
export function createStudioServer(options?: StudioOptions) {
  const cwd = options?.cwd ?? process.cwd();
  return createStudioApp(cwd);
}

/**
 * Start the Studio HTTP server and print a banner.
 */
export async function startStudio(options?: StudioOptions): Promise<void> {
  const port = options?.port ?? 4000;
  const host = options?.host ?? '127.0.0.1';
  const cwd = options?.cwd ?? process.cwd();
  const openBrowser = options?.openBrowser ?? false;

  const app = createStudioApp(cwd);

  serve({ fetch: app.fetch, port, hostname: host }, () => {
    const url = `http://${host}:${port}`;
    console.log('');
    console.log('  Crystral Studio');
    console.log(`  Local:   ${url}`);
    console.log(`  Project: ${cwd}`);
    console.log('');

    if (openBrowser) {
      const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${cmd} ${url}`);
    }
  });
}

export { createStudioApp } from './server.js';
