import type { ErrorCode, ErrorDetails } from '../types/index.js';

export class CrystralError extends Error {
  public readonly code: ErrorCode;
  public readonly details: ErrorDetails;

  constructor(code: ErrorCode, message: string, details: ErrorDetails = {}) {
    super(message);
    this.name = 'CrystralError';
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ValidationError extends CrystralError {
  constructor(message: string, details: ErrorDetails = {}) {
    super('VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

export class ConfigVersionError extends CrystralError {
  constructor(version: number, supportedRange: string) {
    super(
      'CONFIG_VERSION_ERROR',
      `Unsupported config version: ${version}. This SDK supports versions ${supportedRange}.`,
      { version, supportedRange }
    );
    this.name = 'ConfigVersionError';
  }
}

export class AgentNotFoundError extends CrystralError {
  public readonly agentName: string;

  constructor(name: string, projectRoot?: string) {
    const filePath = projectRoot 
      ? `${projectRoot}/agents/${name}.yaml`
      : `agents/${name}.yaml`;
    
    super(
      'AGENT_NOT_FOUND',
      `Agent '${name}' not found.\nExpected file: ${filePath}\n\nTo create it, run:\n  crystral create agent ${name}`,
      { agentName: name, projectRoot }
    );
    this.name = 'AgentNotFoundError';
    this.agentName = name;
  }
}

export class ToolNotFoundError extends CrystralError {
  public readonly toolName: string;

  constructor(name: string, agentName?: string, projectRoot?: string) {
    const filePath = projectRoot 
      ? `${projectRoot}/tools/${name}.yaml`
      : `tools/${name}.yaml`;
    
    let message = `Tool '${name}' not found.\nExpected file: ${filePath}`;
    if (agentName) {
      message += `\nReferenced by agent: ${agentName}`;
    }
    message += `\n\nTo create it, run:\n  crystral create tool ${name}`;
    
    super('TOOL_NOT_FOUND', message, { toolName: name, agentName, projectRoot });
    this.name = 'ToolNotFoundError';
    this.toolName = name;
  }
}

export class RAGCollectionNotFoundError extends CrystralError {
  public readonly collectionName: string;

  constructor(name: string, projectRoot?: string) {
    const dirPath = projectRoot 
      ? `${projectRoot}/rag/${name}/`
      : `rag/${name}/`;
    
    super(
      'COLLECTION_NOT_FOUND',
      `RAG collection '${name}' not found.\nExpected directory: ${dirPath}\n\nTo create it, run:\n  crystral create rag ${name}`,
      { collectionName: name, projectRoot }
    );
    this.name = 'RAGCollectionNotFoundError';
    this.collectionName = name;
  }
}

export class CollectionNotIndexedError extends CrystralError {
  public readonly collectionName: string;

  constructor(name: string) {
    super(
      'COLLECTION_NOT_INDEXED',
      `RAG collection '${name}' has not been indexed yet.\nRun the following to index it before running the agent:\n  crystral rag index ${name}`,
      { collectionName: name }
    );
    this.name = 'CollectionNotIndexedError';
    this.collectionName = name;
  }
}

export class CredentialNotFoundError extends CrystralError {
  public readonly provider: string;

  constructor(provider: string, envVarName: string) {
    super(
      'CREDENTIAL_NOT_FOUND',
      `No API key found for provider '${provider}'.\n\nTried:\n  1. Environment variable ${envVarName} — not set\n  2. Project .env file — not found or key not in file\n  3. ~/.crystral/credentials — provider section not found\n\nTo fix, run one of:\n  crystral auth add ${provider}\n  export ${envVarName}=your-key\n  echo "${envVarName}=your-key" >> .env`,
      { provider }
    );
    this.name = 'CredentialNotFoundError';
    this.provider = provider;
  }
}

export class ProviderError extends CrystralError {
  public readonly provider: string;
  public readonly httpStatus: number;

  constructor(provider: string, model: string, httpStatus: number, providerMessage?: string, statusPageUrl?: string) {
    let message = `Provider error from ${provider} (${model}):\n  Status: ${httpStatus}`;
    if (providerMessage) {
      message += `\n  Message: ${providerMessage}`;
    }
    message += '\n\nCheck:\n  - Your API key is valid and has quota remaining\n  - The model name is correct';
    if (statusPageUrl) {
      message += `\n  - The provider API is operational: ${statusPageUrl}`;
    }
    
    super('PROVIDER_ERROR', message, { provider, model, httpStatus, providerMessage });
    this.name = 'ProviderError';
    this.provider = provider;
    this.httpStatus = httpStatus;
  }
}

export class RateLimitError extends ProviderError {
  public readonly retryAfterMs?: number;

  constructor(provider: string, model: string, retryAfterMs?: number) {
    super(provider, model, 429, `Rate limit exceeded${retryAfterMs ? ` (retry after ${retryAfterMs}ms)` : ''}`);
    this.name = 'RateLimitError';
    if (retryAfterMs !== undefined) {
      this.retryAfterMs = retryAfterMs;
    }
  }
}

export class CircularDelegationError extends CrystralError {
  public readonly agentName: string;
  public readonly callStack: string[];

  constructor(agentName: string, callStack: string[]) {
    super(
      'TOOL_EXECUTION_ERROR',
      `Circular agent delegation detected: ${[...callStack, agentName].join(' → ')}\nAgent '${agentName}' is already in the call stack.`,
      { agentName, callStack }
    );
    this.name = 'CircularDelegationError';
    this.agentName = agentName;
    this.callStack = callStack;
  }
}

export class ToolExecutionError extends CrystralError {
  constructor(toolName: string, message: string) {
    super(
      'TOOL_EXECUTION_ERROR',
      `Tool '${toolName}' execution failed: ${message}`,
      { toolName }
    );
    this.name = 'ToolExecutionError';
  }
}

export class ToolTimeoutError extends CrystralError {
  constructor(toolName: string, timeoutMs: number) {
    super(
      'TOOL_TIMEOUT',
      `Tool '${toolName}' timed out after ${timeoutMs}ms`,
      { toolName, timeoutMs }
    );
    this.name = 'ToolTimeoutError';
  }
}

export class StorageError extends CrystralError {
  constructor(message: string, details: ErrorDetails = {}) {
    super('STORAGE_ERROR', message, details);
    this.name = 'StorageError';
  }
}

export class GuardrailError extends CrystralError {
  public readonly guardrailType: 'input' | 'output';

  constructor(guardrailType: 'input' | 'output', violation: string) {
    super(
      'GUARDRAIL_VIOLATION',
      `Guardrail violation (${guardrailType}): ${violation}`,
      { guardrailType, violation }
    );
    this.name = 'GuardrailError';
    this.guardrailType = guardrailType;
  }
}

// Backwards compatibility alias
export { CrystralError as CrystalAIError };
