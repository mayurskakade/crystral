import * as vm from 'node:vm';
import type { JavaScriptToolConfig } from '../types/index.js';
import type { ToolResult, ToolContext } from './executor.js';

/**
 * Execute a JavaScript tool in a sandboxed environment
 */
export async function executeJavaScriptTool(
  config: JavaScriptToolConfig,
  args: Record<string, unknown>,
  _context: ToolContext
): Promise<ToolResult> {
  try {
    // Build the code with args injection
    const wrappedCode = `
      (function(args) {
        ${config.code}
      })
    `;
    
    // Create sandbox context with limited globals
    const sandbox: vm.Context = vm.createContext({
      // Provide args
      args,
      // Safe built-ins
      console: {
        log: (...items: unknown[]) => items.map(i => String(i)).join(' '),
        error: (...items: unknown[]) => items.map(i => String(i)).join(' '),
        warn: (...items: unknown[]) => items.map(i => String(i)).join(' '),
      },
      // JSON utilities
      JSON,
      // Math utilities
      Math,
      // Date utilities
      Date,
      // Array utilities
      Array,
      Object,
      String,
      Number,
      Boolean,
      // Error types
      Error,
      TypeError,
      RangeError,
      // RegExp
      RegExp,
      // URL utilities
      URL,
      URLSearchParams,
      // No access to require, process, global, etc.
    });
    
    // Compile the code
    const script = new vm.Script(wrappedCode, {
      filename: `tool_${config.name}.js`,
      lineOffset: 0,
      columnOffset: 0,
    });
    
    // Run the script and get the function
    const fn = script.runInContext(sandbox, {
      timeout: config.timeout_ms ?? 5000,
    });
    
    if (typeof fn !== 'function') {
      return {
        content: '',
        success: false,
        error: 'Tool code must return or evaluate to a function',
      };
    }
    
    // Execute the function with args
    const result = fn(args);
    
    // Handle async results
    const finalResult = result instanceof Promise ? await result : result;
    
    // Format result
    const content = formatResult(finalResult);
    
    return {
      content,
      success: true,
    };
  } catch (error) {
    if (error instanceof Error) {
      // Handle specific vm errors
      if (error.message.includes('Script execution timed out')) {
        return {
          content: '',
          success: false,
          error: `Execution timed out after ${config.timeout_ms ?? 5000}ms`,
        };
      }
      
      return {
        content: '',
        success: false,
        error: `JavaScript error: ${error.message}`,
      };
    }
    
    return {
      content: '',
      success: false,
      error: 'Unknown error during JavaScript execution',
    };
  }
}

/**
 * Format the result as a string
 */
function formatResult(result: unknown): string {
  if (result === undefined || result === null) {
    return 'null';
  }
  
  if (typeof result === 'string') {
    return result;
  }
  
  if (typeof result === 'number' || typeof result === 'boolean') {
    return String(result);
  }
  
  if (result instanceof Error) {
    return result.message;
  }
  
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

/**
 * Validate JavaScript code syntax
 */
export function validateJavaScriptCode(code: string): { valid: boolean; error?: string } {
  try {
    new vm.Script(code);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid JavaScript',
    };
  }
}
