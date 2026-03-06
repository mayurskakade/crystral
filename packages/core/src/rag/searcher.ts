import type { RAGConfig } from '../types/index.js';
import type { StorageAdapter } from '../storage/index.js';
import { createEmbedder } from './embedder.js';

/**
 * Search result from RAG query
 */
export interface RAGSearchResult {
  /** Chunk content */
  content: string;
  /** Source file path */
  sourcePath: string;
  /** Chunk index in source */
  chunkIndex: number;
  /** Similarity score (0-1) */
  score: number;
  /** Collection name */
  collection: string;
}

/**
 * RAG Searcher class
 */
export class RAGSearcher {
  private storage: StorageAdapter;
  private config: RAGConfig;
  private embedder: ReturnType<typeof createEmbedder>;
  
  constructor(storage: StorageAdapter, config: RAGConfig) {
    this.storage = storage;
    this.config = config;
    this.embedder = createEmbedder({
      provider: config.embedding_provider,
      model: config.embedding_model,
    });
  }
  
  /**
   * Search for similar chunks
   */
  async search(query: string): Promise<RAGSearchResult[]> {
    // Generate embedding for query
    const queryEmbedding = await this.embedder.embed(query);
    
    // Search all configured collections
    const allResults: RAGSearchResult[] = [];
    
    for (const collection of this.config.collections) {
      const results = this.storage.searchRAG(
        collection,
        queryEmbedding.embedding,
        this.config.match_count,
        this.config.match_threshold
      );
      
      // Convert to search results
      for (const result of results) {
        allResults.push({
          content: result.content,
          sourcePath: result.document_path,
          chunkIndex: 0, // Not returned by searchRAG
          score: result.similarity,
          collection,
        });
      }
    }
    
    // Sort by score (descending) and return top results
    allResults.sort((a, b) => b.score - a.score);
    
    return allResults.slice(0, this.config.match_count);
  }
  
  /**
   * Search with context building
   */
  async searchWithContext(
    query: string,
    options?: {
      maxContextLength?: number;
      includeSources?: boolean;
    }
  ): Promise<{
    context: string;
    sources: Array<{ path: string; score: number }>;
  }> {
    const results = await this.search(query);
    
    const maxContextLength = options?.maxContextLength ?? 4000;
    const includeSources = options?.includeSources ?? true;
    
    // Build context string
    const parts: string[] = [];
    let currentLength = 0;
    const sources: Array<{ path: string; score: number }> = [];
    
    for (const result of results) {
      const sourcePrefix = includeSources 
        ? `[${result.sourcePath}]\n` 
        : '';
      const chunkText = sourcePrefix + result.content + '\n\n';
      
      if (currentLength + chunkText.length > maxContextLength) {
        break;
      }
      
      parts.push(chunkText);
      currentLength += chunkText.length;
      
      // Add unique sources
      if (!sources.some(s => s.path === result.sourcePath)) {
        sources.push({
          path: result.sourcePath,
          score: result.score,
        });
      }
    }
    
    return {
      context: parts.join(''),
      sources,
    };
  }
  
  /**
   * Find similar chunks to a given chunk
   */
  async findSimilar(
    collection: string,
    sourcePath: string,
    chunkIndex: number,
    topK?: number
  ): Promise<RAGSearchResult[]> {
    // Get all chunks and find the original
    const chunks = this.storage.getChunks(collection);
    const originalChunk = chunks.find(c => 
      c.document_path === sourcePath && c.chunk_index === chunkIndex
    );
    
    if (!originalChunk || !originalChunk.embedding) {
      return [];
    }
    
    // Search for similar chunks
    const results = this.storage.searchRAG(
      collection,
      originalChunk.embedding,
      (topK ?? 5) + 1, // +1 to exclude the original
      0.5 // Lower threshold for similar search
    );
    
    // Filter out the original chunk and convert
    return results
      .filter(r => !(r.document_path === sourcePath))
      .slice(0, topK ?? 5)
      .map(result => ({
        content: result.content,
        sourcePath: result.document_path,
        chunkIndex: 0, // Not in RAGResult
        score: result.similarity,
        collection,
      }));
  }
}

/**
 * Create a RAG searcher
 */
export function createRAGSearcher(
  storage: StorageAdapter,
  config: RAGConfig
): RAGSearcher {
  return new RAGSearcher(storage, config);
}

/**
 * Format RAG results as context for an LLM prompt
 */
export function formatRAGContext(results: RAGSearchResult[]): string {
  if (results.length === 0) {
    return '';
  }
  
  const lines: string[] = ['Relevant context from knowledge base:\n'];
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i]!;
    lines.push(`[${i + 1}] Source: ${result.sourcePath}`);
    lines.push(`${result.content}`);
    lines.push('');
  }
  
  return lines.join('\n');
}
