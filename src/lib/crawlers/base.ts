import { Celebrity, ContentItem, CrawlerConfig, DataSource, ICrawler } from '@/types';

export abstract class BaseCrawler implements ICrawler {
  abstract source: DataSource;

  abstract crawl(
    celebrity: Celebrity,
    config?: CrawlerConfig
  ): AsyncGenerator<ContentItem>;

  abstract validateConfig(config: CrawlerConfig): boolean;

  // 辅助方法：创建内容条目
  protected createContentItem(
    data: Partial<ContentItem> & { content: string }
  ): ContentItem {
    return {
      source: this.source,
      type: 'other',
      priority: 4,
      weight: 0.5,
      language: 'en',
      ...data,
    };
  }

  // 辅助方法：延迟（避免请求过快）
  protected async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // 辅助方法：重试机制
  protected async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries - 1) {
          await this.delay(delayMs * (i + 1));
        }
      }
    }

    throw lastError;
  }
}
