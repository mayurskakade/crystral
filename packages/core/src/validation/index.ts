/**
 * Project-wide config validation.
 *
 * Scans all YAML config files (agents, tools, workflows, prompts, tests,
 * schedules, project config) and validates each against its Zod schema.
 */
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
} from '../types/index.js';
import { findProjectRoot } from '../config/loader.js';

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface ValidationFileResult {
  file: string;
  type: 'agent' | 'tool' | 'workflow' | 'prompt' | 'test' | 'schedule' | 'project';
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ValidationResult {
  files: ValidationFileResult[];
  valid: number;
  errors: number;
  warnings: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function yamlFilesIn(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => !f.startsWith('.') && (f.endsWith('.yaml') || f.endsWith('.yml')))
    .map((f) => path.join(dir, f));
}

function validateFile(
  filePath: string,
  schema: z.ZodType,
  type: ValidationFileResult['type'],
): ValidationFileResult {
  const result: ValidationFileResult = {
    file: filePath,
    type,
    valid: true,
    errors: [],
    warnings: [],
  };

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const raw = yaml.load(content);

    if (typeof raw !== 'object' || raw === null) {
      result.valid = false;
      result.errors.push('File does not contain a valid YAML object.');
      return result;
    }

    if (!('version' in (raw as Record<string, unknown>))) {
      result.warnings.push("Missing 'version' field.");
    }

    schema.parse(raw);
  } catch (err: unknown) {
    result.valid = false;
    if (err instanceof z.ZodError) {
      for (const issue of err.issues) {
        result.errors.push(`${issue.path.join('.')}: ${issue.message}`);
      }
    } else if (err instanceof Error) {
      result.errors.push(err.message);
    } else {
      result.errors.push(String(err));
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Validate all YAML config files in the project against their Zod schemas.
 */
export function validateProject(cwd?: string): ValidationResult {
  const root = findProjectRoot(cwd);
  const baseDir = root ?? (cwd ?? process.cwd());

  const files: ValidationFileResult[] = [];

  // 1. Project config
  for (const name of ['crystral.config.yaml', 'crystral.config.yml']) {
    const p = path.join(baseDir, name);
    if (fs.existsSync(p)) {
      files.push(validateFile(p, ProjectConfigSchema, 'project'));
    }
  }

  // 2. Agents
  for (const f of yamlFilesIn(path.join(baseDir, 'agents'))) {
    files.push(validateFile(f, AgentConfigSchema, 'agent'));
  }

  // 3. Tools
  for (const f of yamlFilesIn(path.join(baseDir, 'tools'))) {
    files.push(validateFile(f, ToolConfigSchema, 'tool'));
  }

  // 4. Workflows
  for (const f of yamlFilesIn(path.join(baseDir, 'workflows'))) {
    files.push(validateFile(f, WorkflowConfigSchema, 'workflow'));
  }

  // 5. Prompts
  for (const f of yamlFilesIn(path.join(baseDir, 'prompts'))) {
    files.push(validateFile(f, PromptTemplateConfigSchema, 'prompt'));
  }

  // 6. Tests
  for (const f of yamlFilesIn(path.join(baseDir, 'tests'))) {
    files.push(validateFile(f, TestSuiteConfigSchema, 'test'));
  }

  // 7. Schedules
  for (const f of yamlFilesIn(path.join(baseDir, 'schedules'))) {
    files.push(validateFile(f, ScheduleConfigSchema, 'schedule'));
  }

  const valid = files.filter((f) => f.valid).length;
  const errorCount = files.filter((f) => !f.valid).length;
  const warningCount = files.reduce((sum, f) => sum + f.warnings.length, 0);

  return {
    files,
    valid,
    errors: errorCount,
    warnings: warningCount,
  };
}
