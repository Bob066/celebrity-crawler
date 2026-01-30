'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage, Celebrity, LLMProvider } from '@/types';

interface ChatInterfaceProps {
  llmConfig: {
    provider: LLMProvider;
    apiKey: string;
  };
  onCelebrityConfirmed: (celebrity: Celebrity) => void;
}

export function ChatInterface({
  llmConfig,
  onCelebrityConfirmed,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        '你好！我是名人信息收集助手。请告诉我你想收集哪位名人的信息？\n\n你可以输入名人的名字，例如：\n- 马斯克\n- Elon Musk\n- 乔布斯\n- Steve Jobs',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingCelebrity, setPendingCelebrity] = useState<Celebrity | null>(
    null
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: userMessage }],
          llmConfig,
        }),
      });

      const data = await response.json();

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `错误: ${data.error}` },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.message },
        ]);

        // 如果识别到名人，显示确认按钮
        if (data.celebrity && data.confirmed) {
          setPendingCelebrity(data.celebrity);
        }
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '抱歉，发生了错误。请稍后重试。',
        },
      ]);
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (pendingCelebrity) {
      onCelebrityConfirmed(pendingCelebrity);
      setPendingCelebrity(null);
    }
  };

  const handleReject = () => {
    setPendingCelebrity(null);
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: '好的，请提供更多信息帮助我确认您要找的名人。',
      },
    ]);
  };

  return (
    <div className="bg-white rounded-lg shadow h-[600px] flex flex-col">
      {/* 聊天头部 */}
      <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg">
        <h2 className="font-semibold text-gray-900">AI 助手</h2>
        <p className="text-xs text-gray-500">
          使用 {llmConfig.provider === 'openai' ? 'OpenAI GPT-4' : 'Claude'}{' '}
          进行名人识别
        </p>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            } message-fade-in`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="whitespace-pre-wrap text-sm">{message.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.1s' }}
                />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.2s' }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 名人确认卡片 */}
      {pendingCelebrity && (
        <div className="px-4 py-3 bg-blue-50 border-t border-blue-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-blue-900">
                确认名人: {pendingCelebrity.name}
              </p>
              <p className="text-sm text-blue-700">
                {pendingCelebrity.description}
              </p>
              {pendingCelebrity.aliases.length > 0 && (
                <p className="text-xs text-blue-600 mt-1">
                  别名: {pendingCelebrity.aliases.join(', ')}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleReject}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                不是
              </button>
              <button
                onClick={handleConfirm}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 输入框 */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入名人名字..."
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            发送
          </button>
        </div>
      </form>
    </div>
  );
}
