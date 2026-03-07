import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import {
  ProjectConfigSchema,
  AgentConfigSchema,
  ToolConfigSchema,
  WorkflowConfigSchema,
  PromptTemplateConfigSchema,
  TestSuiteConfigSchema,
  ScheduleConfigSchema,
  type ProjectConfig,
  type AgentConfig,
  type ToolConfig,
  type WorkflowConfig,
  type PromptTemplateConfig,
  type TestSuiteConfig,
  type ScheduleConfig,
} from '../types/index.js';
import { ValidationError, AgentNotFoundError, ToolNotFoundError, RAGCollectionNotFoundError } from '../errors/index.js';
import { applyProfile } from '../profiles/index.js';

/**
 * Find the project root by walking up directories until crystral.config.yaml is found
 */
export function findProjectRoot(cwd: string = process.cwd()): string | null {
  let dir = path.resolve(cwd);
  
  while (true) {
    const configPath = path.join(dir, 'crystral.config.yaml');
    const configPathYml = path.join(dir, 'crystral.config.yml');
    
    if (fs.existsSync(configPath) || fs.existsSync(configPathYml)) {
      return dir;
    }
    
    const parent = path.dirname(dir);
    if (parent === dir) {
      // Reached filesystem root
      return null;
    }
    dir = parent;
  }
}

/**
 * Get the project root or throw if not found
 */
export function requireProjectRoot(cwd?: string): string {
  const root = findProjectRoot(cwd);
  if (!root) {
    throw new ValidationError(
      'crystral.config.yaml not found. Run `crystral init` to create a new project.',
      { cwd }
    );
  }
  return root;
}

/**
 * Parse YAML file and return raw object
 */
function parseYamlFile(filePath: string): unknown {
  const content = fs.readFileSync(filePath, 'utf-8');
  return yaml.load(content);
}

/**
 * Validate Zod schema and convert errors to CrystalAI errors
 */
function validateSchema<T extends z.ZodType>(
  schema: T,
  data: unknown,
  filePath: string
): z.output<T> {
  try {
    return schema.parse(data) as z.output<T>;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues;
      const firstIssue = issues[0];
      if (firstIssue) {
        const field = firstIssue.path.join('.');
        const message = firstIssue.message;
        throw new ValidationError(
          `Invalid config in ${filePath}:\n  Field '${field}': ${message}`,
          { filePath, field, issues: issues.map(i => ({ path: i.path.join('.'), message: i.message })) }
        );
      }
    }
    throw error;
  }
}

/**
 * Load project config from crystral.config.yaml
 */
export function loadProjectConfig(cwd?: string): ProjectConfig {
  const root = findProjectRoot(cwd);
  const configDir = root ?? (cwd ?? process.cwd());
  
  const yamlPath = path.join(configDir, 'crystral.config.yaml');
  const ymlPath = path.join(configDir, 'crystral.config.yml');
  
  let filePath: string;
  if (fs.existsSync(yamlPath)) {
    filePath = yamlPath;
  } else if (fs.existsSync(ymlPath)) {
    filePath = ymlPath;
  } else {
    // Return default config if not found
    const defaultConfig: ProjectConfig = {
      version: 1,
      project: path.basename(configDir),
    };
    return defaultConfig;
  }
  
  const raw = parseYamlFile(filePath);
  
  // Check version field exists
  if (typeof raw === 'object' && raw !== null && !('version' in raw)) {
    throw new ValidationError(
      `Missing required field 'version'. Add 'version: 1' to the top of ${filePath}.`,
      { filePath, field: 'version' }
    );
  }
  
  return validateSchema(ProjectConfigSchema, raw, filePath);
}

/**
 * Deep merge agent config: base defaults overridden by the child config.
 * - Simple scalar fields: override
 * - Arrays (tools, mcp, stop_sequences): replace entirely (not concat)
 * - Objects (rag, system_prompt object): shallow merge
 * - version and extends are skipped from override
 */
function deepMergeAgentConfig(base: AgentConfig, override: Record<string, unknown>): AgentConfig {
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (key === 'version' || key === 'extends') continue; // skip meta fields
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      (result as Record<string, unknown>)[key] = value; // arrays replace
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const baseVal = (result as Record<string, unknown>)[key];
      if (typeof baseVal === 'object' && baseVal !== null) {
        (result as Record<string, unknown>)[key] = { ...baseVal as Record<string, unknown>, ...value as Record<string, unknown> };
      } else {
        (result as Record<string, unknown>)[key] = value;
      }
    } else {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

/**
 * Internal: load agent config with circular extends detection.
 */
function loadAgentConfigInternal(name: string, cwd: string | undefined, seen: Set<string>): AgentConfig {
  if (seen.has(name)) {
    throw new ValidationError(
      `Circular agent inheritance detected: ${[...seen, name].join(' → ')}`,
      { agentName: name, chain: [...seen] }
    );
  }
  seen.add(name);

  const root = findProjectRoot(cwd);
  const agentsDir = root ? path.join(root, 'agents') : path.join(cwd ?? process.cwd(), 'agents');

  const yamlPath = path.join(agentsDir, `${name}.yaml`);
  const ymlPath = path.join(agentsDir, `${name}.yml`);

  let filePath: string;
  if (fs.existsSync(yamlPath)) {
    filePath = yamlPath;
  } else if (fs.existsSync(ymlPath)) {
    filePath = ymlPath;
  } else {
    throw new AgentNotFoundError(name, root ?? undefined);
  }

  const raw = parseYamlFile(filePath);

  // Check version field exists
  if (typeof raw === 'object' && raw !== null && !('version' in raw)) {
    throw new ValidationError(
      `Missing required field 'version'. Add 'version: 1' to the top of ${filePath}.`,
      { filePath, field: 'version' }
    );
  }

  const config = validateSchema(AgentConfigSchema, raw, filePath);

  // Verify name matches filename
  if (config.name !== name) {
    throw new ValidationError(
      `Agent name '${config.name}' does not match filename '${name}.yaml'.\nThe name field must equal the filename without extension.`,
      { filePath, field: 'name', expected: name, actual: config.name }
    );
  }

  // Handle extends (agent inheritance)
  const extendsName = (raw as Record<string, unknown>)['extends'];
  if (typeof extendsName === 'string') {
    const baseConfig = loadAgentConfigInternal(extendsName, cwd, seen);
    // Deep merge: base as defaults, current config overrides
    // Use the raw parsed data (before Zod defaults) so we only override what was explicitly set
    const rawObj = raw as Record<string, unknown>;
    const merged = deepMergeAgentConfig(baseConfig, rawObj);
    // Restore the child's own name (not the base name)
    merged.name = config.name;
    return merged;
  }

  return config;
}

/**
 * Load agent config from agents/<name>.yaml
 * If a profile is active (via CRYSTRAL_PROFILE env or explicit), profile defaults are applied.
 */
export function loadAgentConfig(name: string, cwd?: string): AgentConfig {
  let config = loadAgentConfigInternal(name, cwd, new Set<string>());

  // Apply active profile defaults if available
  const profileName = process.env['CRYSTRAL_PROFILE'];
  if (profileName) {
    try {
      const projectConfig = loadProjectConfig(cwd);
      config = applyProfile(config, projectConfig, profileName);
    } catch {
      // If project config can't be loaded, skip profile application
    }
  }

  return config;
}

/**
 * Load tool config from tools/<name>.yaml
 */
export function loadToolConfig(name: string, cwd?: string, agentName?: string): ToolConfig {
  const root = findProjectRoot(cwd);
  const toolsDir = root ? path.join(root, 'tools') : path.join(cwd ?? process.cwd(), 'tools');
  
  const yamlPath = path.join(toolsDir, `${name}.yaml`);
  const ymlPath = path.join(toolsDir, `${name}.yml`);
  
  let filePath: string;
  if (fs.existsSync(yamlPath)) {
    filePath = yamlPath;
  } else if (fs.existsSync(ymlPath)) {
    filePath = ymlPath;
  } else {
    throw new ToolNotFoundError(name, agentName, root ?? undefined);
  }
  
  const raw = parseYamlFile(filePath);
  
  // Check version field exists
  if (typeof raw === 'object' && raw !== null && !('version' in raw)) {
    throw new ValidationError(
      `Missing required field 'version'. Add 'version: 1' to the top of ${filePath}.`,
      { filePath, field: 'version' }
    );
  }
  
  const config = validateSchema(ToolConfigSchema, raw, filePath);
  
  // Verify name matches filename
  if (config.name !== name) {
    throw new ValidationError(
      `Tool name '${config.name}' does not match filename '${name}.yaml'.\nThe name field must equal the filename without extension.`,
      { filePath, field: 'name', expected: name, actual: config.name }
    );
  }
  
  return config;
}

/**
 * @deprecated Crystal AI no longer manages in-house RAG collections.
 * Configure an external vector store via the `rag:` field in your agent YAML.
 * This function throws to guide migration.
 */
export function loadRAGCollectionConfig(name: string, _cwd?: string): never {
  throw new RAGCollectionNotFoundError(name, undefined);
}

/**
 * List all agents in the project
 */
export function listAgents(cwd?: string): string[] {
  const root = findProjectRoot(cwd);
  const agentsDir = root ? path.join(root, 'agents') : path.join(cwd ?? process.cwd(), 'agents');
  
  if (!fs.existsSync(agentsDir)) {
    return [];
  }
  
  const files = fs.readdirSync(agentsDir);
  const agents: string[] = [];
  
  for (const file of files) {
    if (file.startsWith('.') || file.startsWith('_')) continue;
    if (file.endsWith('.yaml') || file.endsWith('.yml')) {
      const agentName = file.replace(/\.(ya?ml)$/, '');
      // Avoid duplicates (both .yaml and .yml)
      if (!agents.includes(agentName)) {
        agents.push(agentName);
      }
    }
  }

  return agents.sort();
}

/**
 * List all tools in the project
 */
export function listTools(cwd?: string): string[] {
  const root = findProjectRoot(cwd);
  const toolsDir = root ? path.join(root, 'tools') : path.join(cwd ?? process.cwd(), 'tools');
  
  if (!fs.existsSync(toolsDir)) {
    return [];
  }
  
  const files = fs.readdirSync(toolsDir);
  const tools: string[] = [];
  
  for (const file of files) {
    if (file.startsWith('.')) continue;
    if (file.endsWith('.yaml') || file.endsWith('.yml')) {
      const name = file.replace(/\.(ya?ml)$/, '');
      if (!tools.includes(name)) {
        tools.push(name);
      }
    }
  }
  
  return tools.sort();
}

/**
 * List all RAG collections in the project
 */
export function listRAGCollections(cwd?: string): string[] {
  const root = findProjectRoot(cwd);
  const ragDir = root ? path.join(root, 'rag') : path.join(cwd ?? process.cwd(), 'rag');
  
  if (!fs.existsSync(ragDir)) {
    return [];
  }
  
  const entries = fs.readdirSync(ragDir, { withFileTypes: true });
  const collections: string[] = [];
  
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      collections.push(entry.name);
    }
  }
  
  return collections.sort();
}

/**
 * Write project config to file
 */
export function writeProjectConfig(config: ProjectConfig, cwd?: string): void {
  const root = findProjectRoot(cwd) ?? (cwd ?? process.cwd());
  const configPath = path.join(root, 'crystral.config.yaml');
  
  const content = yaml.dump(config, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });
  
  fs.writeFileSync(configPath, content, 'utf-8');
}

/**
 * Write agent config to file
 */
export function writeAgentConfig(config: AgentConfig, cwd?: string): void {
  const root = findProjectRoot(cwd);
  const agentsDir = root ? path.join(root, 'agents') : path.join(cwd ?? process.cwd(), 'agents');
  
  if (!fs.existsSync(agentsDir)) {
    fs.mkdirSync(agentsDir, { recursive: true });
  }
  
  const configPath = path.join(agentsDir, `${config.name}.yaml`);
  
  const content = yaml.dump(config, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });
  
  fs.writeFileSync(configPath, content, 'utf-8');
}

/**
 * Write tool config to file
 */
export function writeToolConfig(config: ToolConfig, cwd?: string): void {
  const root = findProjectRoot(cwd);
  const toolsDir = root ? path.join(root, 'tools') : path.join(cwd ?? process.cwd(), 'tools');

  if (!fs.existsSync(toolsDir)) {
    fs.mkdirSync(toolsDir, { recursive: true });
  }

  const configPath = path.join(toolsDir, `${config.name}.yaml`);

  const content = yaml.dump(config, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });

  fs.writeFileSync(configPath, content, 'utf-8');
}

/**
 * Load workflow config from workflows/<name>.yaml
 */
export function loadWorkflowConfig(name: string, cwd?: string): WorkflowConfig {
  const root = findProjectRoot(cwd);
  const workflowsDir = root ? path.join(root, 'workflows') : path.join(cwd ?? process.cwd(), 'workflows');

  const yamlPath = path.join(workflowsDir, `${name}.yaml`);
  const ymlPath = path.join(workflowsDir, `${name}.yml`);

  let filePath: string;
  if (fs.existsSync(yamlPath)) {
    filePath = yamlPath;
  } else if (fs.existsSync(ymlPath)) {
    filePath = ymlPath;
  } else {
    throw new ValidationError(
      `Workflow '${name}' not found.\nExpected file: ${workflowsDir}/${name}.yaml`,
      { workflowName: name }
    );
  }

  const raw = parseYamlFile(filePath);

  if (typeof raw === 'object' && raw !== null && !('version' in raw)) {
    throw new ValidationError(
      `Missing required field 'version'. Add 'version: 1' to the top of ${filePath}.`,
      { filePath, field: 'version' }
    );
  }

  const config = validateSchema(WorkflowConfigSchema, raw, filePath);

  if (config.name !== name) {
    throw new ValidationError(
      `Workflow name '${config.name}' does not match filename '${name}.yaml'.\nThe name field must equal the filename without extension.`,
      { filePath, field: 'name', expected: name, actual: config.name }
    );
  }

  return config;
}

/**
 * List all workflows in the project
 */
export function listWorkflows(cwd?: string): string[] {
  const root = findProjectRoot(cwd);
  const workflowsDir = root ? path.join(root, 'workflows') : path.join(cwd ?? process.cwd(), 'workflows');

  if (!fs.existsSync(workflowsDir)) {
    return [];
  }

  const files = fs.readdirSync(workflowsDir);
  const workflows: string[] = [];

  for (const file of files) {
    if (file.startsWith('.')) continue;
    if (file.endsWith('.yaml') || file.endsWith('.yml')) {
      const wfName = file.replace(/\.(ya?ml)$/, '');
      if (!workflows.includes(wfName)) {
        workflows.push(wfName);
      }
    }
  }

  return workflows.sort();
}

/**
 * Write workflow config to file
 */
export function writeWorkflowConfig(config: WorkflowConfig, cwd?: string): void {
  const root = findProjectRoot(cwd);
  const workflowsDir = root ? path.join(root, 'workflows') : path.join(cwd ?? process.cwd(), 'workflows');

  if (!fs.existsSync(workflowsDir)) {
    fs.mkdirSync(workflowsDir, { recursive: true });
  }

  const configPath = path.join(workflowsDir, `${config.name}.yaml`);

  const content = yaml.dump(config, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });

  fs.writeFileSync(configPath, content, 'utf-8');
}

// ============================================
// Prompt Template Functions
// ============================================

/**
 * Load prompt template config from prompts/<name>.yaml
 */
export function loadPromptTemplate(name: string, cwd?: string): PromptTemplateConfig {
  const root = findProjectRoot(cwd);
  const promptsDir = root ? path.join(root, 'prompts') : path.join(cwd ?? process.cwd(), 'prompts');

  const yamlPath = path.join(promptsDir, `${name}.yaml`);
  const ymlPath = path.join(promptsDir, `${name}.yml`);

  let filePath: string;
  if (fs.existsSync(yamlPath)) {
    filePath = yamlPath;
  } else if (fs.existsSync(ymlPath)) {
    filePath = ymlPath;
  } else {
    throw new ValidationError(
      `Prompt template '${name}' not found.\nExpected file: ${promptsDir}/${name}.yaml`,
      { templateName: name }
    );
  }

  const raw = parseYamlFile(filePath);

  // Check version field exists
  if (typeof raw === 'object' && raw !== null && !('version' in raw)) {
    throw new ValidationError(
      `Missing required field 'version'. Add 'version: 1' to the top of ${filePath}.`,
      { filePath, field: 'version' }
    );
  }

  const config = validateSchema(PromptTemplateConfigSchema, raw, filePath);

  // Verify name matches filename
  if (config.name !== name) {
    throw new ValidationError(
      `Prompt template name '${config.name}' does not match filename '${name}.yaml'.\nThe name field must equal the filename without extension.`,
      { filePath, field: 'name', expected: name, actual: config.name }
    );
  }

  return config;
}

/**
 * List all prompt templates in the project
 */
export function listPromptTemplates(cwd?: string): string[] {
  const root = findProjectRoot(cwd);
  const promptsDir = root ? path.join(root, 'prompts') : path.join(cwd ?? process.cwd(), 'prompts');

  if (!fs.existsSync(promptsDir)) {
    return [];
  }

  const files = fs.readdirSync(promptsDir);
  const templates: string[] = [];

  for (const file of files) {
    if (file.startsWith('.')) continue;
    if (file.endsWith('.yaml') || file.endsWith('.yml')) {
      const templateName = file.replace(/\.(ya?ml)$/, '');
      if (!templates.includes(templateName)) {
        templates.push(templateName);
      }
    }
  }

  return templates.sort();
}

/**
 * Get the active profile name by loading project config and checking CRYSTRAL_PROFILE env var.
 * Returns undefined if no profile is active.
 */
export function getActiveProfileName(cwd?: string): string | undefined {
  const envProfile = process.env['CRYSTRAL_PROFILE'];
  if (!envProfile) return undefined;

  // Verify the profile exists in the project config
  try {
    const projectConfig = loadProjectConfig(cwd);
    if (projectConfig.profiles && projectConfig.profiles[envProfile]) {
      return envProfile;
    }
  } catch {
    // If project config can't be loaded, return the env value anyway
  }

  return envProfile;
}

/**
 * Write prompt template config to file
 */
export function writePromptTemplate(config: PromptTemplateConfig, cwd?: string): void {
  const root = findProjectRoot(cwd);
  const promptsDir = root ? path.join(root, 'prompts') : path.join(cwd ?? process.cwd(), 'prompts');

  if (!fs.existsSync(promptsDir)) {
    fs.mkdirSync(promptsDir, { recursive: true });
  }

  const configPath = path.join(promptsDir, `${config.name}.yaml`);

  const content = yaml.dump(config, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });

  fs.writeFileSync(configPath, content, 'utf-8');
}

// ============================================
// Test Suite Functions
// ============================================

/**
 * Load a test suite config from tests/<name>.yaml
 */
export function loadTestSuite(name: string, cwd?: string): TestSuiteConfig {
  const root = findProjectRoot(cwd);
  const testsDir = root ? path.join(root, 'tests') : path.join(cwd ?? process.cwd(), 'tests');

  const yamlPath = path.join(testsDir, `${name}.yaml`);
  const ymlPath = path.join(testsDir, `${name}.yml`);

  let filePath: string;
  if (fs.existsSync(yamlPath)) {
    filePath = yamlPath;
  } else if (fs.existsSync(ymlPath)) {
    filePath = ymlPath;
  } else {
    throw new ValidationError(
      `Test suite '${name}' not found.\nExpected file: ${testsDir}/${name}.yaml`,
      { testSuiteName: name }
    );
  }

  const raw = parseYamlFile(filePath);

  if (typeof raw === 'object' && raw !== null && !('version' in raw)) {
    throw new ValidationError(
      `Missing required field 'version'. Add 'version: 1' to the top of ${filePath}.`,
      { filePath, field: 'version' }
    );
  }

  return validateSchema(TestSuiteConfigSchema, raw, filePath);
}

/**
 * List all test suites in the project (tests/*.yaml)
 */
export function listTestSuites(cwd?: string): string[] {
  const root = findProjectRoot(cwd);
  const testsDir = root ? path.join(root, 'tests') : path.join(cwd ?? process.cwd(), 'tests');

  if (!fs.existsSync(testsDir)) {
    return [];
  }

  const files = fs.readdirSync(testsDir);
  const suites: string[] = [];

  for (const file of files) {
    if (file.startsWith('.')) continue;
    if (file.endsWith('.yaml') || file.endsWith('.yml')) {
      const suiteName = file.replace(/\.(ya?ml)$/, '');
      if (!suites.includes(suiteName)) {
        suites.push(suiteName);
      }
    }
  }

  return suites.sort();
}

// ============================================
// Schedule Config Functions
// ============================================

/**
 * Load a schedule config from schedules/<name>.yaml
 */
export function loadScheduleConfig(name: string, cwd?: string): ScheduleConfig {
  const root = findProjectRoot(cwd);
  const schedulesDir = root ? path.join(root, 'schedules') : path.join(cwd ?? process.cwd(), 'schedules');

  const yamlPath = path.join(schedulesDir, `${name}.yaml`);
  const ymlPath = path.join(schedulesDir, `${name}.yml`);

  let filePath: string;
  if (fs.existsSync(yamlPath)) {
    filePath = yamlPath;
  } else if (fs.existsSync(ymlPath)) {
    filePath = ymlPath;
  } else {
    throw new ValidationError(
      `Schedule '${name}' not found.\nExpected file: ${schedulesDir}/${name}.yaml`,
      { scheduleName: name }
    );
  }

  const raw = parseYamlFile(filePath);

  if (typeof raw === 'object' && raw !== null && !('version' in raw)) {
    throw new ValidationError(
      `Missing required field 'version'. Add 'version: 1' to the top of ${filePath}.`,
      { filePath, field: 'version' }
    );
  }

  return validateSchema(ScheduleConfigSchema, raw, filePath);
}

/**
 * List all schedules in the project (schedules/*.yaml)
 */
export function listSchedules(cwd?: string): string[] {
  const root = findProjectRoot(cwd);
  const schedulesDir = root ? path.join(root, 'schedules') : path.join(cwd ?? process.cwd(), 'schedules');

  if (!fs.existsSync(schedulesDir)) {
    return [];
  }

  const files = fs.readdirSync(schedulesDir);
  const schedules: string[] = [];

  for (const file of files) {
    if (file.startsWith('.')) continue;
    if (file.endsWith('.yaml') || file.endsWith('.yml')) {
      const scheduleName = file.replace(/\.(ya?ml)$/, '');
      if (!schedules.includes(scheduleName)) {
        schedules.push(scheduleName);
      }
    }
  }

  return schedules.sort();
}
