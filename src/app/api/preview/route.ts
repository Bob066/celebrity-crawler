import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const celebrityId = searchParams.get('celebrityId');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const priority = searchParams.get('priority');
    const source = searchParams.get('source');

    if (!celebrityId) {
      return NextResponse.json(
        { error: '缺少 celebrityId 参数' },
        { status: 400 }
      );
    }

    // 构建查询条件
    const where: {
      celebrityId: string;
      priority?: number;
      source?: string;
    } = { celebrityId };

    if (priority) {
      where.priority = parseInt(priority);
    }

    if (source) {
      where.source = source;
    }

    // 获取内容
    const contents = await prisma.content.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { weight: 'desc' }, { date: 'desc' }],
      take: limit,
      skip: offset,
    });

    // 转换数据格式
    const formattedContents = contents.map((c) => ({
      id: c.id,
      source: c.source,
      sourceUrl: c.sourceUrl,
      type: c.type,
      priority: c.priority,
      weight: c.weight,
      title: c.title,
      content: c.content,
      summary: c.summary,
      date: c.date,
      author: c.author,
      language: c.language,
      metadata: c.metadata ? JSON.parse(c.metadata) : null,
    }));

    // 获取总数
    const total = await prisma.content.count({ where });

    return NextResponse.json({
      contents: formattedContents,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Preview API 错误:', error);
    return NextResponse.json(
      { error: '获取预览失败' },
      { status: 500 }
    );
  }
}
