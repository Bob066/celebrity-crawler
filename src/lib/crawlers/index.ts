import { DataSource, ICrawler } from '@/types';
import { WikipediaCrawler } from './wikipedia';
import { TwitterCrawler } from './twitter';
import { YouTubeCrawler } from './youtube';
import { NewsCrawler } from './news';
import { BookCrawler } from './book';

// 爬虫注册表
const crawlerRegistry: Record<DataSource, new () => ICrawler> = {
  wikipedia: WikipediaCrawler,
  twitter: TwitterCrawler,
  youtube: YouTubeCrawler,
  news: NewsCrawler,
  book: BookCrawler,
  podcast: NewsCrawler, // 暂时使用 NewsCrawler 作为占位
  blog: NewsCrawler, // 暂时使用 NewsCrawler 作为占位
};

// 获取爬虫实例
export function getCrawler(source: DataSource): ICrawler {
  const CrawlerClass = crawlerRegistry[source];
  if (!CrawlerClass) {
    throw new Error(`不支持的数据源: ${source}`);
  }
  return new CrawlerClass();
}

// 获取所有支持的数据源
export function getSupportedSources(): DataSource[] {
  return Object.keys(crawlerRegistry) as DataSource[];
}

// 检查数据源是否需要 API Key
export function requiresApiKey(source: DataSource): boolean {
  const sourcesRequiringKey: DataSource[] = ['twitter', 'youtube'];
  return sourcesRequiringKey.includes(source);
}

export { WikipediaCrawler, TwitterCrawler, YouTubeCrawler, NewsCrawler, BookCrawler };
