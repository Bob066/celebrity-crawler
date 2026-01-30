import axios from 'axios';
import { Celebrity, ContentItem, CrawlerConfig, DataSource } from '@/types';
import { BaseCrawler } from './base';

interface Tweet {
  id: string;
  text: string;
  created_at: string;
  public_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
  };
  referenced_tweets?: {
    type: 'retweeted' | 'quoted' | 'replied_to';
    id: string;
  }[];
}

interface TwitterUser {
  id: string;
  name: string;
  username: string;
  description?: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
}

export class TwitterCrawler extends BaseCrawler {
  source: DataSource = 'twitter';

  private baseUrl = 'https://api.twitter.com/2';
  private bearerToken: string = '';

  validateConfig(config: CrawlerConfig): boolean {
    return !!config.apiKey;
  }

  async *crawl(
    celebrity: Celebrity,
    config?: CrawlerConfig
  ): AsyncGenerator<ContentItem> {
    if (!config?.apiKey) {
      throw new Error('Twitter API Bearer Token 未配置');
    }

    this.bearerToken = config.apiKey;

    // 搜索用户
    const user = await this.findUser(celebrity);
    if (!user) {
      console.warn('未找到 Twitter 用户:', celebrity.name);
      return;
    }

    // 获取用户推文
    let paginationToken: string | undefined;
    let totalFetched = 0;
    const maxItems = config.maxItems || 500;

    while (totalFetched < maxItems) {
      const result = await this.getUserTweets(user.id, paginationToken);

      for (const tweet of result.tweets) {
        const contentType = this.getTweetType(tweet);
        const priority = contentType === 'reply' ? 1 : 1;

        yield this.createContentItem({
          type: contentType,
          priority,
          weight: 1.0,
          content: tweet.text,
          sourceUrl: `https://twitter.com/${user.username}/status/${tweet.id}`,
          date: new Date(tweet.created_at),
          metadata: {
            tweetId: tweet.id,
            username: user.username,
            metrics: tweet.public_metrics,
            isRetweet: contentType === 'retweet',
            isReply: contentType === 'reply',
          },
        });

        totalFetched++;
        if (totalFetched >= maxItems) break;
      }

      paginationToken = result.nextToken;
      if (!paginationToken) break;

      // 避免请求过快
      await this.delay(1000);
    }
  }

  private async findUser(celebrity: Celebrity): Promise<TwitterUser | null> {
    const searchTerms = [celebrity.name, ...celebrity.aliases];

    for (const term of searchTerms) {
      try {
        // 首先尝试按用户名搜索
        const usernameResult = await this.searchByUsername(
          term.replace(/\s+/g, '')
        );
        if (usernameResult) return usernameResult;

        // 然后尝试按名称搜索
        const nameResult = await this.searchByName(term);
        if (nameResult) return nameResult;
      } catch (error) {
        console.error(`Twitter 用户搜索失败 (${term}):`, error);
      }

      await this.delay(500);
    }

    return null;
  }

  private async searchByUsername(
    username: string
  ): Promise<TwitterUser | null> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/users/by/username/${username}`,
        {
          headers: {
            Authorization: `Bearer ${this.bearerToken}`,
          },
          params: {
            'user.fields': 'description,public_metrics',
          },
        }
      );

      if (response.data.data) {
        return response.data.data;
      }
    } catch {
      // 用户不存在，忽略错误
    }

    return null;
  }

  private async searchByName(name: string): Promise<TwitterUser | null> {
    try {
      // 使用搜索 API 查找用户
      const response = await axios.get(`${this.baseUrl}/users/search`, {
        headers: {
          Authorization: `Bearer ${this.bearerToken}`,
        },
        params: {
          query: name,
          'user.fields': 'description,public_metrics,verified',
        },
      });

      const users = response.data.data || [];

      // 选择粉丝最多的认证用户
      const verifiedUsers = users.filter((u: TwitterUser & { verified?: boolean }) => u.verified);
      if (verifiedUsers.length > 0) {
        return verifiedUsers.sort(
          (a: TwitterUser, b: TwitterUser) =>
            (b.public_metrics?.followers_count || 0) -
            (a.public_metrics?.followers_count || 0)
        )[0];
      }

      // 如果没有认证用户，返回粉丝最多的
      if (users.length > 0) {
        return users.sort(
          (a: TwitterUser, b: TwitterUser) =>
            (b.public_metrics?.followers_count || 0) -
            (a.public_metrics?.followers_count || 0)
        )[0];
      }
    } catch (error) {
      console.error('按名称搜索用户失败:', error);
    }

    return null;
  }

  private async getUserTweets(
    userId: string,
    paginationToken?: string
  ): Promise<{ tweets: Tweet[]; nextToken?: string }> {
    const response = await axios.get(
      `${this.baseUrl}/users/${userId}/tweets`,
      {
        headers: {
          Authorization: `Bearer ${this.bearerToken}`,
        },
        params: {
          max_results: 100,
          pagination_token: paginationToken,
          'tweet.fields': 'created_at,public_metrics,referenced_tweets',
          exclude: 'replies', // 可以移除以包含回复
        },
      }
    );

    return {
      tweets: response.data.data || [],
      nextToken: response.data.meta?.next_token,
    };
  }

  private getTweetType(tweet: Tweet): 'tweet' | 'retweet' | 'reply' {
    if (tweet.referenced_tweets) {
      const refType = tweet.referenced_tweets[0]?.type;
      if (refType === 'retweeted') return 'retweet';
      if (refType === 'replied_to') return 'reply';
    }
    return 'tweet';
  }
}
