/**
 * 内容去重工具
 * 用于比较付费资源和免费已爬取内容，避免重复推荐购买
 */

import { ContentItem } from '@/types';
import { PaidResource, PriceComparison } from '@/types/paid-sources';

// 相似度阈值
const TITLE_SIMILARITY_THRESHOLD = 0.7;
const CONTENT_SIMILARITY_THRESHOLD = 0.6;

/**
 * 计算两个字符串的相似度 (Jaccard 相似度)
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;

  // 标准化字符串
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, '') // 保留中英文和数字
      .split(/\s+/)
      .filter((w) => w.length > 1);

  const words1 = new Set(normalize(str1));
  const words2 = new Set(normalize(str2));

  if (words1.size === 0 || words2.size === 0) return 0;

  // 计算交集
  let intersection = 0;
  words1.forEach((word) => {
    if (words2.has(word)) intersection++;
  });

  // Jaccard 相似度
  const union = words1.size + words2.size - intersection;
  return intersection / union;
}

/**
 * 计算两个标题的相似度（考虑中英文标题）
 */
function calculateTitleSimilarity(
  paidTitle: string,
  paidTitleZh: string | undefined,
  freeTitle: string
): number {
  const similarities: number[] = [];

  // 比较英文标题
  if (paidTitle && freeTitle) {
    similarities.push(calculateSimilarity(paidTitle, freeTitle));
  }

  // 比较中文标题
  if (paidTitleZh && freeTitle) {
    similarities.push(calculateSimilarity(paidTitleZh, freeTitle));
  }

  // 返回最高相似度
  return Math.max(...similarities, 0);
}

/**
 * 检查付费资源是否与已有免费内容重复
 */
export function isDuplicateContent(
  paidResource: PaidResource,
  freeContents: ContentItem[]
): {
  isDuplicate: boolean;
  matchedContent: ContentItem | null;
  similarityScore: number;
  matchReason: string;
} {
  let bestMatch: ContentItem | null = null;
  let highestSimilarity = 0;
  let matchReason = '';

  for (const content of freeContents) {
    // 1. 检查标题相似度
    const titleSimilarity = calculateTitleSimilarity(
      paidResource.title,
      paidResource.titleZh,
      content.title || ''
    );

    if (titleSimilarity > highestSimilarity) {
      highestSimilarity = titleSimilarity;
      bestMatch = content;
      matchReason = `标题相似度: ${(titleSimilarity * 100).toFixed(0)}%`;
    }

    // 2. 检查内容相似度（如果有预览内容）
    if (paidResource.preview && content.content) {
      const contentSimilarity = calculateSimilarity(
        paidResource.preview,
        content.content
      );

      if (contentSimilarity > highestSimilarity) {
        highestSimilarity = contentSimilarity;
        bestMatch = content;
        matchReason = `内容相似度: ${(contentSimilarity * 100).toFixed(0)}%`;
      }
    }

    // 3. 检查作者匹配（如果是同一作者的同类作品）
    if (
      paidResource.author &&
      content.author &&
      paidResource.author.toLowerCase() === content.author.toLowerCase()
    ) {
      // 同一作者，降低相似度阈值
      if (titleSimilarity > 0.5) {
        highestSimilarity = Math.max(highestSimilarity, titleSimilarity + 0.2);
        matchReason = `同一作者的相似作品`;
      }
    }
  }

  // 判断是否为重复内容
  const isDuplicate = highestSimilarity >= TITLE_SIMILARITY_THRESHOLD;

  return {
    isDuplicate,
    matchedContent: bestMatch,
    similarityScore: highestSimilarity,
    matchReason: isDuplicate ? matchReason : '',
  };
}

/**
 * 分析免费内容的覆盖情况
 */
export interface CoverageAnalysis {
  // 已覆盖的内容类型
  coveredTypes: Set<string>;
  // 各优先级的内容数量
  byPriority: Record<number, number>;
  // 缺失的高优先级内容类型
  missingHighPriorityTypes: string[];
  // 总内容数量
  totalCount: number;
  // 是否有足够的一手资料（P1/P2）
  hasEnoughPrimaryContent: boolean;
}

/**
 * 分析已爬取免费内容的覆盖情况
 */
export function analyzeFreeContentCoverage(
  freeContents: ContentItem[]
): CoverageAnalysis {
  const coveredTypes = new Set<string>();
  const byPriority: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  freeContents.forEach((content) => {
    coveredTypes.add(content.type);
    byPriority[content.priority] = (byPriority[content.priority] || 0) + 1;
  });

  // 高优先级内容类型（P1/P2）
  const highPriorityTypes = [
    'tweet', // 社交媒体
    'interview', // 采访
    'speech', // 演讲
    'biography', // 传记
    'book', // 书籍
    'podcast', // 播客
  ];

  // 检查缺失的高优先级类型
  const missingHighPriorityTypes = highPriorityTypes.filter(
    (type) => !coveredTypes.has(type)
  );

  // 判断是否有足够的一手资料
  const primaryContentCount = byPriority[1] + byPriority[2];
  const hasEnoughPrimaryContent = primaryContentCount >= 10;

  return {
    coveredTypes,
    byPriority,
    missingHighPriorityTypes,
    totalCount: freeContents.length,
    hasEnoughPrimaryContent,
  };
}

/**
 * 付费资源过滤结果
 */
export interface FilteredPaidResources {
  // 推荐购买的资源（去重后且有价值）
  recommended: PriceComparison[];
  // 被过滤掉的资源（与免费内容重复）
  filtered: {
    resource: PaidResource;
    reason: string;
    matchedFreeContent?: ContentItem;
  }[];
  // 统计信息
  stats: {
    totalSearched: number;
    duplicateCount: number;
    lowPrioritySkipped: number;
    recommendedCount: number;
  };
}

/**
 * 过滤付费资源 - 核心去重逻辑
 *
 * 规则：
 * 1. 如果付费资源与免费内容重复，不推荐购买
 * 2. 只有当免费资源确实缺失，且该内容优先级高（P1/P2）时才推荐购买
 * 3. 如果已有足够的一手资料，降低推荐力度
 */
export function filterPaidResources(
  paidComparisons: PriceComparison[],
  freeContents: ContentItem[],
  coverage: CoverageAnalysis
): FilteredPaidResources {
  const recommended: PriceComparison[] = [];
  const filtered: FilteredPaidResources['filtered'] = [];

  let duplicateCount = 0;
  let lowPrioritySkipped = 0;

  for (const comparison of paidComparisons) {
    const resource = comparison.resource;

    // 1. 检查是否与免费内容重复
    const dupeCheck = isDuplicateContent(resource, freeContents);

    if (dupeCheck.isDuplicate) {
      duplicateCount++;
      filtered.push({
        resource,
        reason: `与免费内容重复: ${dupeCheck.matchReason}`,
        matchedFreeContent: dupeCheck.matchedContent || undefined,
      });
      continue;
    }

    // 2. 检查优先级 - 只推荐高优先级内容（P1/P2）
    if (resource.priority > 2) {
      // 如果已有足够一手资料，跳过低优先级付费内容
      if (coverage.hasEnoughPrimaryContent) {
        lowPrioritySkipped++;
        filtered.push({
          resource,
          reason: `已有足够一手资料，跳过优先级 P${resource.priority} 的付费内容`,
        });
        continue;
      }

      // 如果是 P3/P4/P5，只在相关度很高时才推荐
      if (resource.relevanceScore < 0.8) {
        lowPrioritySkipped++;
        filtered.push({
          resource,
          reason: `优先级 P${resource.priority} 且相关度不够高 (${(resource.relevanceScore * 100).toFixed(0)}%)`,
        });
        continue;
      }
    }

    // 3. 检查是否填补了内容缺口
    const resourceType = mapPaidTypeToContentType(resource.type);
    const fillsGap = coverage.missingHighPriorityTypes.includes(resourceType);

    // 4. 调整推荐等级
    let adjustedComparison = { ...comparison };

    if (fillsGap && resource.priority <= 2) {
      // 填补高优先级内容缺口，提升推荐等级
      if (comparison.recommendation === 'recommend') {
        adjustedComparison.recommendation = 'highly_recommend';
        adjustedComparison.recommendationReason =
          `填补 ${resourceType} 类型内容缺口，` + comparison.recommendationReason;
      }
    } else if (coverage.hasEnoughPrimaryContent && resource.priority > 2) {
      // 已有足够内容，降低推荐等级
      if (comparison.recommendation === 'highly_recommend') {
        adjustedComparison.recommendation = 'recommend';
        adjustedComparison.recommendationReason =
          '已有较多一手资料，可作为补充';
      } else if (comparison.recommendation === 'recommend') {
        adjustedComparison.recommendation = 'optional';
        adjustedComparison.recommendationReason =
          '已有较多一手资料，非必需';
      }
    }

    recommended.push(adjustedComparison);
  }

  return {
    recommended,
    filtered,
    stats: {
      totalSearched: paidComparisons.length,
      duplicateCount,
      lowPrioritySkipped,
      recommendedCount: recommended.length,
    },
  };
}

/**
 * 将付费资源类型映射到内容类型
 */
function mapPaidTypeToContentType(paidType: string): string {
  const mapping: Record<string, string> = {
    ebook: 'book',
    audiobook: 'book',
    paper: 'paper',
    interview: 'interview',
    course: 'course',
    database: 'database',
    news_archive: 'news',
    biography_full: 'biography',
  };

  return mapping[paidType] || paidType;
}

/**
 * 生成去重报告
 */
export function generateDeduplicationReport(
  result: FilteredPaidResources,
  coverage: CoverageAnalysis
): string {
  const lines: string[] = [
    '## 付费资源分析报告',
    '',
    '### 免费内容覆盖情况',
    `- 总内容数: ${coverage.totalCount}`,
    `- 一手资料 (P1+P2): ${coverage.byPriority[1] + coverage.byPriority[2]} 条`,
    `- 覆盖类型: ${Array.from(coverage.coveredTypes).join(', ') || '无'}`,
    `- 缺失高优先级类型: ${coverage.missingHighPriorityTypes.join(', ') || '无'}`,
    '',
    '### 付费资源筛选结果',
    `- 共搜索: ${result.stats.totalSearched} 个付费资源`,
    `- 与免费内容重复: ${result.stats.duplicateCount} 个`,
    `- 因优先级跳过: ${result.stats.lowPrioritySkipped} 个`,
    `- 推荐购买: ${result.stats.recommendedCount} 个`,
    '',
  ];

  if (result.filtered.length > 0) {
    lines.push('### 被过滤的资源');
    result.filtered.slice(0, 5).forEach((f, i) => {
      lines.push(`${i + 1}. **${f.resource.title}** - ${f.reason}`);
    });
    if (result.filtered.length > 5) {
      lines.push(`... 还有 ${result.filtered.length - 5} 个`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
