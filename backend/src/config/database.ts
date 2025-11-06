import { PrismaClient } from '@prisma/client';
import { databaseLogger } from './logger';

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

// Log queries to database logger
prisma.$on('query' as never, (e: any) => {
  if (process.env.NODE_ENV === 'development') {
    databaseLogger.debug('Query executed', {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
      timestamp: new Date().toISOString(),
    });
  }
});

// Log errors to database logger
prisma.$on('error' as never, (e: any) => {
  databaseLogger.error('Database error', {
    message: e.message,
    target: e.target,
    timestamp: new Date().toISOString(),
  });
});

// Log warnings to database logger
prisma.$on('warn' as never, (e: any) => {
  databaseLogger.warn('Database warning', {
    message: e.message,
    timestamp: new Date().toISOString(),
  });
});

export default prisma;