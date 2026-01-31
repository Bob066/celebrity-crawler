import Anthropic from '@anthropic-ai/sdk';
import { ChatMessage } from '@/types';
import { ILLMAdapter } from './index';

export class ClaudeAdapter implements ILLMAdapter {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model?: string, baseURL?: string) {
    // 支持自定义 API 代理
    // 优先使用环境变量中的 token，否则使用传入的 apiKey
    const token = process.env.ANTHROPIC_AUTH_TOKEN || apiKey;
    const options: { apiKey: string; baseURL?: string; defaultHeaders?: Record<string, string> } = {
      apiKey: token,
    };

    if (baseURL || process.env.ANTHROPIC_BASE_URL) {
      options.baseURL = baseURL || process.env.ANTHROPIC_BASE_URL;
    }

    // 如果是自定义代理（token 以 cr_ 开头），添加 Authorization 头
    if (token.startsWith('cr_')) {
      options.defaultHeaders = {
        'Authorization': `Bearer ${token}`,
      };
    }

    this.client = new Anthropic(options);
    // 使用 Claude 4.5 Sonnet 作为默认模型
    this.model = model || 'claude-sonnet-4-20250514';
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    // 分离系统消息和对话消息
    const systemMessage = messages.find((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: systemMessage?.content,
      messages: conversationMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    return textBlock && 'text' in textBlock ? textBlock.text : '';
  }

  async *streamChat(messages: ChatMessage[]): AsyncGenerator<string> {
    const systemMessage = messages.find((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 4096,
      system: systemMessage?.content,
      messages: conversationMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }
  }
}
