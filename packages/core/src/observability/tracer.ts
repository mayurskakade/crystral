import { randomUUID } from 'node:crypto';

/**
 * Represents a single unit of work within a trace.
 */
export interface Span {
  name: string;
  traceId: string;
  spanId: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  attributes: Record<string, unknown>;
}

/**
 * Lightweight tracer for instrumenting agent execution.
 *
 * Creates a unique trace ID per instance and supports
 * nested span creation with timing and attributes.
 *
 * Usage:
 *   const tracer = new Tracer();
 *   tracer.startSpan('llm_call', { provider: 'openai' });
 *   // ... do work ...
 *   const span = tracer.endSpan();
 */
export class Tracer {
  private traceId: string;
  private spans: Span[] = [];
  private activeSpan: Span | null = null;

  constructor() {
    this.traceId = `trc_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  }

  /** The unique trace ID for this tracer instance. */
  get id(): string {
    return this.traceId;
  }

  /**
   * Start a new span. Ends any currently active span first.
   */
  startSpan(name: string, attributes?: Record<string, unknown>): Span {
    // Auto-end any active span
    if (this.activeSpan) {
      this.endSpan();
    }

    const span: Span = {
      name,
      traceId: this.traceId,
      spanId: `spn_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      startTime: Date.now(),
      attributes: attributes ?? {},
    };

    this.activeSpan = span;
    return span;
  }

  /**
   * End the currently active span, recording its duration.
   * Returns the completed span, or null if no span is active.
   */
  endSpan(): Span | null {
    if (!this.activeSpan) {
      return null;
    }

    const span = this.activeSpan;
    span.endTime = Date.now();
    span.durationMs = span.endTime - span.startTime;
    this.spans.push(span);
    this.activeSpan = null;
    return span;
  }

  /**
   * Get all completed spans for this trace.
   */
  getSpans(): Span[] {
    return [...this.spans];
  }
}
