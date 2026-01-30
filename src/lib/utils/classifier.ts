import { ContentItem, ContentType, DataSource, PRIORITY_CONFIG } from '@/types';

// 内容分类器
export class ContentClassifier {
  // 根据数据源和内容类型自动分配优先级和权重
  static classify(
    source: DataSource,
    type: ContentType,
    metadata?: Record<string, unknown>
  ): { priority: number; weight: number } {
    // 默认值
    let priority = 4;
    let weight = 0.5;

    // 根据数据源分类
    switch (source) {
      case 'twitter':
        // Twitter 是本人直接发言
        priority = 1;
        weight = 1.0;
        break;

      case 'youtube':
        // YouTube 视频，判断是否是本人频道
        if (metadata?.isOwnChannel) {
          priority = 1;
          weight = 1.0;
        } else {
          priority = 1; // 采访也算本人发言
          weight = 1.0;
        }
        break;

      case 'wikipedia':
        priority = 4;
        weight = 0.5;
        break;

      case 'news':
        priority = 3;
        weight = 0.6;
        break;

      case 'book':
        if (type === 'autobiography' || metadata?.isSelfAuthored) {
          priority = 2;
          weight = 0.8;
        } else if (type === 'biography') {
          if (metadata?.isAuthorized) {
            priority = 2;
            weight = 0.8;
          } else {
            priority = 3;
            weight = 0.6;
          }
        } else {
          priority = 3;
          weight = 0.6;
        }
        break;

      case 'podcast':
        // 播客出镜算本人发言
        priority = 1;
        weight = 1.0;
        break;

      case 'blog':
        // 博客需要判断是否是本人的博客
        if (metadata?.isOwnBlog) {
          priority = 1;
          weight = 1.0;
        } else {
          priority = 5;
          weight = 0.3;
        }
        break;

      default:
        priority = 5;
        weight = 0.3;
    }

    // 根据内容类型微调
    switch (type) {
      case 'tweet':
      case 'reply':
        // 本人推文和回复
        priority = 1;
        weight = 1.0;
        break;

      case 'retweet':
        // 转推权重略低
        priority = 1;
        weight = 0.9;
        break;

      case 'interview':
      case 'speech':
        // 采访和演讲是本人直接发言
        priority = 1;
        weight = 1.0;
        break;

      case 'quote':
        // 引用的话需要验证来源
        if (metadata?.verified) {
          priority = 1;
          weight = 0.95;
        } else {
          priority = 3;
          weight = 0.6;
        }
        break;

      case 'wiki':
        priority = 4;
        weight = 0.5;
        break;

      case 'news':
      case 'article':
        priority = 3;
        weight = 0.6;
        break;
    }

    return { priority, weight };
  }

  // 批量分类
  static classifyBatch(items: ContentItem[]): ContentItem[] {
    return items.map((item) => {
      const { priority, weight } = this.classify(
        item.source,
        item.type,
        item.metadata as Record<string, unknown>
      );
      return {
        ...item,
        priority,
        weight,
      };
    });
  }

  // 获取优先级描述
  static getPriorityDescription(priority: number): string {
    const descriptions: Record<number, string> = {
      1: 'P1 - 本人直接发言（社交媒体、采访、演讲）',
      2: 'P2 - 本人作品（授权传记、本人著作）',
      3: 'P3 - 权威第三方（非授权传记、新闻报道）',
      4: 'P4 - 综合信息（Wikipedia等）',
      5: 'P5 - 他人评价',
    };
    return descriptions[priority] || '未知优先级';
  }

  // 计算内容的综合得分
  static calculateScore(item: ContentItem): number {
    // 基础分数 = 权重
    let score = item.weight;

    // 根据内容长度加分（更长的内容可能更有价值）
    const contentLength = item.content.length;
    if (contentLength > 1000) {
      score *= 1.1;
    } else if (contentLength > 500) {
      score *= 1.05;
    }

    // 如果有日期，较新的内容加分
    if (item.date) {
      const ageInDays =
        (Date.now() - new Date(item.date).getTime()) / (1000 * 60 * 60 * 24);
      if (ageInDays < 30) {
        score *= 1.1;
      } else if (ageInDays < 365) {
        score *= 1.05;
      }
    }

    // 确保分数在 0-1 范围内
    return Math.min(1, Math.max(0, score));
  }
}

// 导出优先级配置供其他模块使用
export { PRIORITY_CONFIG };
