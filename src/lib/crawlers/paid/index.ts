import { Celebrity } from '@/types';
import {
  PaidResource,
  PriceComparison,
  PriceInfo,
  PaidSourceType,
} from '@/types/paid-sources';
import { EbookPaidCrawler } from './ebook-crawler';
import { AudiobookPaidCrawler } from './audiobook-crawler';
import { CoursePaidCrawler } from './course-crawler';
import { BasePaidCrawler } from './base-paid';

// 所有付费爬虫
const paidCrawlers: BasePaidCrawler[] = [
  new EbookPaidCrawler(),
  new AudiobookPaidCrawler(),
  new CoursePaidCrawler(),
];

// 搜索所有付费资源
export async function searchPaidResources(
  celebrity: Celebrity
): Promise<PaidResource[]> {
  const allResources: PaidResource[] = [];

  for (const crawler of paidCrawlers) {
    try {
      const resources = await crawler.search(celebrity);
      allResources.push(...resources);
    } catch (error) {
      console.error(`${crawler.sourceType} 搜索失败:`, error);
    }
  }

  // 按相关性排序
  return allResources.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// 获取资源的价格比较
export async function getPriceComparison(
  resource: PaidResource
): Promise<PriceComparison> {
  const crawler = paidCrawlers.find((c) => c.sourceType === resource.type);

  let allPrices: PriceInfo[] = resource.prices || [];

  if (crawler && allPrices.length === 0) {
    allPrices = await crawler.comparePrices(resource);
  }

  // 按价格排序
  allPrices.sort((a, b) => a.priceInCNY - b.priceInCNY);

  // 找到全球最低价
  const bestPrice =
    allPrices.find((p) => p.available) || null;

  // 找到中国大陆最优价
  const bestPriceChina =
    allPrices.find(
      (p) =>
        p.available &&
        p.chinaAccessible &&
        p.supportedPayments.some((pm) =>
          ['alipay', 'wechat', 'unionpay'].includes(pm)
        )
    ) || allPrices.find((p) => p.available && p.chinaAccessible) || null;

  // 生成推荐
  const recommendation = generateRecommendation(resource, bestPriceChina);

  return {
    resource,
    bestPrice,
    bestPriceChina,
    allPrices,
    recommendation: recommendation.level,
    recommendationReason: recommendation.reason,
  };
}

// 批量获取价格比较
export async function batchPriceComparison(
  resources: PaidResource[]
): Promise<PriceComparison[]> {
  const comparisons: PriceComparison[] = [];

  for (const resource of resources) {
    try {
      const comparison = await getPriceComparison(resource);
      comparisons.push(comparison);
    } catch (error) {
      console.error(`价格比较失败 (${resource.title}):`, error);
    }
  }

  // 按推荐度和价格排序
  return comparisons.sort((a, b) => {
    const recommendOrder = {
      highly_recommend: 0,
      recommend: 1,
      optional: 2,
      skip: 3,
    };

    const orderDiff =
      recommendOrder[a.recommendation] - recommendOrder[b.recommendation];
    if (orderDiff !== 0) return orderDiff;

    // 相同推荐等级按价格排序
    const priceA = a.bestPriceChina?.priceInCNY || Infinity;
    const priceB = b.bestPriceChina?.priceInCNY || Infinity;
    return priceA - priceB;
  });
}

// 生成购买推荐
function generateRecommendation(
  resource: PaidResource,
  bestPriceChina: PriceInfo | null
): { level: PriceComparison['recommendation']; reason: string } {
  // 高相关性 + 高质量 + 本人作品
  if (
    resource.relevanceScore >= 0.8 &&
    resource.contentQuality >= 0.7 &&
    resource.priority <= 2
  ) {
    if (bestPriceChina && bestPriceChina.priceInCNY <= 100) {
      return {
        level: 'highly_recommend',
        reason: '高相关性本人作品，价格合理，强烈推荐购买',
      };
    }
    return {
      level: 'highly_recommend',
      reason: '高相关性本人作品，对于理解其思想非常重要',
    };
  }

  // 高相关性
  if (resource.relevanceScore >= 0.6 && resource.contentQuality >= 0.5) {
    if (bestPriceChina && bestPriceChina.priceInCNY <= 50) {
      return {
        level: 'recommend',
        reason: '相关性较高，价格实惠，推荐购买',
      };
    }
    return {
      level: 'recommend',
      reason: '相关性较高，内容有价值',
    };
  }

  // 中等相关性
  if (resource.relevanceScore >= 0.4) {
    return {
      level: 'optional',
      reason: '相关性一般，可作为补充资料',
    };
  }

  // 低相关性
  return {
    level: 'skip',
    reason: '相关性较低，建议跳过',
  };
}

// 获取免费替代资源
export function getFreeAlternatives(
  paidResource: PaidResource
): { source: string; description: string; url: string }[] {
  const alternatives: { source: string; description: string; url: string }[] =
    [];

  // 根据资源类型推荐免费替代
  switch (paidResource.type) {
    case 'ebook':
      alternatives.push(
        {
          source: 'Open Library',
          description: '尝试在 Open Library 查找免费版本',
          url: `https://openlibrary.org/search?q=${encodeURIComponent(
            paidResource.title
          )}`,
        },
        {
          source: 'Project Gutenberg',
          description: '公共领域书籍（适用于较老的作品）',
          url: `https://www.gutenberg.org/ebooks/search/?query=${encodeURIComponent(
            paidResource.title
          )}`,
        },
        {
          source: 'Internet Archive',
          description: '互联网档案馆免费借阅',
          url: `https://archive.org/search.php?query=${encodeURIComponent(
            paidResource.title
          )}`,
        }
      );
      break;

    case 'audiobook':
      alternatives.push(
        {
          source: 'LibriVox',
          description: '志愿者朗读的公共领域有声书',
          url: `https://librivox.org/search?q=${encodeURIComponent(
            paidResource.title
          )}`,
        },
        {
          source: 'YouTube',
          description: '搜索 YouTube 上的有声书',
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(
            paidResource.title + ' audiobook'
          )}`,
        }
      );
      break;

    case 'course':
      alternatives.push(
        {
          source: 'YouTube',
          description: '搜索相关的免费教程视频',
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(
            paidResource.title
          )}`,
        },
        {
          source: 'MIT OpenCourseWare',
          description: 'MIT 开放课程',
          url: `https://ocw.mit.edu/search/?q=${encodeURIComponent(
            paidResource.title
          )}`,
        },
        {
          source: 'Khan Academy',
          description: '可汗学院免费课程',
          url: `https://www.khanacademy.org/search?search_again=1&page_search_query=${encodeURIComponent(
            paidResource.title
          )}`,
        }
      );
      break;
  }

  return alternatives;
}

export {
  EbookPaidCrawler,
  AudiobookPaidCrawler,
  CoursePaidCrawler,
  BasePaidCrawler,
};
