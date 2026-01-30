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

    // 获取所有任务状态
    const tasks = await prisma.crawlTask.findMany({
      where: { celebrityId },
      orderBy: { createdAt: 'desc' },
    });

    // 获取内容统计
    const contentStats = await prisma.content.groupBy({
      by: ['source'],
      where: { celebrityId },
      _count: true,
    });

    const totalContent = await prisma.content.count({
      where: { celebrityId },
    });

    return NextResponse.json({
      tasks: tasks.map((task) => ({
        id: task.id,
        source: task.source,
        status: task.status,
        progress: task.progress,
        total: task.total,
        itemsCrawled: task.itemsCrawled,
        error: task.error,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
      })),
      stats: {
        totalContent,
        bySource: Object.fromEntries(
          contentStats.map((s) => [s.source, s._count])
        ),
      },
    });
  } catch (error) {
    console.error('Status API 错误:', error);
    return NextResponse.json(
      { error: '获取状态失败' },
      { status: 500 }
    );
  }
}
