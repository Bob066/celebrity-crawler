import { Celebrity } from '@/types';
import {
  PaidResource,
  PriceInfo,
  Platform,
  PaidSourceType,
  convertToCNY,
} from '@/types/paid-sources';

export abstract class BasePaidCrawler {
  abstract platforms: Platform[];
  abstract sourceType: PaidSourceType;

  // 搜索付费资源
  abstract search(celebrity: Celebrity): Promise<PaidResource[]>;

  // 获取特定平台的价格
  abstract getPriceFromPlatform(
    resource: PaidResource,
    platform: Platform
  ): Promise<PriceInfo | null>;

  // 延迟
  protected async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // 获取所有平台的价格比较
  async comparePrices(resource: PaidResource): Promise<PriceInfo[]> {
    const prices: PriceInfo[] = [];

    for (const platform of this.platforms) {
      try {
        const price = await this.getPriceFromPlatform(resource, platform);
        if (price) {
          prices.push({
            ...price,
            priceInCNY: convertToCNY(price.price, price.currency),
          });
        }
      } catch (error) {
        console.error(`获取 ${platform.name} 价格失败:`, error);
      }

      await this.delay(300);
    }

    // 按人民币价格排序
    return prices.sort((a, b) => a.priceInCNY - b.priceInCNY);
  }

  // 获取中国大陆可用的最优价格
  getBestPriceForChina(prices: PriceInfo[]): PriceInfo | null {
    const chinaAccessiblePrices = prices.filter(
      (p) =>
        p.available &&
        p.chinaAccessible &&
        p.supportedPayments.some((pm) =>
          ['alipay', 'wechat', 'unionpay'].includes(pm)
        )
    );

    if (chinaAccessiblePrices.length === 0) {
      // 如果没有完全兼容的，返回中国可访问的最低价
      const accessiblePrices = prices.filter(
        (p) => p.available && p.chinaAccessible
      );
      return accessiblePrices.length > 0 ? accessiblePrices[0] : null;
    }

    return chinaAccessiblePrices[0];
  }

  // 创建资源对象
  protected createResource(
    data: Partial<PaidResource> & { title: string }
  ): PaidResource {
    return {
      id: `${this.sourceType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: this.sourceType,
      relevanceScore: 0.5,
      contentQuality: 0.5,
      priority: 3,
      weight: 0.6,
      prices: [],
      ...data,
    };
  }

  // 创建价格信息
  protected createPriceInfo(
    platform: Platform,
    data: Partial<PriceInfo> & { price: number; url: string }
  ): PriceInfo {
    return {
      platform,
      currency: platform.currency,
      priceInCNY: convertToCNY(data.price, platform.currency),
      purchaseType: 'buy',
      available: true,
      chinaAccessible: platform.chinaAccessible,
      supportedPayments: platform.supportedPayments,
      lastChecked: new Date(),
      ...data,
    };
  }
}
