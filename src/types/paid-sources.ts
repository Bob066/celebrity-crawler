// 付费数据源类型
export type PaidSourceType =
  | 'ebook'           // 电子书
  | 'audiobook'       // 有声书
  | 'paper'           // 学术论文
  | 'interview'       // 付费采访/纪录片
  | 'course'          // 课程/讲座
  | 'database'        // 数据库订阅
  | 'news_archive'    // 新闻档案
  | 'biography_full'; // 完整传记

// 支付方式
export type PaymentMethod =
  | 'alipay'          // 支付宝
  | 'wechat'          // 微信支付
  | 'unionpay'        // 银联
  | 'visa'            // Visa
  | 'mastercard'      // Mastercard
  | 'paypal'          // PayPal
  | 'crypto';         // 加密货币

// 平台信息
export interface Platform {
  id: string;
  name: string;
  nameZh: string;              // 中文名
  url: string;
  region: 'cn' | 'global' | 'us' | 'eu';  // 地区
  supportedPayments: PaymentMethod[];
  chinaAccessible: boolean;    // 中国大陆是否可直接访问
  needsVPN: boolean;           // 是否需要VPN
  currency: 'CNY' | 'USD' | 'EUR' | 'GBP';
  description?: string;
}

// 付费资源
export interface PaidResource {
  id: string;
  title: string;
  titleZh?: string;            // 中文标题
  type: PaidSourceType;
  description?: string;
  author?: string;
  publishDate?: Date;

  // 内容预览
  preview?: string;            // 免费预览内容
  previewUrl?: string;         // 预览链接

  // 质量评估
  relevanceScore: number;      // 与名人相关度 0-1
  contentQuality: number;      // 内容质量评分 0-1
  priority: number;            // 优先级 1-5
  weight: number;              // 权重 0-1

  // 价格信息
  prices: PriceInfo[];

  // 元数据
  metadata?: Record<string, unknown>;
}

// 价格信息
export interface PriceInfo {
  platform: Platform;
  url: string;                 // 购买链接
  price: number;               // 价格
  originalPrice?: number;      // 原价（如有折扣）
  currency: 'CNY' | 'USD' | 'EUR' | 'GBP';
  priceInCNY: number;          // 转换为人民币的价格

  // 购买选项
  purchaseType: 'buy' | 'rent' | 'subscribe';
  rentDuration?: number;       // 租借天数
  subscriptionPeriod?: 'monthly' | 'yearly';

  // 格式
  format?: string;             // PDF, EPUB, MP3 等
  quality?: string;            // 清晰度/音质

  // 可用性
  available: boolean;
  chinaAccessible: boolean;
  supportedPayments: PaymentMethod[];

  // 更新时间
  lastChecked: Date;
}

// 比价结果
export interface PriceComparison {
  resource: PaidResource;
  bestPrice: PriceInfo | null;           // 最低价（全球）
  bestPriceChina: PriceInfo | null;      // 中国大陆最优价
  allPrices: PriceInfo[];
  recommendation: 'highly_recommend' | 'recommend' | 'optional' | 'skip';
  recommendationReason: string;
}

// 预定义的平台列表
export const PLATFORMS: Record<string, Platform> = {
  // 中国大陆平台
  douban_read: {
    id: 'douban_read',
    name: 'Douban Read',
    nameZh: '豆瓣阅读',
    url: 'https://read.douban.com',
    region: 'cn',
    supportedPayments: ['alipay', 'wechat'],
    chinaAccessible: true,
    needsVPN: false,
    currency: 'CNY',
  },
  weread: {
    id: 'weread',
    name: 'WeRead',
    nameZh: '微信读书',
    url: 'https://weread.qq.com',
    region: 'cn',
    supportedPayments: ['wechat'],
    chinaAccessible: true,
    needsVPN: false,
    currency: 'CNY',
  },
  jd_read: {
    id: 'jd_read',
    name: 'JD Read',
    nameZh: '京东读书',
    url: 'https://e.jd.com',
    region: 'cn',
    supportedPayments: ['alipay', 'wechat', 'unionpay'],
    chinaAccessible: true,
    needsVPN: false,
    currency: 'CNY',
  },
  dangdang: {
    id: 'dangdang',
    name: 'Dangdang',
    nameZh: '当当网',
    url: 'https://e.dangdang.com',
    region: 'cn',
    supportedPayments: ['alipay', 'wechat', 'unionpay'],
    chinaAccessible: true,
    needsVPN: false,
    currency: 'CNY',
  },
  cnki: {
    id: 'cnki',
    name: 'CNKI',
    nameZh: '中国知网',
    url: 'https://www.cnki.net',
    region: 'cn',
    supportedPayments: ['alipay', 'wechat', 'unionpay'],
    chinaAccessible: true,
    needsVPN: false,
    currency: 'CNY',
    description: '学术论文数据库',
  },
  ximalaya: {
    id: 'ximalaya',
    name: 'Ximalaya',
    nameZh: '喜马拉雅',
    url: 'https://www.ximalaya.com',
    region: 'cn',
    supportedPayments: ['alipay', 'wechat'],
    chinaAccessible: true,
    needsVPN: false,
    currency: 'CNY',
    description: '有声书和播客',
  },

  // 国际平台（中国可用）
  amazon_cn: {
    id: 'amazon_cn',
    name: 'Amazon China',
    nameZh: '亚马逊中国',
    url: 'https://www.amazon.cn',
    region: 'cn',
    supportedPayments: ['alipay', 'visa', 'mastercard'],
    chinaAccessible: true,
    needsVPN: false,
    currency: 'CNY',
  },
  google_play_books: {
    id: 'google_play_books',
    name: 'Google Play Books',
    nameZh: 'Google Play 图书',
    url: 'https://play.google.com/store/books',
    region: 'global',
    supportedPayments: ['visa', 'mastercard', 'paypal'],
    chinaAccessible: false,
    needsVPN: true,
    currency: 'USD',
  },
  amazon_com: {
    id: 'amazon_com',
    name: 'Amazon US',
    nameZh: '美国亚马逊',
    url: 'https://www.amazon.com',
    region: 'us',
    supportedPayments: ['visa', 'mastercard', 'paypal'],
    chinaAccessible: true,
    needsVPN: false,
    currency: 'USD',
  },
  audible: {
    id: 'audible',
    name: 'Audible',
    nameZh: 'Audible 有声书',
    url: 'https://www.audible.com',
    region: 'global',
    supportedPayments: ['visa', 'mastercard', 'paypal'],
    chinaAccessible: true,
    needsVPN: false,
    currency: 'USD',
    description: '全球最大有声书平台',
  },
  scribd: {
    id: 'scribd',
    name: 'Scribd',
    nameZh: 'Scribd',
    url: 'https://www.scribd.com',
    region: 'global',
    supportedPayments: ['visa', 'mastercard', 'paypal'],
    chinaAccessible: true,
    needsVPN: false,
    currency: 'USD',
    description: '电子书和有声书订阅服务',
  },
  springer: {
    id: 'springer',
    name: 'Springer',
    nameZh: 'Springer 学术出版',
    url: 'https://www.springer.com',
    region: 'global',
    supportedPayments: ['visa', 'mastercard', 'paypal'],
    chinaAccessible: true,
    needsVPN: false,
    currency: 'USD',
    description: '学术论文和图书',
  },
  masterclass: {
    id: 'masterclass',
    name: 'MasterClass',
    nameZh: 'MasterClass 大师课',
    url: 'https://www.masterclass.com',
    region: 'global',
    supportedPayments: ['visa', 'mastercard', 'paypal'],
    chinaAccessible: true,
    needsVPN: false,
    currency: 'USD',
    description: '名人大师课程',
  },
  coursera: {
    id: 'coursera',
    name: 'Coursera',
    nameZh: 'Coursera',
    url: 'https://www.coursera.org',
    region: 'global',
    supportedPayments: ['visa', 'mastercard', 'paypal', 'alipay'],
    chinaAccessible: true,
    needsVPN: false,
    currency: 'USD',
    description: '在线课程平台',
  },
  udemy: {
    id: 'udemy',
    name: 'Udemy',
    nameZh: 'Udemy',
    url: 'https://www.udemy.com',
    region: 'global',
    supportedPayments: ['visa', 'mastercard', 'paypal', 'alipay'],
    chinaAccessible: true,
    needsVPN: false,
    currency: 'USD',
  },
};

// 汇率（用于价格转换）
export const EXCHANGE_RATES: Record<string, number> = {
  USD: 7.2,   // 1 USD = 7.2 CNY
  EUR: 7.8,   // 1 EUR = 7.8 CNY
  GBP: 9.1,   // 1 GBP = 9.1 CNY
  CNY: 1,
};

// 转换价格为人民币
export function convertToCNY(price: number, currency: string): number {
  return price * (EXCHANGE_RATES[currency] || 1);
}
