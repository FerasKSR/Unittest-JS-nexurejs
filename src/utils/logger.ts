/**
 * Log levels
 */
export enum LogLevel {
  _DEBUG,
  _INFO,
  _WARN,
  _ERROR
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
      this.level = LogLevel._INFO;
    } else {
      this.enabled = options.enabled !== false;
      this.level = options.level || LogLevel._INFO;
      this.handler = options.handler;
    }
  }

  /**
   * Log a debug message
   * @param message The message to log
   * @param args Additional arguments
   */
  debug(message: string, ...args: any[]): void {
    this.log(LogLevel._DEBUG, message, ...args);
  }

  /**
   * Log an info message
   * @param message The message to log
   * @param args Additional arguments
   */
  info(message: string, ...args: any[]): void {
    this.log(LogLevel._INFO, message, ...args);
  }

  /**
   * Log a warning message
   * @param message The message to log
   * @param args Additional arguments
   */
  warn(message: string, ...args: any[]): void {
    this.log(LogLevel._WARN, message, ...args);
  }

  /**
   * Log an error message
   * @param message The message to log
   * @param args Additional arguments
   */
  error(message: string, ...args: any[]): void {
    this.log(LogLevel._ERROR, message, ...args);
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
    const levelName = LogLevel[level].substring(1);
    const formattedMessage = `[${timestamp}] [${levelName}] ${message}`;

    switch (level) {
      case LogLevel._DEBUG:
        console.debug(formattedMessage, ...args);
        break;
      case LogLevel._INFO:
        console.info(formattedMessage, ...args);
        break;
      case LogLevel._WARN:
        console.warn(formattedMessage, ...args);
        break;
      case LogLevel._ERROR:
        console.error(formattedMessage, ...args);
        break;
    }
  }

  /**
   * Check if a log level should be logged
   * @param level The log level to check
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel._DEBUG, LogLevel._INFO, LogLevel._WARN, LogLevel._ERROR];
    const levelIndex = levels.indexOf(level);
    const minLevelIndex = levels.indexOf(this.level);

    return levelIndex >= minLevelIndex;
  }

  setHandler(_level: LogLevel, _message: string, ..._args: any[]): void {
    // ... existing code ...
  }

  setCustomHandler(_level: LogLevel, _message: string, ..._args: any[]): void {
    // ... existing code ...
  }
}
