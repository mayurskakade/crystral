import type { LoggingConfig } from '../types/index.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
}

const DEFAULT_CONFIG: LoggingConfig = {
  level: 'info',
  trace: false,
  export: 'stdout',
};

/**
 * Singleton logger with configurable log levels and structured JSON output.
 *
 * Usage:
 *   const logger = Logger.getInstance();
 *   logger.info('Agent started', { agent: 'my-agent' });
 */
export class Logger {
  private static instance: Logger | undefined;
  private level: LogLevel;
  private config: LoggingConfig;

  private constructor(config?: LoggingConfig) {
    this.config = config ?? DEFAULT_CONFIG;
    this.level = this.config.level;
  }

  /**
   * Get or create the singleton Logger instance.
   * Pass config on first call to configure; subsequent calls return the same instance.
   */
  static getInstance(config?: LoggingConfig): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  /**
   * Reconfigure the singleton logger. Creates a new instance with updated settings.
   */
  static configure(config: LoggingConfig): void {
    Logger.instance = new Logger(config);
  }

  /**
   * Reset the singleton (primarily for testing).
   */
  static reset(): void {
    Logger.instance = undefined;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.level]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(data ? { data } : {}),
    };

    if (this.config.export === 'stdout') {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(entry));
    }
  }
}
