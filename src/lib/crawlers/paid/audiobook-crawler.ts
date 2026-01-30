import axios from 'axios';
import { Celebrity } from '@/types';
import {
  PaidResource,
  PriceInfo,
  Platform,
  PLATFORMS,
} from '@/types/paid-sources';
import { BasePaidCrawler } from './base-paid';

export class AudiobookPaidCrawler extends BasePaidCrawler {
  sourceType = 'audiobook' as const;

  platforms: Platform[] = [
    PLATFORMS.ximalaya,
    PLATFORMS.audible,
    PLATFORMS.scribd,
    PLATFORMS.weread,
  ];

  async search(celebrity: Celebrity): Promise<PaidResource[]> {
    const resources: PaidResource[] = [];
    const searchTerms = [
      celebrity.name,
      ...celebrity.aliases.slice(0, 2),
    ];

    // 搜索喜马拉雅
    for (const term of searchTerms) {
      try {
        const xmResults = await this.searchXimalaya(term, celebrity);
        for (const result of xmResults) {
          if (!resources.some((r) => r.title === result.title)) {
            resources.push(result);
          }
        }
      } catch (error) {
        console.error('喜马拉雅搜索失败:', error);
      }

      await this.delay(500);
    }

    // 搜索 Audible（基于书籍名称）
    for (const term of searchTerms) {
      try {
        const audibleResults = await this.searchAudible(term, celebrity);
        for (const result of audibleResults) {
          if (!resources.some((r) => r.title === result.title)) {
            resources.push(result);
          }
        }
      } catch (error) {
        console.error('Audible 搜索失败:', error);
      }

      await this.delay(500);
    }

    return resources;
  }

  async getPriceFromPlatform(
    resource: PaidResource,
    platform: Platform
  ): Promise<PriceInfo | null> {
    switch (platform.id) {
      case 'ximalaya':
        return this.getXimalayaPrice(resource);
      case 'audible':
        return this.getAudiblePrice(resource);
      default:
        return null;
    }
  }

  private async searchXimalaya(
    query: string,
    celebrity: Celebrity
  ): Promise<PaidResource[]> {
    const resources: PaidResource[] = [];

    try {
      // 喜马拉雅搜索 API
      const searchUrl = `https://www.ximalaya.com/revision/search/main?kw=${encodeURIComponent(
        query
      )}&page=1&spellchecker=true&condition=relation&rows=20&device=iPhone&core=album&fq=category_id%3A3001`;

      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        },
      });

      const data = response.data;
      const albums = data.data?.album?.docs || [];

      for (const album of albums) {
        const relevance = this.assessRelevance(album.title, celebrity);
        if (relevance < 0.3) continue;

        const resource = this.createResource({
          title: album.title,
          description: album.intro,
          author: album.nickname,
          preview: album.intro?.substring(0, 300),
          previewUrl: `https://www.ximalaya.com/album/${album.albumId}`,
          relevanceScore: relevance,
          contentQuality: this.assessQuality(album),
          priority: 2,
          weight: 0.8,
          prices: [],
          metadata: {
            platform: 'ximalaya',
            albumId: album.albumId,
            playCount: album.playCount,
            trackCount: album.tracksCount,
            isPaid: album.isPaid,
          },
        });

        // 添加喜马拉雅价格
        if (album.isPaid && album.priceInfo) {
          resource.prices.push(
            this.createPriceInfo(PLATFORMS.ximalaya, {
              price: album.priceInfo.price / 100, // 分转元
              url: `https://www.ximalaya.com/album/${album.albumId}`,
              format: 'Audio',
            })
          );
        } else if (!album.isPaid) {
          resource.prices.push(
            this.createPriceInfo(PLATFORMS.ximalaya, {
              price: 0,
              url: `https://www.ximalaya.com/album/${album.albumId}`,
              format: 'Audio',
            })
          );
        }

        resources.push(resource);
      }
    } catch (error) {
      console.error('喜马拉雅搜索失败:', error);
    }

    return resources;
  }

  private async searchAudible(
    query: string,
    celebrity: Celebrity
  ): Promise<PaidResource[]> {
    const resources: PaidResource[] = [];

    try {
      // Audible 搜索（通过网页爬取）
      const searchUrl = `https://www.audible.com/search?keywords=${encodeURIComponent(
        query
      )}`;

      // 由于 Audible 有反爬措施，这里返回搜索链接
      // 实际使用时可以集成 Audible API 或使用无头浏览器

      const resource = this.createResource({
        title: `${query} - Audible 有声书`,
        description: `在 Audible 上搜索 "${query}" 相关有声书`,
        previewUrl: searchUrl,
        relevanceScore: 0.5,
        contentQuality: 0.7,
        priority: 2,
        weight: 0.8,
        prices: [
          this.createPriceInfo(PLATFORMS.audible, {
            price: 14.95, // Audible 会员价
            originalPrice: 29.95,
            url: searchUrl,
            format: 'Audio',
            purchaseType: 'subscribe',
            subscriptionPeriod: 'monthly',
          }),
        ],
        metadata: {
          platform: 'audible',
          searchQuery: query,
        },
      });

      resources.push(resource);
    } catch (error) {
      console.error('Audible 搜索失败:', error);
    }

    return resources;
  }

  private async getXimalayaPrice(
    resource: PaidResource
  ): Promise<PriceInfo | null> {
    const albumId = resource.metadata?.albumId;
    if (!albumId) return null;

    try {
      // 获取专辑详情
      const response = await axios.get(
        `https://www.ximalaya.com/revision/album/v1/simple?albumId=${albumId}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
          },
        }
      );

      const data = response.data.data;
      if (data.priceInfo) {
        return this.createPriceInfo(PLATFORMS.ximalaya, {
          price: data.priceInfo.price / 100,
          url: `https://www.ximalaya.com/album/${albumId}`,
          format: 'Audio',
        });
      }

      // 免费
      return this.createPriceInfo(PLATFORMS.ximalaya, {
        price: 0,
        url: `https://www.ximalaya.com/album/${albumId}`,
        format: 'Audio',
      });
    } catch (error) {
      console.error('获取喜马拉雅价格失败:', error);
    }

    return null;
  }

  private async getAudiblePrice(
    resource: PaidResource
  ): Promise<PriceInfo | null> {
    // Audible 需要会员订阅
    return this.createPriceInfo(PLATFORMS.audible, {
      price: 14.95,
      url: resource.previewUrl || 'https://www.audible.com',
      format: 'Audio',
      purchaseType: 'subscribe',
      subscriptionPeriod: 'monthly',
    });
  }

  private assessRelevance(title: string, celebrity: Celebrity): number {
    const titleLower = title.toLowerCase();
    const celebrityNames = [
      celebrity.name.toLowerCase(),
      ...celebrity.aliases.map((a) => a.toLowerCase()),
    ];

    for (const name of celebrityNames) {
      if (titleLower.includes(name)) {
        return 0.8;
      }
    }

    return 0.2;
  }

  private assessQuality(album: {
    playCount?: number;
    tracksCount?: number;
  }): number {
    let score = 0.5;

    // 播放量高
    if (album.playCount && album.playCount > 100000) {
      score += 0.2;
    }

    // 内容丰富
    if (album.tracksCount && album.tracksCount > 10) {
      score += 0.2;
    }

    return Math.min(1, score);
  }
}
