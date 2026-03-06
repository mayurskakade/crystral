import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorage } from '../storage/memory.js';

describe('MemoryStorage', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('creates a session and returns a UUID', () => {
    const id = storage.createSession();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('returns empty messages for a new session', () => {
    const id = storage.createSession();
    expect(storage.getMessages(id)).toEqual([]);
  });

  it('returns empty array for unknown session', () => {
    expect(storage.getMessages('non-existent')).toEqual([]);
  });

  it('saves and retrieves messages', () => {
    const id = storage.createSession();
    const msgs = [
      { role: 'user' as const, content: 'Hello' },
      { role: 'assistant' as const, content: 'Hi there!' },
    ];
    storage.saveMessages(id, msgs);
    expect(storage.getMessages(id)).toEqual(msgs);
  });

  it('overwrites messages on subsequent saves', () => {
    const id = storage.createSession();
    storage.saveMessages(id, [{ role: 'user' as const, content: 'First' }]);
    storage.saveMessages(id, [{ role: 'user' as const, content: 'Second' }]);
    expect(storage.getMessages(id)).toHaveLength(1);
    expect(storage.getMessages(id)[0]!.content).toBe('Second');
  });

  it('lists all sessions', () => {
    const id1 = storage.createSession();
    const id2 = storage.createSession();
    const sessions = storage.listSessions();
    expect(sessions).toContain(id1);
    expect(sessions).toContain(id2);
  });

  it('deletes a session', () => {
    const id = storage.createSession();
    storage.saveMessages(id, [{ role: 'user' as const, content: 'Hello' }]);
    storage.deleteSession(id);
    expect(storage.getMessages(id)).toEqual([]);
    expect(storage.listSessions()).not.toContain(id);
  });

  it('each session is independent', () => {
    const id1 = storage.createSession();
    const id2 = storage.createSession();
    storage.saveMessages(id1, [{ role: 'user' as const, content: 'Session 1' }]);
    storage.saveMessages(id2, [{ role: 'user' as const, content: 'Session 2' }]);
    expect(storage.getMessages(id1)[0]!.content).toBe('Session 1');
    expect(storage.getMessages(id2)[0]!.content).toBe('Session 2');
  });
});
