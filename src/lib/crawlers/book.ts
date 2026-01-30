import axios from 'axios';
import { Celebrity, ContentItem, CrawlerConfig, DataSource } from '@/types';
import { BaseCrawler } from './base';

interface BookInfo {
  id: string;
  title: string;
  authors: string[];
  description?: string;
  publishedDate?: string;
  previewLink?: string;
  infoLink?: string;
  categories?: string[];
  pageCount?: number;
}

export class BookCrawler extends BaseCrawler {
  source: DataSource = 'book';

  private googleBooksUrl = 'https://www.googleapis.com/books/v1/volumes';
  private openLibraryUrl = 'https://openlibrary.org';

  validateConfig(): boolean {
    // Google Books API 和 Open Library 都是免费的
    return true;
  }

  async *crawl(
    celebrity: Celebrity,
    config?: CrawlerConfig
  ): AsyncGenerator<ContentItem> {
    const maxItems = config?.maxItems || 20;
    let totalFetched = 0;
    const processedIds = new Set<string>();

    // 搜索关键词
    const searchTerms = [
      `${celebrity.name} biography`,
      `${celebrity.name} autobiography`,
      `"${celebrity.name}"`,
      `by ${celebrity.name}`,
    ];

    for (const term of searchTerms) {
      if (totalFetched >= maxItems) break;

      try {
        // 使用 Google Books API
        const books = await this.searchGoogleBooks(term);

        for (const book of books) {
          if (processedIds.has(book.id)) continue;
          if (totalFetched >= maxItems) break;

          processedIds.add(book.id);

          // 判断是否是名人本人写的书
          const isSelfAuthored = this.isSelfAuthored(book, celebrity);
          const isBiography = this.isBiography(book);

          let priority: number;
          let weight: number;

          if (isSelfAuthored) {
            priority = 2;
            weight = 0.8;
          } else if (isBiography) {
            priority = 3;
            weight = 0.6;
          } else {
            priority = 4;
            weight = 0.5;
          }

          yield this.createContentItem({
            type: isSelfAuthored
              ? 'autobiography'
              : isBiography
              ? 'biography'
              : 'article',
            priority,
            weight,
            title: book.title,
            content: book.description || `书籍: ${book.title}`,
            sourceUrl: book.infoLink || book.previewLink,
            date: book.publishedDate
              ? new Date(book.publishedDate)
              : undefined,
            author: book.authors?.join(', '),
            metadata: {
              bookId: book.id,
              authors: book.authors,
              categories: book.categories,
              pageCount: book.pageCount,
              isSelfAuthored,
              isBiography,
            },
          });

          totalFetched++;
        }
      } catch (error) {
        console.error(`书籍搜索失败 (${term}):`, error);
      }

      await this.delay(300);
    }

    // 如果结果不够，也搜索 Open Library
    if (totalFetched < maxItems) {
      try {
        const olBooks = await this.searchOpenLibrary(celebrity.name);

        for (const book of olBooks) {
          if (processedIds.has(book.id)) continue;
          if (totalFetched >= maxItems) break;

          processedIds.add(book.id);

          yield this.createContentItem({
            type: 'biography',
            priority: 3,
            weight: 0.6,
            title: book.title,
            content: book.description || `书籍: ${book.title}`,
            sourceUrl: book.infoLink,
            author: book.authors?.join(', '),
            metadata: {
              source: 'OpenLibrary',
              bookId: book.id,
              authors: book.authors,
            },
          });

          totalFetched++;
        }
      } catch (error) {
        console.error('Open Library 搜索失败:', error);
      }
    }
  }

  private async searchGoogleBooks(query: string): Promise<BookInfo[]> {
    try {
      const response = await axios.get(this.googleBooksUrl, {
        params: {
          q: query,
          maxResults: 10,
          printType: 'books',
          langRestrict: 'en',
        },
      });

      return (response.data.items || []).map(
        (item: {
          id: string;
          volumeInfo: {
            title: string;
            authors?: string[];
            description?: string;
            publishedDate?: string;
            previewLink?: string;
            infoLink?: string;
            categories?: string[];
            pageCount?: number;
          };
        }) => ({
          id: item.id,
          title: item.volumeInfo.title,
          authors: item.volumeInfo.authors || [],
          description: item.volumeInfo.description,
          publishedDate: item.volumeInfo.publishedDate,
          previewLink: item.volumeInfo.previewLink,
          infoLink: item.volumeInfo.infoLink,
          categories: item.volumeInfo.categories,
          pageCount: item.volumeInfo.pageCount,
        })
      );
    } catch (error) {
      console.error('Google Books API 错误:', error);
      return [];
    }
  }

  private async searchOpenLibrary(query: string): Promise<BookInfo[]> {
    try {
      const response = await axios.get(
        `${this.openLibraryUrl}/search.json`,
        {
          params: {
            q: query,
            limit: 10,
          },
        }
      );

      return (response.data.docs || []).map(
        (doc: {
          key: string;
          title: string;
          author_name?: string[];
          first_sentence?: string[];
          first_publish_year?: number;
        }) => ({
          id: doc.key,
          title: doc.title,
          authors: doc.author_name || [],
          description: doc.first_sentence?.[0],
          publishedDate: doc.first_publish_year?.toString(),
          infoLink: `${this.openLibraryUrl}${doc.key}`,
        })
      );
    } catch (error) {
      console.error('Open Library API 错误:', error);
      return [];
    }
  }

  private isSelfAuthored(book: BookInfo, celebrity: Celebrity): boolean {
    if (!book.authors || book.authors.length === 0) return false;

    const celebrityNames = [
      celebrity.name.toLowerCase(),
      ...celebrity.aliases.map((a) => a.toLowerCase()),
    ];

    return book.authors.some((author) =>
      celebrityNames.some(
        (name) =>
          author.toLowerCase().includes(name) ||
          name.includes(author.toLowerCase())
      )
    );
  }

  private isBiography(book: BookInfo): boolean {
    const title = book.title.toLowerCase();
    const categories = (book.categories || []).map((c) => c.toLowerCase());

    const biographyKeywords = [
      'biography',
      'life',
      'story',
      'memoir',
      'autobiography',
      'portrait',
    ];

    return (
      biographyKeywords.some((kw) => title.includes(kw)) ||
      categories.some((cat) =>
        biographyKeywords.some((kw) => cat.includes(kw))
      )
    );
  }
}
