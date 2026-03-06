// Chunker
export {
  chunkText,
  chunkDocument,
  estimateTokenCount,
  splitChunk,
  type TextChunk,
} from './chunker.js';

// Embedder
export {
  createEmbedder,
  getDefaultEmbeddingModel,
  getEmbeddingDimensions,
  cosineSimilarity,
  type EmbeddingResult,
  type BatchEmbeddingResult,
  type EmbedderConfig,
} from './embedder.js';

// Indexer
export {
  RAGIndexer,
  createRAGIndexer,
  type IndexingProgress,
  type IndexingProgressCallback,
  type IndexingResult,
} from './indexer.js';

// Searcher
export {
  RAGSearcher,
  createRAGSearcher,
  formatRAGContext,
  type RAGSearchResult,
} from './searcher.js';
