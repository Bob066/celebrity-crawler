import { NextRequest, NextResponse } from 'next/server';
import { getLLMAdapter, CELEBRITY_IDENTIFICATION_PROMPT } from '@/lib/llm';
import { ChatMessage, Celebrity, LLMConfig } from '@/types';
import prisma from '@/lib/db/prisma';

export async function POST(request: NextRequest) {
  try {
    const { messages, llmConfig } = (await request.json()) as {
      messages: ChatMessage[];
      llmConfig: LLMConfig;
    };

    if (!messages || !llmConfig) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 构建完整的消息列表，包含系统提示
    const fullMessages: ChatMessage[] = [
      { role: 'system', content: CELEBRITY_IDENTIFICATION_PROMPT },
      ...messages,
    ];

    // 调用 LLM
    const adapter = getLLMAdapter(llmConfig);
    const response = await adapter.chat(fullMessages);

    // 尝试解析 JSON 响应
    let result: {
      confirmed: boolean;
      celebrity?: {
        name: string;
        aliases: string[];
        description?: string;
      };
      message: string;
    };

    try {
      // 尝试从响应中提取 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        // 如果没有 JSON，直接返回响应文本
        return NextResponse.json({
          message: response,
          confirmed: false,
        });
      }
    } catch {
      // JSON 解析失败，直接返回响应文本
      return NextResponse.json({
        message: response,
        confirmed: false,
      });
    }

    // 如果确认了名人，保存到数据库
    let savedCelebrity: Celebrity | null = null;
    if (result.confirmed && result.celebrity) {
      try {
        const dbCelebrity = await prisma.celebrity.create({
          data: {
            name: result.celebrity.name,
            aliases: JSON.stringify(result.celebrity.aliases || []),
            description: result.celebrity.description,
          },
        });

        savedCelebrity = {
          id: dbCelebrity.id,
          name: dbCelebrity.name,
          aliases: JSON.parse(dbCelebrity.aliases),
          description: dbCelebrity.description || undefined,
        };
      } catch (dbError) {
        console.error('保存名人信息失败:', dbError);
        // 不阻止流程，返回未保存的信息
        savedCelebrity = {
          name: result.celebrity.name,
          aliases: result.celebrity.aliases || [],
          description: result.celebrity.description,
        };
      }
    }

    return NextResponse.json({
      message: result.message,
      confirmed: result.confirmed,
      celebrity: savedCelebrity,
    });
  } catch (error) {
    console.error('Chat API 错误:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json(
      { error: `处理请求时发生错误: ${errorMessage}` },
      { status: 500 }
    );
  }
}
