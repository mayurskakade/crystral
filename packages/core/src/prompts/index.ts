/**
 * Prompt template loading and resolution.
 */
import type { PromptTemplateConfig, SystemPromptTemplate } from '../types/index.js';
import { loadPromptTemplate } from '../config/loader.js';
import { interpolateVariables, mergeVariables } from './resolver.js';

export { interpolateVariables, mergeVariables } from './resolver.js';

/**
 * Resolve a system prompt to a final string.
 *
 * - If systemPrompt is a string, interpolate {var} placeholders with runtimeVariables.
 * - If systemPrompt is an object with a template field:
 *   1. Load the prompt template by name using loadPromptTemplate()
 *   2. Merge: template defaults < systemPrompt.variables < runtimeVariables
 *   3. Interpolate {var} placeholders in the template text
 * - Return the resolved string.
 */
export function resolveSystemPrompt(
  systemPrompt: string | SystemPromptTemplate,
  runtimeVariables: Record<string, string> = {},
  cwd?: string,
): string {
  if (typeof systemPrompt === 'string') {
    return interpolateVariables(systemPrompt, runtimeVariables);
  }

  // systemPrompt is { template: string; variables?: Record<string, string> }
  const templateConfig: PromptTemplateConfig = loadPromptTemplate(systemPrompt.template, cwd);

  const merged = mergeVariables(
    templateConfig.defaults,
    systemPrompt.variables,
    runtimeVariables,
  );

  return interpolateVariables(templateConfig.template, merged);
}
