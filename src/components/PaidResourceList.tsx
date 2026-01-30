'use client';

import { useState, useEffect } from 'react';
import { Celebrity } from '@/types';
import { PriceComparison, PaymentMethod, PriceInfo } from '@/types/paid-sources';

interface FilteredResource {
  title: string;
  type: string;
  reason: string;
  matchedFreeTitle?: string;
}

interface PaidResourceStats {
  freeContent: {
    total: number;
    byPriority: Record<number, number>;
    coveredTypes: string[];
    missingTypes: string[];
    hasEnoughPrimary: boolean;
  };
  paidResources: {
    totalSearched: number;
    duplicateFiltered: number;
    lowPrioritySkipped: number;
    recommended: number;
  };
  byType: Record<string, number>;
  byRecommendation: Record<string, number>;
  totalPriceIfBuyAll: number;
  highlyRecommendedCount: number;
}

interface PaidResourceListProps {
  celebrity: Celebrity;
  onResourceSelected?: (resource: PriceComparison) => void;
}

const PAYMENT_ICONS: Record<PaymentMethod, { name: string; color: string }> = {
  alipay: { name: '支付宝', color: 'bg-blue-500' },
  wechat: { name: '微信', color: 'bg-green-500' },
  unionpay: { name: '银联', color: 'bg-red-500' },
  visa: { name: 'Visa', color: 'bg-blue-600' },
  mastercard: { name: 'MC', color: 'bg-orange-500' },
  paypal: { name: 'PayPal', color: 'bg-blue-400' },
  crypto: { name: '加密货币', color: 'bg-yellow-500' },
};

const RECOMMENDATION_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  highly_recommend: {
    label: '强烈推荐',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  recommend: {
    label: '推荐购买',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  optional: {
    label: '可选',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
  },
  skip: {
    label: '不推荐',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
};

const TYPE_LABELS: Record<string, string> = {
  ebook: '电子书',
  audiobook: '有声书',
  course: '课程',
  paper: '学术论文',
  interview: '付费采访',
  biography_full: '完整传记',
};

export function PaidResourceList({
  celebrity,
  onResourceSelected,
}: PaidResourceListProps) {
  const [resources, setResources] = useState<PriceComparison[]>([]);
  const [filteredResources, setFilteredResources] = useState<FilteredResource[]>([]);
  const [stats, setStats] = useState<PaidResourceStats | null>(null);
  const [message, setMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [showFiltered, setShowFiltered] = useState(false);
  const [filter, setFilter] = useState<{
    type: string | null;
    recommendation: string | null;
    chinaOnly: boolean;
  }>({
    type: null,
    recommendation: null,
    chinaOnly: true, // 默认只显示中国可用
  });
  const [selectedResources, setSelectedResources] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    fetchPaidResources();
  }, [celebrity.id]);

  const fetchPaidResources = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/paid-resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ celebrity }),
      });

      const data = await response.json();
      setResources(data.comparisons || []);
      setFilteredResources(data.filteredResources || []);
      setStats(data.stats || null);
      setMessage(data.message || '');
    } catch (error) {
      console.error('获取付费资源失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const displayResources = resources.filter((r) => {
    if (filter.type && r.resource.type !== filter.type) return false;
    if (filter.recommendation && r.recommendation !== filter.recommendation)
      return false;
    if (filter.chinaOnly && !r.bestPriceChina) return false;
    return true;
  });

  const toggleResourceSelection = (resourceId: string) => {
    const newSelected = new Set(selectedResources);
    if (newSelected.has(resourceId)) {
      newSelected.delete(resourceId);
    } else {
      newSelected.add(resourceId);
    }
    setSelectedResources(newSelected);
  };

  const totalSelectedPrice = displayResources
    .filter((r) => selectedResources.has(r.resource.id))
    .reduce((sum, r) => sum + (r.bestPriceChina?.priceInCNY || 0), 0);

  return (
    <div className="space-y-6">
      {/* 智能分析提示 */}
      {message && (
        <div className={`rounded-lg p-4 ${
          resources.length === 0
            ? 'bg-green-50 border border-green-200'
            : 'bg-blue-50 border border-blue-200'
        }`}>
          <div className="flex items-start gap-3">
            <svg
              className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                resources.length === 0 ? 'text-green-600' : 'text-blue-600'
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h4 className={`font-medium ${
                resources.length === 0 ? 'text-green-900' : 'text-blue-900'
              }`}>
                智能筛选结果
              </h4>
              <p className={`text-sm mt-1 ${
                resources.length === 0 ? 'text-green-700' : 'text-blue-700'
              }`}>
                {message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 统计信息 */}
      {stats && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {stats.freeContent.total}
              </div>
              <div className="text-xs text-gray-500">已爬取免费内容</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {stats.paidResources.totalSearched}
              </div>
              <div className="text-xs text-gray-500">搜索到付费资源</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {stats.paidResources.duplicateFiltered}
              </div>
              <div className="text-xs text-gray-500">与免费内容重复</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {stats.paidResources.recommended}
              </div>
              <div className="text-xs text-gray-500">推荐购买</div>
            </div>
          </div>

          {/* 免费内容覆盖情况 */}
          {stats.freeContent.hasEnoughPrimary && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm text-green-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                已有足够一手资料 (P1+P2: {stats.freeContent.byPriority[1] + stats.freeContent.byPriority[2]} 条)
              </div>
            </div>
          )}

          {stats.freeContent.missingTypes.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="text-sm text-yellow-600">
                缺少的内容类型: {stats.freeContent.missingTypes.join('、')}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 被过滤的资源（可展开） */}
      {filteredResources.length > 0 && (
        <div className="bg-gray-50 rounded-lg border border-gray-200">
          <button
            onClick={() => setShowFiltered(!showFiltered)}
            className="w-full px-4 py-3 flex items-center justify-between text-sm text-gray-600 hover:bg-gray-100"
          >
            <span>
              查看被过滤的 {filteredResources.length} 个资源（与免费内容重复或优先级较低）
            </span>
            <svg
              className={`w-5 h-5 transform transition ${showFiltered ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showFiltered && (
            <div className="px-4 pb-4 space-y-2">
              {filteredResources.map((f, index) => (
                <div key={index} className="flex items-start gap-2 text-sm py-2 border-t border-gray-200">
                  <span className="text-gray-400 line-through">{f.title}</span>
                  <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded whitespace-nowrap">
                    {TYPE_LABELS[f.type] || f.type}
                  </span>
                  <span className="text-xs text-gray-500 ml-auto">{f.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 筛选栏 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-xs text-gray-500 mb-1">资源类型</label>
            <select
              value={filter.type || ''}
              onChange={(e) =>
                setFilter({ ...filter, type: e.target.value || null })
              }
              className="px-3 py-1.5 border rounded text-sm"
            >
              <option value="">全部类型</option>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">推荐等级</label>
            <select
              value={filter.recommendation || ''}
              onChange={(e) =>
                setFilter({ ...filter, recommendation: e.target.value || null })
              }
              className="px-3 py-1.5 border rounded text-sm"
            >
              <option value="">全部</option>
              {Object.entries(RECOMMENDATION_CONFIG).map(([value, config]) => (
                <option key={value} value={value}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="chinaOnly"
              checked={filter.chinaOnly}
              onChange={(e) =>
                setFilter({ ...filter, chinaOnly: e.target.checked })
              }
              className="w-4 h-4"
            />
            <label htmlFor="chinaOnly" className="text-sm text-gray-700">
              仅显示中国大陆可购买
            </label>
          </div>

          {selectedResources.size > 0 && (
            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm text-gray-600">
                已选 {selectedResources.size} 项，总计{' '}
                <span className="font-semibold text-blue-600">
                  ¥{totalSelectedPrice.toFixed(2)}
                </span>
              </span>
              <button
                onClick={() => {
                  displayResources
                    .filter((r) => selectedResources.has(r.resource.id))
                    .forEach((r) => onResourceSelected?.(r));
                }}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                添加到购买清单
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 资源列表 */}
      {isLoading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          正在搜索付费资源并比价...
        </div>
      ) : displayResources.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          {resources.length === 0
            ? '免费资源已足够丰富，无需购买付费资源'
            : '没有找到符合筛选条件的付费资源'}
        </div>
      ) : (
        <div className="space-y-4">
          {displayResources.map((comparison) => (
            <PaidResourceCard
              key={comparison.resource.id}
              comparison={comparison}
              isSelected={selectedResources.has(comparison.resource.id)}
              onToggleSelect={() =>
                toggleResourceSelection(comparison.resource.id)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 单个资源卡片
function PaidResourceCard({
  comparison,
  isSelected,
  onToggleSelect,
}: {
  comparison: PriceComparison;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  const { resource, bestPriceChina, allPrices, recommendation, recommendationReason } =
    comparison;
  const [showAllPrices, setShowAllPrices] = useState(false);

  const recConfig = RECOMMENDATION_CONFIG[recommendation];

  return (
    <div
      className={`bg-white rounded-lg shadow overflow-hidden transition ${
        isSelected ? 'ring-2 ring-blue-500' : ''
      }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* 选择框 */}
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="w-5 h-5 mt-1 rounded"
          />

          {/* 主要信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                {TYPE_LABELS[resource.type] || resource.type}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded ${recConfig.bgColor} ${recConfig.color}`}
              >
                {recConfig.label}
              </span>
              {resource.priority <= 2 && (
                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">
                  P{resource.priority} 本人作品
                </span>
              )}
            </div>

            <h3 className="font-medium text-gray-900 mb-1">{resource.title}</h3>

            {resource.titleZh && (
              <p className="text-sm text-gray-600 mb-1">{resource.titleZh}</p>
            )}

            {resource.author && (
              <p className="text-sm text-gray-500">作者: {resource.author}</p>
            )}

            {resource.description && (
              <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                {resource.description}
              </p>
            )}

            <p className="text-xs text-gray-400 mt-2">{recommendationReason}</p>
          </div>

          {/* 价格信息 */}
          <div className="text-right">
            {bestPriceChina ? (
              <>
                <div className="text-2xl font-bold text-blue-600">
                  ¥{bestPriceChina.priceInCNY.toFixed(2)}
                </div>
                {bestPriceChina.originalPrice && (
                  <div className="text-sm text-gray-400 line-through">
                    ¥
                    {(
                      bestPriceChina.originalPrice *
                      (bestPriceChina.currency === 'USD' ? 7.2 : 1)
                    ).toFixed(2)}
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-1">
                  {bestPriceChina.platform.nameZh}
                </div>
                <div className="flex justify-end gap-1 mt-1">
                  {bestPriceChina.supportedPayments
                    .slice(0, 3)
                    .map((pm) => (
                      <span
                        key={pm}
                        className={`text-xs px-1.5 py-0.5 text-white rounded ${PAYMENT_ICONS[pm].color}`}
                      >
                        {PAYMENT_ICONS[pm].name}
                      </span>
                    ))}
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-400">暂无中国区价格</div>
            )}
          </div>
        </div>

        {/* 展开所有价格 */}
        {allPrices.length > 1 && (
          <div className="mt-4 pt-4 border-t">
            <button
              onClick={() => setShowAllPrices(!showAllPrices)}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              {showAllPrices
                ? '收起比价'
                : `查看全部 ${allPrices.length} 个平台价格`}
            </button>

            {showAllPrices && (
              <div className="mt-3 space-y-2">
                {allPrices.map((price, index) => (
                  <PriceRow key={index} price={price} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 购买链接 */}
        {bestPriceChina && (
          <div className="mt-4 flex gap-2">
            <a
              href={bestPriceChina.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              前往 {bestPriceChina.platform.nameZh} 购买
            </a>
            {resource.previewUrl && (
              <a
                href={resource.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 border text-sm rounded hover:bg-gray-50"
              >
                预览
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// 价格行
function PriceRow({ price }: { price: PriceInfo }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">{price.platform.nameZh}</span>
        {!price.chinaAccessible && (
          <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">
            需VPN
          </span>
        )}
        {price.format && (
          <span className="text-xs text-gray-500">{price.format}</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {price.supportedPayments.slice(0, 2).map((pm) => (
            <span
              key={pm}
              className={`text-xs px-1 py-0.5 text-white rounded ${PAYMENT_ICONS[pm].color}`}
            >
              {PAYMENT_ICONS[pm].name}
            </span>
          ))}
        </div>
        <div className="text-right">
          <span className="font-medium">¥{price.priceInCNY.toFixed(2)}</span>
          {price.currency !== 'CNY' && (
            <span className="text-xs text-gray-400 ml-1">
              ({price.currency} {price.price.toFixed(2)})
            </span>
          )}
        </div>
        <a
          href={price.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:text-blue-700"
        >
          购买
        </a>
      </div>
    </div>
  );
}
