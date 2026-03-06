import type { RestApiToolConfig, ToolAuth } from '../types/index.js';
import type { ToolResult, ToolContext } from './executor.js';

/**
 * Execute a REST API tool
 */
export async function executeRestTool(
  config: RestApiToolConfig,
  args: Record<string, unknown>,
  context: ToolContext
): Promise<ToolResult> {
  try {
    // Build URL with path parameters
    let url = substituteVariables(config.endpoint, { ...context.variables, ...args });
    
    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
    
    // Add authentication
    if (config.auth && config.auth.type !== 'none') {
      addAuthHeaders(headers, config.auth, context);
    }
    
    // Prepare request options
    const requestOptions: RequestInit = {
      method: config.method ?? 'GET',
      headers,
    };
    
    // Add query parameters for GET requests
    if (config.method === 'GET' || !config.method) {
      const queryParams = buildQueryParams(args, config.parameters ?? []);
      if (queryParams) {
        url += (url.includes('?') ? '&' : '?') + queryParams;
      }
    }
    
    // Add body for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(config.method ?? 'GET')) {
      if (config.body_template) {
        requestOptions.body = substituteVariables(config.body_template, { ...context.variables, ...args });
      } else {
        requestOptions.body = JSON.stringify(args);
      }
    }
    
    // Make the request
    const response = await fetch(url, requestOptions);
    
    // Handle non-OK responses
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read response');
      return {
        content: '',
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }
    
    // Parse response
    let data: unknown;
    const contentType = response.headers.get('content-type') ?? '';
    
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    
    // Extract data from response path if specified
    if (config.response_path && typeof data === 'object' && data !== null) {
      data = extractValue(data as Record<string, unknown>, config.response_path);
    }
    
    // Format result
    const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    
    return {
      content,
      success: true,
    };
  } catch (error) {
    return {
      content: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Add authentication headers based on auth config
 */
function addAuthHeaders(
  headers: Record<string, string>,
  auth: ToolAuth,
  _context: ToolContext
): void {
  switch (auth.type) {
    case 'bearer':
      if (auth.token_env) {
        const token = process.env[auth.token_env];
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }
      break;
    
    case 'basic':
      if (auth.username_env && auth.password_env) {
        const username = process.env[auth.username_env] ?? '';
        const password = process.env[auth.password_env] ?? '';
        const credentials = Buffer.from(`${username}:${password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      }
      break;
    
    case 'header':
      if (auth.header_name && auth.token_env) {
        const token = process.env[auth.token_env];
        if (token) {
          headers[auth.header_name] = token;
        }
      }
      break;
  }
}

/**
 * Build query parameters string from args
 */
function buildQueryParams(
  args: Record<string, unknown>,
  excludeParams: Array<{ name: string }>
): string {
  const excludeNames = new Set(excludeParams.map(p => p.name));
  const params: string[] = [];
  
  for (const [key, value] of Object.entries(args)) {
    if (!excludeNames.has(key) && value !== undefined && value !== null) {
      const encodedKey = encodeURIComponent(key);
      const encodedValue = encodeURIComponent(String(value));
      params.push(`${encodedKey}=${encodedValue}`);
    }
  }
  
  return params.join('&');
}

/**
 * Substitute {{variable}} placeholders in a string
 */
function substituteVariables(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = variables[key];
    if (value === undefined) {
      return `{{${key}}}`;
    }
    return String(value);
  });
}

/**
 * Extract value from nested object using dot notation path
 */
function extractValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    
    if (typeof current === 'object') {
      // Handle array index notation: items[0]
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const arrayKey = arrayMatch[1]!;
        const index = parseInt(arrayMatch[2]!, 10);
        const array = (current as Record<string, unknown>)[arrayKey];
        if (Array.isArray(array)) {
          current = array[index];
        } else {
          return undefined;
        }
      } else {
        current = (current as Record<string, unknown>)[part];
      }
    } else {
      return undefined;
    }
  }
  
  return current;
}
