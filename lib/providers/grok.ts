import { BaseAIProvider } from './base';
import { Message, AIResponse } from '@/types';

export class GrokProvider extends BaseAIProvider {
  constructor(apiKey: string, model: string = 'grok-3') {
    super(apiKey, model, {
      name: 'grok',
      displayName: 'xAI Grok',
      model,
    });
  }

  async sendMessage(
    messages: Message[],
    options = {
      temperature: 0.7,
      maxTokens: 4000,
      stream: false,
    }
  ): Promise<AIResponse> {
    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: this.formatMessages(messages),
          temperature: options.temperature,
          max_tokens: options.maxTokens,
          stream: options.stream,
        }),
      });

      if (!response.ok) {
        throw new Error(`Grok API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        provider: this.provider,
        content: data.choices?.[0]?.message?.content || '',
        timestamp: new Date(),
        tokensUsed: data.usage?.total_tokens,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  countTokens(messages: Message[]): number {
    const text = messages.map(m => m.content).join(' ');
    return Math.ceil(text.length / 4);
  }

  protected formatMessages(messages: Message[]): any[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
  }
}