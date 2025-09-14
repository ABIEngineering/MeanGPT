import { Message, AIResponse, AIProvider } from '@/types';

export abstract class BaseAIProvider {
  protected apiKey: string;
  protected model: string;
  public provider: AIProvider;

  constructor(apiKey: string, model: string, provider: AIProvider) {
    this.apiKey = apiKey;
    this.model = model;
    this.provider = provider;
  }

  abstract sendMessage(
    messages: Message[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    }
  ): Promise<AIResponse>;

  abstract countTokens(messages: Message[]): number;

  protected handleError(error: any): AIResponse {
    console.error(`Error from ${this.provider.displayName}:`, error);
    return {
      provider: this.provider,
      content: '',
      error: error.message || 'Unknown error occurred',
      timestamp: new Date(),
    };
  }

  protected formatMessages(messages: Message[]): any[] {
    return messages;
  }
}