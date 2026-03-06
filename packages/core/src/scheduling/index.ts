/**
 * Simple schedule runner using cron-like expressions.
 */
import type { ScheduleConfig } from '../types/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScheduleEntry {
  config: ScheduleConfig;
  nextRun: Date;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Cron parser
// ---------------------------------------------------------------------------

interface CronMatcher {
  matches(date: Date): boolean;
}

interface CronField {
  type: 'any' | 'value' | 'step' | 'range' | 'list';
  values: number[];
}

function parseField(field: string, min: number, max: number): CronField {
  // Wildcard
  if (field === '*') {
    return { type: 'any', values: [] };
  }

  // Step: */N or N/M
  if (field.includes('/')) {
    const [base, stepStr] = field.split('/');
    const step = parseInt(stepStr!, 10);
    const values: number[] = [];
    const start = base === '*' ? min : parseInt(base!, 10);
    for (let i = start; i <= max; i += step) {
      values.push(i);
    }
    return { type: 'step', values };
  }

  // Range: N-M
  if (field.includes('-')) {
    const [startStr, endStr] = field.split('-');
    const start = parseInt(startStr!, 10);
    const end = parseInt(endStr!, 10);
    const values: number[] = [];
    for (let i = start; i <= end; i++) {
      values.push(i);
    }
    return { type: 'range', values };
  }

  // List: N,M,O
  if (field.includes(',')) {
    const values = field.split(',').map((v) => parseInt(v.trim(), 10));
    return { type: 'list', values };
  }

  // Single value
  return { type: 'value', values: [parseInt(field, 10)] };
}

function fieldMatches(field: CronField, value: number): boolean {
  if (field.type === 'any') return true;
  return field.values.includes(value);
}

/**
 * Parse a cron expression (5 fields: minute hour dayOfMonth month dayOfWeek).
 *
 * Supports:
 * - `*` (any)
 * - `N` (exact value)
 * - `N-M` (range)
 * - `N,M,O` (list)
 * - `*\/N` (step)
 *
 * Examples:
 * - `* /5 * * * *` — every 5 minutes (written without the space)
 * - `0 * * * *` — every hour
 * - `0 0 * * *` — daily at midnight
 * - `0 9 * * 1-5` — weekdays at 9am
 */
export function parseCron(expression: string): CronMatcher {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: expected 5 fields, got ${parts.length}`);
  }

  const minute = parseField(parts[0]!, 0, 59);
  const hour = parseField(parts[1]!, 0, 23);
  const dayOfMonth = parseField(parts[2]!, 1, 31);
  const month = parseField(parts[3]!, 1, 12);
  const dayOfWeek = parseField(parts[4]!, 0, 6); // 0 = Sunday

  return {
    matches(date: Date): boolean {
      return (
        fieldMatches(minute, date.getMinutes()) &&
        fieldMatches(hour, date.getHours()) &&
        fieldMatches(dayOfMonth, date.getDate()) &&
        fieldMatches(month, date.getMonth() + 1) &&
        fieldMatches(dayOfWeek, date.getDay())
      );
    },
  };
}

// ---------------------------------------------------------------------------
// Helper: compute next run from now
// ---------------------------------------------------------------------------

function computeNextRun(expression: string, from: Date = new Date()): Date {
  const matcher = parseCron(expression);
  // Search forward minute-by-minute up to 48 hours
  const candidate = new Date(from);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  const maxIterations = 48 * 60; // 48 hours of minutes
  for (let i = 0; i < maxIterations; i++) {
    if (matcher.matches(candidate)) {
      return candidate;
    }
    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  // Fallback: return 48h from now
  return new Date(from.getTime() + 48 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Schedule Runner
// ---------------------------------------------------------------------------

export class ScheduleRunner {
  private schedules: ScheduleEntry[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  /**
   * Load schedule configs and compute next run times.
   */
  load(configs: ScheduleConfig[]): void {
    this.schedules = configs.map((config) => ({
      config,
      nextRun: computeNextRun(config.schedule),
      enabled: config.enabled,
    }));
  }

  /**
   * Start checking every minute whether any schedule should fire.
   */
  start(executor: (schedule: ScheduleConfig) => Promise<void>): void {
    if (this.timer) return; // already running

    this.timer = setInterval(() => {
      const now = new Date();
      for (const entry of this.schedules) {
        if (!entry.enabled) continue;
        if (now >= entry.nextRun) {
          // Fire and forget; update nextRun
          void executor(entry.config).catch(() => {
            // Errors are silently ignored; callers should handle in executor
          });
          entry.nextRun = computeNextRun(entry.config.schedule, now);
        }
      }
    }, 60_000); // check every 60 seconds
  }

  /**
   * Stop the scheduler.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * List all schedules with their next run times.
   */
  getSchedules(): ScheduleEntry[] {
    return [...this.schedules];
  }

  /**
   * Enable or disable a schedule by name.
   */
  toggle(name: string, enabled: boolean): void {
    for (const entry of this.schedules) {
      if (entry.config.name === name) {
        entry.enabled = enabled;
        if (enabled) {
          entry.nextRun = computeNextRun(entry.config.schedule);
        }
        return;
      }
    }
  }
}
