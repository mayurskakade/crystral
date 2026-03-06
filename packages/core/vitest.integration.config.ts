import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: path.resolve(__dirname, 'src'),
  test: {
    environment: 'node',
    include: ['__tests__/**/*.integration.test.ts'],
    testTimeout: 30000,
    reporters: ['verbose'],
    globals: false,
  },
});
