// @ts-nocheck
// This file is kept for historical reference only. It is not exported and not used.
// Crystal AI no longer manages in-house RAG chunking — use external vector stores.
interface RAGCollectionConfig {
  chunk_size: number;
  chunk_overlap: number;
  [key: string]: unknown;
}

/**
 * Text chunk for RAG indexing
 */
export interface TextChunk {
  /** Unique chunk ID */
  id: string;
  /** Source file path relative to collection root */
  sourcePath: string;
  /** Chunk index within the source file */
  chunkIndex: number;
  /** Text content */
  content: string;
  /** Character offset in source file */
  startOffset: number;
  /** End character offset in source file */
  endOffset: number;
  /** Embedding vector (set after embedding) */
  embedding?: number[];
}

/**
 * Split text into chunks for RAG indexing
 */
export function chunkText(
  text: string,
  options: {
    chunkSize: number;
    chunkOverlap: number;
    sourcePath: string;
    sourceId: string;
  }
): TextChunk[] {
  const { chunkSize, chunkOverlap, sourcePath, sourceId } = options;
  const chunks: TextChunk[] = [];
  
  // Normalize line endings
  const normalizedText = text.replace(/\r\n/g, '\n');
  
  let offset = 0;
  let chunkIndex = 0;
  
  while (offset < normalizedText.length) {
    // Calculate chunk boundaries
    let endOffset = offset + chunkSize;
    
    // If not at the end, try to break at a sentence or word boundary
    if (endOffset < normalizedText.length) {
      // Look for sentence boundary within last 200 chars
      const searchStart = Math.max(offset + chunkSize - 200, offset);
      const searchText = normalizedText.slice(searchStart, endOffset + 100);
      
      // Try to find sentence boundary (. ! ? followed by space or newline)
      const sentenceMatch = searchText.match(/[.!?][\s\n]/g);
      if (sentenceMatch) {
        const lastSentence = sentenceMatch[sentenceMatch.length - 1];
        if (lastSentence) {
          const lastIndex = searchText.lastIndexOf(lastSentence);
          if (lastIndex !== -1) {
            endOffset = searchStart + lastIndex + 2; // Include punctuation and space
          }
        }
      } else {
        // Fall back to word boundary
        const wordBoundary = normalizedText.lastIndexOf(' ', endOffset);
        if (wordBoundary > offset) {
          endOffset = wordBoundary;
        }
      }
    } else {
      endOffset = normalizedText.length;
    }
    
    // Extract chunk content
    const content = normalizedText.slice(offset, endOffset).trim();
    
    // Skip empty chunks
    if (content.length > 0) {
      chunks.push({
        id: `${sourceId}_chunk_${chunkIndex}`,
        sourcePath,
        chunkIndex,
        content,
        startOffset: offset,
        endOffset,
      });
      
      chunkIndex++;
    }
    
    // Move to next chunk with overlap
    offset = endOffset - chunkOverlap;
    
    // Ensure we're making progress
    const lastChunk = chunks[chunks.length - 1];
    if (lastChunk && offset <= lastChunk.startOffset) {
      offset = endOffset;
    }
  }
  
  return chunks;
}

/**
 * Chunk a document file based on collection config
 */
export function chunkDocument(
  content: string,
  sourcePath: string,
  config: RAGCollectionConfig
): TextChunk[] {
  // Generate source ID from path (safe for IDs)
  const sourceId = sourcePath
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 64);
  
  return chunkText(content, {
    chunkSize: config.chunk_size,
    chunkOverlap: config.chunk_overlap,
    sourcePath,
    sourceId,
  });
}

/**
 * Estimate token count for a text chunk
 * Uses a simple heuristic: ~4 characters per token for English text
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split a long chunk into smaller pieces if needed
 */
export function splitChunk(
  chunk: TextChunk,
  maxTokens: number,
  overlap: number
): TextChunk[] {
  const estimatedTokens = estimateTokenCount(chunk.content);
  
  if (estimatedTokens <= maxTokens) {
    return [chunk];
  }
  
  // Calculate approximate character limit
  const maxChars = maxTokens * 4;
  const subChunks: TextChunk[] = [];
  
  let offset = 0;
  let subIndex = 0;
  
  while (offset < chunk.content.length) {
    let endOffset = Math.min(offset + maxChars, chunk.content.length);
    
    // Try to break at word boundary
    if (endOffset < chunk.content.length) {
      const wordBoundary = chunk.content.lastIndexOf(' ', endOffset);
      if (wordBoundary > offset) {
        endOffset = wordBoundary;
      }
    }
    
    const content = chunk.content.slice(offset, endOffset).trim();
    
    if (content.length > 0) {
      subChunks.push({
        id: `${chunk.id}_sub_${subIndex}`,
        sourcePath: chunk.sourcePath,
        chunkIndex: chunk.chunkIndex,
        content,
        startOffset: chunk.startOffset + offset,
        endOffset: chunk.startOffset + endOffset,
      });
      
      subIndex++;
    }
    
    offset = endOffset - overlap;
    if (offset <= (subChunks[subChunks.length - 1]?.startOffset ?? 0) - chunk.startOffset) {
      offset = endOffset;
    }
  }
  
  return subChunks;
}
