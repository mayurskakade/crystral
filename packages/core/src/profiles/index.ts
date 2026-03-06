import type { ProjectConfig, AgentConfig } from '../types/index.js';

/**
 * Get the active profile name from environment or explicit option.
 * The projectConfig is used to validate that the profile exists.
 */
export function getActiveProfile(_projectConfig: ProjectConfig, explicit?: string): string | undefined {
  if (explicit) return explicit;
  const envProfile = process.env['CRYSTRAL_PROFILE'];
  return envProfile ?? undefined;
}

/**
 * Apply profile overrides to an agent config.
 * Profile provides defaults -- agent's explicit values take precedence.
 */
export function applyProfile(
  agent: AgentConfig,
  projectConfig: ProjectConfig,
  profileName?: string,
): AgentConfig {
  const name = getActiveProfile(projectConfig, profileName);
  if (!name) return agent;

  const profiles = projectConfig.profiles;
  if (!profiles) return agent;

  const profile = profiles[name];
  if (!profile) return agent;

  // Build the result: profile values act as fallback defaults
  const result: AgentConfig = { ...agent };

  // Provider/model from profile as fallback only if agent doesn't explicitly set them
  // Since AgentConfig always has provider/model (required fields), we apply profile
  // defaults only for cache, logging, and guardrails which are optional.
  if (profile.default_provider && !agent.provider) {
    result.provider = profile.default_provider;
  }
  if (profile.default_model && !agent.model) {
    result.model = profile.default_model;
  }

  // Apply profile's cache, logging, guardrails as defaults if agent doesn't have them
  if (profile.cache && !agent.cache) {
    result.cache = profile.cache;
  }
  if (profile.logging && !agent.logging) {
    result.logging = profile.logging;
  }
  if (profile.guardrails && !agent.guardrails) {
    result.guardrails = profile.guardrails;
  }

  return result;
}
