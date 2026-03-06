import { z } from 'zod';

// ============================================
// Provider enum
// ============================================

export const ProviderSchema = z.enum(['openai', 'anthropic', 'groq', 'google', 'together']);
export type Provider = z.infer<typeof ProviderSchema>;

// ============================================
// Output Config (Structured Output)
// ============================================

export const OutputConfigSchema = z.object({
  format: z.enum(['json', 'text']).default('text'),
  schema: z.record(z.unknown()).optional(),
  strict: z.boolean().default(false),
});

export type OutputConfig = z.output<typeof OutputConfigSchema>;

// ============================================
// Retry + Fallback Config
// ============================================

export const RetryConfigSchema = z.object({
  max_attempts: z.number().int().min(1).max(10).default(3),
  backoff: z.enum(['none', 'linear', 'exponential']).default('exponential'),
  retry_on: z.array(z.string()).default(['rate_limit', 'server_error', 'timeout']),
});

export type RetryConfig = z.output<typeof RetryConfigSchema>;

export const FallbackProviderSchema = z.array(z.object({
  provider: ProviderSchema,
  model: z.string().min(1).max(128),
}));

export type FallbackProvider = z.infer<typeof FallbackProviderSchema>;

// ============================================
// Guardrails Config
// ============================================

export const GuardrailsInputConfigSchema = z.object({
  max_length: z.number().int().min(1).optional(),
  block_patterns: z.array(z.string()).optional(),
  block_topics: z.array(z.string()).optional(),
  pii_action: z.enum(['block', 'redact', 'warn', 'none']).default('none'),
});

export const GuardrailsOutputConfigSchema = z.object({
  max_length: z.number().int().min(1).optional(),
  require_patterns: z.array(z.string()).optional(),
  block_patterns: z.array(z.string()).optional(),
  pii_action: z.enum(['block', 'redact', 'warn', 'none']).default('none'),
});

export type GuardrailsInputConfig = z.output<typeof GuardrailsInputConfigSchema>;
export type GuardrailsOutputConfig = z.output<typeof GuardrailsOutputConfigSchema>;

export const GuardrailsConfigSchema = z.object({
  input: GuardrailsInputConfigSchema.optional(),
  output: GuardrailsOutputConfigSchema.optional(),
});

export type GuardrailsConfig = z.output<typeof GuardrailsConfigSchema>;

// ============================================
// Capabilities Config (Vision etc.)
// ============================================

export const CapabilitiesConfigSchema = z.object({
  vision: z.boolean().default(false),
  max_image_size: z.number().int().min(1).optional(),
});

export type CapabilitiesConfig = z.output<typeof CapabilitiesConfigSchema>;

// ============================================
// Cache Config
// ============================================

export const CacheConfigSchema = z.object({
  enabled: z.boolean().default(false),
  ttl: z.number().int().min(1).default(3600),
  force: z.boolean().optional(),
});

export type CacheConfig = z.output<typeof CacheConfigSchema>;

// ============================================
// Logging Config
// ============================================

export const LoggingConfigSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  trace: z.boolean().default(false),
  export: z.enum(['stdout', 'file', 'webhook']).default('stdout'),
});

export type LoggingConfig = z.output<typeof LoggingConfigSchema>;

// ============================================
// Profile Config (Environment Profiles)
// ============================================

export const ProfileConfigSchema = z.object({
  default_provider: ProviderSchema.optional(),
  default_model: z.string().min(1).max(128).optional(),
  cache: CacheConfigSchema.optional(),
  logging: LoggingConfigSchema.optional(),
  guardrails: GuardrailsConfigSchema.optional(),
});

export type ProfileConfig = z.output<typeof ProfileConfigSchema>;

// ============================================
// Project Config - crystral.config.yaml
// ============================================

export const ProjectConfigSchema = z.object({
  version: z.literal(1),
  project: z.string().min(1).max(64).regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/,
    'Project name must start with alphanumeric and contain only letters, numbers, hyphens, and underscores'),
  studio: z.object({
    port: z.number().int().min(1024).max(65535).default(4000),
    open_browser: z.boolean().default(true),
    host: z.string().default('127.0.0.1'),
  }).optional(),
  cache: CacheConfigSchema.optional(),
  profiles: z.record(ProfileConfigSchema).optional(),
  logging: LoggingConfigSchema.optional(),
});

export type ProjectConfig = z.output<typeof ProjectConfigSchema>;

// ============================================
// RAG Config (within Agent)
// ============================================

export const RAGConfigSchema = z.object({
  collections: z.array(z.string().min(1)).min(1, 'At least one RAG collection is required'),
  embedding_provider: ProviderSchema,
  embedding_model: z.string().min(1),
  match_threshold: z.number().min(0).max(1).default(0.7),
  match_count: z.number().int().min(1).max(50).default(5),
});

export type RAGConfig = z.output<typeof RAGConfigSchema>;

// ============================================
// MCP Server Config (within Agent)
// ============================================

export const StdioMCPServerSchema = z.object({
  transport: z.literal('stdio'),
  name: z.string().min(1).max(64),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).optional(),
});

export const SSEMCPServerSchema = z.object({
  transport: z.literal('sse'),
  name: z.string().min(1).max(64),
  url: z.string().url('MCP SSE URL must be a valid URL'),
});

export const MCPServerSchema = z.discriminatedUnion('transport', [
  StdioMCPServerSchema,
  SSEMCPServerSchema,
]);

export type MCPServerConfig = z.infer<typeof MCPServerSchema>;

// ============================================
// Prompt Template Config
// ============================================

export const PromptTemplateConfigSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(64),
  description: z.string().max(512).optional(),
  template: z.string().min(1),
  defaults: z.record(z.string()).optional(),
});

export type PromptTemplateConfig = z.output<typeof PromptTemplateConfigSchema>;

// ============================================
// System Prompt (backward-compatible union)
// ============================================

export const SystemPromptTemplateSchema = z.object({
  template: z.string().min(1),
  variables: z.record(z.string()).optional(),
});

export const SystemPromptSchema = z.union([
  z.string(),
  SystemPromptTemplateSchema,
]);

export type SystemPromptTemplate = z.infer<typeof SystemPromptTemplateSchema>;

// ============================================
// Schedule Config
// ============================================

export const ScheduleConfigSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(64),
  agent: z.string().min(1).max(64),
  schedule: z.string().min(1),
  input: z.string().min(1),
  variables: z.record(z.string()).optional(),
  enabled: z.boolean().default(true),
});

export type ScheduleConfig = z.output<typeof ScheduleConfigSchema>;

// ============================================
// Test Config
// ============================================

export const TestExpectSchema = z.object({
  contains: z.string().optional(),
  not_contains: z.string().optional(),
  max_tokens: z.number().int().min(1).optional(),
  output_schema: z.record(z.unknown()).optional(),
  guardrail_blocked: z.boolean().optional(),
});

export type TestExpect = z.infer<typeof TestExpectSchema>;

export const TestCaseSchema = z.object({
  name: z.string().min(1),
  input: z.string().min(1),
  variables: z.record(z.string()).optional(),
  expect: TestExpectSchema,
});

export type TestCase = z.infer<typeof TestCaseSchema>;

export const TestSuiteConfigSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(64),
  agent: z.string().min(1).max(64),
  mock: z.boolean().optional(),
  tests: z.array(TestCaseSchema).min(1),
});

export type TestSuiteConfig = z.output<typeof TestSuiteConfigSchema>;

// ============================================
// Agent Config - agents/<name>.yaml
// ============================================

export const AgentConfigSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/,
    'Agent name must contain only letters, numbers, hyphens, and underscores'),
  description: z.string().max(512).optional(),
  provider: ProviderSchema,
  model: z.string().min(1).max(128),
  system_prompt: SystemPromptSchema.default(''),
  temperature: z.number().min(0).max(2).default(1.0),
  max_tokens: z.number().int().min(1).max(1000000).default(4096),
  top_p: z.number().min(0).max(1).default(1.0),
  presence_penalty: z.number().min(-2).max(2).default(0.0),
  frequency_penalty: z.number().min(-2).max(2).default(0.0),
  stop_sequences: z.array(z.string()).optional(),
  tools: z.array(z.string()).default([]),
  rag: RAGConfigSchema.optional(),
  mcp: z.array(MCPServerSchema).default([]),
  output: OutputConfigSchema.optional(),
  retry: RetryConfigSchema.optional(),
  fallback: FallbackProviderSchema.optional(),
  guardrails: GuardrailsConfigSchema.optional(),
  capabilities: CapabilitiesConfigSchema.optional(),
  cache: CacheConfigSchema.optional(),
  logging: LoggingConfigSchema.optional(),
  extends: z.string().max(64).optional(),
});

export type AgentConfig = z.output<typeof AgentConfigSchema>;

// ============================================
// Tool Parameter
// ============================================

export const ToolParameterTypeSchema = z.enum(['string', 'number', 'integer', 'boolean', 'array', 'object']);

export const ToolParameterSchema = z.object({
  name: z.string().min(1).max(64).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/,
    'Parameter name must be a valid identifier'),
  type: ToolParameterTypeSchema,
  required: z.boolean().default(false),
  description: z.string().optional(),
  default: z.unknown().optional(),
  enum: z.array(z.union([z.string(), z.number()])).optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  min_length: z.number().int().optional(),
  max_length: z.number().int().optional(),
  pattern: z.string().optional(),
  items: z.object({
    type: ToolParameterTypeSchema,
  }).optional(),
});

export type ToolParameter = z.output<typeof ToolParameterSchema>;

// ============================================
// Tool Auth
// ============================================

export const ToolAuthTypeSchema = z.enum(['bearer', 'basic', 'header', 'none']);

export const ToolAuthSchema = z.object({
  type: ToolAuthTypeSchema.default('none'),
  token_env: z.string().optional(),
  username_env: z.string().optional(),
  password_env: z.string().optional(),
  header_name: z.string().optional(),
});

export type ToolAuth = z.output<typeof ToolAuthSchema>;

// ============================================
// Tool Config - tools/<name>.yaml
// ============================================

export const ToolTypeSchema = z.enum(['rest_api', 'javascript', 'web_search', 'agent']);

const BaseToolConfigSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/,
    'Tool name must contain only letters, numbers, hyphens, and underscores'),
  description: z.string().min(1).max(512),
  type: ToolTypeSchema,
  parameters: z.array(ToolParameterSchema).default([]),
});

// REST API Tool
export const RestApiToolConfigSchema = BaseToolConfigSchema.extend({
  type: z.literal('rest_api'),
  endpoint: z.string().url('Endpoint must be a valid URL'),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']).default('GET'),
  headers: z.record(z.string()).optional(),
  auth: ToolAuthSchema.optional(),
  body_template: z.string().optional(),
  response_path: z.string().optional(),
  timeout_ms: z.number().int().min(100).max(300000).default(30000),
});

export type RestApiToolConfig = z.output<typeof RestApiToolConfigSchema>;

// JavaScript Tool
export const JavaScriptToolConfigSchema = BaseToolConfigSchema.extend({
  type: z.literal('javascript'),
  runtime: z.literal('node').default('node'),
  timeout_ms: z.number().int().min(100).max(30000).default(5000),
  code: z.string().min(1),
});

export type JavaScriptToolConfig = z.output<typeof JavaScriptToolConfigSchema>;

// Web Search Tool
export const WebSearchToolConfigSchema = BaseToolConfigSchema.extend({
  type: z.literal('web_search'),
  provider: z.literal('brave').default('brave'),
  result_count: z.number().int().min(1).max(20).default(5),
  safe_search: z.enum(['off', 'moderate', 'strict']).default('moderate'),
});

export type WebSearchToolConfig = z.output<typeof WebSearchToolConfigSchema>;

// Agent Tool
export const AgentToolConfigSchema = BaseToolConfigSchema.extend({
  type: z.literal('agent'),
  agent_name: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/,
    'Agent name must contain only letters, numbers, hyphens, and underscores'),
  pass_context: z.boolean().default(false),
  timeout_ms: z.number().int().min(1000).max(600000).default(120000),
  max_iterations: z.number().int().min(1).max(100).default(10),
});

export type AgentToolConfig = z.output<typeof AgentToolConfigSchema>;

// Union type for all tool configs
export const ToolConfigSchema = z.discriminatedUnion('type', [
  RestApiToolConfigSchema,
  JavaScriptToolConfigSchema,
  WebSearchToolConfigSchema,
  AgentToolConfigSchema,
]);

export type ToolConfig = RestApiToolConfig | JavaScriptToolConfig | WebSearchToolConfig | AgentToolConfig;

// ============================================
// RAG Collection Config - rag/<name>/.crystral-rag.yaml
// ============================================

export const RAGCollectionConfigSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(64),
  embedding_provider: ProviderSchema.default('openai'),
  embedding_model: z.string().default('text-embedding-3-small'),
  chunk_size: z.number().int().min(64).max(8192).default(512),
  chunk_overlap: z.number().int().min(0).max(4096).default(64),
  include: z.array(z.string()).default(['**/*.md', '**/*.txt', '**/*.pdf']),
  exclude: z.array(z.string()).default([]),
}).refine(
  (data) => data.chunk_overlap < data.chunk_size,
  {
    message: 'chunk_overlap must be less than chunk_size',
    path: ['chunk_overlap'],
  }
);

export type RAGCollectionConfig = z.output<typeof RAGCollectionConfigSchema>;

// ============================================
// Workflow Config - workflows/<name>.yaml
// ============================================

export const WorkflowAgentSchema = z.object({
  name: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/,
    'Agent reference name must contain only letters, numbers, hyphens, and underscores'),
  agent: z.string().min(1).max(64),
  description: z.string().min(1).max(512),
  depends_on: z.array(z.string()).optional(),
  run_if: z.string().optional(),
  output_as: z.string().optional(),
});

export const WorkflowOrchestratorSchema = z.object({
  provider: ProviderSchema,
  model: z.string().min(1).max(128),
  system_prompt: z.string().default(''),
  strategy: z.enum(['auto', 'sequential', 'parallel']).default('auto'),
  max_iterations: z.number().int().min(1).max(100).default(20),
  temperature: z.number().min(0).max(2).default(0.7),
});

export const WorkflowContextSchema = z.object({
  shared_memory: z.boolean().default(false),
  max_context_tokens: z.number().int().min(100).max(1000000).default(8000),
});

export const WorkflowConfigSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/,
    'Workflow name must contain only letters, numbers, hyphens, and underscores'),
  description: z.string().max(512).optional(),
  orchestrator: WorkflowOrchestratorSchema,
  agents: z.array(WorkflowAgentSchema).min(1, 'At least one agent is required'),
  context: WorkflowContextSchema.default({}),
});

export type WorkflowConfig = z.output<typeof WorkflowConfigSchema>;
