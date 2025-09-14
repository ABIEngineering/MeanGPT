import Anthropic from '@anthropic-ai/sdk';
import { BaseAIProvider } from './base';
import { Message, AIResponse } from '@/types';

export class AnthropicProvider extends BaseAIProvider {
  private client: Anthropic;

  constructor(apiKey: string, model: string = 'claude-sonnet-4-20250514') {
    super(apiKey, model, {
      name: 'anthropic',
      displayName: 'Anthropic Claude',
      model,
    });
    
    this.client = new Anthropic({
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
      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages.filter(m => m.role !== 'system');

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: options.maxTokens || 4000,
        temperature: options.temperature,
        system: systemMessage?.content,
        messages: this.formatMessages(conversationMessages),
      });

      return {
        provider: this.provider,
        content: response.content[0].type === 'text' ? response.content[0].text : '',
        timestamp: new Date(),
        tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  countTokens(messages: Message[]): number {
    const text = messages.map(m => m.content).join(' ');
    return Math.ceil(text.length / 4);
  }

  protected formatMessages(messages: Message[]): Anthropic.MessageParam[] {
    return messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      }));
  }
}