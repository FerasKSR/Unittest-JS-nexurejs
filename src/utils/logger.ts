/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/**
 * Logger options
 */
export interface LoggerOptions {
  /**
   * Enable logging
   * @default true
   */
  enabled?: boolean;

  /**
   * Minimum log level
   * @default LogLevel.INFO
   */
  level?: LogLevel;

  /**
   * Custom log handler
   */
  handler?: (level: LogLevel, message: string, ...args: any[]) => void;
}

/**
 * Simple logger utility
 */
export class Logger {
  private enabled: boolean;
  private level: LogLevel;
  private handler?: (level: LogLevel, message: string, ...args: any[]) => void;

  /**
   * Create a new logger
   * @param options Logger options or boolean to enable/disable logging
   */
  constructor(options: LoggerOptions | boolean = {}) {
    if (typeof options === 'boolean') {
      this.enabled = options;
      this.level = LogLevel.INFO;
    } else {
      this.enabled = options.enabled !== false;
      this.level = options.level || LogLevel.INFO;
      this.handler = options.handler;
    }
  }

  /**
   * Log a debug message
   * @param message The message to log
   * @param args Additional arguments
   */
  debug(message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  /**
   * Log an info message
   * @param message The message to log
   * @param args Additional arguments
   */
  info(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  /**
   * Log a warning message
   * @param message The message to log
   * @param args Additional arguments
   */
  warn(message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  /**
   * Log an error message
   * @param message The message to log
   * @param args Additional arguments
   */
  error(message: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }

  /**
   * Log a message with a specific level
   * @param level The log level
   * @param message The message to log
   * @param args Additional arguments
   */
  private log(level: LogLevel, message: string, ...args: any[]): void {
    if (!this.enabled || !this.shouldLog(level)) {
      return;
    }

    if (this.handler) {
      this.handler(level, message, ...args);
      return;
    }

    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage, ...args);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, ...args);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, ...args);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage, ...args);
        break;
    }
  }

  /**
   * Check if a log level should be logged
   * @param level The log level to check
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const levelIndex = levels.indexOf(level);
    const minLevelIndex = levels.indexOf(this.level);

    return levelIndex >= minLevelIndex;
  }
}
