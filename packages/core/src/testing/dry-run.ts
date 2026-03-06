/**
 * Dry-run utility: loads and resolves all config for an agent without
 * making any LLM calls.
 */
import { loadAgentConfig, findProjectRoot } from '../config/loader.js';
import { resolveSystemPrompt } from '../prompts/index.js';

export interface DryRunResult {
  agent: string;
  resolvedConfig: Record<string, unknown>;
  tools: string[];
  systemPrompt: string;
  warnings: string[];
}

/**
 * Load agent config, resolve inheritance, resolve system prompt template,
 * list tools, and return a summary.
 */
export function dryRun(agentName: string, cwd?: string): DryRunResult {
  const warnings: string[] = [];

  // 1. Load agent config (handles extends / inheritance)
  const config = loadAgentConfig(agentName, cwd);

  // 2. Resolve system prompt
  let systemPrompt = '';
  try {
    systemPrompt = resolveSystemPrompt(config.system_prompt, {}, cwd);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`Failed to resolve system prompt: ${msg}`);
  }

  // 3. Check for common issues
  const projectRoot = findProjectRoot(cwd);
  if (!projectRoot) {
    warnings.push('No crystral.config.yaml found in any parent directory.');
  }

  if (config.tools.length === 0 && (!config.mcp || config.mcp.length === 0)) {
    warnings.push('Agent has no tools or MCP servers configured.');
  }

  if (!config.system_prompt || (typeof config.system_prompt === 'string' && config.system_prompt.trim() === '')) {
    warnings.push('Agent has an empty system prompt.');
  }

  // 4. Build resolved config (strip defaults that are internal)
  const resolvedConfig: Record<string, unknown> = { ...config };

  return {
    agent: config.name,
    resolvedConfig,
    tools: config.tools,
    systemPrompt,
    warnings,
  };
}
