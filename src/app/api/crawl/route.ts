import { NextRequest, NextResponse } from 'next/server';
import { Celebrity, DataSource, CrawlerConfig } from '@/types';
import { getCrawler } from '@/lib/crawlers';
import prisma from '@/lib/db/prisma';

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

    try {
      const crawler = getCrawler(source);

      // 构建爬虫配置
      const config: CrawlerConfig = {
        source,
        apiKey: getApiKeyForSource(source, apiKeys),
        maxItems: 100,
      };

      // 验证配置
      if (!crawler.validateConfig(config)) {
        throw new Error(`${source} 配置无效`);
      }

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
    } catch (error) {
      console.error(`爬取 ${source} 失败:`, error);

      // 标记失败
      await prisma.crawlTask.update({
        where: { id: task.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : '未知错误',
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
