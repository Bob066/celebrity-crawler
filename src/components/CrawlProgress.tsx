'use client';

import { useState, useEffect, useRef } from 'react';
import { CrawlTask, Celebrity } from '@/types';

interface CrawlLog {
  id: string;
  taskId: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

interface CrawlProgressProps {
  tasks: CrawlTask[];
  celebrity: Celebrity | null;
}

const SOURCE_NAMES: Record<string, string> = {
  twitter: 'X (Twitter)',
  youtube: 'YouTube',
  wikipedia: 'Wikipedia',
  news: '新闻',
  book: '书籍/传记',
  podcast: '播客',
};

const STATUS_CONFIG: Record<
  string,
  { color: string; bgColor: string; text: string }
> = {
  pending: { color: 'text-gray-600', bgColor: 'bg-gray-100', text: '等待中' },
  running: { color: 'text-blue-600', bgColor: 'bg-blue-100', text: '爬取中' },
  completed: {
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    text: '已完成',
  },
  failed: { color: 'text-red-600', bgColor: 'bg-red-100', text: '失败' },
  cancelled: {
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    text: '已取消',
  },
};

const LOG_LEVEL_CONFIG: Record<string, { color: string; icon: string }> = {
  info: { color: 'text-blue-600', icon: 'ℹ️' },
  warn: { color: 'text-yellow-600', icon: '⚠️' },
  error: { color: 'text-red-600', icon: '❌' },
  success: { color: 'text-green-600', icon: '✅' },
};

export function CrawlProgress({ tasks, celebrity }: CrawlProgressProps) {
  const [logs, setLogs] = useState<CrawlLog[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const lastLogTime = useRef<string | null>(null);

  // 轮询获取日志
  useEffect(() => {
    if (!celebrity?.id) return;

    const fetchLogs = async () => {
      try {
        const url = new URL('/api/logs', window.location.origin);
        url.searchParams.set('celebrityId', celebrity.id || '');
        if (lastLogTime.current) {
          url.searchParams.set('since', lastLogTime.current);
        }

        const response = await fetch(url.toString());
        const data = await response.json();

        if (data.logs && data.logs.length > 0) {
          setLogs((prev) => {
            const existingIds = new Set(prev.map((l) => l.id));
            const newLogs = data.logs.filter((l: CrawlLog) => !existingIds.has(l.id));
            if (newLogs.length > 0) {
              lastLogTime.current = newLogs[0].createdAt;
              return [...newLogs.reverse(), ...prev].slice(0, 200); // 保留最近200条
            }
            return prev;
          });
        }
      } catch (error) {
        console.error('获取日志失败:', error);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);

    return () => clearInterval(interval);
  }, [celebrity?.id]);

  // 自动滚动到底部
  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showLogs]);

  const totalItems = tasks.reduce((sum, task) => sum + task.itemsCrawled, 0);
  const completedTasks = tasks.filter(
    (t) => t.status === 'completed' || t.status === 'failed'
  ).length;
  const overallProgress =
    tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 总体进度 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              正在爬取: {celebrity?.name}
            </h2>
            <p className="text-sm text-gray-500">
              已收集 {totalItems} 条数据
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">
              {Math.round(overallProgress)}%
            </div>
            <div className="text-sm text-gray-500">
              {completedTasks}/{tasks.length} 个数据源
            </div>
          </div>
        </div>

        {/* 总体进度条 */}
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full progress-animate rounded-full transition-all duration-500"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* 各数据源进度 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h3 className="font-semibold text-gray-900">数据源进度</h3>
        </div>
        <div className="divide-y">
          {tasks.map((task) => {
            const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
            const progress =
              task.total > 0 ? (task.progress / task.total) * 100 : 0;

            return (
              <div key={task.id} className="px-6 py-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-900">
                      {SOURCE_NAMES[task.source] || task.source}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}
                    >
                      {statusConfig.text}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {task.itemsCrawled} 条
                  </div>
                </div>

                {/* 单项进度条 */}
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      task.status === 'running'
                        ? 'bg-blue-500'
                        : task.status === 'completed'
                        ? 'bg-green-500'
                        : task.status === 'failed'
                        ? 'bg-red-500'
                        : 'bg-gray-300'
                    }`}
                    style={{
                      width: `${task.status === 'completed' ? 100 : progress}%`,
                    }}
                  />
                </div>

                {/* 错误信息 */}
                {task.error && (
                  <div className="mt-2 text-sm text-red-600">{task.error}</div>
                )}

                {/* 运行中的动画提示 */}
                {task.status === 'running' && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-blue-600">
                    <svg
                      className="animate-spin w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    正在获取数据...
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 实时日志 */}
      <div className="bg-white rounded-lg shadow">
        <div
          className="px-6 py-4 border-b flex items-center justify-between cursor-pointer"
          onClick={() => setShowLogs(!showLogs)}
        >
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <span>实时日志</span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {logs.length} 条
            </span>
          </h3>
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform ${showLogs ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {showLogs && (
          <div className="max-h-80 overflow-y-auto bg-gray-900 text-gray-100 font-mono text-sm">
            {logs.length === 0 ? (
              <div className="p-4 text-gray-400 text-center">
                等待日志...
              </div>
            ) : (
              <div className="p-4 space-y-1">
                {[...logs].reverse().map((log) => {
                  const config = LOG_LEVEL_CONFIG[log.level] || LOG_LEVEL_CONFIG.info;
                  const time = new Date(log.createdAt).toLocaleTimeString('zh-CN');
                  return (
                    <div key={log.id} className="flex items-start gap-2">
                      <span className="text-gray-500 flex-shrink-0">{time}</span>
                      <span className="flex-shrink-0">{config.icon}</span>
                      <span className={config.color}>{log.message}</span>
                    </div>
                  );
                })}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 提示信息 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-yellow-600 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h4 className="font-medium text-yellow-800">爬取进行中</h4>
            <p className="text-sm text-yellow-700 mt-1">
              数据爬取可能需要一些时间，请耐心等待。爬取完成后将自动进入数据预览页面。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
