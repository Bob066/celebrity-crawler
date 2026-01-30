import axios from 'axios';
import { Celebrity, ContentItem, CrawlerConfig, DataSource } from '@/types';
import { BaseCrawler } from './base';

interface YouTubeVideo {
  id: string;
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
    channelTitle: string;
    thumbnails: {
      default?: { url: string };
    };
  };
}

interface YouTubeCaption {
  videoId: string;
  text: string;
}

export class YouTubeCrawler extends BaseCrawler {
  source: DataSource = 'youtube';

  private baseUrl = 'https://www.googleapis.com/youtube/v3';
  private apiKey: string = '';

  validateConfig(config: CrawlerConfig): boolean {
    return !!config.apiKey;
  }

  async *crawl(
    celebrity: Celebrity,
    config?: CrawlerConfig
  ): AsyncGenerator<ContentItem> {
    if (!config?.apiKey) {
      throw new Error('YouTube API Key 未配置');
    }

    this.apiKey = config.apiKey;

    const searchTerms = [
      `${celebrity.name} interview`,
      `${celebrity.name} speech`,
      `${celebrity.name} talk`,
      `${celebrity.name} podcast`,
    ];

    const maxItems = config.maxItems || 50;
    let totalFetched = 0;
    const processedVideoIds = new Set<string>();

    for (const searchTerm of searchTerms) {
      if (totalFetched >= maxItems) break;

      try {
        const videos = await this.searchVideos(searchTerm);

        for (const video of videos) {
          if (processedVideoIds.has(video.id)) continue;
          if (totalFetched >= maxItems) break;

          processedVideoIds.add(video.id);

          // 尝试获取字幕
          const caption = await this.getCaption(video.id);

          const content = caption
            ? caption.text
            : video.snippet.description;

          // 判断内容类型
          const contentType = this.getContentType(video.snippet.title);
          const priority = this.getPriority(video, celebrity);

          yield this.createContentItem({
            type: contentType,
            priority,
            weight: priority === 1 ? 1.0 : 0.8,
            title: video.snippet.title,
            content,
            sourceUrl: `https://www.youtube.com/watch?v=${video.id}`,
            date: new Date(video.snippet.publishedAt),
            metadata: {
              videoId: video.id,
              channelTitle: video.snippet.channelTitle,
              hasCaption: !!caption,
              searchTerm,
            },
          });

          totalFetched++;
          await this.delay(200);
        }
      } catch (error) {
        console.error(`YouTube 搜索失败 (${searchTerm}):`, error);
      }

      await this.delay(500);
    }
  }

  private async searchVideos(query: string): Promise<YouTubeVideo[]> {
    const searchResponse = await axios.get(`${this.baseUrl}/search`, {
      params: {
        key: this.apiKey,
        q: query,
        part: 'snippet',
        type: 'video',
        maxResults: 20,
        order: 'relevance',
        videoCaption: 'closedCaption', // 优先有字幕的视频
      },
    });

    const videoIds = searchResponse.data.items
      ?.map((item: { id: { videoId: string } }) => item.id.videoId)
      .filter(Boolean)
      .join(',');

    if (!videoIds) return [];

    // 获取视频详情
    const videosResponse = await axios.get(`${this.baseUrl}/videos`, {
      params: {
        key: this.apiKey,
        id: videoIds,
        part: 'snippet,contentDetails',
      },
    });

    return videosResponse.data.items || [];
  }

  private async getCaption(videoId: string): Promise<YouTubeCaption | null> {
    try {
      // 获取字幕列表
      const captionsResponse = await axios.get(`${this.baseUrl}/captions`, {
        params: {
          key: this.apiKey,
          videoId,
          part: 'snippet',
        },
      });

      const captions = captionsResponse.data.items || [];

      // 优先选择英文字幕
      const englishCaption = captions.find(
        (c: { snippet: { language: string } }) =>
          c.snippet.language === 'en' || c.snippet.language === 'en-US'
      );

      if (englishCaption) {
        // 注意：获取字幕内容需要 OAuth 认证，这里返回简化版本
        // 实际实现中可以使用第三方服务或 youtube-transcript 库
        return {
          videoId,
          text: `[字幕可用 - 语言: ${englishCaption.snippet.language}]`,
        };
      }
    } catch {
      // 字幕获取失败，忽略
    }

    return null;
  }

  private getContentType(
    title: string
  ): 'interview' | 'speech' | 'podcast_episode' | 'other' {
    const titleLower = title.toLowerCase();

    if (
      titleLower.includes('interview') ||
      titleLower.includes('conversation')
    ) {
      return 'interview';
    }
    if (
      titleLower.includes('speech') ||
      titleLower.includes('talk') ||
      titleLower.includes('ted')
    ) {
      return 'speech';
    }
    if (
      titleLower.includes('podcast') ||
      titleLower.includes('ep.') ||
      titleLower.includes('episode')
    ) {
      return 'podcast_episode';
    }

    return 'interview';
  }

  private getPriority(video: YouTubeVideo, celebrity: Celebrity): number {
    const title = video.snippet.title.toLowerCase();
    const channel = video.snippet.channelTitle.toLowerCase();
    const celebrityName = celebrity.name.toLowerCase();

    // 如果是名人自己的频道，优先级最高
    if (
      channel.includes(celebrityName) ||
      celebrity.aliases.some((a) => channel.includes(a.toLowerCase()))
    ) {
      return 1;
    }

    // 如果标题表明是直接采访/演讲
    if (title.includes('interview') || title.includes('speech')) {
      return 1;
    }

    // 其他视频
    return 2;
  }
}
