import { NextRequest, NextResponse } from 'next/server';
import { Celebrity, DataSource, CrawlerConfig } from '@/types';
import { getCrawler } from '@/lib/crawlers';
import prisma from '@/lib/db/prisma';
import { createCrawlLogger } from '@/lib/utils/crawlLogger';

export async function POST(request: NextRequest) {
  try {
    const { celebrity, sources, apiKeys } = (await request.json()) as {
      celebrity: Celebrity;
      sources: DataSource[];
      apiKeys: Record<string, string>;
    };

    if (!celebrity || !sources || sources.length === 0) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 确保名人存在于数据库中
    let celebrityId = celebrity.id;
    if (!celebrityId) {
      const dbCelebrity = await prisma.celebrity.create({
        data: {
          name: celebrity.name,
          aliases: JSON.stringify(celebrity.aliases || []),
          description: celebrity.description,
        },
      });
      celebrityId = dbCelebrity.id;
    }

    // 为每个数据源创建爬取任务
    const tasks = await Promise.all(
      sources.map(async (source) => {
        const task = await prisma.crawlTask.create({
          data: {
            celebrityId,
            source,
            status: 'pending',
          },
        });
        return task;
      })
    );

    // 启动后台爬取（不阻塞响应）
    startCrawling(celebrityId, celebrity, sources, apiKeys).catch((error) => {
      console.error('爬取过程出错:', error);
    });

    return NextResponse.json({
      success: true,
      celebrityId,
      tasks: tasks.map((t) => ({
        id: t.id,
        source: t.source,
        status: t.status,
      })),
    });
  } catch (error) {
    console.error('Crawl API 错误:', error);
    return NextResponse.json(
      { error: '启动爬取失败' },
      { status: 500 }
    );
  }
}

async function startCrawling(
  celebrityId: string,
  celebrity: Celebrity,
  sources: DataSource[],
  apiKeys: Record<string, string>
) {
  for (const source of sources) {
    // 更新任务状态为运行中
    const task = await prisma.crawlTask.findFirst({
      where: { celebrityId, source, status: 'pending' },
    });

    if (!task) continue;

    await prisma.crawlTask.update({
      where: { id: task.id },
      data: { status: 'running', startedAt: new Date() },
    });

    // 创建日志记录器
    const logger = createCrawlLogger(task.id);

    try {
      // 获取 API Key（如果有）
      const apiKey = getApiKeyForSource(source, apiKeys);
      const hasApiKey = !!apiKey && apiKey.trim().length > 0;

      // 根据是否有 API Key 选择爬虫（有 Key 用 API 爬虫，无 Key 用公开爬虫）
      const crawler = getCrawler(source, hasApiKey);

      // 构建爬虫配置
      const config: CrawlerConfig = {
        source,
        apiKey: hasApiKey ? apiKey : undefined,
        maxItems: 100,
      };

      // 验证配置
      if (!crawler.validateConfig(config)) {
        await logger.error(`${source} 配置无效`);
        throw new Error(`${source} 配置无效`);
      }

      await logger.info(`开始爬取 ${source}`, { mode: hasApiKey ? 'API' : '公开' });

      let itemsCrawled = 0;

      // 执行爬取
      for await (const item of crawler.crawl(celebrity, config)) {
        // 保存到数据库
        await prisma.content.create({
          data: {
            celebrityId,
            source: item.source,
            sourceUrl: item.sourceUrl,
            type: item.type,
            priority: item.priority,
            weight: item.weight,
            title: item.title,
            content: item.content,
            summary: item.summary,
            date: item.date,
            author: item.author,
            language: item.language || 'en',
            metadata: item.metadata ? JSON.stringify(item.metadata) : null,
          },
        });

        itemsCrawled++;

        // 记录每条数据
        await logger.info(`获取到: ${item.title || item.type}`, {
          type: item.type,
          source: item.source,
          url: item.sourceUrl,
        });

        // 更新进度
        await prisma.crawlTask.update({
          where: { id: task.id },
          data: {
            itemsCrawled,
            progress: itemsCrawled,
          },
        });
      }

      // 标记完成
      await prisma.crawlTask.update({
        where: { id: task.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          total: itemsCrawled,
        },
      });

      await logger.success(`${source} 爬取完成`, { total: itemsCrawled });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      await logger.error(`爬取失败: ${errorMessage}`);
      console.error(`爬取 ${source} 失败:`, error);

      // 标记失败
      await prisma.crawlTask.update({
        where: { id: task.id },
        data: {
          status: 'failed',
          error: errorMessage,
          completedAt: new Date(),
        },
      });
    }
  }
}

function getApiKeyForSource(
  source: DataSource,
  apiKeys: Record<string, string>
): string | undefined {
  const keyMapping: Record<DataSource, string> = {
    twitter: 'TWITTER_BEARER_TOKEN',
    youtube: 'YOUTUBE_API_KEY',
    news: 'GOOGLE_SEARCH_API_KEY',
    wikipedia: '',
    book: '',
    podcast: 'SPOTIFY_API_KEY',
    blog: '',
  };

  const keyName = keyMapping[source];
  return keyName ? apiKeys[keyName] : undefined;
}
