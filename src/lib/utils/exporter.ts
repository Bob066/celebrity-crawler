import { Celebrity, ContentItem, DataSource, ExportOptions, ExportResult } from '@/types';
import { format } from 'date-fns';

// 数据导出器
export class DataExporter {
  // 生成导出结果
  static generateExportResult(
    celebrity: Celebrity,
    contents: ContentItem[]
  ): ExportResult {
    // 统计数据
    const sources = Array.from(new Set(contents.map((c) => c.source)));
    const priorityDistribution: Record<number, number> = {};

    contents.forEach((c) => {
      priorityDistribution[c.priority] =
        (priorityDistribution[c.priority] || 0) + 1;
    });

    return {
      celebrity,
      metadata: {
        exportDate: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        totalItems: contents.length,
        sources,
        priorityDistribution,
      },
      contents,
    };
  }

  // 导出为 JSON
  static exportToJson(result: ExportResult, options?: ExportOptions): string {
    const exportData = {
      ...result,
      contents: options?.splitByPriority
        ? this.groupByPriority(result.contents)
        : options?.splitBySource
        ? this.groupBySource(result.contents)
        : result.contents,
    };

    return JSON.stringify(exportData, null, 2);
  }

  // 导出为 Markdown
  static exportToMarkdown(
    result: ExportResult,
    options?: ExportOptions
  ): string {
    const lines: string[] = [];

    // 标题
    lines.push(`# ${result.celebrity.name} 数据集`);
    lines.push('');

    // 概览
    lines.push('## 概览');
    lines.push('');
    lines.push(`- **导出日期**: ${result.metadata.exportDate}`);
    lines.push(`- **数据总量**: ${result.metadata.totalItems} 条`);
    lines.push(`- **数据来源**: ${result.metadata.sources.join(', ')}`);
    lines.push('');

    // 别名
    if (result.celebrity.aliases.length > 0) {
      lines.push(`- **别名**: ${result.celebrity.aliases.join(', ')}`);
      lines.push('');
    }

    // 简介
    if (result.celebrity.description) {
      lines.push(`- **简介**: ${result.celebrity.description}`);
      lines.push('');
    }

    // 优先级分布
    lines.push('## 优先级分布');
    lines.push('');
    const priorityLabels: Record<number, string> = {
      1: 'P1 - 本人直接发言',
      2: 'P2 - 本人作品',
      3: 'P3 - 权威第三方',
      4: 'P4 - 综合信息',
      5: 'P5 - 他人评价',
    };

    for (const [priority, count] of Object.entries(
      result.metadata.priorityDistribution
    )) {
      const label = priorityLabels[parseInt(priority)] || `P${priority}`;
      lines.push(`- ${label}: ${count} 条`);
    }
    lines.push('');

    // 内容
    if (options?.splitByPriority) {
      // 按优先级分组
      const grouped = this.groupByPriority(result.contents);
      for (const [priority, items] of Object.entries(grouped)) {
        lines.push(`## ${priorityLabels[parseInt(priority)] || `优先级 ${priority}`}`);
        lines.push('');
        this.appendContentItems(lines, items as ContentItem[]);
      }
    } else if (options?.splitBySource) {
      // 按来源分组
      const grouped = this.groupBySource(result.contents);
      for (const [source, items] of Object.entries(grouped)) {
        lines.push(`## 来源: ${source}`);
        lines.push('');
        this.appendContentItems(lines, items as ContentItem[]);
      }
    } else {
      // 不分组，按优先级排序
      const sorted = [...result.contents].sort(
        (a, b) => a.priority - b.priority
      );
      lines.push('## 内容');
      lines.push('');
      this.appendContentItems(lines, sorted);
    }

    // 页脚
    lines.push('---');
    lines.push('');
    lines.push('*本数据集由名人信息爬虫系统自动生成*');

    return lines.join('\n');
  }

  // 按优先级分组
  private static groupByPriority(
    contents: ContentItem[]
  ): Record<number, ContentItem[]> {
    const grouped: Record<number, ContentItem[]> = {};
    contents.forEach((item) => {
      if (!grouped[item.priority]) {
        grouped[item.priority] = [];
      }
      grouped[item.priority].push(item);
    });
    return grouped;
  }

  // 按来源分组
  private static groupBySource(
    contents: ContentItem[]
  ): Record<DataSource, ContentItem[]> {
    const grouped: Record<string, ContentItem[]> = {};
    contents.forEach((item) => {
      if (!grouped[item.source]) {
        grouped[item.source] = [];
      }
      grouped[item.source].push(item);
    });
    return grouped as Record<DataSource, ContentItem[]>;
  }

  // 添加内容条目到 Markdown
  private static appendContentItems(
    lines: string[],
    items: ContentItem[]
  ): void {
    items.forEach((item, index) => {
      // 标题行
      const dateStr = item.date
        ? format(new Date(item.date), 'yyyy-MM-dd')
        : '日期未知';
      const titlePart = item.title ? `**${item.title}**` : '';

      lines.push(`### ${index + 1}. ${titlePart || item.type}`);
      lines.push('');

      // 元信息
      lines.push(
        `> 来源: ${item.source} | 类型: ${item.type} | 日期: ${dateStr} | 权重: ${item.weight.toFixed(2)}`
      );

      if (item.sourceUrl) {
        lines.push(`> 链接: ${item.sourceUrl}`);
      }

      if (item.author) {
        lines.push(`> 作者: ${item.author}`);
      }

      lines.push('');

      // 内容
      const content = item.content.length > 2000
        ? item.content.substring(0, 2000) + '...(内容已截断)'
        : item.content;

      lines.push(content);
      lines.push('');
      lines.push('---');
      lines.push('');
    });
  }

  // 生成训练数据格式（用于 Agent 训练）
  static exportForTraining(result: ExportResult): string {
    const trainingData = result.contents
      .sort((a, b) => a.priority - b.priority)
      .map((item) => ({
        text: item.content,
        source: item.source,
        type: item.type,
        priority: item.priority,
        weight: item.weight,
        date: item.date,
        metadata: {
          title: item.title,
          url: item.sourceUrl,
          author: item.author,
        },
      }));

    return JSON.stringify(
      {
        celebrity: {
          name: result.celebrity.name,
          aliases: result.celebrity.aliases,
        },
        training_data: trainingData,
      },
      null,
      2
    );
  }
}
