// 数据源类型
export type DataSource =
  | 'twitter'
  | 'youtube'
  | 'wikipedia'
  | 'news'
  | 'book'
  | 'podcast'
  | 'blog';

// 内容类型
export type ContentType =
  | 'tweet'
  | 'retweet'
  | 'reply'
  | 'interview'
  | 'speech'
  | 'podcast_episode'
  | 'biography'
  | 'autobiography'
  | 'article'
  | 'news'
  | 'wiki'
  | 'blog_post'
  | 'quote'
  | 'other';

// 优先级配置
export interface PriorityConfig {
  level: 1 | 2 | 3 | 4 | 5;
  weight: number;
  description: string;
}

// 预定义的优先级
export const PRIORITY_CONFIG: Record<string, PriorityConfig> = {
  // P1: 本人直接发言
  self_social_media: { level: 1, weight: 1.0, description: '本人社交媒体发言' },
  self_interview: { level: 1, weight: 1.0, description: '本人采访/演讲' },

  // P2: 本人作品
  authorized_biography: { level: 2, weight: 0.8, description: '授权传记' },
  self_authored: { level: 2, weight: 0.8, description: '本人著作' },

  // P3: 第三方权威来源
  unauthorized_biography: { level: 3, weight: 0.6, description: '非授权传记' },
  news_report: { level: 3, weight: 0.6, description: '新闻报道' },

  // P4: 综合信息
  wikipedia: { level: 4, weight: 0.5, description: 'Wikipedia' },

  // P5: 他人评价
  third_party_opinion: { level: 5, weight: 0.3, description: '他人评论/评价' },
};

// 内容条目
export interface ContentItem {
  id?: string;
  source: DataSource;
  sourceUrl?: string;
  type: ContentType;
  priority: number;
  weight: number;
  title?: string;
  content: string;
  summary?: string;
  date?: Date;
  author?: string;
  language?: string;
  metadata?: Record<string, unknown>;
}

// 名人信息
export interface Celebrity {
  id?: string;
  name: string;
  aliases: string[];
  description?: string;
  imageUrl?: string;
}

// 爬取任务状态
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

// 爬取任务
export interface CrawlTask {
  id: string;
  celebrityId: string;
  source: DataSource;
  status: TaskStatus;
  progress: number;
  total: number;
  itemsCrawled: number;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

// 聊天消息
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// LLM 提供者
export type LLMProvider = 'openai' | 'anthropic';

// LLM 配置
export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model?: string;
}

// 爬虫配置
export interface CrawlerConfig {
  source: DataSource;
  apiKey?: string;
  maxItems?: number;
  startDate?: Date;
  endDate?: Date;
}

// 导出格式
export type ExportFormat = 'json' | 'markdown' | 'both';

// 导出选项
export interface ExportOptions {
  format: ExportFormat;
  includeMetadata: boolean;
  splitByPriority: boolean;
  splitBySource: boolean;
}

// 导出结果
export interface ExportResult {
  celebrity: Celebrity;
  metadata: {
    exportDate: string;
    totalItems: number;
    sources: DataSource[];
    priorityDistribution: Record<number, number>;
  };
  contents: ContentItem[];
}

// API 响应
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// 爬虫基类接口
export interface ICrawler {
  source: DataSource;
  crawl(celebrity: Celebrity, config?: CrawlerConfig): AsyncGenerator<ContentItem>;
  validateConfig(config: CrawlerConfig): boolean;
}
