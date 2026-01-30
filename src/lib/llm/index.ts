import { ChatMessage, LLMConfig, LLMProvider } from '@/types';
import { OpenAIAdapter } from './openai';
import { ClaudeAdapter } from './claude';

// LLM 适配器接口
export interface ILLMAdapter {
  chat(messages: ChatMessage[]): Promise<string>;
  streamChat(messages: ChatMessage[]): AsyncGenerator<string>;
}

// 获取 LLM 适配器
export function getLLMAdapter(config: LLMConfig): ILLMAdapter {
  switch (config.provider) {
    case 'openai':
      return new OpenAIAdapter(config.apiKey, config.model);
    case 'anthropic':
      return new ClaudeAdapter(config.apiKey, config.model);
    default:
      throw new Error(`不支持的 LLM 提供者: ${config.provider}`);
  }
}

// 验证 API Key 是否有效
export async function validateApiKey(provider: LLMProvider, apiKey: string): Promise<boolean> {
  try {
    const adapter = getLLMAdapter({ provider, apiKey });
    await adapter.chat([{ role: 'user', content: 'test' }]);
    return true;
  } catch {
    return false;
  }
}

// 名人识别系统提示词
export const CELEBRITY_IDENTIFICATION_PROMPT = `你是一个专业的名人信息助手。你的任务是帮助用户确认他们想要收集信息的名人身份。

当用户输入一个名字时，你需要：
1. 确认具体是哪位名人（如果有同名的情况）
2. 提供该名人的基本信息确认身份
3. 列出该名人可能用到的其他名字/别名

请用JSON格式回复，格式如下：
{
  "confirmed": true/false,
  "celebrity": {
    "name": "完整名字",
    "aliases": ["别名1", "别名2"],
    "description": "简短描述（职业、主要成就等）",
    "disambiguation": "如果有同名情况，解释区分"
  },
  "message": "给用户的确认消息"
}

如果无法确定是哪位名人，请设置 confirmed 为 false，并在 message 中询问更多信息。`;

// 内容分类系统提示词
export const CONTENT_CLASSIFICATION_PROMPT = `你是一个内容分类专家。请根据以下规则对内容进行分类：

优先级规则：
- P1 (权重1.0): 本人直接发言（社交媒体、采访、演讲）
- P2 (权重0.8): 本人作品（授权传记、本人著作）
- P3 (权重0.6): 权威第三方（非授权传记、新闻报道）
- P4 (权重0.5): 综合信息（Wikipedia等）
- P5 (权重0.3): 他人评价

请分析内容并返回JSON格式：
{
  "priority": 1-5,
  "weight": 0.0-1.0,
  "type": "内容类型",
  "isSelfExpression": true/false,
  "summary": "内容摘要（50字以内）"
}`;
