import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { Provider } from '../types/index.js';
import { CredentialNotFoundError } from '../errors/index.js';
import { findProjectRoot } from '../config/loader.js';

/**
 * Provider to environment variable name mapping
 */
const PROVIDER_ENV_VARS: Record<Provider, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  groq: 'GROQ_API_KEY',
  google: 'GOOGLE_API_KEY',
  together: 'TOGETHER_API_KEY',
};

/**
 * Additional providers (not AI providers)
 */
const ADDITIONAL_ENV_VARS: Record<string, string> = {
  brave: 'BRAVE_API_KEY',
};

/**
 * Get all provider env var names
 */
function getEnvVarName(provider: string): string {
  return PROVIDER_ENV_VARS[provider as Provider] ?? ADDITIONAL_ENV_VARS[provider] ?? `${provider.toUpperCase()}_API_KEY`;
}

/**
 * Parse INI-style credentials file
 */
function parseCredentialsFile(filePath: string): Record<string, Record<string, string>> {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  
  // Check file permissions on Unix systems
  if (process.platform !== 'win32') {
    const stats = fs.statSync(filePath);
    const mode = stats.mode & 0o777;
    if (mode !== 0o600) {
      console.warn(`Warning: ${filePath} has insecure permissions. Run: chmod 600 ${filePath}`);
    }
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const result: Record<string, Record<string, string>> = {};
  let currentSection: string | null = null;
  
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
      continue;
    }
    
    // Section header
    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1]!.toLowerCase();
      result[currentSection] = {};
      continue;
    }
    
    // Key-value pair
    if (currentSection) {
      const kvMatch = trimmed.match(/^([^=]+)=(.*)$/);
      if (kvMatch) {
        const key = kvMatch[1]!.trim();
        const value = kvMatch[2]!.trim();
        result[currentSection]![key] = value;
      }
    }
  }
  
  return result;
}

/**
 * Parse .env file and return key-value pairs
 */
function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  
  const result: Record<string, string> = {};
  const content = fs.readFileSync(filePath, 'utf-8');
  
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    
    // Handle 'export' prefix
    const withoutExport = trimmed.startsWith('export ') 
      ? trimmed.slice(7).trim() 
      : trimmed;
    
    // Parse key=value or key="value" or key='value'
    const match = withoutExport.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1]!.trim();
      let value = match[2]!.trim();
      
      // Remove quotes
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Resolve API key for a provider
 * Priority: env var > project .env > ~/.crystral/credentials
 */
export function resolveApiKey(provider: Provider | string, cwd?: string): string {
  const envVarName = getEnvVarName(provider);
  
  // Priority 1: Process environment variable
  const envValue = process.env[envVarName];
  if (envValue) {
    return envValue;
  }
  
  // Priority 2: Project .env file
  const root = findProjectRoot(cwd);
  if (root) {
    const envPath = path.join(root, '.env');
    const envVars = parseEnvFile(envPath);
    if (envVars[envVarName]) {
      return envVars[envVarName]!;
    }
  }
  
  // Priority 3: Global credentials file
  const homeDir = os.homedir();
  const credentialsPath = path.join(homeDir, '.crystral', 'credentials');
  const credentials = parseCredentialsFile(credentialsPath);
  const providerLower = provider.toLowerCase();
  
  if (credentials[providerLower]?.api_key) {
    return credentials[providerLower]!.api_key;
  }
  
  // Not found
  throw new CredentialNotFoundError(provider, envVarName);
}

/**
 * Check if an API key is available for a provider (without throwing)
 */
export function hasApiKey(provider: Provider | string, cwd?: string): boolean {
  try {
    resolveApiKey(provider, cwd);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the source of an API key (for display purposes)
 */
export function getApiKeySource(provider: Provider | string, cwd?: string): 'env' | 'dotenv' | 'credentials' | null {
  const envVarName = getEnvVarName(provider);
  
  // Check process env
  if (process.env[envVarName]) {
    return 'env';
  }
  
  // Check .env file
  const root = findProjectRoot(cwd);
  if (root) {
    const envPath = path.join(root, '.env');
    const envVars = parseEnvFile(envPath);
    if (envVars[envVarName]) {
      return 'dotenv';
    }
  }
  
  // Check credentials file
  const homeDir = os.homedir();
  const credentialsPath = path.join(homeDir, '.crystral', 'credentials');
  const credentials = parseCredentialsFile(credentialsPath);
  const providerLower = provider.toLowerCase();
  
  if (credentials[providerLower]?.api_key) {
    return 'credentials';
  }
  
  return null;
}

/**
 * Save a credential to the global credentials file
 */
export function saveGlobalCredential(provider: Provider | string, apiKey: string): void {
  const homeDir = os.homedir();
  const crystralDir = path.join(homeDir, '.crystral');
  const credentialsPath = path.join(crystralDir, 'credentials');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(crystralDir)) {
    fs.mkdirSync(crystralDir, { recursive: true });
  }
  
  // Read existing credentials
  let content = '';
  if (fs.existsSync(credentialsPath)) {
    content = fs.readFileSync(credentialsPath, 'utf-8');
  }
  
  // Update or add the provider section
  const providerLower = provider.toLowerCase();
  const lines = content.split('\n');
  const newLines: string[] = [];
  let inSection = false;
  let sectionUpdated = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Check for section header
    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      if (inSection && !sectionUpdated) {
        // We were in the target section but didn't update, add the key
        newLines.push(`api_key = ${apiKey}`);
        sectionUpdated = true;
      }
      inSection = sectionMatch[1]!.toLowerCase() === providerLower;
    }
    
    // If in target section, check for api_key line
    if (inSection && trimmed.startsWith('api_key')) {
      newLines.push(`api_key = ${apiKey}`);
      sectionUpdated = true;
      continue;
    }
    
    newLines.push(line);
  }
  
  // Handle end of file
  if (inSection && !sectionUpdated) {
    newLines.push(`api_key = ${apiKey}`);
    sectionUpdated = true;
  }
  
  // If section wasn't found, add it
  if (!sectionUpdated) {
    if (newLines.length > 0 && newLines[newLines.length - 1] !== '') {
      newLines.push('');
    }
    newLines.push(`[${providerLower}]`);
    newLines.push(`api_key = ${apiKey}`);
  }
  
  // Write the file
  fs.writeFileSync(credentialsPath, newLines.join('\n') + '\n', 'utf-8');
  
  // Set permissions on Unix systems
  if (process.platform !== 'win32') {
    fs.chmodSync(credentialsPath, 0o600);
  }
}

/**
 * List all configured providers with masked keys
 */
export function listGlobalCredentials(): Record<string, { maskedKey: string; source: string }> {
  const result: Record<string, { maskedKey: string; source: string }> = {};
  
  // Check all providers
  const allProviders = [...Object.keys(PROVIDER_ENV_VARS), ...Object.keys(ADDITIONAL_ENV_VARS)];
  
  for (const provider of allProviders) {
    const source = getApiKeySource(provider as Provider);
    
    if (source) {
      try {
        const key = resolveApiKey(provider as Provider);
        const maskedKey = maskApiKey(key);
        result[provider] = { maskedKey, source };
      } catch {
        // Should not happen since we checked source
      }
    }
  }
  
  return result;
}

/**
 * Mask an API key for display
 */
function maskApiKey(key: string): string {
  if (key.length <= 8) {
    return '****';
  }
  
  const start = key.slice(0, 4);
  const end = key.slice(-3);
  const middle = '*'.repeat(Math.min(20, key.length - 7));
  
  return `${start}${middle}${end}`;
}

/**
 * Remove a credential from the global credentials file
 */
export function removeGlobalCredential(provider: Provider | string): boolean {
  const homeDir = os.homedir();
  const credentialsPath = path.join(homeDir, '.crystral', 'credentials');
  
  if (!fs.existsSync(credentialsPath)) {
    return false;
  }
  
  const content = fs.readFileSync(credentialsPath, 'utf-8');
  const providerLower = provider.toLowerCase();
  const lines = content.split('\n');
  const newLines: string[] = [];
  let inSection = false;
  let removed = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Check for section header
    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      inSection = sectionMatch[1]!.toLowerCase() === providerLower;
      if (inSection) {
        removed = true;
        continue; // Skip the section header
      }
    }
    
    // Skip lines in the target section
    if (inSection) {
      continue;
    }
    
    newLines.push(line);
  }
  
  if (removed) {
    fs.writeFileSync(credentialsPath, newLines.join('\n').trim() + '\n', 'utf-8');
  }
  
  return removed;
}

/**
 * Get the path to the global credentials file
 */
export function getCredentialsPath(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, '.crystral', 'credentials');
}
