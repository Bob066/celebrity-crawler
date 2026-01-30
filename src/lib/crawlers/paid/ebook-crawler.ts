import axios from 'axios';
import * as cheerio from 'cheerio';
import { Celebrity } from '@/types';
import {
  PaidResource,
  PriceInfo,
  Platform,
  PLATFORMS,
} from '@/types/paid-sources';
import { BasePaidCrawler } from './base-paid';

export class EbookPaidCrawler extends BasePaidCrawler {
  sourceType = 'ebook' as const;

  platforms: Platform[] = [
    PLATFORMS.amazon_cn,
    PLATFORMS.amazon_com,
    PLATFORMS.weread,
    PLATFORMS.douban_read,
    PLATFORMS.jd_read,
    PLATFORMS.dangdang,
    PLATFORMS.google_play_books,
    PLATFORMS.scribd,
  ];

  async search(celebrity: Celebrity): Promise<PaidResource[]> {
    const resources: PaidResource[] = [];
    const searchTerms = [
      celebrity.name,
      ...celebrity.aliases.slice(0, 2),
    ];

    // 搜索各平台
    for (const term of searchTerms) {
      // 搜索 Google Books（获取基础书籍信息）
      const books = await this.searchGoogleBooks(term);

      for (const book of books) {
        // 检查是否已添加（避免重复）
        if (resources.some((r) => r.title === book.title)) continue;

        // 评估相关性
        const relevance = this.assessRelevance(book, celebrity);
        if (relevance < 0.3) continue;

        const resource = this.createResource({
          title: book.title,
          titleZh: book.titleZh,
          description: book.description,
          author: book.author,
          publishDate: book.publishDate,
          preview: book.preview,
          previewUrl: book.previewUrl,
          relevanceScore: relevance,
          contentQuality: this.assessQuality(book),
          priority: this.assessPriority(book, celebrity),
          weight: this.assessWeight(book, celebrity),
          metadata: {
            isbn: book.isbn,
            pageCount: book.pageCount,
            categories: book.categories,
          },
        });

        resources.push(resource);
      }

      await this.delay(500);
    }

    return resources;
  }

  async getPriceFromPlatform(
    resource: PaidResource,
    platform: Platform
  ): Promise<PriceInfo | null> {
    try {
      switch (platform.id) {
        case 'amazon_cn':
          return await this.getAmazonCNPrice(resource);
        case 'amazon_com':
          return await this.getAmazonUSPrice(resource);
        case 'weread':
          return await this.getWereadPrice(resource);
        case 'douban_read':
          return await this.getDoubanPrice(resource);
        case 'jd_read':
          return await this.getJDPrice(resource);
        default:
          return null;
      }
    } catch (error) {
      console.error(`获取 ${platform.name} 价格失败:`, error);
      return null;
    }
  }

  private async searchGoogleBooks(query: string): Promise<BookInfo[]> {
    try {
      const response = await axios.get(
        'https://www.googleapis.com/books/v1/volumes',
        {
          params: {
            q: query,
            maxResults: 20,
            printType: 'books',
            orderBy: 'relevance',
          },
        }
      );

      return (response.data.items || []).map(
        (item: {
          id: string;
          volumeInfo: {
            title: string;
            authors?: string[];
            description?: string;
            publishedDate?: string;
            industryIdentifiers?: { type: string; identifier: string }[];
            pageCount?: number;
            categories?: string[];
            previewLink?: string;
          };
          saleInfo?: {
            listPrice?: { amount: number; currencyCode: string };
            retailPrice?: { amount: number; currencyCode: string };
          };
        }) => ({
          id: item.id,
          title: item.volumeInfo.title,
          author: item.volumeInfo.authors?.join(', '),
          description: item.volumeInfo.description,
          publishDate: item.volumeInfo.publishedDate
            ? new Date(item.volumeInfo.publishedDate)
            : undefined,
          isbn: item.volumeInfo.industryIdentifiers?.find(
            (i) => i.type === 'ISBN_13'
          )?.identifier,
          pageCount: item.volumeInfo.pageCount,
          categories: item.volumeInfo.categories,
          previewUrl: item.volumeInfo.previewLink,
          preview: item.volumeInfo.description?.substring(0, 500),
          price: item.saleInfo?.retailPrice?.amount,
          currency: item.saleInfo?.retailPrice?.currencyCode,
        })
      );
    } catch (error) {
      console.error('Google Books 搜索失败:', error);
      return [];
    }
  }

  private async getAmazonCNPrice(
    resource: PaidResource
  ): Promise<PriceInfo | null> {
    // 搜索亚马逊中国 Kindle 商店
    try {
      const searchUrl = `https://www.amazon.cn/s?k=${encodeURIComponent(
        resource.title
      )}&i=digital-text`;

      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const $ = cheerio.load(response.data);

      // 查找第一个结果的价格
      const priceElement = $('.a-price-whole').first();
      const price = parseFloat(priceElement.text().replace(/[^\d.]/g, ''));

      if (price && price > 0) {
        const productLink = $('a.a-link-normal.s-no-outline').first().attr('href');

        return this.createPriceInfo(PLATFORMS.amazon_cn, {
          price,
          url: productLink
            ? `https://www.amazon.cn${productLink}`
            : searchUrl,
          format: 'Kindle',
        });
      }
    } catch (error) {
      console.error('Amazon CN 价格获取失败:', error);
    }

    return null;
  }

  private async getAmazonUSPrice(
    resource: PaidResource
  ): Promise<PriceInfo | null> {
    try {
      const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(
        resource.title
      )}&i=digital-text`;

      // 注意：实际实现需要处理反爬措施
      // 这里返回模拟数据结构
      return this.createPriceInfo(PLATFORMS.amazon_com, {
        price: 9.99, // 模拟价格
        url: searchUrl,
        format: 'Kindle',
        available: true,
      });
    } catch (error) {
      console.error('Amazon US 价格获取失败:', error);
    }

    return null;
  }

  private async getWereadPrice(
    resource: PaidResource
  ): Promise<PriceInfo | null> {
    try {
      const searchUrl = `https://weread.qq.com/web/search/global?keyword=${encodeURIComponent(
        resource.title
      )}`;

      // 微信读书 API
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const data = response.data;
      if (data.books && data.books.length > 0) {
        const book = data.books[0];
        const price = book.price ? book.price / 100 : 0; // 微信读书价格单位是分

        if (price > 0) {
          return this.createPriceInfo(PLATFORMS.weread, {
            price,
            url: `https://weread.qq.com/web/reader/${book.bookId}`,
            format: 'WeRead',
          });
        }

        // 如果是免费书籍
        if (book.free) {
          return this.createPriceInfo(PLATFORMS.weread, {
            price: 0,
            url: `https://weread.qq.com/web/reader/${book.bookId}`,
            format: 'WeRead',
          });
        }
      }
    } catch (error) {
      console.error('微信读书价格获取失败:', error);
    }

    return null;
  }

  private async getDoubanPrice(
    resource: PaidResource
  ): Promise<PriceInfo | null> {
    try {
      const searchUrl = `https://read.douban.com/search?q=${encodeURIComponent(
        resource.title
      )}`;

      // 豆瓣阅读搜索
      // 注意：豆瓣有反爬措施，实际使用可能需要更多处理
      return this.createPriceInfo(PLATFORMS.douban_read, {
        price: 0, // 需要实际爬取
        url: searchUrl,
        format: 'DoubanRead',
        available: true,
      });
    } catch (error) {
      console.error('豆瓣阅读价格获取失败:', error);
    }

    return null;
  }

  private async getJDPrice(
    resource: PaidResource
  ): Promise<PriceInfo | null> {
    try {
      const searchUrl = `https://e.jd.com/Search?keyword=${encodeURIComponent(
        resource.title
      )}`;

      return this.createPriceInfo(PLATFORMS.jd_read, {
        price: 0, // 需要实际爬取
        url: searchUrl,
        format: 'JDRead',
        available: true,
      });
    } catch (error) {
      console.error('京东读书价格获取失败:', error);
    }

    return null;
  }

  // 评估相关性
  private assessRelevance(book: BookInfo, celebrity: Celebrity): number {
    let score = 0;

    const titleLower = book.title.toLowerCase();
    const celebrityNames = [
      celebrity.name.toLowerCase(),
      ...celebrity.aliases.map((a) => a.toLowerCase()),
    ];

    // 标题包含名人名字
    if (celebrityNames.some((name) => titleLower.includes(name))) {
      score += 0.4;
    }

    // 作者是名人本人
    if (book.author) {
      const authorLower = book.author.toLowerCase();
      if (celebrityNames.some((name) => authorLower.includes(name))) {
        score += 0.4;
      }
    }

    // 描述中提到名人
    if (book.description) {
      const descLower = book.description.toLowerCase();
      if (celebrityNames.some((name) => descLower.includes(name))) {
        score += 0.2;
      }
    }

    // 类别相关性
    if (book.categories?.some((c) => c.toLowerCase().includes('biography'))) {
      score += 0.1;
    }

    return Math.min(1, score);
  }

  // 评估质量
  private assessQuality(book: BookInfo): number {
    let score = 0.5;

    // 有完整描述
    if (book.description && book.description.length > 200) {
      score += 0.2;
    }

    // 页数合理
    if (book.pageCount && book.pageCount > 100) {
      score += 0.1;
    }

    // 有 ISBN
    if (book.isbn) {
      score += 0.1;
    }

    return Math.min(1, score);
  }

  // 评估优先级
  private assessPriority(book: BookInfo, celebrity: Celebrity): number {
    const celebrityNames = [
      celebrity.name.toLowerCase(),
      ...celebrity.aliases.map((a) => a.toLowerCase()),
    ];

    // 如果是本人著作，优先级最高
    if (book.author) {
      const authorLower = book.author.toLowerCase();
      if (celebrityNames.some((name) => authorLower.includes(name))) {
        return 2; // P2 - 本人作品
      }
    }

    // 传记
    const titleLower = book.title.toLowerCase();
    if (
      titleLower.includes('biography') ||
      titleLower.includes('传记') ||
      titleLower.includes('life')
    ) {
      return 3; // P3 - 权威第三方
    }

    return 4; // P4 - 一般资料
  }

  // 评估权重
  private assessWeight(book: BookInfo, celebrity: Celebrity): number {
    const priority = this.assessPriority(book, celebrity);

    switch (priority) {
      case 2:
        return 0.8;
      case 3:
        return 0.6;
      default:
        return 0.5;
    }
  }
}

interface BookInfo {
  id: string;
  title: string;
  titleZh?: string;
  author?: string;
  description?: string;
  publishDate?: Date;
  isbn?: string;
  pageCount?: number;
  categories?: string[];
  previewUrl?: string;
  preview?: string;
  price?: number;
  currency?: string;
}
