import type { ToolConfig, RestApiToolConfig, JavaScriptToolConfig, WebSearchToolConfig, AgentToolConfig } from '../types/index.js';
import { ToolExecutionError, ToolTimeoutError } from '../errors/index.js';
import { executeRestTool } from './rest.js';
import { executeJavaScriptTool } from './javascript.js';
import { executeWebSearchTool } from './web_search.js';
import { executeAgentTool } from './agent.js';

/**
 * Tool execution context
 */
export interface ToolContext {
  /** Working directory for relative paths */
  cwd: string;
  /** Variables from agent run command */
  variables: Record<string, string>;
  /** Timeout override in milliseconds */
  timeoutMs?: number;
  /** Agent call stack for circular delegation detection */
  agentCallStack?: string[];
  /** Parent conversation messages for context passing */
  parentMessages?: Array<{ role: string; content: string }>;
  /** Callback when an agent delegation starts */
  onAgentDelegation?: (parentAgent: string, targetAgent: string, task: string) => void;
  /** Callback when an agent delegation completes */
  onAgentDelegationResult?: (parentAgent: string, targetAgent: string, result: string, success: boolean) => void;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  /** Result content as string */
  content: string;
  /** Whether the tool execution was successful */
  success: boolean;
  /** Error message if not successful */
  error?: string;
}

/**
 * Execute a tool with the given arguments
 */
export async function executeTool(
  config: ToolConfig,
  args: Record<string, unknown>,
  context: ToolContext
): Promise<ToolResult> {
  const timeoutMs = context.timeoutMs ?? getDefaultTimeout(config);
  
  try {
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new ToolTimeoutError(config.name, timeoutMs));
      }, timeoutMs);
    });

    // Execute based on tool type
    const executePromise = executeToolByType(config, args, context);
    
    const result = await Promise.race([executePromise, timeoutPromise]);
    
    return result;
  } catch (error) {
    if (error instanceof ToolTimeoutError) {
      throw error;
    }
    
    return {
      content: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Route to appropriate tool executor based on type
 */
async function executeToolByType(
  config: ToolConfig,
  args: Record<string, unknown>,
  context: ToolContext
): Promise<ToolResult> {
  const toolName = config.name;
  const toolType = config.type;
  
  switch (toolType) {
    case 'rest_api':
      return executeRestTool(config as RestApiToolConfig, args, context);
    
    case 'javascript':
      return executeJavaScriptTool(config as JavaScriptToolConfig, args, context);
    
    case 'web_search':
      return executeWebSearchTool(config as WebSearchToolConfig, args, context);

    case 'agent':
      return executeAgentTool(config as AgentToolConfig, args, context);

    default:
      // This should never happen due to discriminated union, but TypeScript needs it
      throw new ToolExecutionError(toolName, `Unknown tool type: ${toolType as string}`);
  }
}

/**
 * Get default timeout for tool type
 */
function getDefaultTimeout(config: ToolConfig): number {
  switch (config.type) {
    case 'rest_api':
      return (config as RestApiToolConfig).timeout_ms ?? 30000;
    case 'javascript':
      return (config as JavaScriptToolConfig).timeout_ms ?? 5000;
    case 'web_search':
      return 15000;
    case 'agent':
      return (config as AgentToolConfig).timeout_ms ?? 120000;
    default:
      return 30000;
  }
}

/**
 * Validate required parameters are present
 */
export function validateParameters(
  config: ToolConfig,
  args: Record<string, unknown>
): void {
  const params = config.parameters ?? [];
  
  for (const param of params) {
    if (param.required && !(param.name in args)) {
      if (param.default !== undefined) {
        // Default value exists, will be applied later
        continue;
      }
      throw new ToolExecutionError(
        config.name,
        `Missing required parameter: ${param.name}`
      );
    }
  }
}

/**
 * Apply default values for missing parameters
 */
export function applyDefaults(
  config: ToolConfig,
  args: Record<string, unknown>
): Record<string, unknown> {
  const params = config.parameters ?? [];
  const result = { ...args };
  
  for (const param of params) {
    if (!(param.name in result) && param.default !== undefined) {
      result[param.name] = param.default;
    }
  }
  
  return result;
}

/**
 * Validate parameter types and constraints
 */
export function validateParameterConstraints(
  config: ToolConfig,
  args: Record<string, unknown>
): void {
  const params = config.parameters ?? [];
  
  for (const param of params) {
    const value = args[param.name];
    
    if (value === undefined) {
      continue; // Already validated required
    }
    
    // Type validation
    if (!validateType(value, param.type)) {
      throw new ToolExecutionError(
        config.name,
        `Parameter '${param.name}' must be of type ${param.type}, got ${typeof value}`
      );
    }
    
    // Enum validation
    if (param.enum && !param.enum.includes(value as string | number)) {
      throw new ToolExecutionError(
        config.name,
        `Parameter '${param.name}' must be one of: ${param.enum.join(', ')}`
      );
    }
    
    // Number constraints
    if (param.type === 'number' || param.type === 'integer') {
      const numValue = value as number;
      
      if (param.minimum !== undefined && numValue < param.minimum) {
        throw new ToolExecutionError(
          config.name,
          `Parameter '${param.name}' must be >= ${param.minimum}`
        );
      }
      
      if (param.maximum !== undefined && numValue > param.maximum) {
        throw new ToolExecutionError(
          config.name,
          `Parameter '${param.name}' must be <= ${param.maximum}`
        );
      }
    }
    
    // String constraints
    if (param.type === 'string' && typeof value === 'string') {
      if (param.min_length !== undefined && value.length < param.min_length) {
        throw new ToolExecutionError(
          config.name,
          `Parameter '${param.name}' must be at least ${param.min_length} characters`
        );
      }
      
      if (param.max_length !== undefined && value.length > param.max_length) {
        throw new ToolExecutionError(
          config.name,
          `Parameter '${param.name}' must be at most ${param.max_length} characters`
        );
      }
      
      if (param.pattern && !new RegExp(param.pattern).test(value)) {
        throw new ToolExecutionError(
          config.name,
          `Parameter '${param.name}' does not match required pattern: ${param.pattern}`
        );
      }
    }
  }
}

/**
 * Validate value matches expected type
 */
function validateType(value: unknown, type: string): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value as number);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    default:
      return true;
  }
}

/**
 * Convert tool config to OpenAI function format
 */
export function toOpenAIFunction(config: ToolConfig): {
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
} {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  
  for (const param of config.parameters ?? []) {
    properties[param.name] = {
      type: param.type,
      description: param.description,
      ...(param.enum ? { enum: param.enum } : {}),
      ...(param.minimum !== undefined ? { minimum: param.minimum } : {}),
      ...(param.maximum !== undefined ? { maximum: param.maximum } : {}),
      ...(param.min_length !== undefined ? { minLength: param.min_length } : {}),
      ...(param.max_length !== undefined ? { maxLength: param.max_length } : {}),
      ...(param.pattern ? { pattern: param.pattern } : {}),
      ...(param.items ? { items: param.items } : {}),
    };
    
    if (param.required) {
      required.push(param.name);
    }
  }
  
  return {
    type: 'function',
    function: {
      name: config.name,
      description: config.description,
      parameters: {
        type: 'object',
        properties,
        ...(required.length > 0 ? { required } : {}),
      },
    },
  };
}
