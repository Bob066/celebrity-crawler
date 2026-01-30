'use client';

import { useState, useEffect } from 'react';
import { Celebrity } from '@/types';
import { PriceComparison, PaymentMethod, PriceInfo } from '@/types/paid-sources';

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
  const [isLoading, setIsLoading] = useState(true);
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
    } catch (error) {
      console.error('获取付费资源失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredResources = resources.filter((r) => {
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

  const totalSelectedPrice = filteredResources
    .filter((r) => selectedResources.has(r.resource.id))
    .reduce((sum, r) => sum + (r.bestPriceChina?.priceInCNY || 0), 0);

  return (
    <div className="space-y-6">
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
                  filteredResources
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
      ) : filteredResources.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          没有找到符合条件的付费资源
        </div>
      ) : (
        <div className="space-y-4">
          {filteredResources.map((comparison) => (
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
