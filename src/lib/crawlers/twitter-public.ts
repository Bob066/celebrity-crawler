/**
 * Twitter/X 公开网页爬虫
 * 无需 API Key，通过公开网页和第三方服务获取推文
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { Celebrity, ContentItem, CrawlerConfig, DataSource } from '@/types';
import { BaseCrawler } from './base';

interface PublicTweet {
  id: string;
  text: string;
  date: string;
  username: string;
  likes?: number;
  retweets?: number;
  url: string;
}

export class TwitterPublicCrawler extends BaseCrawler {
  source: DataSource = 'twitter';

  validateConfig(): boolean {
    return true; // 不需要 API Key
  }

  async *crawl(
    celebrity: Celebrity,
    config?: CrawlerConfig
  ): AsyncGenerator<ContentItem> {
    const maxItems = config?.maxItems || 100;
    let totalFetched = 0;

    // 尝试多种方式获取推文
    const tweets: PublicTweet[] = [];

    // 方法1: 通过 Nitter 实例获取（Twitter 的开源前端）
    const nitterTweets = await this.fetchFromNitter(celebrity);
    tweets.push(...nitterTweets);

    // 方法2: 通过搜索引擎缓存获取
    if (tweets.length < maxItems) {
      const searchTweets = await this.fetchFromSearchEngines(celebrity);
      tweets.push(...searchTweets);
    }

    // 方法3: 通过 Wayback Machine 获取历史推文
    if (tweets.length < maxItems) {
      const archiveTweets = await this.fetchFromWaybackMachine(celebrity);
      tweets.push(...archiveTweets);
    }

    // 去重
    const uniqueTweets = this.deduplicateTweets(tweets);

    for (const tweet of uniqueTweets) {
      if (totalFetched >= maxItems) break;

      yield this.createContentItem({
        type: 'tweet',
        priority: 1,
        weight: 1.0,
        content: tweet.text,
        sourceUrl: tweet.url,
        date: tweet.date ? new Date(tweet.date) : undefined,
        metadata: {
          tweetId: tweet.id,
          username: tweet.username,
          likes: tweet.likes,
          retweets: tweet.retweets,
          crawlMethod: 'public',
        },
      });

      totalFetched++;
    }
  }

  /**
   * 从 Nitter 实例获取推文
   * Nitter 是 Twitter 的开源替代前端
   */
  private async fetchFromNitter(celebrity: Celebrity): Promise<PublicTweet[]> {
    const tweets: PublicTweet[] = [];

    // 多个 Nitter 实例（有些可能不可用）
    const nitterInstances = [
      'https://nitter.net',
      'https://nitter.privacydev.net',
      'https://nitter.poast.org',
    ];

    // 尝试猜测用户名
    const possibleUsernames = this.guessUsernames(celebrity);

    for (const instance of nitterInstances) {
      for (const username of possibleUsernames) {
        try {
          const response = await axios.get(`${instance}/${username}`, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            timeout: 10000,
          });

          const $ = cheerio.load(response.data);

          // 解析推文
          $('.timeline-item').each((_, element) => {
            const tweetContent = $(element).find('.tweet-content').text().trim();
            const tweetLink = $(element).find('.tweet-link').attr('href');
            const tweetDate = $(element).find('.tweet-date a').attr('title');
            const statsText = $(element).find('.tweet-stats').text();

            if (tweetContent && tweetLink) {
              const tweetId = tweetLink.split('/').pop() || '';

              // 解析统计数据
              const likesMatch = statsText.match(/(\d+)\s*likes?/i);
              const retweetsMatch = statsText.match(/(\d+)\s*retweets?/i);

              tweets.push({
                id: tweetId,
                text: tweetContent,
                date: tweetDate || '',
                username,
                likes: likesMatch ? parseInt(likesMatch[1]) : undefined,
                retweets: retweetsMatch ? parseInt(retweetsMatch[1]) : undefined,
                url: `https://twitter.com${tweetLink}`,
              });
            }
          });

          if (tweets.length > 0) {
            console.log(`从 ${instance} 获取到 ${tweets.length} 条推文`);
            return tweets; // 成功获取，返回结果
          }
        } catch (error) {
          console.warn(`Nitter 实例 ${instance} 不可用:`, error);
        }
      }
    }

    return tweets;
  }

  /**
   * 从搜索引擎获取推文
   */
  private async fetchFromSearchEngines(
    celebrity: Celebrity
  ): Promise<PublicTweet[]> {
    const tweets: PublicTweet[] = [];

    const searchQueries = [
      `site:twitter.com "${celebrity.name}"`,
      `site:x.com "${celebrity.name}"`,
    ];

    for (const query of searchQueries) {
      try {
        // 使用 DuckDuckGo HTML 搜索（不需要 API）
        const response = await axios.get('https://html.duckduckgo.com/html/', {
          params: { q: query },
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          timeout: 10000,
        });

        const $ = cheerio.load(response.data);

        $('.result').each((_, element) => {
          const title = $(element).find('.result__title').text().trim();
          const link = $(element).find('.result__url').text().trim();
          const snippet = $(element).find('.result__snippet').text().trim();

          // 检查是否是 Twitter/X 链接
          if (link.includes('twitter.com') || link.includes('x.com')) {
            const tweetIdMatch = link.match(/status\/(\d+)/);
            if (tweetIdMatch) {
              tweets.push({
                id: tweetIdMatch[1],
                text: snippet || title,
                date: '',
                username: this.extractUsername(link),
                url: link.startsWith('http') ? link : `https://${link}`,
              });
            }
          }
        });

        await this.delay(1000);
      } catch (error) {
        console.warn('搜索引擎获取失败:', error);
      }
    }

    return tweets;
  }

  /**
   * 从 Wayback Machine 获取历史推文
   */
  private async fetchFromWaybackMachine(
    celebrity: Celebrity
  ): Promise<PublicTweet[]> {
    const tweets: PublicTweet[] = [];
    const possibleUsernames = this.guessUsernames(celebrity);

    for (const username of possibleUsernames.slice(0, 2)) {
      try {
        // 查询 Wayback Machine CDX API
        const cdxUrl = `https://web.archive.org/cdx/search/cdx`;
        const response = await axios.get(cdxUrl, {
          params: {
            url: `twitter.com/${username}`,
            matchType: 'prefix',
            output: 'json',
            limit: 50,
            filter: 'statuscode:200',
          },
          timeout: 15000,
        });

        const results = response.data;
        if (!Array.isArray(results) || results.length <= 1) continue;

        // 跳过表头
        for (let i = 1; i < Math.min(results.length, 20); i++) {
          const [, timestamp, originalUrl] = results[i];

          // 检查是否是推文页面
          const tweetIdMatch = originalUrl.match(/status\/(\d+)/);
          if (!tweetIdMatch) continue;

          // 获取存档页面
          try {
            const archiveUrl = `https://web.archive.org/web/${timestamp}/${originalUrl}`;
            const pageResponse = await axios.get(archiveUrl, {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              },
              timeout: 10000,
            });

            const $ = cheerio.load(pageResponse.data);

            // 尝试提取推文内容
            const tweetText =
              $('[data-testid="tweetText"]').text().trim() ||
              $('.tweet-text').text().trim() ||
              $('article p').first().text().trim();

            if (tweetText) {
              tweets.push({
                id: tweetIdMatch[1],
                text: tweetText,
                date: this.parseWaybackTimestamp(timestamp),
                username,
                url: originalUrl,
              });
            }
          } catch {
            // 存档页面获取失败，跳过
          }

          await this.delay(500);
        }
      } catch (error) {
        console.warn('Wayback Machine 查询失败:', error);
      }
    }

    return tweets;
  }

  /**
   * 猜测可能的用户名
   */
  private guessUsernames(celebrity: Celebrity): string[] {
    const usernames: string[] = [];

    // 从名字生成可能的用户名
    const name = celebrity.name.toLowerCase();
    const nameParts = name.split(/\s+/);

    // 常见用户名格式
    usernames.push(name.replace(/\s+/g, '')); // elonmusk
    usernames.push(nameParts.join('_')); // elon_musk
    usernames.push(nameParts.join('')); // elonmusk

    if (nameParts.length >= 2) {
      usernames.push(nameParts[0] + nameParts[nameParts.length - 1]); // elonmusk
      usernames.push(nameParts[0][0] + nameParts[nameParts.length - 1]); // emusk
    }

    // 添加别名
    for (const alias of celebrity.aliases) {
      const aliasClean = alias.toLowerCase().replace(/\s+/g, '');
      if (!usernames.includes(aliasClean)) {
        usernames.push(aliasClean);
      }
    }

    return usernames.slice(0, 5); // 最多尝试5个
  }

  /**
   * 从 URL 提取用户名
   */
  private extractUsername(url: string): string {
    const match = url.match(/(?:twitter\.com|x\.com)\/(\w+)/);
    return match ? match[1] : 'unknown';
  }

  /**
   * 解析 Wayback Machine 时间戳
   */
  private parseWaybackTimestamp(timestamp: string): string {
    // 格式: YYYYMMDDHHmmss
    if (timestamp.length >= 8) {
      const year = timestamp.substring(0, 4);
      const month = timestamp.substring(4, 6);
      const day = timestamp.substring(6, 8);
      return `${year}-${month}-${day}`;
    }
    return '';
  }

  /**
   * 推文去重
   */
  private deduplicateTweets(tweets: PublicTweet[]): PublicTweet[] {
    const seen = new Set<string>();
    return tweets.filter((tweet) => {
      const key = tweet.id || tweet.text.substring(0, 100);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
