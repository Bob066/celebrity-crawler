import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { DataExporter } from '@/lib/utils/exporter';
import { Celebrity, ContentItem } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { celebrityId, format } = (await request.json()) as {
      celebrityId: string;
      format: 'json' | 'markdown' | 'both';
    };

    if (!celebrityId) {
      return NextResponse.json(
        { error: '缺少 celebrityId 参数' },
        { status: 400 }
      );
    }

    // 获取名人信息
    const dbCelebrity = await prisma.celebrity.findUnique({
      where: { id: celebrityId },
    });

    if (!dbCelebrity) {
      return NextResponse.json(
        { error: '名人不存在' },
        { status: 404 }
      );
    }

    const celebrity: Celebrity = {
      id: dbCelebrity.id,
      name: dbCelebrity.name,
      aliases: JSON.parse(dbCelebrity.aliases),
      description: dbCelebrity.description || undefined,
      imageUrl: dbCelebrity.imageUrl || undefined,
    };

    // 获取所有内容
    const dbContents = await prisma.content.findMany({
      where: { celebrityId },
      orderBy: [{ priority: 'asc' }, { weight: 'desc' }, { date: 'desc' }],
    });

    const contents: ContentItem[] = dbContents.map((c) => ({
      id: c.id,
      source: c.source as ContentItem['source'],
      sourceUrl: c.sourceUrl || undefined,
      type: c.type as ContentItem['type'],
      priority: c.priority,
      weight: c.weight,
      title: c.title || undefined,
      content: c.content,
      summary: c.summary || undefined,
      date: c.date || undefined,
      author: c.author || undefined,
      language: c.language,
      metadata: c.metadata ? JSON.parse(c.metadata) : undefined,
    }));

    // 生成导出结果
    const exportResult = DataExporter.generateExportResult(celebrity, contents);

    // 根据格式生成内容
    if (format === 'json') {
      const jsonContent = DataExporter.exportToJson(exportResult, {
        format: 'json',
        includeMetadata: true,
        splitByPriority: true,
        splitBySource: false,
      });

      return new NextResponse(jsonContent, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(
            celebrity.name
          )}-dataset.json"`,
        },
      });
    } else if (format === 'markdown') {
      const mdContent = DataExporter.exportToMarkdown(exportResult, {
        format: 'markdown',
        includeMetadata: true,
        splitByPriority: true,
        splitBySource: false,
      });

      return new NextResponse(mdContent, {
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(
            celebrity.name
          )}-dataset.md"`,
        },
      });
    } else {
      // 导出两种格式，打包成简单的合并内容
      const jsonContent = DataExporter.exportToJson(exportResult, {
        format: 'json',
        includeMetadata: true,
        splitByPriority: true,
        splitBySource: false,
      });

      const mdContent = DataExporter.exportToMarkdown(exportResult, {
        format: 'markdown',
        includeMetadata: true,
        splitByPriority: true,
        splitBySource: false,
      });

      // 训练数据格式
      const trainingContent = DataExporter.exportForTraining(exportResult);

      // 创建一个包含所有文件内容的 JSON
      const allContent = JSON.stringify(
        {
          files: [
            {
              name: `${celebrity.name}-dataset.json`,
              type: 'application/json',
              content: jsonContent,
            },
            {
              name: `${celebrity.name}-dataset.md`,
              type: 'text/markdown',
              content: mdContent,
            },
            {
              name: `${celebrity.name}-training.json`,
              type: 'application/json',
              content: trainingContent,
            },
          ],
        },
        null,
        2
      );

      return new NextResponse(allContent, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(
            celebrity.name
          )}-all-formats.json"`,
        },
      });
    }
  } catch (error) {
    console.error('Export API 错误:', error);
    return NextResponse.json(
      { error: '导出失败' },
      { status: 500 }
    );
  }
}
