import axios from 'axios';
import * as cheerio from 'cheerio';
import { Celebrity, ContentItem, CrawlerConfig, DataSource } from '@/types';
import { BaseCrawler } from './base';

interface NewsArticle {
  title: string;
  link: string;
  snippet: string;
  source: string;
  date?: string;
}

export class NewsCrawler extends BaseCrawler {
  source: DataSource = 'news';

  private googleSearchUrl = 'https://www.googleapis.com/customsearch/v1';
  private apiKey: string = '';
  private searchEngineId: string = '';

  validateConfig(config: CrawlerConfig): boolean {
    // 可以使用 Google Custom Search API，或者回退到免费方案
    return true;
  }

  async *crawl(
    celebrity: Celebrity,
    config?: CrawlerConfig
  ): AsyncGenerator<ContentItem> {
    this.apiKey = config?.apiKey || '';

    const searchTerms = [
      celebrity.name,
      ...celebrity.aliases.slice(0, 2), // 只用前两个别名
    ];

    const maxItems = config?.maxItems || 30;
    let totalFetched = 0;
    const processedUrls = new Set<string>();

    for (const searchTerm of searchTerms) {
      if (totalFetched >= maxItems) break;

      try {
        let articles: NewsArticle[];

        if (this.apiKey) {
          // 使用 Google Custom Search API
          articles = await this.searchWithGoogleApi(searchTerm);
        } else {
          // 使用免费的新闻源
          articles = await this.searchFreeNews(searchTerm);
        }

        for (const article of articles) {
          if (processedUrls.has(article.link)) continue;
          if (totalFetched >= maxItems) break;

          processedUrls.add(article.link);

          // 尝试获取文章全文
          const fullContent = await this.fetchArticleContent(article.link);

          yield this.createContentItem({
            type: 'news',
            priority: 3,
            weight: 0.6,
            title: article.title,
            content: fullContent || article.snippet,
            sourceUrl: article.link,
            date: article.date ? new Date(article.date) : undefined,
            author: article.source,
            metadata: {
              source: article.source,
              isFullContent: !!fullContent,
            },
          });

          totalFetched++;
          await this.delay(300);
        }
      } catch (error) {
        console.error(`新闻搜索失败 (${searchTerm}):`, error);
      }

      await this.delay(500);
    }
  }

  private async searchWithGoogleApi(query: string): Promise<NewsArticle[]> {
    try {
      const response = await axios.get(this.googleSearchUrl, {
        params: {
          key: this.apiKey,
          cx: this.searchEngineId,
          q: `${query} news`,
          num: 10,
          dateRestrict: 'y5', // 最近5年
          sort: 'date',
        },
      });

      return (response.data.items || []).map(
        (item: {
          title: string;
          link: string;
          snippet: string;
          displayLink: string;
        }) => ({
          title: item.title,
          link: item.link,
          snippet: item.snippet,
          source: item.displayLink,
        })
      );
    } catch (error) {
      console.error('Google API 搜索失败:', error);
      return [];
    }
  }

  private async searchFreeNews(query: string): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = [];

    // 并行获取多个免费新闻源
    const newsPromises = [
      this.fetchBingNews(query),
      this.fetchGoogleNewsRSS(query),
      this.fetchDuckDuckGoNews(query),
      this.fetchRedditPosts(query),
    ];

    const results = await Promise.allSettled(newsPromises);

    for (const result of results) {
      if (result.status === 'fulfilled') {
        articles.push(...result.value);
      }
    }

    return articles;
  }

  /**
   * 从 Bing News RSS 获取新闻
   */
  private async fetchBingNews(query: string): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = [];

    try {
      const bingUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(
        query
      )}&format=rss`;
      const response = await axios.get(bingUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10000,
      });

      const $ = cheerio.load(response.data, { xmlMode: true });
      $('item').each((_, element) => {
        const title = $(element).find('title').text();
        const link = $(element).find('link').text();
        const description = $(element).find('description').text();
        const pubDate = $(element).find('pubDate').text();

        if (title && link) {
          articles.push({
            title,
            link,
            snippet: description,
            source: 'Bing News',
            date: pubDate,
          });
        }
      });
    } catch (error) {
      console.warn('Bing News RSS 获取失败:', error);
    }

    return articles;
  }

  /**
   * 从 Google News RSS 获取新闻
   */
  private async fetchGoogleNewsRSS(query: string): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = [];

    try {
      const googleNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(
        query
      )}&hl=en-US&gl=US&ceid=US:en`;

      const response = await axios.get(googleNewsUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10000,
      });

      const $ = cheerio.load(response.data, { xmlMode: true });
      $('item').each((_, element) => {
        const title = $(element).find('title').text();
        const link = $(element).find('link').text();
        const description = $(element).find('description').text();
        const pubDate = $(element).find('pubDate').text();
        const source = $(element).find('source').text();

        if (title && link) {
          articles.push({
            title,
            link,
            snippet: this.stripHtml(description),
            source: source || 'Google News',
            date: pubDate,
          });
        }
      });
    } catch (error) {
      console.warn('Google News RSS 获取失败:', error);
    }

    return articles;
  }

  /**
   * 从 DuckDuckGo 搜索获取新闻
   */
  private async fetchDuckDuckGoNews(query: string): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = [];

    try {
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(
        query + ' news'
      )}`;

      const response = await axios.get(ddgUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10000,
      });

      const $ = cheerio.load(response.data);
      $('.result').each((_, element) => {
        const title = $(element).find('.result__title').text().trim();
        const linkElement = $(element).find('.result__url');
        const link = linkElement.attr('href') || linkElement.text().trim();
        const snippet = $(element).find('.result__snippet').text().trim();

        if (title && link) {
          // DuckDuckGo 链接需要解析
          let actualLink = link;
          if (link.startsWith('//duckduckgo.com')) {
            const urlMatch = link.match(/uddg=([^&]+)/);
            if (urlMatch) {
              actualLink = decodeURIComponent(urlMatch[1]);
            }
          } else if (!link.startsWith('http')) {
            actualLink = `https://${link}`;
          }

          articles.push({
            title,
            link: actualLink,
            snippet,
            source: 'DuckDuckGo',
          });
        }
      });
    } catch (error) {
      console.warn('DuckDuckGo 搜索失败:', error);
    }

    return articles;
  }

  /**
   * 从 Reddit 获取相关帖子
   */
  private async fetchRedditPosts(query: string): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = [];

    try {
      // Reddit 的公开 JSON API
      const redditUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(
        query
      )}&sort=relevance&limit=10`;

      const response = await axios.get(redditUrl, {
        headers: {
          'User-Agent': 'CelebrityCrawler/1.0',
        },
        timeout: 10000,
      });

      const posts = response.data?.data?.children || [];

      for (const post of posts) {
        const data = post.data;
        if (!data) continue;

        // 只获取新闻相关的 subreddit 或链接帖子
        if (data.is_self && data.selftext?.length < 100) continue;

        articles.push({
          title: data.title,
          link: data.url || `https://www.reddit.com${data.permalink}`,
          snippet: data.selftext?.substring(0, 500) || '',
          source: `Reddit r/${data.subreddit}`,
          date: data.created_utc
            ? new Date(data.created_utc * 1000).toISOString()
            : undefined,
        });
      }
    } catch (error) {
      console.warn('Reddit 搜索失败:', error);
    }

    return articles;
  }

  /**
   * 移除 HTML 标签
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }

  private async fetchArticleContent(url: string): Promise<string | null> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10000,
      });

      const $ = cheerio.load(response.data);

      // 移除不需要的元素
      $('script, style, nav, footer, header, aside, .ads, .advertisement').remove();

      // 尝试获取文章正文
      // 常见的文章容器选择器
      const selectors = [
        'article',
        '[role="main"]',
        '.article-content',
        '.post-content',
        '.entry-content',
        '.story-body',
        'main',
      ];

      for (const selector of selectors) {
        const content = $(selector).text().trim();
        if (content && content.length > 200) {
          // 清理文本
          return content
            .replace(/\s+/g, ' ')
            .replace(/\n+/g, '\n')
            .substring(0, 5000); // 限制长度
        }
      }

      // 回退到获取所有段落
      const paragraphs = $('p')
        .map((_, el) => $(el).text().trim())
        .get()
        .filter((p) => p.length > 50)
        .join('\n\n');

      if (paragraphs.length > 200) {
        return paragraphs.substring(0, 5000);
      }
    } catch (error) {
      console.error('文章内容获取失败:', error);
    }

    return null;
  }
}
