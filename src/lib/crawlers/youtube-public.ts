/**
 * YouTube 公开网页爬虫
 * 无需 API Key，通过公开网页获取视频信息和字幕
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { Celebrity, ContentItem, CrawlerConfig, DataSource } from '@/types';
import { BaseCrawler } from './base';

interface PublicVideo {
  id: string;
  title: string;
  description: string;
  channelName: string;
  publishDate: string;
  viewCount?: number;
  duration?: string;
  transcript?: string;
}

export class YouTubePublicCrawler extends BaseCrawler {
  source: DataSource = 'youtube';

  validateConfig(): boolean {
    return true; // 不需要 API Key
  }

  async *crawl(
    celebrity: Celebrity,
    config?: CrawlerConfig
  ): AsyncGenerator<ContentItem> {
    const maxItems = config?.maxItems || 30;
    let totalFetched = 0;

    const searchQueries = [
      `${celebrity.name} interview`,
      `${celebrity.name} speech`,
      `${celebrity.name} talk`,
      `${celebrity.name} podcast`,
    ];

    const processedVideoIds = new Set<string>();

    for (const query of searchQueries) {
      if (totalFetched >= maxItems) break;

      try {
        // 方法1: 通过 Invidious 实例搜索（YouTube 的开源前端）
        let videos = await this.searchViaInvidious(query);

        // 方法2: 如果 Invidious 失败，尝试直接解析 YouTube 页面
        if (videos.length === 0) {
          videos = await this.searchViaYouTubeHTML(query);
        }

        for (const video of videos) {
          if (processedVideoIds.has(video.id)) continue;
          if (totalFetched >= maxItems) break;

          processedVideoIds.add(video.id);

          // 尝试获取字幕
          const transcript = await this.fetchTranscript(video.id);
          if (transcript) {
            video.transcript = transcript;
          }

          const contentType = this.getContentType(video.title);
          const priority = this.getPriority(video, celebrity);

          yield this.createContentItem({
            type: contentType,
            priority,
            weight: priority === 1 ? 1.0 : 0.8,
            title: video.title,
            content: video.transcript || video.description,
            sourceUrl: `https://www.youtube.com/watch?v=${video.id}`,
            date: video.publishDate ? new Date(video.publishDate) : undefined,
            metadata: {
              videoId: video.id,
              channelName: video.channelName,
              viewCount: video.viewCount,
              duration: video.duration,
              hasTranscript: !!video.transcript,
              crawlMethod: 'public',
            },
          });

          totalFetched++;
          await this.delay(500);
        }
      } catch (error) {
        console.error(`YouTube 公开搜索失败 (${query}):`, error);
      }

      await this.delay(1000);
    }
  }

  /**
   * 通过 Invidious 实例搜索
   */
  private async searchViaInvidious(query: string): Promise<PublicVideo[]> {
    const videos: PublicVideo[] = [];

    // Invidious 实例列表
    const instances = [
      'https://invidious.snopyta.org',
      'https://vid.puffyan.us',
      'https://invidious.kavin.rocks',
      'https://inv.riverside.rocks',
    ];

    for (const instance of instances) {
      try {
        const response = await axios.get(`${instance}/api/v1/search`, {
          params: {
            q: query,
            type: 'video',
            sort_by: 'relevance',
          },
          timeout: 10000,
        });

        if (Array.isArray(response.data)) {
          for (const item of response.data.slice(0, 10)) {
            if (item.type === 'video') {
              videos.push({
                id: item.videoId,
                title: item.title,
                description: item.description || '',
                channelName: item.author || '',
                publishDate: item.published ? new Date(item.published * 1000).toISOString() : '',
                viewCount: item.viewCount,
                duration: this.formatDuration(item.lengthSeconds),
              });
            }
          }
        }

        if (videos.length > 0) {
          console.log(`从 ${instance} 获取到 ${videos.length} 个视频`);
          return videos;
        }
      } catch (error) {
        console.warn(`Invidious 实例 ${instance} 不可用:`, error);
      }
    }

    return videos;
  }

  /**
   * 直接从 YouTube 搜索页面解析
   */
  private async searchViaYouTubeHTML(query: string): Promise<PublicVideo[]> {
    const videos: PublicVideo[] = [];

    try {
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 15000,
      });

      // YouTube 将数据嵌入在脚本中
      const html = response.data;
      const ytInitialDataMatch = html.match(/var ytInitialData = ({.+?});/);

      if (ytInitialDataMatch) {
        try {
          const ytData = JSON.parse(ytInitialDataMatch[1]);

          // 导航到视频列表
          const contents =
            ytData?.contents?.twoColumnSearchResultsRenderer?.primaryContents
              ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

          for (const item of contents) {
            const videoRenderer = item.videoRenderer;
            if (!videoRenderer) continue;

            const videoId = videoRenderer.videoId;
            const title = videoRenderer.title?.runs?.[0]?.text || '';
            const channelName = videoRenderer.ownerText?.runs?.[0]?.text || '';
            const viewCountText = videoRenderer.viewCountText?.simpleText || '';
            const lengthText = videoRenderer.lengthText?.simpleText || '';
            const publishedText = videoRenderer.publishedTimeText?.simpleText || '';

            // 解析观看次数
            const viewCountMatch = viewCountText.match(/[\d,]+/);
            const viewCount = viewCountMatch
              ? parseInt(viewCountMatch[0].replace(/,/g, ''))
              : undefined;

            videos.push({
              id: videoId,
              title,
              description: '', // 搜索结果不包含完整描述
              channelName,
              publishDate: publishedText,
              viewCount,
              duration: lengthText,
            });
          }
        } catch (parseError) {
          console.error('解析 YouTube 数据失败:', parseError);
        }
      }
    } catch (error) {
      console.error('YouTube HTML 搜索失败:', error);
    }

    return videos;
  }

  /**
   * 获取视频字幕/转录
   */
  private async fetchTranscript(videoId: string): Promise<string | null> {
    // 方法1: 尝试通过第三方服务获取字幕
    try {
      // 使用 youtubetranscript.com 等服务
      const transcriptUrl = `https://youtubetranscript.com/?server_vid=${videoId}`;
      const response = await axios.get(transcriptUrl, {
        timeout: 10000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const $ = cheerio.load(response.data);
      const transcriptText = $('#transcript').text().trim();

      if (transcriptText && transcriptText.length > 100) {
        return transcriptText;
      }
    } catch {
      // 服务不可用，忽略
    }

    // 方法2: 尝试直接从 YouTube 获取字幕
    try {
      const videoPageUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const response = await axios.get(videoPageUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10000,
      });

      const html = response.data;

      // 查找字幕 URL
      const captionMatch = html.match(/"captionTracks":\[(.*?)\]/);
      if (captionMatch) {
        try {
          const captionData = JSON.parse(`[${captionMatch[1]}]`);
          const englishCaption = captionData.find(
            (c: { languageCode: string }) =>
              c.languageCode === 'en' || c.languageCode === 'en-US'
          );

          if (englishCaption?.baseUrl) {
            const captionResponse = await axios.get(englishCaption.baseUrl, {
              timeout: 10000,
            });

            // 解析 XML 字幕
            const $caption = cheerio.load(captionResponse.data, {
              xmlMode: true,
            });
            const texts = $caption('text')
              .map((_, el) => $caption(el).text())
              .get();

            if (texts.length > 0) {
              return texts.join(' ').replace(/\s+/g, ' ').trim();
            }
          }
        } catch {
          // 字幕解析失败
        }
      }
    } catch {
      // 视频页面获取失败
    }

    return null;
  }

  /**
   * 格式化视频时长
   */
  private formatDuration(seconds: number): string {
    if (!seconds) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * 判断内容类型
   */
  private getContentType(
    title: string
  ): 'interview' | 'speech' | 'podcast_episode' | 'other' {
    const titleLower = title.toLowerCase();

    if (titleLower.includes('interview') || titleLower.includes('conversation')) {
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

  /**
   * 判断优先级
   */
  private getPriority(video: PublicVideo, celebrity: Celebrity): number {
    const title = video.title.toLowerCase();
    const channel = video.channelName.toLowerCase();
    const celebrityName = celebrity.name.toLowerCase();

    // 如果是名人自己的频道
    if (
      channel.includes(celebrityName) ||
      celebrity.aliases.some((a) => channel.includes(a.toLowerCase()))
    ) {
      return 1;
    }

    // 如果是直接采访/演讲
    if (title.includes('interview') || title.includes('speech')) {
      return 1;
    }

    return 2;
  }
}
