import { NextRequest, NextResponse } from 'next/server';
import { Celebrity } from '@/types';
import {
  searchPaidResources,
  batchPriceComparison,
  getFreeAlternatives,
} from '@/lib/crawlers/paid';

export async function POST(request: NextRequest) {
  try {
    const { celebrity } = (await request.json()) as { celebrity: Celebrity };

    if (!celebrity) {
      return NextResponse.json(
        { error: '缺少名人信息' },
        { status: 400 }
      );
    }

    // 搜索付费资源
    const resources = await searchPaidResources(celebrity);

    // 批量获取价格比较
    const comparisons = await batchPriceComparison(resources);

    // 为每个资源添加免费替代品建议
    const comparisonsWithAlternatives = comparisons.map((comparison) => ({
      ...comparison,
      freeAlternatives: getFreeAlternatives(comparison.resource),
    }));

    // 统计信息
    const stats = {
      total: comparisons.length,
      byType: {} as Record<string, number>,
      byRecommendation: {} as Record<string, number>,
      totalPriceIfBuyAll: comparisons.reduce(
        (sum, c) => sum + (c.bestPriceChina?.priceInCNY || 0),
        0
      ),
      highlyRecommendedCount: comparisons.filter(
        (c) => c.recommendation === 'highly_recommend'
      ).length,
    };

    comparisons.forEach((c) => {
      stats.byType[c.resource.type] =
        (stats.byType[c.resource.type] || 0) + 1;
      stats.byRecommendation[c.recommendation] =
        (stats.byRecommendation[c.recommendation] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      comparisons: comparisonsWithAlternatives,
      stats,
    });
  } catch (error) {
    console.error('Paid Resources API 错误:', error);
    return NextResponse.json(
      { error: '获取付费资源失败' },
      { status: 500 }
    );
  }
}
