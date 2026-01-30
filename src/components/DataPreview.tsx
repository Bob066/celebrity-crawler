'use client';

import { useState, useEffect } from 'react';
import { Celebrity, ContentItem, DataSource } from '@/types';

interface DataPreviewProps {
  celebrity: Celebrity;
  onExport: (format: 'json' | 'markdown' | 'both') => void;
}

interface DataStats {
  total: number;
  bySource: Record<string, number>;
  byPriority: Record<number, number>;
}

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'P1 - 本人直接发言', color: 'bg-red-100 text-red-700' },
  2: { label: 'P2 - 本人作品', color: 'bg-orange-100 text-orange-700' },
  3: { label: 'P3 - 权威第三方', color: 'bg-yellow-100 text-yellow-700' },
  4: { label: 'P4 - 综合信息', color: 'bg-blue-100 text-blue-700' },
  5: { label: 'P5 - 他人评价', color: 'bg-gray-100 text-gray-700' },
};

const SOURCE_NAMES: Record<string, string> = {
  twitter: 'X (Twitter)',
  youtube: 'YouTube',
  wikipedia: 'Wikipedia',
  news: '新闻',
  book: '书籍/传记',
  podcast: '播客',
};

export function DataPreview({ celebrity, onExport }: DataPreviewProps) {
  const [stats, setStats] = useState<DataStats | null>(null);
  const [previewData, setPreviewData] = useState<ContentItem[]>([]);
  const [selectedPriority, setSelectedPriority] = useState<number | null>(null);
  const [selectedSource, setSelectedSource] = useState<DataSource | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchPreview();
  }, [celebrity.id]);

  const fetchStats = async () => {
    try {
      const response = await fetch(
        `/api/stats?celebrityId=${celebrity.id}`
      );
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('获取统计失败:', error);
    }
  };

  const fetchPreview = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        celebrityId: celebrity.id || '',
        limit: '20',
      });
      if (selectedPriority) {
        params.set('priority', String(selectedPriority));
      }
      if (selectedSource) {
        params.set('source', selectedSource);
      }

      const response = await fetch(`/api/preview?${params}`);
      const data = await response.json();
      setPreviewData(data.contents || []);
    } catch (error) {
      console.error('获取预览失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (celebrity.id) {
      fetchPreview();
    }
  }, [selectedPriority, selectedSource]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* 统计概览 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">总数据量</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">
            {stats?.total || 0}
          </div>
          <div className="text-sm text-gray-500 mt-1">条记录</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">数据来源</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">
            {Object.keys(stats?.bySource || {}).length}
          </div>
          <div className="text-sm text-gray-500 mt-1">个平台</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">高优先级数据</div>
          <div className="text-3xl font-bold text-blue-600 mt-1">
            {((stats?.byPriority[1] || 0) + (stats?.byPriority[2] || 0))}
          </div>
          <div className="text-sm text-gray-500 mt-1">P1 + P2 数据</div>
        </div>
      </div>

      {/* 分布图表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 优先级分布 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-4">优先级分布</h3>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((priority) => {
              const count = stats?.byPriority[priority] || 0;
              const percentage =
                stats?.total ? (count / stats.total) * 100 : 0;
              const config = PRIORITY_LABELS[priority];

              return (
                <div
                  key={priority}
                  className={`cursor-pointer p-2 rounded-lg transition ${
                    selectedPriority === priority
                      ? 'ring-2 ring-blue-500'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() =>
                    setSelectedPriority(
                      selectedPriority === priority ? null : priority
                    )
                  }
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${config.color}`}
                    >
                      {config.label}
                    </span>
                    <span className="text-sm text-gray-600">{count} 条</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 来源分布 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-4">来源分布</h3>
          <div className="space-y-3">
            {Object.entries(stats?.bySource || {}).map(([source, count]) => {
              const percentage =
                stats?.total ? (count / stats.total) * 100 : 0;

              return (
                <div
                  key={source}
                  className={`cursor-pointer p-2 rounded-lg transition ${
                    selectedSource === source
                      ? 'ring-2 ring-blue-500'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() =>
                    setSelectedSource(
                      selectedSource === source ? null : (source as DataSource)
                    )
                  }
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">
                      {SOURCE_NAMES[source] || source}
                    </span>
                    <span className="text-sm text-gray-600">{count} 条</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 数据预览 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">数据预览</h3>
            <p className="text-sm text-gray-500">
              {selectedPriority && `筛选: ${PRIORITY_LABELS[selectedPriority]?.label}`}
              {selectedSource && ` | 来源: ${SOURCE_NAMES[selectedSource]}`}
              {!selectedPriority && !selectedSource && '显示前 20 条数据'}
            </p>
          </div>
          {(selectedPriority || selectedSource) && (
            <button
              onClick={() => {
                setSelectedPriority(null);
                setSelectedSource(null);
              }}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              清除筛选
            </button>
          )}
        </div>

        <div className="divide-y max-h-[500px] overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">加载中...</div>
          ) : previewData.length === 0 ? (
            <div className="p-8 text-center text-gray-500">暂无数据</div>
          ) : (
            previewData.map((item, index) => (
              <div key={index} className="px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          PRIORITY_LABELS[item.priority]?.color || ''
                        }`}
                      >
                        P{item.priority}
                      </span>
                      <span className="text-xs text-gray-500">
                        {SOURCE_NAMES[item.source] || item.source}
                      </span>
                      {item.date && (
                        <span className="text-xs text-gray-400">
                          {new Date(item.date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {item.title && (
                      <h4 className="font-medium text-gray-900 mb-1">
                        {item.title}
                      </h4>
                    )}
                    <p className="text-sm text-gray-600 line-clamp-3">
                      {item.content}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">权重</div>
                    <div className="font-medium text-gray-700">
                      {item.weight.toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 导出按钮 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold text-gray-900 mb-4">导出数据集</h3>
        <p className="text-sm text-gray-600 mb-4">
          选择导出格式，JSON 格式适合程序处理，Markdown 格式便于人工审阅
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => onExport('json')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            导出 JSON
          </button>
          <button
            onClick={() => onExport('markdown')}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            导出 Markdown
          </button>
          <button
            onClick={() => onExport('both')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            导出全部格式
          </button>
        </div>
      </div>
    </div>
  );
}
