import prisma from '@/lib/db/prisma';

export type LogLevel = 'info' | 'warn' | 'error' | 'success';

export interface CrawlLogger {
  info: (message: string, details?: Record<string, unknown>) => Promise<void>;
  warn: (message: string, details?: Record<string, unknown>) => Promise<void>;
  error: (message: string, details?: Record<string, unknown>) => Promise<void>;
  success: (message: string, details?: Record<string, unknown>) => Promise<void>;
}

export function createCrawlLogger(taskId: string): CrawlLogger {
  const log = async (level: LogLevel, message: string, details?: Record<string, unknown>) => {
    try {
      await prisma.crawlLog.create({
        data: {
          taskId,
          level,
          message,
          details: details ? JSON.stringify(details) : null,
        },
      });
      // 同时输出到控制台
      console.log(`[${level.toUpperCase()}] [${taskId.slice(0, 8)}] ${message}`);
    } catch (err) {
      console.error('写入日志失败:', err);
    }
  };

  return {
    info: (message, details) => log('info', message, details),
    warn: (message, details) => log('warn', message, details),
    error: (message, details) => log('error', message, details),
    success: (message, details) => log('success', message, details),
  };
}
