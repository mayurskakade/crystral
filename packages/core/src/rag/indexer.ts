// @ts-nocheck
// This file is kept for historical reference only. It is not exported and not used.
// Crystal AI no longer manages in-house RAG indexing — use external vector stores.
import * as fs from 'node:fs';
import * as path from 'node:path';
interface RAGCollectionConfig {
  name: string;
  embedding_provider: string;
  embedding_model: string;
  chunk_size: number;
  chunk_overlap: number;
  include: string[];
  exclude: string[];
}
import type { StorageAdapter, Chunk } from '../storage/index.js';
import { chunkDocument } from './chunker.js';
import { createEmbedder } from './embedder.js';

/**
 * Indexing progress callback
 */
export type IndexingProgressCallback = (progress: IndexingProgress) => void;

/**
 * Indexing progress information
 */
export interface IndexingProgress {
  /** Current phase */
  phase: 'scanning' | 'reading' | 'chunking' | 'embedding' | 'storing';
  /** Total files found */
  totalFiles: number;
  /** Files processed so far */
  processedFiles: number;
  /** Current file being processed */
  currentFile?: string;
  /** Total chunks created */
  totalChunks: number;
  /** Chunks embedded so far */
  embeddedChunks: number;
  /** Total tokens used */
  totalTokens: number;
  /** Error message if any */
  error?: string;
}

/**
 * Indexing result
 */
export interface IndexingResult {
  /** Number of files indexed */
  fileCount: number;
  /** Number of chunks created */
  chunkCount: number;
  /** Total tokens used for embedding */
  totalTokens: number;
  /** Total time in milliseconds */
  durationMs: number;
  /** Any errors encountered */
  errors: Array<{ file: string; error: string }>;
}

/**
 * RAG Indexer class
 */
export class RAGIndexer {
  private storage: StorageAdapter;
  private config: RAGCollectionConfig;
  private embedder: ReturnType<typeof createEmbedder>;
  private collectionPath: string;
  
  constructor(
    storage: StorageAdapter,
    config: RAGCollectionConfig,
    collectionPath: string
  ) {
    this.storage = storage;
    this.config = config;
    this.collectionPath = collectionPath;
    this.embedder = createEmbedder({
      provider: config.embedding_provider,
      model: config.embedding_model,
    });
  }
  
  /**
   * Index all documents in the collection
   */
  async index(progressCallback?: IndexingProgressCallback): Promise<IndexingResult> {
    const startTime = Date.now();
    const errors: Array<{ file: string; error: string }> = [];
    let totalTokens = 0;
    let totalChunks = 0;
    let processedFiles = 0;
    
    try {
      // Phase 1: Scan for files
      progressCallback?.({
        phase: 'scanning',
        totalFiles: 0,
        processedFiles: 0,
        totalChunks: 0,
        embeddedChunks: 0,
        totalTokens: 0,
      });
      
      const files = await this.scanFiles();
      const totalFiles = files.length;
      
      // Clear existing chunks for this collection
      this.storage.clearCollection(this.config.name);
      
      // Process each file
      for (const file of files) {
        try {
          progressCallback?.({
            phase: 'reading',
            totalFiles,
            processedFiles,
            currentFile: file,
            totalChunks,
            embeddedChunks: 0,
            totalTokens,
          });
          
          // Read file content
          const content = await this.readFile(file);
          
          // Phase 2: Chunk document
          progressCallback?.({
            phase: 'chunking',
            totalFiles,
            processedFiles,
            currentFile: file,
            totalChunks,
            embeddedChunks: 0,
            totalTokens,
          });
          
          const relativePath = path.relative(this.collectionPath, file);
          const chunks = chunkDocument(content, relativePath, this.config);
          
          // Phase 3: Embed chunks
          progressCallback?.({
            phase: 'embedding',
            totalFiles,
            processedFiles,
            currentFile: file,
            totalChunks: totalChunks + chunks.length,
            embeddedChunks: 0,
            totalTokens,
          });
          
          // Embed in batches of 100 (API limit)
          const batchSize = 100;
          for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);
            const texts = batch.map(c => c.content);
            
            const result = await this.embedder.embedBatch(texts);
            totalTokens += result.totalTokens;
            
            // Add embeddings to chunks
            for (let j = 0; j < batch.length; j++) {
              const embedding = result.embeddings[j];
              if (embedding) {
                batch[j]!.embedding = embedding;
              }
            }
            
            progressCallback?.({
              phase: 'embedding',
              totalFiles,
              processedFiles,
              currentFile: file,
              totalChunks: totalChunks + chunks.length,
              embeddedChunks: i + batch.length,
              totalTokens,
            });
          }
          
          // Phase 4: Store chunks
          progressCallback?.({
            phase: 'storing',
            totalFiles,
            processedFiles,
            currentFile: file,
            totalChunks: totalChunks + chunks.length,
            embeddedChunks: chunks.length,
            totalTokens,
          });
          
          // Convert to storage format and batch store
          const storageChunks: Array<Omit<Chunk, 'id'>> = chunks.map(chunk => {
            const base: Omit<Chunk, 'id'> = {
              collection: this.config.name,
              document_path: chunk.sourcePath,
              chunk_index: chunk.chunkIndex,
              content: chunk.content,
            };
            if (chunk.embedding) {
              base.embedding = chunk.embedding;
            }
            return base;
          });
          
          this.storage.storeChunks(this.config.name, storageChunks);
          
          totalChunks += chunks.length;
          processedFiles++;
        } catch (error) {
          errors.push({
            file,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
      
      const durationMs = Date.now() - startTime;
      
      return {
        fileCount: processedFiles,
        chunkCount: totalChunks,
        totalTokens,
        durationMs,
        errors,
      };
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Scan for files matching include/exclude patterns
   */
  private async scanFiles(): Promise<string[]> {
    const files: string[] = [];
    const includePatterns = this.config.include;
    const excludePatterns = this.config.exclude;
    
    const scanDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        // Skip hidden files and directories
        if (entry.name.startsWith('.')) {
          continue;
        }
        
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile()) {
          const relativePath = path.relative(this.collectionPath, fullPath);
          
          // Check include patterns
          const shouldInclude = includePatterns.some((pattern: string) =>
            this.matchPattern(relativePath, pattern)
          );

          // Check exclude patterns
          const shouldExclude = excludePatterns.some((pattern: string) =>
            this.matchPattern(relativePath, pattern)
          );
          
          if (shouldInclude && !shouldExclude) {
            files.push(fullPath);
          }
        }
      }
    };
    
    if (fs.existsSync(this.collectionPath)) {
      scanDir(this.collectionPath);
    }
    
    return files;
  }
  
  /**
   * Simple glob pattern matching
   */
  private matchPattern(path: string, pattern: string): boolean {
    // Convert glob to regex
    const regex = pattern
      .replace(/\*\*/g, '<<DOUBLE_STAR>>')
      .replace(/\*/g, '[^/]*')
      .replace(/<<DOUBLE_STAR>>/g, '.*')
      .replace(/\?/g, '[^/]')
      .replace(/\./g, '\\.');
    
    return new RegExp(`^${regex}$`).test(path);
  }
  
  /**
   * Read file content based on file type
   */
  private async readFile(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();
    
    // For now, only support text files
    // PDF support would require additional libraries
    if (['.md', '.txt', '.json', '.yaml', '.yml', '.csv'].includes(ext)) {
      return fs.promises.readFile(filePath, 'utf-8');
    }
    
    if (['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java'].includes(ext)) {
      return fs.promises.readFile(filePath, 'utf-8');
    }
    
    // Try to read as text
    try {
      return fs.promises.readFile(filePath, 'utf-8');
    } catch {
      throw new Error(`Unsupported file type: ${ext}`);
    }
  }
}

/**
 * Create a RAG indexer
 */
export function createRAGIndexer(
  storage: StorageAdapter,
  config: RAGCollectionConfig,
  collectionPath: string
): RAGIndexer {
  return new RAGIndexer(storage, config, collectionPath);
}
