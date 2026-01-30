import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const celebrityId = searchParams.get('celebrityId');

    if (!celebrityId) {
      return NextResponse.json(
        { error: '缺少 celebrityId 参数' },
        { status: 400 }
      );
    }

    // 总数
    const total = await prisma.content.count({
      where: { celebrityId },
    });

    // 按来源统计
    const bySourceRaw = await prisma.content.groupBy({
      by: ['source'],
      where: { celebrityId },
      _count: true,
    });

    const bySource = Object.fromEntries(
      bySourceRaw.map((item) => [item.source, item._count])
    );

    // 按优先级统计
    const byPriorityRaw = await prisma.content.groupBy({
      by: ['priority'],
      where: { celebrityId },
      _count: true,
    });

    const byPriority = Object.fromEntries(
      byPriorityRaw.map((item) => [item.priority, item._count])
    );

    return NextResponse.json({
      total,
      bySource,
      byPriority,
    });
  } catch (error) {
    console.error('Stats API 错误:', error);
    return NextResponse.json(
      { error: '获取统计失败' },
      { status: 500 }
    );
  }
}
