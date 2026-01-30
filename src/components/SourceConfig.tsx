'use client';

import { useState } from 'react';
import { DataSource, LLMProvider } from '@/types';

interface SourceConfigProps {
  onLLMConfigured: (provider: LLMProvider, apiKey: string) => void;
  apiKeys: Record<string, string>;
  onApiKeysChange: (keys: Record<string, string>) => void;
  selectedSources: DataSource[];
  onSourcesChange: (sources: DataSource[]) => void;
}

const DATA_SOURCES: {
  id: DataSource;
  name: string;
  description: string;
  requiresApiKey: boolean;
  hasPublicMode: boolean;  // 是否支持无 Key 公开爬取
  apiKeyName?: string;
  publicModeNote?: string;
}[] = [
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    description: '维基百科基本信息',
    requiresApiKey: false,
    hasPublicMode: true,
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    description: '社交媒体发言、转推和回复',
    requiresApiKey: false,
    hasPublicMode: true,
    apiKeyName: 'TWITTER_BEARER_TOKEN',
    publicModeNote: '无 Key 模式：通过 Nitter/搜索引擎/Wayback Machine 获取',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    description: '采访视频、演讲的字幕和文字稿',
    requiresApiKey: false,
    hasPublicMode: true,
    apiKeyName: 'YOUTUBE_API_KEY',
    publicModeNote: '无 Key 模式：通过 Invidious/公开页面获取',
  },
  {
    id: 'news',
    name: '新闻聚合',
    description: '各大新闻媒体的报道文章',
    requiresApiKey: false,
    hasPublicMode: true,
    apiKeyName: 'GOOGLE_SEARCH_API_KEY',
    publicModeNote: '无 Key 模式：通过 Bing/Google News RSS/DuckDuckGo/Reddit 获取',
  },
  {
    id: 'book',
    name: '书籍/传记',
    description: '相关书籍和传记内容摘要',
    requiresApiKey: false,
    hasPublicMode: true,
  },
  {
    id: 'podcast',
    name: '播客',
    description: '播客出镜内容的文字稿',
    requiresApiKey: true,
    hasPublicMode: false,
    apiKeyName: 'SPOTIFY_API_KEY',
  },
];

export function SourceConfig({
  onLLMConfigured,
  apiKeys,
  onApiKeysChange,
  selectedSources,
  onSourcesChange,
}: SourceConfigProps) {
  const [llmProvider, setLlmProvider] = useState<LLMProvider>('openai');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');
  // 记录哪些数据源使用公开模式（无 Key）
  const [publicModeEnabled, setPublicModeEnabled] = useState<Record<string, boolean>>({
    twitter: true,
    youtube: true,
    news: true,
  });

  const handleSourceToggle = (sourceId: DataSource) => {
    if (selectedSources.includes(sourceId)) {
      onSourcesChange(selectedSources.filter((s) => s !== sourceId));
    } else {
      onSourcesChange([...selectedSources, sourceId]);
    }
  };

  const handleApiKeyChange = (keyName: string, value: string) => {
    onApiKeysChange({ ...apiKeys, [keyName]: value });
  };

  const togglePublicMode = (sourceId: string) => {
    setPublicModeEnabled({
      ...publicModeEnabled,
      [sourceId]: !publicModeEnabled[sourceId],
    });
    // 如果切换到公开模式，清空对应的 API Key
    const source = DATA_SOURCES.find((s) => s.id === sourceId);
    if (source?.apiKeyName && !publicModeEnabled[sourceId]) {
      onApiKeysChange({ ...apiKeys, [source.apiKeyName]: '' });
    }
  };

  const handleContinue = async () => {
    if (!llmApiKey.trim()) {
      setError('请输入 LLM API Key');
      return;
    }

    setIsValidating(true);
    setError('');

    try {
      // 验证 API Key
      const response = await fetch('/api/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: llmProvider,
          apiKey: llmApiKey,
        }),
      });

      const data = await response.json();

      if (data.valid) {
        onLLMConfigured(llmProvider, llmApiKey);
      } else {
        setError('API Key 无效，请检查后重试');
      }
    } catch {
      setError('验证失败，请稍后重试');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* LLM 配置 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          1. 配置 AI 模型
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          选择一个 LLM 提供商用于名人识别和内容分析
        </p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <button
            onClick={() => setLlmProvider('openai')}
            className={`p-4 border-2 rounded-lg text-left transition ${
              llmProvider === 'openai'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-medium">OpenAI</div>
            <div className="text-sm text-gray-500">GPT-4 Turbo</div>
          </button>
          <button
            onClick={() => setLlmProvider('anthropic')}
            className={`p-4 border-2 rounded-lg text-left transition ${
              llmProvider === 'anthropic'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-medium">Anthropic</div>
            <div className="text-sm text-gray-500">Claude 3 Opus</div>
          </button>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {llmProvider === 'openai' ? 'OpenAI' : 'Anthropic'} API Key
          </label>
          <input
            type="password"
            value={llmApiKey}
            onChange={(e) => setLlmApiKey(e.target.value)}
            placeholder={
              llmProvider === 'openai' ? 'sk-...' : 'sk-ant-...'
            }
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500">
            API Key 仅在本地使用，不会上传到服务器
          </p>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
      </div>

      {/* 数据源配置 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          2. 选择数据源
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          选择要爬取的数据来源，部分来源需要配置 API Key
        </p>

        <div className="space-y-3">
          {DATA_SOURCES.map((source) => (
            <div
              key={source.id}
              className={`border rounded-lg p-4 transition ${
                selectedSources.includes(source.id)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedSources.includes(source.id)}
                    onChange={() => handleSourceToggle(source.id)}
                    className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium text-gray-900">
                      {source.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {source.description}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {source.hasPublicMode && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                      支持免费
                    </span>
                  )}
                  {!source.hasPublicMode && source.requiresApiKey && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                      需要 Key
                    </span>
                  )}
                </div>
              </div>

              {/* 公开模式切换 + API Key 输入 */}
              {source.hasPublicMode &&
                source.apiKeyName &&
                selectedSources.includes(source.id) && (
                  <div className="mt-3 ml-7 space-y-2">
                    {/* 模式切换 */}
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`mode-${source.id}`}
                          checked={publicModeEnabled[source.id]}
                          onChange={() => {
                            if (!publicModeEnabled[source.id]) {
                              togglePublicMode(source.id);
                            }
                          }}
                          className="w-4 h-4 text-green-600"
                        />
                        <span className="text-sm text-gray-700">
                          免费公开爬取
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`mode-${source.id}`}
                          checked={!publicModeEnabled[source.id]}
                          onChange={() => {
                            if (publicModeEnabled[source.id]) {
                              togglePublicMode(source.id);
                            }
                          }}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm text-gray-700">
                          使用 API Key（更稳定）
                        </span>
                      </label>
                    </div>

                    {/* 公开模式说明 */}
                    {publicModeEnabled[source.id] && source.publicModeNote && (
                      <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                        {source.publicModeNote}
                      </div>
                    )}

                    {/* API Key 输入（仅在非公开模式时显示） */}
                    {!publicModeEnabled[source.id] && (
                      <input
                        type="password"
                        value={apiKeys[source.apiKeyName] || ''}
                        onChange={(e) =>
                          handleApiKeyChange(source.apiKeyName, e.target.value)
                        }
                        placeholder={`输入 ${source.apiKeyName}`}
                        className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>
                )}

              {/* 仅需要 API Key 的数据源（无公开模式） */}
              {!source.hasPublicMode &&
                source.requiresApiKey &&
                selectedSources.includes(source.id) && (
                  <div className="mt-3 ml-7">
                    <input
                      type="password"
                      value={apiKeys[source.apiKeyName || ''] || ''}
                      onChange={(e) =>
                        handleApiKeyChange(
                          source.apiKeyName || '',
                          e.target.value
                        )
                      }
                      placeholder={`输入 ${source.apiKeyName}`}
                      className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
            </div>
          ))}
        </div>
      </div>

      {/* 继续按钮 */}
      <div className="flex justify-end">
        <button
          onClick={handleContinue}
          disabled={isValidating || !llmApiKey.trim()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isValidating ? (
            <>
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
              验证中...
            </>
          ) : (
            '下一步'
          )}
        </button>
      </div>
    </div>
  );
}
