export type ErrorCode =
  | 'PROVIDER_ERROR'
  | 'RATE_LIMIT'
  | 'TOOL_EXECUTION_ERROR'
  | 'INVALID_CONFIG'
  | 'SESSION_NOT_FOUND';

export class CrystralClientError extends Error {
  readonly code: ErrorCode;
  constructor(message: string, code: ErrorCode) {
    super(message);
    this.name = 'CrystralClientError';
    this.code = code;
  }
}

export class ProviderError extends CrystralClientError {
  readonly provider: string;
  readonly model: string;
  readonly statusCode: number;
  constructor(provider: string, model: string, statusCode: number, message?: string) {
    super(
      message ?? `Provider error from ${provider} (${model}): HTTP ${statusCode}`,
      'PROVIDER_ERROR'
    );
    this.name = 'ProviderError';
    this.provider = provider;
    this.model = model;
    this.statusCode = statusCode;
  }
}

export class RateLimitError extends ProviderError {
  readonly retryAfterMs?: number;
  readonly errorCode: ErrorCode = 'RATE_LIMIT';
  constructor(provider: string, model: string, retryAfterMs?: number) {
    super(provider, model, 429, `Rate limited by ${provider}. ${retryAfterMs ? `Retry after ${retryAfterMs}ms.` : ''}`);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class ToolExecutionError extends CrystralClientError {
  readonly toolName: string;
  constructor(toolName: string, message: string) {
    super(`Tool "${toolName}" failed: ${message}`, 'TOOL_EXECUTION_ERROR');
    this.name = 'ToolExecutionError';
    this.toolName = toolName;
  }
}

export class InvalidConfigError extends CrystralClientError {
  constructor(message: string) {
    super(message, 'INVALID_CONFIG');
    this.name = 'InvalidConfigError';
  }
}
