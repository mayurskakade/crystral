import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as yaml from 'js-yaml';
import type { StorageAdapter } from '../../storage/adapter.ts';
import type { Session, Message, InferenceLog, RAGResult } from '../../types/runtime.ts';

// ---------------------------------------------------------------------------
// Temp project helpers
// ---------------------------------------------------------------------------

export interface TempProject {
  dir: string;
  cleanup: () => void;
}

export function createTempProject(): TempProject {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crystral-test-'));
  return {
    dir,
    cleanup: () => {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    },
  };
}

export function writeYaml(dir: string, relPath: string, data: unknown): void {
  const fullPath = path.join(dir, relPath);
  const parentDir = path.dirname(fullPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }
  fs.writeFileSync(fullPath, yaml.dump(data, { indent: 2, lineWidth: -1, noRefs: true }), 'utf-8');
}

export function writeProjectConfig(
  dir: string,
  overrides: Record<string, unknown> = {},
): void {
  writeYaml(dir, 'crystral.config.yaml', {
    version: 1,
    project: 'test-project',
    ...overrides,
  });
}

export function writeAgent(
  dir: string,
  name: string,
  overrides: Record<string, unknown> = {},
): void {
  writeYaml(dir, `agents/${name}.yaml`, {
    version: 1,
    name,
    provider: 'openai',
    model: 'gpt-4o-mini',
    system_prompt: 'You are a helpful assistant.',
    ...overrides,
  });
}

export function writePrompt(
  dir: string,
  name: string,
  overrides: Record<string, unknown> = {},
): void {
  writeYaml(dir, `prompts/${name}.yaml`, {
    version: 1,
    name,
    template: 'Hello, {name}! You are a {role}.',
    defaults: { name: 'World', role: 'assistant' },
    ...overrides,
  });
}

export function writeTestSuite(
  dir: string,
  name: string,
  overrides: Record<string, unknown> = {},
): void {
  writeYaml(dir, `tests/${name}.yaml`, {
    version: 1,
    name,
    agent: 'test-agent',
    tests: [
      {
        name: 'basic test',
        input: 'Hello',
        expect: { contains: 'Hello' },
      },
    ],
    ...overrides,
  });
}

export function writeSchedule(
  dir: string,
  name: string,
  overrides: Record<string, unknown> = {},
): void {
  writeYaml(dir, `schedules/${name}.yaml`, {
    version: 1,
    name,
    agent: 'test-agent',
    schedule: '0 * * * *',
    input: 'Run scheduled task',
    enabled: true,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Mock Storage Adapter (in-memory, no SQLite)
// ---------------------------------------------------------------------------

interface CacheEntry {
  response: string;
  expiresAt: Date;
}

export function createMockStorage(): StorageAdapter {
  const sessions = new Map<string, Session>();
  const messages = new Map<string, Message[]>();
  const cache = new Map<string, CacheEntry>();
  let msgIdCounter = 0;

  return {
    createSession(agentName: string, title?: string): Session {
      const id = `sess_${Math.random().toString(36).slice(2)}`;
      const session: Session = {
        id,
        agent_name: agentName,
        created_at: new Date().toISOString(),
        ...(title ? { title } : {}),
      };
      sessions.set(id, session);
      messages.set(id, []);
      return session;
    },
    getSession(id: string): Session | null {
      return sessions.get(id) ?? null;
    },
    listSessions(agentName?: string): Session[] {
      const all = [...sessions.values()];
      return agentName ? all.filter(s => s.agent_name === agentName) : all;
    },
    deleteSession(id: string): void {
      sessions.delete(id);
      messages.delete(id);
    },
    addMessage(sessionId: string, msg: Omit<Message, 'id' | 'created_at'>): Message {
      const id = `msg_${++msgIdCounter}`;
      const message: Message = {
        id,
        ...msg,
        created_at: new Date().toISOString(),
      };
      const list = messages.get(sessionId) ?? [];
      list.push(message);
      messages.set(sessionId, list);
      return message;
    },
    getMessages(sessionId: string): Message[] {
      return messages.get(sessionId) ?? [];
    },
    storeChunks(): void { /* no-op */ },
    getChunks(): never[] { return []; },
    searchRAG(): RAGResult[] { return []; },
    clearCollection(): void { /* no-op */ },
    getCollectionStats() { return { chunks: 0, documents: [] }; },
    logInference(_log: Omit<InferenceLog, 'id' | 'created_at'>): void { /* no-op */ },
    getLogs(): InferenceLog[] { return []; },

    getCachedResponse(key: string): string | null {
      const entry = cache.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= new Date()) {
        cache.delete(key);
        return null;
      }
      return entry.response;
    },
    setCachedResponse(key: string, response: string, expiresAt: Date): void {
      cache.set(key, { response, expiresAt });
    },
    clearCache(): void {
      cache.clear();
    },
    clearExpiredCache(): void {
      const now = new Date();
      for (const [key, entry] of cache.entries()) {
        if (entry.expiresAt <= now) {
          cache.delete(key);
        }
      }
    },
    getCacheStats() {
      let sizeBytes = 0;
      for (const entry of cache.values()) {
        sizeBytes += entry.response.length;
      }
      return { entries: cache.size, sizeBytes };
    },
    close(): void { /* no-op */ },
  };
}

// ---------------------------------------------------------------------------
// Together AI config helper for integration tests
// ---------------------------------------------------------------------------

export function togetherConfig() {
  return {
    provider: 'together' as const,
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  };
}
