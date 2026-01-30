import { DataSource, ICrawler } from '@/types';
import { WikipediaCrawler } from './wikipedia';
import { TwitterCrawler } from './twitter';
import { TwitterPublicCrawler } from './twitter-public';
import { YouTubeCrawler } from './youtube';
import { YouTubePublicCrawler } from './youtube-public';
import { NewsCrawler } from './news';
import { BookCrawler } from './book';

// API 爬虫注册表（需要 API Key）
const apiCrawlerRegistry: Record<DataSource, new () => ICrawler> = {
  wikipedia: WikipediaCrawler,
  twitter: TwitterCrawler,
  youtube: YouTubeCrawler,
  news: NewsCrawler,
  book: BookCrawler,
  podcast: NewsCrawler, // 暂时使用 NewsCrawler 作为占位
  blog: NewsCrawler, // 暂时使用 NewsCrawler 作为占位
};

// 公开爬虫注册表（无需 API Key）
const publicCrawlerRegistry: Partial<Record<DataSource, new () => ICrawler>> = {
  wikipedia: WikipediaCrawler,
  twitter: TwitterPublicCrawler,
  youtube: YouTubePublicCrawler,
  news: NewsCrawler, // NewsCrawler 已支持无 Key 模式
  book: BookCrawler,
};

/**
 * 获取爬虫实例
 * @param source 数据源类型
 * @param hasApiKey 是否有 API Key，决定使用 API 爬虫还是公开爬虫
 */
export function getCrawler(source: DataSource, hasApiKey: boolean = false): ICrawler {
  // 如果有 API Key，优先使用 API 爬虫
  if (hasApiKey) {
    const CrawlerClass = apiCrawlerRegistry[source];
    if (CrawlerClass) {
      return new CrawlerClass();
    }
  }

  // 否则使用公开爬虫
  const PublicCrawlerClass = publicCrawlerRegistry[source];
  if (PublicCrawlerClass) {
    return new PublicCrawlerClass();
  }

  // 回退到 API 爬虫
  const FallbackClass = apiCrawlerRegistry[source];
  if (!FallbackClass) {
    throw new Error(`不支持的数据源: ${source}`);
  }
  return new FallbackClass();
}

// 获取所有支持的数据源
export function getSupportedSources(): DataSource[] {
  return Object.keys(apiCrawlerRegistry) as DataSource[];
}

// 检查数据源是否支持公开爬取（无需 API Key）
export function supportsPublicCrawling(source: DataSource): boolean {
  return source in publicCrawlerRegistry;
}

// 检查数据源是否需要 API Key（现在大多数都不需要了）
export function requiresApiKey(source: DataSource): boolean {
  // 只有 podcast 目前还需要 API Key
  const sourcesRequiringKey: DataSource[] = ['podcast'];
  return sourcesRequiringKey.includes(source);
}

export {
  WikipediaCrawler,
  TwitterCrawler,
  TwitterPublicCrawler,
  YouTubeCrawler,
  YouTubePublicCrawler,
  NewsCrawler,
  BookCrawler,
};
