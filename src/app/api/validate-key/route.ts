import { NextRequest, NextResponse } from 'next/server';
import { LLMProvider } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { provider, apiKey } = await request.json();

    if (!provider || !apiKey) {
      return NextResponse.json(
        { valid: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const isValid = await validateApiKey(provider as LLMProvider, apiKey);

    return NextResponse.json({ valid: isValid });
  } catch (error) {
    console.error('API Key 验证失败:', error);
    return NextResponse.json(
      { valid: false, error: '验证失败' },
      { status: 500 }
    );
  }
}

async function validateApiKey(
  provider: LLMProvider,
  apiKey: string
): Promise<boolean> {
  try {
    if (provider === 'openai') {
      // 验证 OpenAI API Key
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
      return response.ok;
    } else if (provider === 'anthropic') {
      // 验证 Anthropic API Key
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'test' }],
        }),
      });
      // 即使返回错误，只要不是认证错误就说明 key 有效
      return response.ok || response.status !== 401;
    }

    return false;
  } catch {
    return false;
  }
}
