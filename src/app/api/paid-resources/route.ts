import { NextRequest, NextResponse } from 'next/server';
import { Celebrity, ContentItem } from '@/types';
import prisma from '@/lib/db/prisma';
import {
  searchPaidResources,
  batchPriceComparison,
  getFreeAlternatives,
} from '@/lib/crawlers/paid';
import {
  filterPaidResources,
  analyzeFreeContentCoverage,
  generateDeduplicationReport,
  FilteredPaidResources,
  CoverageAnalysis,
} from '@/lib/utils/deduplication';

export const dynamic = 'force-dynamic';

/**
 * 生成用户友好的提示信息
 */
function generateUserMessage(
  filterResult: FilteredPaidResources,
  coverage: CoverageAnalysis
): string {
  const { recommended, stats } = filterResult;

  // 没有推荐购买的资源
  if (recommended.length === 0) {
    if (coverage.hasEnoughPrimaryContent) {
      return '免费资源已经足够丰富，暂时不需要购买付费资源。';
    }
    if (stats.duplicateCount > 0) {
      return `搜索到的 ${stats.totalSearched} 个付费资源都与已有免费内容重复，无需购买。`;
    }
    return '未找到值得推荐的付费资源。';
  }

  // 有推荐的资源
  const highlyRecommended = recommended.filter(
    (r) => r.recommendation === 'highly_recommend'
  );

  if (highlyRecommended.length > 0) {
    const missingTypesText =
      coverage.missingHighPriorityTypes.length > 0
        ? `可以补充 ${coverage.missingHighPriorityTypes.join('、')} 类型的内容。`
        : '';
    return `发现 ${highlyRecommended.length} 个强烈推荐的付费资源，${missingTypesText}`;
  }

  return `筛选后推荐 ${recommended.length} 个付费资源，已过滤 ${stats.duplicateCount} 个与免费内容重复的资源。`;
}

export async function POST(request: NextRequest) {
  try {
    const { celebrity } = (await request.json()) as { celebrity: Celebrity };

    if (!celebrity || !celebrity.id) {
      return NextResponse.json(
        { error: '缺少名人信息' },
        { status: 400 }
      );
    }

    // 1. 获取已爬取的免费内容
    const freeContentsRaw = await prisma.content.findMany({
      where: { celebrityId: celebrity.id },
      orderBy: [{ priority: 'asc' }, { weight: 'desc' }],
    });

    // 转换为 ContentItem 格式
    const freeContents: ContentItem[] = freeContentsRaw.map((c) => ({
      id: c.id,
      source: c.source as ContentItem['source'],
      sourceUrl: c.sourceUrl || undefined,
      type: c.type as ContentItem['type'],
      priority: c.priority,
      weight: c.weight,
      title: c.title || undefined,
      content: c.content,
      summary: c.summary || undefined,
      date: c.date || undefined,
      author: c.author || undefined,
      language: c.language,
      metadata: c.metadata ? JSON.parse(c.metadata) : undefined,
    }));

    // 2. 分析免费内容覆盖情况
    const coverage = analyzeFreeContentCoverage(freeContents);

    // 3. 搜索付费资源
    const paidResources = await searchPaidResources(celebrity);

    // 4. 获取价格比较
    const allComparisons = await batchPriceComparison(paidResources);

    // 5. 应用去重逻辑 - 过滤掉与免费内容重复的资源
    const filterResult = filterPaidResources(
      allComparisons,
      freeContents,
      coverage
    );

    // 6. 为推荐的资源添加免费替代品建议
    const recommendedWithAlternatives = filterResult.recommended.map(
      (comparison) => ({
        ...comparison,
        freeAlternatives: getFreeAlternatives(comparison.resource),
      })
    );

    // 7. 生成统计信息
    const stats = {
      // 免费内容覆盖情况
      freeContent: {
        total: coverage.totalCount,
        byPriority: coverage.byPriority,
        coveredTypes: Array.from(coverage.coveredTypes),
        missingTypes: coverage.missingHighPriorityTypes,
        hasEnoughPrimary: coverage.hasEnoughPrimaryContent,
      },
      // 付费资源筛选结果
      paidResources: {
        totalSearched: filterResult.stats.totalSearched,
        duplicateFiltered: filterResult.stats.duplicateCount,
        lowPrioritySkipped: filterResult.stats.lowPrioritySkipped,
        recommended: filterResult.stats.recommendedCount,
      },
      // 推荐的资源统计
      byType: {} as Record<string, number>,
      byRecommendation: {} as Record<string, number>,
      totalPriceIfBuyAll: recommendedWithAlternatives.reduce(
        (sum, c) => sum + (c.bestPriceChina?.priceInCNY || 0),
        0
      ),
      highlyRecommendedCount: recommendedWithAlternatives.filter(
        (c) => c.recommendation === 'highly_recommend'
      ).length,
    };

    recommendedWithAlternatives.forEach((c) => {
      stats.byType[c.resource.type] =
        (stats.byType[c.resource.type] || 0) + 1;
      stats.byRecommendation[c.recommendation] =
        (stats.byRecommendation[c.recommendation] || 0) + 1;
    });

    // 8. 生成去重报告
    const deduplicationReport = generateDeduplicationReport(
      filterResult,
      coverage
    );

    return NextResponse.json({
      success: true,
      // 只返回推荐购买的资源
      comparisons: recommendedWithAlternatives,
      // 被过滤掉的资源（供用户查看原因）
      filteredResources: filterResult.filtered.map((f) => ({
        title: f.resource.title,
        type: f.resource.type,
        reason: f.reason,
        matchedFreeTitle: f.matchedFreeContent?.title,
      })),
      stats,
      report: deduplicationReport,
      // 提示信息
      message: generateUserMessage(filterResult, coverage),
    });
  } catch (error) {
    console.error('Paid Resources API 错误:', error);
    return NextResponse.json(
      { error: '获取付费资源失败' },
      { status: 500 }
    );
  }
}
