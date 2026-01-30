import axios from 'axios';
import { Celebrity } from '@/types';
import {
  PaidResource,
  PriceInfo,
  Platform,
  PLATFORMS,
} from '@/types/paid-sources';
import { BasePaidCrawler } from './base-paid';

export class CoursePaidCrawler extends BasePaidCrawler {
  sourceType = 'course' as const;

  platforms: Platform[] = [
    PLATFORMS.masterclass,
    PLATFORMS.coursera,
    PLATFORMS.udemy,
  ];

  async search(celebrity: Celebrity): Promise<PaidResource[]> {
    const resources: PaidResource[] = [];
    const searchTerms = [
      celebrity.name,
      ...celebrity.aliases.slice(0, 2),
    ];

    // 搜索 MasterClass
    try {
      const mcResults = await this.searchMasterClass(celebrity);
      resources.push(...mcResults);
    } catch (error) {
      console.error('MasterClass 搜索失败:', error);
    }

    // 搜索 Coursera
    for (const term of searchTerms) {
      try {
        const courseraResults = await this.searchCoursera(term, celebrity);
        for (const result of courseraResults) {
          if (!resources.some((r) => r.title === result.title)) {
            resources.push(result);
          }
        }
      } catch (error) {
        console.error('Coursera 搜索失败:', error);
      }
      await this.delay(500);
    }

    // 搜索 Udemy
    for (const term of searchTerms) {
      try {
        const udemyResults = await this.searchUdemy(term, celebrity);
        for (const result of udemyResults) {
          if (!resources.some((r) => r.title === result.title)) {
            resources.push(result);
          }
        }
      } catch (error) {
        console.error('Udemy 搜索失败:', error);
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
      case 'masterclass':
        return this.getMasterClassPrice(resource);
      case 'coursera':
        return this.getCourseraPrice(resource);
      case 'udemy':
        return this.getUdemyPrice(resource);
      default:
        return null;
    }
  }

  private async searchMasterClass(
    celebrity: Celebrity
  ): Promise<PaidResource[]> {
    const resources: PaidResource[] = [];

    // MasterClass 知名教师列表
    // 实际实现中可以爬取 MasterClass 网站
    const celebrityNames = [
      celebrity.name.toLowerCase(),
      ...celebrity.aliases.map((a) => a.toLowerCase()),
    ];

    // 检查是否是 MasterClass 的教师
    // 这里使用模拟数据，实际应该爬取网站
    const knownInstructors: Record<
      string,
      { title: string; description: string; url: string }
    > = {
      'elon musk': {
        title: 'Elon Musk Teaches Problem Solving',
        description: 'Learn how Elon Musk approaches complex problems',
        url: 'https://www.masterclass.com/classes/elon-musk-teaches-problem-solving',
      },
      'gordon ramsay': {
        title: 'Gordon Ramsay Teaches Cooking',
        description: 'Learn cooking techniques from Gordon Ramsay',
        url: 'https://www.masterclass.com/classes/gordon-ramsay-teaches-cooking',
      },
      // 更多名人...
    };

    for (const name of celebrityNames) {
      if (knownInstructors[name]) {
        const course = knownInstructors[name];
        const resource = this.createResource({
          title: course.title,
          description: course.description,
          author: celebrity.name,
          previewUrl: course.url,
          relevanceScore: 1.0, // 本人教授的课程
          contentQuality: 0.9,
          priority: 1, // P1 - 本人直接发言
          weight: 1.0,
          prices: [
            this.createPriceInfo(PLATFORMS.masterclass, {
              price: 180,
              url: course.url,
              purchaseType: 'subscribe',
              subscriptionPeriod: 'yearly',
            }),
          ],
          metadata: {
            platform: 'masterclass',
            isSelfTaught: true,
          },
        });
        resources.push(resource);
      }
    }

    // 搜索关于该名人的课程
    const searchUrl = `https://www.masterclass.com/search?query=${encodeURIComponent(
      celebrity.name
    )}`;

    const resource = this.createResource({
      title: `MasterClass - ${celebrity.name} 相关课程`,
      description: `在 MasterClass 上搜索与 ${celebrity.name} 相关的大师课程`,
      previewUrl: searchUrl,
      relevanceScore: 0.5,
      contentQuality: 0.8,
      priority: 3,
      weight: 0.6,
      prices: [
        this.createPriceInfo(PLATFORMS.masterclass, {
          price: 180,
          url: searchUrl,
          purchaseType: 'subscribe',
          subscriptionPeriod: 'yearly',
        }),
      ],
      metadata: {
        platform: 'masterclass',
        searchQuery: celebrity.name,
      },
    });

    resources.push(resource);
    return resources;
  }

  private async searchCoursera(
    query: string,
    celebrity: Celebrity
  ): Promise<PaidResource[]> {
    const resources: PaidResource[] = [];

    try {
      // Coursera 搜索 API
      const searchUrl = `https://www.coursera.org/search?query=${encodeURIComponent(
        query
      )}`;

      const resource = this.createResource({
        title: `Coursera - ${query} 相关课程`,
        description: `在 Coursera 上搜索与 "${query}" 相关的课程`,
        previewUrl: searchUrl,
        relevanceScore: this.assessRelevance(query, celebrity),
        contentQuality: 0.7,
        priority: 3,
        weight: 0.6,
        prices: [
          this.createPriceInfo(PLATFORMS.coursera, {
            price: 49,
            url: searchUrl,
            purchaseType: 'subscribe',
            subscriptionPeriod: 'monthly',
          }),
        ],
        metadata: {
          platform: 'coursera',
          searchQuery: query,
        },
      });

      resources.push(resource);
    } catch (error) {
      console.error('Coursera 搜索失败:', error);
    }

    return resources;
  }

  private async searchUdemy(
    query: string,
    celebrity: Celebrity
  ): Promise<PaidResource[]> {
    const resources: PaidResource[] = [];

    try {
      // Udemy 搜索
      const searchUrl = `https://www.udemy.com/courses/search/?q=${encodeURIComponent(
        query
      )}`;

      // Udemy API 需要认证，这里使用搜索链接
      const resource = this.createResource({
        title: `Udemy - ${query} 相关课程`,
        description: `在 Udemy 上搜索与 "${query}" 相关的课程`,
        previewUrl: searchUrl,
        relevanceScore: this.assessRelevance(query, celebrity),
        contentQuality: 0.6,
        priority: 4,
        weight: 0.5,
        prices: [
          this.createPriceInfo(PLATFORMS.udemy, {
            price: 12.99, // Udemy 经常打折
            originalPrice: 84.99,
            url: searchUrl,
            purchaseType: 'buy',
          }),
        ],
        metadata: {
          platform: 'udemy',
          searchQuery: query,
        },
      });

      resources.push(resource);
    } catch (error) {
      console.error('Udemy 搜索失败:', error);
    }

    return resources;
  }

  private getMasterClassPrice(
    resource: PaidResource
  ): Promise<PriceInfo | null> {
    // MasterClass 年费订阅
    return Promise.resolve(
      this.createPriceInfo(PLATFORMS.masterclass, {
        price: 180,
        url: resource.previewUrl || 'https://www.masterclass.com',
        purchaseType: 'subscribe',
        subscriptionPeriod: 'yearly',
      })
    );
  }

  private getCourseraPrice(resource: PaidResource): Promise<PriceInfo | null> {
    return Promise.resolve(
      this.createPriceInfo(PLATFORMS.coursera, {
        price: 49,
        url: resource.previewUrl || 'https://www.coursera.org',
        purchaseType: 'subscribe',
        subscriptionPeriod: 'monthly',
      })
    );
  }

  private getUdemyPrice(resource: PaidResource): Promise<PriceInfo | null> {
    return Promise.resolve(
      this.createPriceInfo(PLATFORMS.udemy, {
        price: 12.99,
        originalPrice: 84.99,
        url: resource.previewUrl || 'https://www.udemy.com',
        purchaseType: 'buy',
      })
    );
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

    return 0.3;
  }
}
