import * as fs from 'node:fs';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { Message, Session, InferenceLog, RAGResult } from '../types/index.js';
import { findProjectRoot } from '../config/loader.js';

/**
 * Chunk with embedding for RAG storage
 */
export interface Chunk {
  id: string;
  collection: string;
  document_path: string;
  content: string;
  chunk_index: number;
  embedding?: number[];
}

/**
 * Storage adapter interface
 */
export interface StorageAdapter {
  // Sessions
  createSession(agentName: string, title?: string): Session;
  getSession(id: string): Session | null;
  listSessions(agentName?: string): Session[];
  deleteSession(id: string): void;
  
  // Messages
  addMessage(sessionId: string, msg: Omit<Message, 'id' | 'created_at'>): Message;
  getMessages(sessionId: string): Message[];
  
  // RAG chunks + embeddings
  storeChunks(collection: string, chunks: Omit<Chunk, 'id'>[]): void;
  getChunks(collection: string): Chunk[];
  searchRAG(collection: string, queryEmbedding: number[], limit: number, threshold?: number): RAGResult[];
  clearCollection(collection: string): void;
  getCollectionStats(collection: string): { chunks: number; documents: string[]; lastIndexed?: Date };
  
  // Logs
  logInference(log: Omit<InferenceLog, 'id' | 'created_at'>): void;
  getLogs(filter?: { agentName?: string; limit?: number; since?: Date }): InferenceLog[];

  // Cache
  getCachedResponse(key: string): string | null;
  setCachedResponse(key: string, response: string, expiresAt: Date): void;
  clearCache(): void;
  clearExpiredCache(): void;
  getCacheStats(): { entries: number; sizeBytes: number };

  close(): void;
}

/**
 * SQLite storage adapter implementation
 */
export class SQLiteStorage implements StorageAdapter {
  private db: Database.Database;
  private dbPath: string;
  private static instances: Map<string, SQLiteStorage> = new Map();
  
  private constructor(dbPath: string) {
    this.dbPath = dbPath;
    
    // Ensure directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    // Open database
    this.db = new Database(dbPath);
    
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    
    // Initialize schema
    this.initializeSchema();
  }
  
  /**
   * Get or create a storage instance for a project
   */
  static getInstance(cwd?: string): SQLiteStorage {
    const root = findProjectRoot(cwd) ?? (cwd ?? process.cwd());
    const dbPath = path.join(root, '.crystral', 'agents.db');
    
    if (!SQLiteStorage.instances.has(dbPath)) {
      SQLiteStorage.instances.set(dbPath, new SQLiteStorage(dbPath));
    }
    
    return SQLiteStorage.instances.get(dbPath)!;
  }
  
  /**
   * Initialize database schema
   */
  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id          TEXT PRIMARY KEY,
        agent_name  TEXT NOT NULL,
        title       TEXT,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS messages (
        id            TEXT PRIMARY KEY,
        session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        role          TEXT NOT NULL CHECK(role IN ('system','user','assistant','tool')),
        content       TEXT NOT NULL,
        tool_calls    TEXT,
        tool_call_id  TEXT,
        tokens_used   INTEGER,
        cost_usd      REAL,
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
      
      CREATE TABLE IF NOT EXISTS rag_chunks (
        id            TEXT PRIMARY KEY,
        collection    TEXT NOT NULL,
        document_path TEXT NOT NULL,
        content       TEXT NOT NULL,
        chunk_index   INTEGER,
        content_hash  TEXT,
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_rag_chunks_collection ON rag_chunks(collection);
      CREATE INDEX IF NOT EXISTS idx_rag_chunks_hash ON rag_chunks(collection, content_hash);
      
      CREATE TABLE IF NOT EXISTS rag_embeddings (
        chunk_id      TEXT PRIMARY KEY,
        embedding     BLOB NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS rag_index_metadata (
        collection    TEXT PRIMARY KEY,
        last_indexed  DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS inference_logs (
        id            TEXT PRIMARY KEY,
        session_id    TEXT,
        agent_name    TEXT NOT NULL,
        provider      TEXT NOT NULL,
        model         TEXT NOT NULL,
        input_tokens  INTEGER,
        output_tokens INTEGER,
        cost_usd      REAL,
        latency_ms    INTEGER,
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_inference_logs_agent ON inference_logs(agent_name);
      CREATE INDEX IF NOT EXISTS idx_inference_logs_created ON inference_logs(created_at);

      CREATE TABLE IF NOT EXISTS llm_cache (
        key TEXT PRIMARY KEY,
        provider TEXT,
        model TEXT,
        response TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_llm_cache_expires ON llm_cache(expires_at);
    `);
  }
  
  // ============================================
  // Sessions
  // ============================================
  
  createSession(agentName: string, title?: string): Session {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, agent_name, title)
      VALUES (?, ?, ?)
    `);
    stmt.run(id, agentName, title ?? null);
    
    return {
      id,
      agent_name: agentName,
      ...(title ? { title } : {}),
      created_at: new Date().toISOString(),
    };
  }
  
  getSession(id: string): Session | null {
    const stmt = this.db.prepare(`
      SELECT s.*, COUNT(m.id) as message_count
      FROM sessions s
      LEFT JOIN messages m ON s.id = m.session_id
      WHERE s.id = ?
      GROUP BY s.id
    `);
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    
    if (!row) return null;
    
    const title = row.title as string | null;
    return {
      id: row.id as string,
      agent_name: row.agent_name as string,
      ...(title ? { title } : {}),
      created_at: row.created_at as string,
      message_count: row.message_count as number,
    };
  }
  
  listSessions(agentName?: string): Session[] {
    let sql = `
      SELECT s.*, COUNT(m.id) as message_count
      FROM sessions s
      LEFT JOIN messages m ON s.id = m.session_id
    `;
    
    if (agentName) {
      sql += ' WHERE s.agent_name = ?';
    }
    
    sql += ' GROUP BY s.id ORDER BY s.created_at DESC';
    
    const stmt = this.db.prepare(sql);
    const rows = agentName ? stmt.all(agentName) : stmt.all();
    
    return (rows as Record<string, unknown>[]).map(row => {
      const title = row.title as string | null;
      return {
        id: row.id as string,
        agent_name: row.agent_name as string,
        ...(title ? { title } : {}),
        created_at: row.created_at as string,
        message_count: row.message_count as number,
      };
    });
  }
  
  deleteSession(id: string): void {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
    stmt.run(id);
  }
  
  // ============================================
  // Messages
  // ============================================
  
  addMessage(sessionId: string, msg: Omit<Message, 'id' | 'created_at'>): Message {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO messages (id, session_id, role, content, tool_calls, tool_call_id, tokens_used, cost_usd)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      sessionId,
      msg.role,
      msg.content,
      msg.tool_calls ? JSON.stringify(msg.tool_calls) : null,
      msg.tool_call_id ?? null,
      msg.tokens_used ?? null,
      msg.cost_usd ?? null
    );
    
    return {
      id,
      ...msg,
      created_at: new Date().toISOString(),
    };
  }
  
  getMessages(sessionId: string): Message[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE session_id = ?
      ORDER BY created_at ASC
    `);
    const rows = stmt.all(sessionId) as Record<string, unknown>[];
    
    return rows.map(row => {
      const toolCalls = row.tool_calls ? JSON.parse(row.tool_calls as string) : undefined;
      const toolCallId = row.tool_call_id as string | null;
      const tokensUsed = row.tokens_used as number | null;
      const costUsd = row.cost_usd as number | null;
      return {
        id: row.id as string,
        role: row.role as Message['role'],
        content: row.content as string,
        ...(toolCalls ? { tool_calls: toolCalls } : {}),
        ...(toolCallId ? { tool_call_id: toolCallId } : {}),
        ...(tokensUsed !== null ? { tokens_used: tokensUsed } : {}),
        ...(costUsd !== null ? { cost_usd: costUsd } : {}),
        created_at: row.created_at as string,
      };
    });
  }
  
  // ============================================
  // RAG
  // ============================================
  
  storeChunks(collection: string, chunks: Omit<Chunk, 'id'>[]): void {
    const insertChunk = this.db.prepare(`
      INSERT INTO rag_chunks (id, collection, document_path, content, chunk_index, content_hash)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const insertEmbedding = this.db.prepare(`
      INSERT OR REPLACE INTO rag_embeddings (chunk_id, embedding)
      VALUES (?, ?)
    `);
    
    const updateMetadata = this.db.prepare(`
      INSERT OR REPLACE INTO rag_index_metadata (collection, last_indexed)
      VALUES (?, CURRENT_TIMESTAMP)
    `);
    
    const transaction = this.db.transaction(() => {
      for (const chunk of chunks) {
        const id = uuidv4();
        const contentHash = this.hashContent(chunk.content);
        
        insertChunk.run(id, collection, chunk.document_path, chunk.content, chunk.chunk_index, contentHash);
        
        if (chunk.embedding) {
          const embeddingBuffer = Buffer.from(new Float64Array(chunk.embedding).buffer);
          insertEmbedding.run(id, embeddingBuffer);
        }
      }
      
      updateMetadata.run(collection);
    });
    
    transaction();
  }
  
  getChunks(collection: string): Chunk[] {
    const stmt = this.db.prepare(`
      SELECT c.*, e.embedding
      FROM rag_chunks c
      LEFT JOIN rag_embeddings e ON c.id = e.chunk_id
      WHERE c.collection = ?
      ORDER BY c.document_path, c.chunk_index
    `);
    const rows = stmt.all(collection) as Record<string, unknown>[];
    
    return rows.map(row => {
      const embedding = row.embedding ? this.bufferToEmbedding(row.embedding as Buffer) : undefined;
      return {
        id: row.id as string,
        collection: row.collection as string,
        document_path: row.document_path as string,
        content: row.content as string,
        chunk_index: row.chunk_index as number,
        ...(embedding ? { embedding } : {}),
      };
    });
  }
  
  searchRAG(collection: string, queryEmbedding: number[], limit: number, threshold = 0.7): RAGResult[] {
    // Get all chunks with embeddings
    const stmt = this.db.prepare(`
      SELECT c.id, c.content, c.document_path, e.embedding
      FROM rag_chunks c
      JOIN rag_embeddings e ON c.id = e.chunk_id
      WHERE c.collection = ?
    `);
    const rows = stmt.all(collection) as Record<string, unknown>[];
    
    // Calculate cosine similarity for each chunk
    const results: Array<{ chunk: Record<string, unknown>; similarity: number }> = [];
    
    for (const row of rows) {
      const embedding = this.bufferToEmbedding(row.embedding as Buffer);
      const similarity = this.cosineSimilarity(queryEmbedding, embedding);
      
      if (similarity >= threshold) {
        results.push({ chunk: row, similarity });
      }
    }
    
    // Sort by similarity descending and limit
    results.sort((a, b) => b.similarity - a.similarity);
    const topResults = results.slice(0, limit);
    
    return topResults.map(r => ({
      chunk_id: r.chunk.id as string,
      content: r.chunk.content as string,
      document_path: r.chunk.document_path as string,
      similarity: r.similarity,
    }));
  }
  
  clearCollection(collection: string): void {
    const deleteChunks = this.db.prepare('DELETE FROM rag_chunks WHERE collection = ?');
    const deleteMetadata = this.db.prepare('DELETE FROM rag_index_metadata WHERE collection = ?');
    
    const transaction = this.db.transaction(() => {
      // Delete embeddings first (via chunk IDs)
      const chunkIds = this.db.prepare('SELECT id FROM rag_chunks WHERE collection = ?').all(collection) as { id: string }[];
      const deleteEmbedding = this.db.prepare('DELETE FROM rag_embeddings WHERE chunk_id = ?');
      for (const { id } of chunkIds) {
        deleteEmbedding.run(id);
      }
      
      deleteChunks.run(collection);
      deleteMetadata.run(collection);
    });
    
    transaction();
  }
  
  getCollectionStats(collection: string): { chunks: number; documents: string[]; lastIndexed?: Date } {
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM rag_chunks WHERE collection = ?');
    const countResult = countStmt.get(collection) as { count: number };
    
    const docsStmt = this.db.prepare('SELECT DISTINCT document_path FROM rag_chunks WHERE collection = ?');
    const docsResult = docsStmt.all(collection) as { document_path: string }[];
    
    const metaStmt = this.db.prepare('SELECT last_indexed FROM rag_index_metadata WHERE collection = ?');
    const metaResult = metaStmt.get(collection) as { last_indexed: string } | undefined;
    
    return {
      chunks: countResult.count,
      documents: docsResult.map(r => r.document_path),
      ...(metaResult ? { lastIndexed: new Date(metaResult.last_indexed) } : {}),
    };
  }
  
  // ============================================
  // Logs
  // ============================================
  
  logInference(log: Omit<InferenceLog, 'id' | 'created_at'>): void {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO inference_logs (id, session_id, agent_name, provider, model, input_tokens, output_tokens, cost_usd, latency_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      log.session_id ?? null,
      log.agent_name,
      log.provider,
      log.model,
      log.input_tokens,
      log.output_tokens,
      log.cost_usd,
      log.latency_ms
    );
  }
  
  getLogs(filter?: { agentName?: string; limit?: number; since?: Date }): InferenceLog[] {
    let sql = 'SELECT * FROM inference_logs WHERE 1=1';
    const params: (string | number)[] = [];
    
    if (filter?.agentName) {
      sql += ' AND agent_name = ?';
      params.push(filter.agentName);
    }
    
    if (filter?.since) {
      sql += ' AND created_at >= ?';
      params.push(filter.since.toISOString());
    }
    
    sql += ' ORDER BY created_at DESC';
    
    if (filter?.limit) {
      sql += ' LIMIT ?';
      params.push(filter.limit);
    }
    
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as Record<string, unknown>[];
    
    return rows.map(row => {
      const sessionId = row.session_id as string | null;
      return {
        id: row.id as string,
        ...(sessionId ? { session_id: sessionId } : {}),
        agent_name: row.agent_name as string,
        provider: row.provider as string,
        model: row.model as string,
        input_tokens: row.input_tokens as number,
        output_tokens: row.output_tokens as number,
        cost_usd: row.cost_usd as number,
        latency_ms: row.latency_ms as number,
        created_at: row.created_at as string,
      };
    });
  }
  
  // ============================================
  // Cache
  // ============================================

  getCachedResponse(key: string): string | null {
    const stmt = this.db.prepare(`
      SELECT response FROM llm_cache
      WHERE key = ? AND expires_at > datetime('now')
    `);
    const row = stmt.get(key) as { response: string } | undefined;
    return row ? row.response : null;
  }

  setCachedResponse(key: string, response: string, expiresAt: Date): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO llm_cache (key, response, expires_at)
      VALUES (?, ?, ?)
    `);
    stmt.run(key, response, expiresAt.toISOString());
  }

  clearCache(): void {
    this.db.prepare('DELETE FROM llm_cache').run();
  }

  clearExpiredCache(): void {
    this.db.prepare("DELETE FROM llm_cache WHERE expires_at < datetime('now')").run();
  }

  getCacheStats(): { entries: number; sizeBytes: number } {
    const countRow = this.db.prepare('SELECT COUNT(*) as count FROM llm_cache').get() as { count: number };
    const sizeRow = this.db.prepare(
      'SELECT COALESCE(SUM(LENGTH(response)), 0) as size FROM llm_cache',
    ).get() as { size: number };
    return { entries: countRow.count, sizeBytes: sizeRow.size };
  }

  // ============================================
  // Utility
  // ============================================
  
  private hashContent(content: string): string {
    // Simple hash for content deduplication
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
  
  private bufferToEmbedding(buffer: Buffer): number[] {
    const float64Array = new Float64Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 8);
    return Array.from(float64Array);
  }
  
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i]! * b[i]!;
      normA += a[i]! * a[i]!;
      normB += b[i]! * b[i]!;
    }
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  
  close(): void {
    this.db.close();
    SQLiteStorage.instances.delete(this.dbPath);
  }
}

/**
 * Get storage path for a project
 */
export function getStoragePath(cwd?: string): string {
  const root = findProjectRoot(cwd) ?? (cwd ?? process.cwd());
  return path.join(root, '.crystral', 'agents.db');
}
