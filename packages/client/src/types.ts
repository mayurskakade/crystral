// ─── Provider ────────────────────────────────────────────────────────────────

export type Provider = 'openai' | 'anthropic' | 'groq' | 'google' | 'together';

// ─── Messages ────────────────────────────────────────────────────────────────

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  tool_call_id?: string;
}

// ─── Images ──────────────────────────────────────────────────────────────────

export interface ImageInput {
  /** Base64-encoded image data or a public URL */
  data: string;
  media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
}

// ─── Tools ───────────────────────────────────────────────────────────────────

export interface ClientTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  /** Called when the model invokes this tool. Return any serialisable value. */
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

// ─── Storage ─────────────────────────────────────────────────────────────────

export interface StorageAdapter {
  getMessages(sessionId: string): Message[];
  saveMessages(sessionId: string, messages: Message[]): void;
  createSession(): string;
  listSessions(): string[];
  deleteSession(sessionId: string): void;
}

// ─── Config ──────────────────────────────────────────────────────────────────

export interface ClientConfig {
  /** LLM provider */
  provider: Provider;
  /** Model identifier, e.g. "gpt-4o", "claude-3-5-sonnet-20241022" */
  model: string;
  /**
   * API key for the provider (BYOK).
   * In browser apps, keep this in user-controlled state (input field / localStorage).
   * Never hard-code it in your source.
   */
  apiKey: string;
  /** System prompt / persona */
  systemPrompt?: string;
  /** Sampling temperature (0–2). Defaults to provider default. */
  temperature?: number;
  /** Max tokens to generate */
  maxTokens?: number;
  /** Tools the model can call */
  tools?: ClientTool[];
  /**
   * Session storage adapter.
   * Defaults to in-memory (MemoryStorage). Use LocalStorageAdapter for
   * browser persistence or implement StorageAdapter for custom backends.
   */
  storage?: StorageAdapter;
  /**
   * Override the provider base URL.
   * Useful for pointing to a CORS proxy, OpenAI-compatible local model, etc.
   */
  baseUrl?: string;
}

// ─── Run options ─────────────────────────────────────────────────────────────

export interface RunOptions {
  /** Resume an existing session. Omit to start a new one. */
  sessionId?: string;
  /** Enable token-by-token streaming via onToken */
  stream?: boolean;
  /** Called once per token when stream: true */
  onToken?: (token: string) => void;
  /** Called before a tool is executed */
  onToolCall?: (name: string, args: Record<string, unknown>) => void;
  /** Called after a tool finishes */
  onToolResult?: (name: string, result: unknown, success: boolean) => void;
  /** Max tool-call iterations per run (default: 10) */
  maxToolIterations?: number;
  /** Multimodal image inputs */
  images?: ImageInput[];
  /** Variables substituted in system prompt using {key} syntax */
  variables?: Record<string, string>;
}

// ─── Run result ──────────────────────────────────────────────────────────────

export interface RunResult {
  /** The model's final text response */
  content: string;
  /** Session ID — pass to RunOptions.sessionId to continue the conversation */
  sessionId: string;
  /** Full conversation history for this session */
  messages: Message[];
  /** Tool calls made during this run */
  toolCalls: Array<{
    name: string;
    args: Record<string, unknown>;
    result: unknown;
    success: boolean;
  }>;
  usage: {
    input: number;
    output: number;
    total: number;
  };
  durationMs: number;
}

// ─── Internal provider types ──────────────────────────────────────────────────

export interface ToolDefinition {
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface CompletionOptions {
  temperature?: number;
  max_tokens?: number;
  tools?: ToolDefinition[];
  tool_choice?: string;
  images?: ImageInput[];
  response_format?: { type: 'json_object' | 'text' };
  top_p?: number;
  stop_sequences?: string[];
}

export interface CompletionResult {
  content: string;
  tool_calls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  input_tokens: number;
  output_tokens: number;
  finish_reason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
}
