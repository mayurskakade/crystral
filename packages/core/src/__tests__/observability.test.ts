import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Logger } from '../observability/logger.ts';
import { Tracer } from '../observability/tracer.ts';
import { execute, result, assert, pass } from './helpers/test-logger.ts';

// ---------------------------------------------------------------------------
// 12.1 Logger
// ---------------------------------------------------------------------------

describe('12.1 Logger', () => {
  beforeEach(() => { Logger.reset(); });
  afterEach(() => { Logger.reset(); });

  it('12.1.1 getInstance returns the same instance each time', () => {
    execute('Logger.getInstance() === Logger.getInstance()');
    const a = Logger.getInstance();
    const b = Logger.getInstance();
    assert('a === b (singleton)');
    expect(a).toBe(b);
    pass('12.1.1');
  });

  it('12.1.2 configure creates a new instance', () => {
    execute('Logger.getInstance(), Logger.configure(), Logger.getInstance()');
    const before = Logger.getInstance();
    Logger.configure({ level: 'warn', trace: false, export: 'stdout' });
    const after = Logger.getInstance();
    assert('before !== after after configure()');
    expect(before).not.toBe(after);
    pass('12.1.2');
  });

  it('12.1.3 reset clears the singleton', () => {
    execute('Logger.getInstance(), Logger.reset(), Logger.getInstance()');
    const a = Logger.getInstance();
    Logger.reset();
    const b = Logger.getInstance();
    assert('a !== b after reset()');
    expect(a).not.toBe(b);
    pass('12.1.3');
  });

  it('12.1.4 info() does not throw', () => {
    execute("logger.info('test message')");
    const logger = Logger.getInstance({ level: 'debug', trace: false, export: 'stdout' });
    assert('info() does not throw');
    expect(() => logger.info('test message')).not.toThrow();
    pass('12.1.4');
  });

  it('12.1.5 warn() does not throw', () => {
    execute("logger.warn('test warning')");
    const logger = Logger.getInstance({ level: 'debug', trace: false, export: 'stdout' });
    assert('warn() does not throw');
    expect(() => logger.warn('test warning')).not.toThrow();
    pass('12.1.5');
  });

  it('12.1.6 error() does not throw', () => {
    execute("logger.error('test error')");
    const logger = Logger.getInstance({ level: 'debug', trace: false, export: 'stdout' });
    assert('error() does not throw');
    expect(() => logger.error('test error')).not.toThrow();
    pass('12.1.6');
  });

  it('12.1.7 debug() does not throw', () => {
    execute("logger.debug('test debug')");
    const logger = Logger.getInstance({ level: 'debug', trace: false, export: 'stdout' });
    assert('debug() does not throw');
    expect(() => logger.debug('test debug')).not.toThrow();
    pass('12.1.7');
  });

  it('12.1.8 logger instance is returned from configure', () => {
    execute('Logger.configure() then Logger.getInstance()');
    Logger.configure({ level: 'error', trace: false, export: 'stdout' });
    const logger = Logger.getInstance();
    assert('logger is a Logger instance');
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    pass('12.1.8');
  });
});

// ---------------------------------------------------------------------------
// 12.2 Tracer
// ---------------------------------------------------------------------------

describe('12.2 Tracer', () => {
  it('12.2.1 tracer.id starts with "trc_"', () => {
    execute('new Tracer().id');
    const tracer = new Tracer();
    const r = tracer.id;
    result(r);
    assert('r.startsWith("trc_")');
    expect(r).toMatch(/^trc_/);
    pass('12.2.1');
  });

  it('12.2.2 each new Tracer has a unique id', () => {
    execute('new Tracer().id !== new Tracer().id');
    const a = new Tracer();
    const b = new Tracer();
    result({ idA: a.id, idB: b.id });
    assert('a.id !== b.id');
    expect(a.id).not.toBe(b.id);
    pass('12.2.2');
  });

  it('12.2.3 startSpan returns a span with the given name', () => {
    execute("tracer.startSpan('my-span')");
    const tracer = new Tracer();
    const span = tracer.startSpan('my-span');
    result({ name: span.name });
    assert('span.name === "my-span"');
    expect(span.name).toBe('my-span');
    pass('12.2.3');
  });

  it('12.2.4 span has traceId matching tracer.id', () => {
    execute("tracer.startSpan().traceId === tracer.id");
    const tracer = new Tracer();
    const span = tracer.startSpan('op');
    result({ traceId: span.traceId, tracerId: tracer.id });
    assert('span.traceId === tracer.id');
    expect(span.traceId).toBe(tracer.id);
    pass('12.2.4');
  });

  it('12.2.5 endSpan records the span in getSpans()', () => {
    execute("startSpan then endSpan, getSpans().length === 1");
    const tracer = new Tracer();
    tracer.startSpan('op1');
    tracer.endSpan();
    const spans = tracer.getSpans();
    result({ count: spans.length });
    assert('spans.length === 1');
    expect(spans.length).toBe(1);
    pass('12.2.5');
  });

  it('12.2.6 completed span has durationMs >= 0', () => {
    execute("startSpan, endSpan, span.durationMs >= 0");
    const tracer = new Tracer();
    tracer.startSpan('timed-op');
    const span = tracer.endSpan();
    result({ durationMs: span?.durationMs });
    assert('span.durationMs >= 0');
    expect(span?.durationMs).toBeGreaterThanOrEqual(0);
    pass('12.2.6');
  });

  it('12.2.7 endSpan with no active span returns null', () => {
    execute("tracer.endSpan() with no active span returns null");
    const tracer = new Tracer();
    const r = tracer.endSpan();
    result(r);
    assert('r === null');
    expect(r).toBeNull();
    pass('12.2.7');
  });

  it('12.2.8 multiple spans recorded in order', () => {
    execute("three spans, getSpans() returns them in order");
    const tracer = new Tracer();
    tracer.startSpan('span1');
    tracer.endSpan();
    tracer.startSpan('span2');
    tracer.endSpan();
    tracer.startSpan('span3');
    tracer.endSpan();
    const spans = tracer.getSpans();
    result({ names: spans.map(s => s.name) });
    assert('3 spans named span1, span2, span3');
    expect(spans.length).toBe(3);
    expect(spans[0]?.name).toBe('span1');
    expect(spans[1]?.name).toBe('span2');
    expect(spans[2]?.name).toBe('span3');
    pass('12.2.8');
  });
});
