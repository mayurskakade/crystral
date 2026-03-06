import type { Provider } from '../types/index.js';
import { createProvider } from '../providers/index.js';
import { resolveApiKey } from '../credentials/index.js';

/**
 * Embedding result
 */
export interface EmbeddingResult {
  /** Text that was embedded */
  text: string;
  /** Embedding vector */
  embedding: number[];
  /** Estimated token count */
  tokenCount: number;
}

/**
 * Batch embedding result
 */
export interface BatchEmbeddingResult {
  /** Embeddings in same order as input texts */
  embeddings: number[][];
  /** Estimated total tokens */
  totalTokens: number;
  /** Model used */
  model: string;
  /** Provider used */
  provider: string;
}

/**
 * Embedder configuration
 */
export interface EmbedderConfig {
  provider: Provider;
  model: string;
}

/**
 * Create an embedder for the given provider and model
 */
export function createEmbedder(config: EmbedderConfig) {
  return new Embedder(config);
}

/**
 * Estimate token count for a text
 * Uses a simple heuristic: ~4 characters per token for English text
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Embedder class for generating text embeddings
 */
class Embedder {
  private provider: ReturnType<typeof createProvider>;
  private model: string;
  private providerName: Provider;
  
  constructor(config: EmbedderConfig) {
    const apiKey = resolveApiKey(config.provider);
    this.provider = createProvider(config.provider, apiKey);
    this.model = config.model;
    this.providerName = config.provider;
  }
  
  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<EmbeddingResult> {
    const embedding = await this.provider.embed(text, this.model);
    
    return {
      text,
      embedding,
      tokenCount: estimateTokens(text),
    };
  }
  
  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(texts: string[]): Promise<BatchEmbeddingResult> {
    const embeddings: number[][] = [];
    let totalTokens = 0;
    
    // Process texts sequentially (could be parallelized for some providers)
    for (const text of texts) {
      const embedding = await this.provider.embed(text, this.model);
      embeddings.push(embedding);
      totalTokens += estimateTokens(text);
    }
    
    return {
      embeddings,
      totalTokens,
      model: this.model,
      provider: this.providerName,
    };
  }
  
  /**
   * Check if provider supports embeddings
   */
  supportsEmbeddings(): boolean {
    return this.provider.supportsEmbeddings();
  }
}

/**
 * Get default embedding model for a provider
 */
export function getDefaultEmbeddingModel(provider: Provider): string {
  const defaults: Record<Provider, string> = {
    openai: 'text-embedding-3-small',
    anthropic: 'voyage-2', // Anthropic uses Voyage
    groq: 'text-embedding-3-small', // Groq uses OpenAI compatible
    google: 'text-embedding-004',
    together: 'togethercomputer/m2-bert-80M-8k-retrieval',
  };
  
  return defaults[provider] ?? 'text-embedding-3-small';
}

/**
 * Get embedding dimensions for a model
 */
export function getEmbeddingDimensions(model: string): number {
  // OpenAI models
  if (model.includes('text-embedding-3-large')) return 3072;
  if (model.includes('text-embedding-3-small')) return 1536;
  if (model.includes('text-embedding-ada-002')) return 1536;
  
  // Google models
  if (model.includes('text-embedding-004')) return 768;
  if (model.includes('text-embedding-preview')) return 768;
  
  // Together models
  if (model.includes('m2-bert-80M')) return 768;
  if (model.includes('m2-bert-80M-8k')) return 768;
  
  // Voyage models
  if (model.includes('voyage-large-2')) return 1536;
  if (model.includes('voyage-2')) return 1024;
  if (model.includes('voyage-code-2')) return 1536;
  
  // Default assumption
  return 1536;
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same dimension');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (normA * normB);
}
