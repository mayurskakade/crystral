// ============================================
// Message types
// ============================================

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  tokens_used?: number;
  cost_usd?: number;
  created_at: string;
}

// ============================================
// Session types
// ============================================

export interface Session {
  id: string;
  agent_name: string;
  title?: string;
  created_at: string;
  message_count?: number;
}

// ============================================
// Agent Response
// ============================================

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface AgentResponse {
  content: string;
  session_id: string;
  tool_calls_made: number;
  tokens: TokenUsage;
  cost_usd: number;
  latency_ms: number;
}

// ============================================
// Streaming Events
// ============================================

export interface ChunkEvent {
  type: 'chunk';
  content: string;
}

export interface ToolCallEvent {
  type: 'tool_call';
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResultEvent {
  type: 'tool_result';
  id: string;
  name: string;
  result: string;
}

export interface DoneEvent {
  type: 'done';
  session_id: string;
  tokens: TokenUsage;
  cost_usd: number;
  latency_ms: number;
}

export interface AgentDelegationEvent {
  type: 'agent_delegation';
  parent_agent: string;
  target_agent: string;
  task: string;
}

export interface AgentDelegationResultEvent {
  type: 'agent_delegation_result';
  parent_agent: string;
  target_agent: string;
  result: string;
  success: boolean;
}

export type StreamEvent = ChunkEvent | ToolCallEvent | ToolResultEvent | DoneEvent | AgentDelegationEvent | AgentDelegationResultEvent;

// ============================================
// RAG types
// ============================================

export interface RAGResult {
  chunk_id: string;
  content: string;
  document_path: string;
  similarity: number;
}

export interface IndexResult {
  chunks: number;
  documents: number;
  skipped: number;
  duration_ms: number;
}

export interface CollectionStats {
  name: string;
  chunks: number;
  documents: string[];
  last_indexed?: Date;
}

// ============================================
// Inference Log
// ============================================

export interface InferenceLog {
  id: string;
  session_id?: string;
  agent_name: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
  created_at: string;
}

// ============================================
// Provider types
// ============================================

export type FinishReason = 'stop' | 'tool_calls' | 'length';

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export interface CompletionOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  stop_sequences?: string[];
  tools?: ToolDefinition[];
  tool_choice?: 'auto' | 'none' | { name: string };
  response_format?: { type: string };
  images?: ImageInput[];
  /** Unified multimodal input blocks (audio, image, document) */
  input_blocks?: ContentBlock[];
  /** Requested output modalities */
  output_modalities?: Array<'text' | 'audio' | 'image'>;
  /** Voice ID for TTS synthesis */
  tts_voice?: string;
}

export interface CompletionResult {
  content: string;
  tool_calls?: ToolCall[];
  input_tokens: number;
  output_tokens: number;
  finish_reason: FinishReason;
  /** Generated media outputs (images, audio) */
  media?: MediaOutput[];
  /** Auto-transcribed text from audio input blocks */
  transcript?: string;
}

// ============================================
// Run Options
// ============================================

export interface RunOptions {
  session_id?: string;
  variables?: Record<string, string>;
  rag_threshold?: number;
  rag_match_count?: number;
  cwd?: string;
}

// ============================================
// Error types
// ============================================

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'CONFIG_VERSION_ERROR'
  | 'AGENT_NOT_FOUND'
  | 'TOOL_NOT_FOUND'
  | 'COLLECTION_NOT_FOUND'
  | 'COLLECTION_NOT_INDEXED'
  | 'CREDENTIAL_NOT_FOUND'
  | 'PROVIDER_ERROR'
  | 'RATE_LIMIT'
  | 'TOOL_EXECUTION_ERROR'
  | 'TOOL_TIMEOUT'
  | 'STORAGE_ERROR'
  | 'GUARDRAIL_ERROR'
  | 'GUARDRAIL_VIOLATION';

export interface ErrorDetails {
  [key: string]: unknown;
}

// ============================================
// Image Input (Multimodal)
// ============================================

export interface ImageInput {
  /** base64-encoded image data or a URL */
  data: string;
  /** MIME type (e.g. 'image/png', 'image/jpeg') */
  media_type: string;
}

// ============================================
// Unified Content Blocks (Multimodal Input)
// ============================================

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ImageBlock {
  type: 'image';
  data: string;
  media_type: string;
}

export interface AudioBlock {
  type: 'audio';
  data: string;
  media_type: string;
  duration_seconds?: number;
}

export interface DocumentBlock {
  type: 'document';
  data: string;
  media_type: 'application/pdf';
  filename?: string;
}

export type ContentBlock = TextBlock | ImageBlock | AudioBlock | DocumentBlock;

// ============================================
// Media Output (Multimodal Output)
// ============================================

export interface ImageOutput {
  type: 'image';
  data: string;
  media_type: string;
  revised_prompt?: string;
}

export interface AudioOutput {
  type: 'audio';
  data: string;
  media_type: string;
  duration_seconds?: number;
}

export type MediaOutput = ImageOutput | AudioOutput;

// ============================================
// Extended Agent Run Result fields
// ============================================

export interface GuardrailResult {
  inputBlocked?: boolean;
  outputBlocked?: boolean;
  piiRedacted: boolean;
}

export interface ProviderUsed {
  provider: string;
  model: string;
}
