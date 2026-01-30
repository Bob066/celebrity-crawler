import Anthropic from '@anthropic-ai/sdk';
import { ChatMessage } from '@/types';
import { ILLMAdapter } from './index';

export class ClaudeAdapter implements ILLMAdapter {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model || 'claude-3-opus-20240229';
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
