import OpenAI from 'openai';
import { BaseAIProvider } from './base';
import { Message, AIResponse } from '@/types';

export class OpenAIProvider extends BaseAIProvider {
  private client: OpenAI;

  constructor(apiKey: string, model: string = 'gpt-4o') {
    super(apiKey, model, {
      name: 'openai',
      displayName: 'OpenAI ChatGPT',
      model,
    });
    
    this.client = new OpenAI({
      apiKey: this.apiKey,
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
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: this.formatMessages(messages),
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        stream: options.stream,
      });

      if (options.stream) {
        return {
          provider: this.provider,
          content: 'Streaming not yet implemented',
          timestamp: new Date(),
        };
      }

      const response = completion as OpenAI.Chat.ChatCompletion;
      
      return {
        provider: this.provider,
        content: response.choices[0]?.message?.content || '',
        timestamp: new Date(),
        tokensUsed: response.usage?.total_tokens,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  countTokens(messages: Message[]): number {
    const text = messages.map(m => m.content).join(' ');
    return Math.ceil(text.length / 4);
  }

  protected formatMessages(messages: Message[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    }));
  }
}