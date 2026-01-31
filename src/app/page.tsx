'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChatInterface } from '@/components/ChatInterface';
import { SourceConfig } from '@/components/SourceConfig';
import { CrawlProgress } from '@/components/CrawlProgress';
import { DataPreview } from '@/components/DataPreview';
import { PaidResourceList } from '@/components/PaidResourceList';
import { Celebrity, DataSource, CrawlTask, LLMProvider } from '@/types';

type AppState = 'config' | 'chat' | 'crawling' | 'preview' | 'paid';

const STORAGE_KEY = 'celebrity-crawler-state';

interface SavedState {
  appState: AppState;
  llmConfig: { provider: LLMProvider; apiKey: string } | null;
  apiKeys: Record<string, string>;
  celebrity: Celebrity | null;
  selectedSources: DataSource[];
  savedAt: string;
}

export default function Home() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [appState, setAppState] = useState<AppState>('config');
  const [llmConfig, setLlmConfig] = useState<{
    provider: LLMProvider;
    apiKey: string;
  } | null>(null);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [celebrity, setCelebrity] = useState<Celebrity | null>(null);
  const [selectedSources, setSelectedSources] = useState<DataSource[]>([
    'wikipedia',
  ]);
  const [crawlTasks, setCrawlTasks] = useState<CrawlTask[]>([]);

  // 轮询爬取状态（提前定义，因为 useEffect 中使用）
  const pollCrawlStatus = useCallback((celebrityId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/status?celebrityId=${celebrityId}`);
        const data = await response.json();

        if (data.tasks) {
          setCrawlTasks(data.tasks);

          // 检查是否全部完成
          const allCompleted = data.tasks.every(
            (t: CrawlTask) => t.status === 'completed' || t.status === 'failed'
          );

          if (allCompleted) {
            setAppState('preview');
            return;
          }
        }

        // 继续轮询
        setTimeout(poll, 2000);
      } catch (error) {
        console.error('状态查询失败:', error);
        setTimeout(poll, 5000);
      }
    };

    poll();
  }, []);

  // 从 localStorage 加载状态
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const state: SavedState = JSON.parse(saved);
        // 检查是否在24小时内
        const savedTime = new Date(state.savedAt).getTime();
        const now = Date.now();
        if (now - savedTime < 24 * 60 * 60 * 1000) {
          setAppState(state.appState);
          setLlmConfig(state.llmConfig);
          setApiKeys(state.apiKeys);
          setCelebrity(state.celebrity);
          setSelectedSources(state.selectedSources);

          // 如果之前在爬取中，恢复轮询
          if (state.appState === 'crawling' && state.celebrity?.id) {
            pollCrawlStatus(state.celebrity.id);
          }
        }
      }
    } catch (error) {
      console.error('加载缓存状态失败:', error);
    }
    setIsLoaded(true);
  }, [pollCrawlStatus]);

  // 保存状态到 localStorage
  const saveState = useCallback(() => {
    if (!isLoaded) return;
    try {
      const state: SavedState = {
        appState,
        llmConfig,
        apiKeys,
        celebrity,
        selectedSources,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('保存状态失败:', error);
    }
  }, [isLoaded, appState, llmConfig, apiKeys, celebrity, selectedSources]);

  // 状态变化时自动保存
  useEffect(() => {
    saveState();
  }, [saveState]);

  // 清除缓存
  const clearCache = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAppState('config');
    setLlmConfig(null);
    setApiKeys({});
    setCelebrity(null);
    setSelectedSources(['wikipedia']);
    setCrawlTasks([]);
  };

  // 处理LLM配置完成
  const handleLLMConfigured = (provider: LLMProvider, apiKey: string) => {
    setLlmConfig({ provider, apiKey });
    setAppState('chat');
  };

  // 处理名人确认
  const handleCelebrityConfirmed = (confirmedCelebrity: Celebrity) => {
    setCelebrity(confirmedCelebrity);
  };

  // 开始爬取
  const handleStartCrawl = async () => {
    if (!celebrity) return;

    setAppState('crawling');

    // 为每个选中的数据源创建爬取任务
    const tasks: CrawlTask[] = selectedSources.map((source) => ({
      id: `${source}-${Date.now()}`,
      celebrityId: celebrity.id || '',
      source,
      status: 'pending',
      progress: 0,
      total: 0,
      itemsCrawled: 0,
    }));

    setCrawlTasks(tasks);

    // 启动爬取
    try {
      const response = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          celebrity,
          sources: selectedSources,
          apiKeys,
        }),
      });

      if (!response.ok) {
        throw new Error('爬取请求失败');
      }

      // 轮询获取状态
      pollCrawlStatus(celebrity.id || '');
    } catch (error) {
      console.error('爬取失败:', error);
    }
  };

  // 导出数据
  const handleExport = async (format: 'json' | 'markdown' | 'both') => {
    if (!celebrity) return;

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          celebrityId: celebrity.id,
          format,
        }),
      });

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${celebrity.name}-dataset.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出失败:', error);
    }
  };

  // 等待加载完成
  if (!isLoaded) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      {/* 头部 */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                名人信息爬虫系统
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                收集名人公开信息，构建个性化训练数据集
              </p>
            </div>
            <div className="flex items-center gap-3">
              {celebrity && (
                <div className="flex items-center gap-3 bg-blue-50 px-4 py-2 rounded-lg">
                  <span className="text-blue-700 font-medium">
                    {celebrity.name}
                  </span>
                  <button
                    onClick={() => {
                      setCelebrity(null);
                      setAppState('chat');
                    }}
                    className="text-blue-500 hover:text-blue-700 text-sm"
                  >
                    更换
                  </button>
                </div>
              )}
              <button
                onClick={clearCache}
                className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
                title="清除缓存，重新开始"
              >
                重置
              </button>
            </div>
          </div>

          {/* 步骤指示器 */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {[
              { key: 'config', label: '1. 配置' },
              { key: 'chat', label: '2. 确认名人' },
              { key: 'crawling', label: '3. 免费数据爬取' },
              { key: 'preview', label: '4. 预览数据' },
              { key: 'paid', label: '5. 付费资源' },
            ].map((step, index) => (
              <div key={step.key} className="flex items-center">
                <div
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    appState === step.key
                      ? 'bg-blue-600 text-white'
                      : ['config', 'chat', 'crawling', 'preview', 'paid'].indexOf(
                          appState
                        ) > index
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {step.label}
                </div>
                {index < 4 && (
                  <div className="w-8 h-0.5 bg-gray-200 mx-1" />
                )}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 配置阶段 */}
        {appState === 'config' && (
          <SourceConfig
            onLLMConfigured={handleLLMConfigured}
            apiKeys={apiKeys}
            onApiKeysChange={setApiKeys}
            selectedSources={selectedSources}
            onSourcesChange={setSelectedSources}
          />
        )}

        {/* 聊天确认阶段 */}
        {appState === 'chat' && llmConfig && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ChatInterface
                llmConfig={llmConfig}
                onCelebrityConfirmed={handleCelebrityConfirmed}
              />
            </div>
            <div>
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold text-gray-900 mb-3">
                  已选择的数据源
                </h3>
                <ul className="space-y-2 text-sm">
                  {selectedSources.map((source) => (
                    <li
                      key={source}
                      className="flex items-center gap-2 text-gray-600"
                    >
                      <span className="w-2 h-2 bg-green-500 rounded-full" />
                      {source}
                    </li>
                  ))}
                </ul>
                {celebrity && (
                  <button
                    onClick={handleStartCrawl}
                    className="w-full mt-4 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
                  >
                    开始爬取数据
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 爬取进度阶段 */}
        {appState === 'crawling' && (
          <CrawlProgress tasks={crawlTasks} celebrity={celebrity} />
        )}

        {/* 预览导出阶段 */}
        {appState === 'preview' && celebrity && (
          <div className="space-y-6">
            <DataPreview celebrity={celebrity} onExport={handleExport} />

            {/* 进入付费资源页面的按钮 */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    想要更完整的数据集？
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    我们已搜索到更多付费资源（电子书、有声书、课程等），并为你进行了多平台比价
                  </p>
                </div>
                <button
                  onClick={() => setAppState('paid')}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition whitespace-nowrap"
                >
                  查看付费资源
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 付费资源阶段 */}
        {appState === 'paid' && celebrity && (
          <div className="space-y-6">
            {/* 返回按钮 */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setAppState('preview')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                返回免费数据预览
              </button>
              <div className="text-sm text-gray-500">
                以下资源已按中国大陆可购买优先排序
              </div>
            </div>

            {/* 说明卡片 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-3">
                <svg
                  className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <h4 className="font-medium text-blue-900">付费资源说明</h4>
                  <ul className="text-sm text-blue-800 mt-2 space-y-1">
                    <li>• 优先显示支持支付宝/微信支付的平台</li>
                    <li>• 同一资源在不同平台的价格已自动比较，推荐最优选择</li>
                    <li>• 「强烈推荐」的资源是本人作品或高相关性内容</li>
                    <li>• 点击资源可查看所有平台价格对比</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 付费资源列表 */}
            <PaidResourceList celebrity={celebrity} />
          </div>
        )}
      </div>
    </main>
  );
}
