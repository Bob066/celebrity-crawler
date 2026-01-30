'use client';

import { useState } from 'react';

interface ApiKeyGuideProps {
  provider: 'openai' | 'anthropic' | 'twitter' | 'youtube' | 'google' | 'spotify';
  onClose: () => void;
}

const GUIDE_DATA = {
  openai: {
    name: 'OpenAI',
    steps: [
      {
        title: '注册 OpenAI 账号',
        description: '访问 OpenAI 官网创建账号',
        link: 'https://platform.openai.com/signup',
        linkText: '前往注册',
      },
      {
        title: '进入 API Keys 页面',
        description: '登录后，点击右上角头像 → API Keys',
        link: 'https://platform.openai.com/api-keys',
        linkText: '打开 API Keys',
      },
      {
        title: '创建新的 API Key',
        description: '点击 "Create new secret key"，输入名称后创建',
      },
      {
        title: '复制 API Key',
        description: '创建后立即复制保存，关闭窗口后将无法再次查看',
        important: true,
      },
      {
        title: '充值（可选）',
        description: '新账号有 $5 免费额度，用完后需要充值。支持 Visa/Mastercard',
        link: 'https://platform.openai.com/account/billing',
        linkText: '充值页面',
      },
    ],
    keyFormat: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    pricing: '按使用量计费，GPT-4 约 $0.03/1K tokens',
    tips: [
      '新账号有 $5 免费额度',
      '建议设置使用限额避免超支',
      '中国用户可能需要使用海外手机号注册',
    ],
  },
  anthropic: {
    name: 'Anthropic (Claude)',
    steps: [
      {
        title: '注册 Anthropic 账号',
        description: '访问 Anthropic Console 创建账号',
        link: 'https://console.anthropic.com/signup',
        linkText: '前往注册',
      },
      {
        title: '进入 API Keys 页面',
        description: '登录后，在左侧菜单找到 "API Keys"',
        link: 'https://console.anthropic.com/settings/keys',
        linkText: '打开 API Keys',
      },
      {
        title: '创建新的 API Key',
        description: '点击 "Create Key"，输入名称后创建',
      },
      {
        title: '复制 API Key',
        description: '创建后立即复制保存',
        important: true,
      },
    ],
    keyFormat: 'sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    pricing: '按使用量计费，Claude 3 Opus 约 $0.015/1K tokens',
    tips: [
      '新账号有 $5 免费额度',
      '支持多种 Claude 模型',
      '中国用户可能需要使用海外手机号注册',
    ],
  },
  twitter: {
    name: 'X (Twitter) API',
    steps: [
      {
        title: '申请开发者账号',
        description: '访问 Twitter Developer Portal 申请开发者权限',
        link: 'https://developer.twitter.com/en/portal/dashboard',
        linkText: '开发者平台',
      },
      {
        title: '创建项目和应用',
        description: '在 Dashboard 中创建新项目，然后创建一个 App',
      },
      {
        title: '申请 API 访问级别',
        description: '基础版免费但有限制，需要申请 "Basic" 或 "Pro" 级别',
      },
      {
        title: '获取 Bearer Token',
        description: '在 App 设置中，找到 "Keys and tokens" → "Bearer Token"',
        important: true,
      },
    ],
    keyFormat: 'AAAAAAAAAAAAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    pricing: 'Basic 免费（有限制），Pro $100/月',
    tips: [
      '申请需要填写使用用途说明',
      '免费版每月限 10,000 次请求',
      '审核可能需要几天时间',
      '建议先使用免费公开爬取模式',
    ],
  },
  youtube: {
    name: 'YouTube Data API',
    steps: [
      {
        title: '登录 Google Cloud Console',
        description: '使用 Google 账号登录 Cloud Console',
        link: 'https://console.cloud.google.com/',
        linkText: '打开 Console',
      },
      {
        title: '创建新项目',
        description: '点击顶部项目选择器 → "新建项目"',
      },
      {
        title: '启用 YouTube Data API',
        description: '搜索 "YouTube Data API v3"，点击启用',
        link: 'https://console.cloud.google.com/apis/library/youtube.googleapis.com',
        linkText: '启用 API',
      },
      {
        title: '创建凭据',
        description: '进入 "凭据" 页面 → "创建凭据" → "API 密钥"',
        link: 'https://console.cloud.google.com/apis/credentials',
        linkText: '创建凭据',
      },
      {
        title: '复制 API Key',
        description: '创建后复制 API Key',
        important: true,
      },
    ],
    keyFormat: 'AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    pricing: '每天免费 10,000 个单位（约 100 次搜索）',
    tips: [
      '完全免费使用',
      '建议限制 API Key 只能访问 YouTube API',
      '每个请求消耗不同数量的配额单位',
    ],
  },
  google: {
    name: 'Google Custom Search API',
    steps: [
      {
        title: '创建 Google Cloud 项目',
        description: '同 YouTube API 的步骤 1-2',
        link: 'https://console.cloud.google.com/',
        linkText: '打开 Console',
      },
      {
        title: '启用 Custom Search API',
        description: '搜索 "Custom Search API"，点击启用',
        link: 'https://console.cloud.google.com/apis/library/customsearch.googleapis.com',
        linkText: '启用 API',
      },
      {
        title: '创建 API 密钥',
        description: '进入 "凭据" 页面创建 API 密钥',
      },
      {
        title: '创建自定义搜索引擎',
        description: '访问 Programmable Search Engine 创建搜索引擎',
        link: 'https://programmablesearchengine.google.com/controlpanel/create',
        linkText: '创建搜索引擎',
      },
      {
        title: '获取搜索引擎 ID (CX)',
        description: '在搜索引擎设置中找到 "搜索引擎 ID"',
        important: true,
      },
    ],
    keyFormat: 'API Key: AIzaSyxxx... + CX: 017576662512468239146:omuauf_lfve',
    pricing: '每天免费 100 次搜索，超出后 $5/1000 次',
    tips: [
      '需要同时配置 API Key 和搜索引擎 ID',
      '可以设置只搜索特定网站',
      '建议使用免费的新闻 RSS 替代',
    ],
  },
  spotify: {
    name: 'Spotify API',
    steps: [
      {
        title: '登录 Spotify for Developers',
        description: '使用 Spotify 账号登录开发者平台',
        link: 'https://developer.spotify.com/dashboard',
        linkText: '开发者平台',
      },
      {
        title: '创建应用',
        description: '点击 "Create an App"，填写应用信息',
      },
      {
        title: '获取 Client ID 和 Client Secret',
        description: '在应用设置中查看凭据',
        important: true,
      },
      {
        title: '设置回调 URL（如需要）',
        description: '在应用设置中添加 Redirect URI',
      },
    ],
    keyFormat: 'Client ID + Client Secret',
    pricing: '免费，有请求速率限制',
    tips: [
      'Spotify 账号即可使用',
      '播客 API 访问权限可能受限',
      '某些功能需要 Spotify Premium',
    ],
  },
};

export function ApiKeyGuide({ provider, onClose }: ApiKeyGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const guide = GUIDE_DATA[provider];

  if (!guide) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* 头部 */}
        <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">如何获取 {guide.name} API Key</h2>
            <p className="text-sm text-blue-100 mt-1">
              步骤 {currentStep + 1} / {guide.steps.length}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-blue-200 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* 进度条 */}
          <div className="flex gap-1 mb-6">
            {guide.steps.map((_, index) => (
              <div
                key={index}
                className={`h-1 flex-1 rounded ${
                  index <= currentStep ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          {/* 当前步骤 */}
          <div className="mb-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">
                {currentStep + 1}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  {guide.steps[currentStep].title}
                </h3>
                <p className="text-gray-600 mt-1">
                  {guide.steps[currentStep].description}
                </p>
                {guide.steps[currentStep].important && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                    <strong>重要：</strong>请务必复制保存，之后可能无法再次查看！
                  </div>
                )}
                {guide.steps[currentStep].link && (
                  <a
                    href={guide.steps[currentStep].link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-3 text-blue-600 hover:text-blue-700"
                  >
                    {guide.steps[currentStep].linkText}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* 所有步骤概览 */}
          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">所有步骤：</h4>
            <div className="space-y-2">
              {guide.steps.map((step, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className={`w-full text-left p-2 rounded text-sm transition ${
                    index === currentStep
                      ? 'bg-blue-50 text-blue-700'
                      : index < currentStep
                      ? 'text-green-600'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <span className="font-medium">{index + 1}. </span>
                  {step.title}
                  {index < currentStep && (
                    <svg className="w-4 h-4 inline ml-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 附加信息 */}
          <div className="border-t pt-4 mt-4 space-y-3">
            <div>
              <span className="text-sm font-medium text-gray-700">Key 格式：</span>
              <code className="ml-2 text-sm bg-gray-100 px-2 py-1 rounded">
                {guide.keyFormat}
              </code>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700">费用：</span>
              <span className="ml-2 text-sm text-gray-600">{guide.pricing}</span>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700">注意事项：</span>
              <ul className="mt-1 text-sm text-gray-600 list-disc list-inside">
                {guide.tips.map((tip, index) => (
                  <li key={index}>{tip}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 bg-gray-50 flex justify-between">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            上一步
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-100"
            >
              关闭
            </button>
            {currentStep < guide.steps.length - 1 ? (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                下一步
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                完成
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 简化版帮助链接组件
 */
export function ApiKeyHelpLink({
  provider,
  className = '',
}: {
  provider: 'openai' | 'anthropic' | 'twitter' | 'youtube' | 'google' | 'spotify';
  className?: string;
}) {
  const [showGuide, setShowGuide] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowGuide(true)}
        className={`text-xs text-blue-600 hover:text-blue-700 underline ${className}`}
      >
        如何获取？
      </button>
      {showGuide && (
        <ApiKeyGuide provider={provider} onClose={() => setShowGuide(false)} />
      )}
    </>
  );
}
