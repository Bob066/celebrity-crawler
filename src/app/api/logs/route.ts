import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

// 获取爬取日志
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const celebrityId = searchParams.get('celebrityId');
    const since = searchParams.get('since'); // ISO timestamp，获取此时间之后的日志

    let taskIds: string[] = [];

    if (taskId) {
      taskIds = [taskId];
    } else if (celebrityId) {
      // 获取该名人所有任务的日志
      const tasks = await prisma.crawlTask.findMany({
        where: { celebrityId },
        select: { id: true },
      });
      taskIds = tasks.map((t) => t.id);
    }

    if (taskIds.length === 0) {
      return NextResponse.json({ logs: [] });
    }

    const logs = await prisma.crawlLog.findMany({
      where: {
        taskId: { in: taskIds },
        ...(since && { createdAt: { gt: new Date(since) } }),
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // 限制返回数量
    });

    return NextResponse.json({
      logs: logs.map((log) => ({
        id: log.id,
        taskId: log.taskId,
        level: log.level,
        message: log.message,
        details: log.details ? JSON.parse(log.details) : null,
        createdAt: log.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('获取日志失败:', error);
    return NextResponse.json(
      { error: '获取日志失败' },
      { status: 500 }
    );
  }
}
