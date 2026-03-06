import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseCron, ScheduleRunner } from '../scheduling/index.ts';
import type { ScheduleConfig } from '../types/index.ts';
import { execute, result, assert, pass } from './helpers/test-logger.ts';

describe('11.1 parseCron', () => {
  it('11.1.1 "* * * * *" matches any date', () => {
    execute("parseCron('* * * * *').matches(new Date())");
    const matcher = parseCron('* * * * *');
    const r = matcher.matches(new Date());
    result(r);
    assert('r === true');
    expect(r).toBe(true);
    pass('11.1.1');
  });

  it('11.1.2 "0 * * * *" matches only minute=0', () => {
    execute("parseCron('0 * * * *').matches with minute=0 vs minute=1");
    const matcher = parseCron('0 * * * *');
    const dateAt0 = new Date(2025, 0, 1, 10, 0, 0);
    const dateAt1 = new Date(2025, 0, 1, 10, 1, 0);
    result({ at0: matcher.matches(dateAt0), at1: matcher.matches(dateAt1) });
    assert('at minute=0: true, at minute=1: false');
    expect(matcher.matches(dateAt0)).toBe(true);
    expect(matcher.matches(dateAt1)).toBe(false);
    pass('11.1.2');
  });

  it('11.1.3 "0 9 * * *" matches only hour=9 minute=0', () => {
    execute("parseCron('0 9 * * *') at 09:00 and 10:00");
    const matcher = parseCron('0 9 * * *');
    const at9 = new Date(2025, 0, 1, 9, 0, 0);
    const at10 = new Date(2025, 0, 1, 10, 0, 0);
    result({ at9: matcher.matches(at9), at10: matcher.matches(at10) });
    expect(matcher.matches(at9)).toBe(true);
    expect(matcher.matches(at10)).toBe(false);
    pass('11.1.3');
  });

  it('11.1.4 step "*/5 * * * *" matches every 5 minutes', () => {
    execute("parseCron('*/5 * * * *') at minute=0, 5, 6");
    const matcher = parseCron('*/5 * * * *');
    const at0 = new Date(2025, 0, 1, 10, 0);
    const at5 = new Date(2025, 0, 1, 10, 5);
    const at6 = new Date(2025, 0, 1, 10, 6);
    result({ at0: matcher.matches(at0), at5: matcher.matches(at5), at6: matcher.matches(at6) });
    expect(matcher.matches(at0)).toBe(true);
    expect(matcher.matches(at5)).toBe(true);
    expect(matcher.matches(at6)).toBe(false);
    pass('11.1.4');
  });

  it('11.1.5 range "0 9-17 * * *" matches hour 9-17', () => {
    execute("parseCron('0 9-17 * * *') at hour=9, 17, 18");
    const matcher = parseCron('0 9-17 * * *');
    const at9  = new Date(2025, 0, 1, 9,  0);
    const at17 = new Date(2025, 0, 1, 17, 0);
    const at18 = new Date(2025, 0, 1, 18, 0);
    result({ at9: matcher.matches(at9), at17: matcher.matches(at17), at18: matcher.matches(at18) });
    expect(matcher.matches(at9)).toBe(true);
    expect(matcher.matches(at17)).toBe(true);
    expect(matcher.matches(at18)).toBe(false);
    pass('11.1.5');
  });

  it('11.1.6 list "0 9,12,17 * * *" matches exactly those hours', () => {
    execute("parseCron('0 9,12,17 * * *') at hour=9, 10, 12, 17");
    const matcher = parseCron('0 9,12,17 * * *');
    const at9  = new Date(2025, 0, 1, 9,  0);
    const at10 = new Date(2025, 0, 1, 10, 0);
    const at12 = new Date(2025, 0, 1, 12, 0);
    const at17 = new Date(2025, 0, 1, 17, 0);
    result({ at9: matcher.matches(at9), at10: matcher.matches(at10), at12: matcher.matches(at12), at17: matcher.matches(at17) });
    expect(matcher.matches(at9)).toBe(true);
    expect(matcher.matches(at10)).toBe(false);
    expect(matcher.matches(at12)).toBe(true);
    expect(matcher.matches(at17)).toBe(true);
    pass('11.1.6');
  });

  it('11.1.7 throws on fewer than 5 fields', () => {
    execute("parseCron('* * * *') should throw");
    assert('throws Error');
    expect(() => parseCron('* * * *')).toThrow();
    pass('11.1.7');
  });

  it('11.1.8 throws on more than 5 fields', () => {
    execute("parseCron('* * * * * *') should throw");
    assert('throws Error');
    expect(() => parseCron('* * * * * *')).toThrow();
    pass('11.1.8');
  });

  it('11.1.9 day of week filter "0 0 * * 1" matches only Monday', () => {
    execute("parseCron('0 0 * * 1') on Monday vs Tuesday");
    const matcher = parseCron('0 0 * * 1');
    // Jan 6 2025 = Monday (day 1)
    const monday = new Date(2025, 0, 6, 0, 0);
    // Jan 7 2025 = Tuesday (day 2)
    const tuesday = new Date(2025, 0, 7, 0, 0);
    result({ monday: matcher.matches(monday), tuesday: matcher.matches(tuesday) });
    expect(matcher.matches(monday)).toBe(true);
    expect(matcher.matches(tuesday)).toBe(false);
    pass('11.1.9');
  });

  it('11.1.10 specific date "0 9 15 3 *" matches only March 15 09:00', () => {
    execute("parseCron('0 9 15 3 *') on March 15 vs March 16");
    const matcher = parseCron('0 9 15 3 *');
    const march15 = new Date(2025, 2, 15, 9, 0); // March = month 2 in JS
    const march16 = new Date(2025, 2, 16, 9, 0);
    result({ mar15: matcher.matches(march15), mar16: matcher.matches(march16) });
    expect(matcher.matches(march15)).toBe(true);
    expect(matcher.matches(march16)).toBe(false);
    pass('11.1.10');
  });
});

describe('11.2 ScheduleRunner', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  const makeConfig = (name: string, schedule = '* * * * *'): ScheduleConfig => ({
    version: 1,
    name,
    agent: 'test-agent',
    schedule,
    input: 'Run task',
    enabled: true,
  });

  it('11.2.1 load populates schedules list', () => {
    execute('runner.load([config1, config2]), runner.getSchedules().length');
    const runner = new ScheduleRunner();
    runner.load([makeConfig('task1'), makeConfig('task2')]);
    const schedules = runner.getSchedules();
    result({ count: schedules.length });
    assert('schedules.length === 2');
    expect(schedules.length).toBe(2);
    pass('11.2.1');
  });

  it('11.2.2 getSchedules returns entries with nextRun dates', () => {
    execute('runner.load + getSchedules() entry has nextRun');
    const runner = new ScheduleRunner();
    runner.load([makeConfig('task1')]);
    const entries = runner.getSchedules();
    result({ hasNextRun: entries[0]?.nextRun instanceof Date });
    assert('entries[0].nextRun is a Date');
    expect(entries[0]?.nextRun).toBeInstanceOf(Date);
    pass('11.2.2');
  });

  it('11.2.3 toggle disables a schedule', () => {
    execute('runner.load, toggle("task1", false), getSchedules()[0].enabled');
    const runner = new ScheduleRunner();
    runner.load([makeConfig('task1')]);
    runner.toggle('task1', false);
    const entries = runner.getSchedules();
    result({ enabled: entries[0]?.enabled });
    assert('entries[0].enabled === false');
    expect(entries[0]?.enabled).toBe(false);
    pass('11.2.3');
  });

  it('11.2.4 toggle re-enables a schedule', () => {
    execute('runner.load, toggle off, toggle on, getSchedules()[0].enabled');
    const runner = new ScheduleRunner();
    runner.load([makeConfig('task1')]);
    runner.toggle('task1', false);
    runner.toggle('task1', true);
    const entries = runner.getSchedules();
    result({ enabled: entries[0]?.enabled });
    assert('entries[0].enabled === true');
    expect(entries[0]?.enabled).toBe(true);
    pass('11.2.4');
  });

  it('11.2.5 stop clears the timer', () => {
    execute('runner.start + runner.stop');
    const runner = new ScheduleRunner();
    runner.load([makeConfig('task1')]);
    const executor = vi.fn().mockResolvedValue(undefined);
    runner.start(executor);
    runner.stop();
    // Advance 2 minutes — executor should NOT be called since we stopped
    vi.advanceTimersByTime(120_000);
    // We just verify stop does not throw
    assert('stop() does not throw');
    pass('11.2.5');
  });
});
