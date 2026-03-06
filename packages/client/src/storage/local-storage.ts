import type { Message, StorageAdapter } from '../types.js';

/**
 * Browser localStorage adapter.
 * Sessions persist across page refreshes until localStorage is cleared.
 *
 * @example
 * ```typescript
 * import { CrystralClient, LocalStorageAdapter } from '@crystralai/client';
 *
 * const client = new CrystralClient({
 *   provider: 'openai',
 *   model: 'gpt-4o',
 *   apiKey: userKey,
 *   storage: new LocalStorageAdapter('my-app'),
 * });
 * ```
 */
export class LocalStorageAdapter implements StorageAdapter {
  private prefix: string;
  private indexKey: string;

  constructor(namespace = 'crystralai') {
    this.prefix = `${namespace}:session:`;
    this.indexKey = `${namespace}:sessions`;
  }

  createSession(): string {
    const id = crypto.randomUUID();
    const sessions = this.listSessions();
    sessions.push(id);
    localStorage.setItem(this.indexKey, JSON.stringify(sessions));
    localStorage.setItem(`${this.prefix}${id}`, JSON.stringify([]));
    return id;
  }

  getMessages(sessionId: string): Message[] {
    const raw = localStorage.getItem(`${this.prefix}${sessionId}`);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as Message[];
    } catch {
      return [];
    }
  }

  saveMessages(sessionId: string, messages: Message[]): void {
    localStorage.setItem(`${this.prefix}${sessionId}`, JSON.stringify(messages));
  }

  listSessions(): string[] {
    const raw = localStorage.getItem(this.indexKey);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  }

  deleteSession(sessionId: string): void {
    localStorage.removeItem(`${this.prefix}${sessionId}`);
    const sessions = this.listSessions().filter(id => id !== sessionId);
    localStorage.setItem(this.indexKey, JSON.stringify(sessions));
  }
}
