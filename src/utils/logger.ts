/**
 * Structured logger for x-skill
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, module: string, message: string, data?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [@hidden-leaf/x-skill:${module}]`;
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  return `${prefix} ${message}${dataStr}`;
}

export function createLogger(module: string) {
  return {
    debug: (message: string, data?: Record<string, unknown>) => {
      if (shouldLog('debug')) console.debug(formatMessage('debug', module, message, data));
    },
    info: (message: string, data?: Record<string, unknown>) => {
      if (shouldLog('info')) console.info(formatMessage('info', module, message, data));
    },
    warn: (message: string, data?: Record<string, unknown>) => {
      if (shouldLog('warn')) console.warn(formatMessage('warn', module, message, data));
    },
    error: (message: string, data?: Record<string, unknown>) => {
      if (shouldLog('error')) console.error(formatMessage('error', module, message, data));
    },
  };
}
