import type { Message, StorageAdapter } from '../types.js';

/**
 * In-memory session storage. Default adapter.
 * Sessions are lost when the page is refreshed or the process exits.
 * Use LocalStorageAdapter or a custom adapter for persistence.
 */
export class MemoryStorage implements StorageAdapter {
  private sessions: Map<string, Message[]> = new Map();

  createSession(): string {
    const id = crypto.randomUUID();
    this.sessions.set(id, []);
    return id;
  }

  getMessages(sessionId: string): Message[] {
    return this.sessions.get(sessionId) ?? [];
  }

  saveMessages(sessionId: string, messages: Message[]): void {
    this.sessions.set(sessionId, messages);
  }

  listSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
