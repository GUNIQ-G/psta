import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { LOG_DIR } from './paths';

// Custom format for JSON logging
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Custom format for console logging (development)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, category, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}] [${category || 'app'}] ${message} ${metaStr}`;
  })
);

// Daily rotate file transport configuration
const createDailyRotateTransport = (filename: string, dirname: string, level?: string) => {
  return new DailyRotateFile({
    filename: `${filename}-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    dirname,
    maxFiles: '30d', // Keep logs for 30 days
    level: level || 'info',
    format: jsonFormat,
    auditFile: path.join(dirname, `.${filename}-audit.json`),
  });
};

// App Logger (General application logs)
export const appLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: jsonFormat,
  defaultMeta: { category: 'app' },
  transports: [
    createDailyRotateTransport('app', path.join(LOG_DIR, 'app/backend')),
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    }),
  ],
});

// Error Logger (Only errors)
export const errorLogger = winston.createLogger({
  level: 'error',
  format: jsonFormat,
  defaultMeta: { category: 'error' },
  transports: [
    createDailyRotateTransport('error', path.join(LOG_DIR, 'app/backend'), 'error'),
    new winston.transports.Console({
      format: consoleFormat,
      level: 'error',
    }),
  ],
});

// Access Logger (HTTP requests)
export const accessLogger = winston.createLogger({
  level: 'info',
  format: jsonFormat,
  defaultMeta: { category: 'access' },
  transports: [
    createDailyRotateTransport('access', path.join(LOG_DIR, 'app/backend')),
  ],
});

// Auth Logger (Authentication events)
export const authLogger = winston.createLogger({
  level: 'info',
  format: jsonFormat,
  defaultMeta: { category: 'auth' },
  transports: [
    createDailyRotateTransport('auth', path.join(LOG_DIR, 'app/backend')),
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ],
});

// Database Logger (Prisma queries)
export const databaseLogger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: jsonFormat,
  defaultMeta: { category: 'database' },
  transports: [
    createDailyRotateTransport('queries', path.join(LOG_DIR, 'database')),
  ],
});

// LDAP Logger (LDAP authentication)
export const ldapLogger = winston.createLogger({
  level: 'info',
  format: jsonFormat,
  defaultMeta: { category: 'ldap' },
  transports: [
    createDailyRotateTransport('ldap', path.join(LOG_DIR, 'external')),
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ],
});

// Slack Logger (Slack notifications)
export const slackLogger = winston.createLogger({
  level: 'info',
  format: jsonFormat,
  defaultMeta: { category: 'slack' },
  transports: [
    createDailyRotateTransport('slack', path.join(LOG_DIR, 'external')),
  ],
});

// Notification Logger (Multi-platform notifications)
export const notificationLogger = winston.createLogger({
  level: 'info',
  format: jsonFormat,
  defaultMeta: { category: 'notifications' },
  transports: [
    createDailyRotateTransport('notifications', path.join(LOG_DIR, 'external')),
  ],
});

// Migration Logger (Prisma migrations)
export const migrationLogger = winston.createLogger({
  level: 'info',
  format: jsonFormat,
  defaultMeta: { category: 'migration' },
  transports: [
    createDailyRotateTransport('migrations', path.join(LOG_DIR, 'database')),
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ],
});

// Helper function to log HTTP requests
export const logHttpRequest = (req: any, res: any, duration: number) => {
  const logData = {
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    duration: `${duration}ms`,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('user-agent'),
    userId: req.user?.id,
  };

  if (res.statusCode >= 500) {
    errorLogger.error('HTTP request failed', logData);
  } else if (res.statusCode >= 400) {
    accessLogger.warn('HTTP request warning', logData);
  } else {
    accessLogger.info('HTTP request', logData);
  }
};

// Helper function to log errors
export const logError = (error: Error, context?: any) => {
  errorLogger.error(error.message, {
    stack: error.stack,
    name: error.name,
    ...context,
  });
};

// Helper function to log auth events
export const logAuthEvent = (event: string, data: any) => {
  authLogger.info(event, data);
};

// Export default logger (app logger)
export default appLogger;
