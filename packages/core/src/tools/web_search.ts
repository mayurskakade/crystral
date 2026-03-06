import type { WebSearchToolConfig } from '../types/index.js';
import type { ToolResult, ToolContext } from './executor.js';

/**
 * Execute a web search tool using Brave Search API
 */
export async function executeWebSearchTool(
  config: WebSearchToolConfig,
  args: Record<string, unknown>,
  _context: ToolContext
): Promise<ToolResult> {
  try {
    const query = args.query ?? args.q;
    
    if (!query || typeof query !== 'string') {
      return {
        content: '',
        success: false,
        error: 'Missing or invalid query parameter',
      };
    }
    
    // Get API key from environment
    const apiKey = process.env.BRAVE_SEARCH_API_KEY ?? process.env.BRAVE_API_KEY;
    
    if (!apiKey) {
      return {
        content: '',
        success: false,
        error: 'Missing BRAVE_SEARCH_API_KEY or BRAVE_API_KEY environment variable. Get your API key from https://brave.com/search/api/',
      };
    }
    
    const resultCount = config.result_count ?? 5;
    const safeSearch = config.safe_search ?? 'moderate';
    
    // Build search URL
    const searchUrl = new URL('https://api.search.brave.com/res/v1/web/search');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('count', String(resultCount));
    searchUrl.searchParams.set('safesearch', safeSearch);
    searchUrl.searchParams.set('search_lang', 'en');
    searchUrl.searchParams.set('text_decorations', 'false');
    
    // Make the request
    const response = await fetch(searchUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        return {
          content: '',
          success: false,
          error: 'Invalid Brave Search API key. Check your BRAVE_SEARCH_API_KEY environment variable.',
        };
      }
      
      if (response.status === 429) {
        return {
          content: '',
          success: false,
          error: 'Brave Search API rate limit exceeded. Please try again later.',
        };
      }
      
      const errorText = await response.text().catch(() => 'Unable to read response');
      return {
        content: '',
        success: false,
        error: `Brave Search API error (HTTP ${response.status}): ${errorText}`,
      };
    }
    
    const data = await response.json() as BraveSearchResponse;
    
    // Format results
    const results = formatSearchResults(data, query, resultCount);
    
    return {
      content: results,
      success: true,
    };
  } catch (error) {
    return {
      content: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during web search',
    };
  }
}

/**
 * Brave Search API response structure
 */
interface BraveSearchResponse {
  web?: {
    results?: Array<{
      title?: string;
      url?: string;
      description?: string;
      page_age?: string;
      language?: string;
    }>;
  };
  query?: {
    original?: string;
    show_strict_warning?: boolean;
  };
}

/**
 * Format search results as a readable string
 */
function formatSearchResults(data: BraveSearchResponse, query: string, maxResults: number): string {
  const results = data.web?.results ?? [];
  
  if (results.length === 0) {
    return `No results found for "${query}"`;
  }
  
  const lines: string[] = [`Search results for "${query}":\n`];
  
  const limitedResults = results.slice(0, maxResults);
  
  for (let i = 0; i < limitedResults.length; i++) {
    const result = limitedResults[i]!;
    const num = i + 1;
    
    lines.push(`${num}. ${result.title ?? 'Untitled'}`);
    
    if (result.url) {
      lines.push(`   URL: ${result.url}`);
    }
    
    if (result.description) {
      // Truncate long descriptions
      const desc = result.description.length > 300 
        ? result.description.slice(0, 297) + '...'
        : result.description;
      lines.push(`   ${desc}`);
    }
    
    if (result.page_age) {
      lines.push(`   Age: ${result.page_age}`);
    }
    
    lines.push('');
  }
  
  return lines.join('\n');
}
