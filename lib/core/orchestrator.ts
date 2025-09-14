import { OpenAIProvider } from '../providers/openai';
import { AnthropicProvider } from '../providers/anthropic';
import { GeminiProvider } from '../providers/gemini';
import { GrokProvider } from '../providers/grok';
import { BaseAIProvider } from '../providers/base';
import { Message, AIResponse, AggregatedResponse } from '@/types';

export class AIOrchestrator {
  private providers: Map<string, BaseAIProvider> = new Map();

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    const grokKey = process.env.GROK_API_KEY;

    if (openaiKey) {
      this.providers.set('openai', new OpenAIProvider(
        openaiKey,
        process.env.OPENAI_MODEL || 'gpt-4o-mini'
      ));
    }

    if (anthropicKey) {
      this.providers.set('anthropic', new AnthropicProvider(
        anthropicKey,
        process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'
      ));
    }

    if (geminiKey) {
      this.providers.set('gemini', new GeminiProvider(
        geminiKey,
        process.env.GEMINI_MODEL || 'gemini-1.5-flash'
      ));
    }

    if (grokKey) {
      this.providers.set('grok', new GrokProvider(
        grokKey,
        process.env.GROK_MODEL || 'grok-2-1212'
      ));
    }
  }

  async queryAllProviders(
    messages: Message[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      providers?: string[];
    }
  ): Promise<AggregatedResponse> {
    const activeProviders = options?.providers 
      ? Array.from(this.providers.entries()).filter(([name]) => options.providers?.includes(name))
      : Array.from(this.providers.entries());

    const promises = activeProviders.map(([name, provider]) => 
      provider.sendMessage(messages, {
        temperature: options?.temperature || 0.7,
        maxTokens: options?.maxTokens || 4000,
        stream: false,
      })
    );

    const startTime = Date.now();
    const responses = await Promise.allSettled(promises);
    
    const successfulResponses: AIResponse[] = [];
    const failedResponses: AIResponse[] = [];

    responses.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successfulResponses.push(result.value);
      } else {
        const [name, provider] = activeProviders[index];
        failedResponses.push({
          provider: provider.provider,
          content: '',
          error: result.reason?.message || 'Unknown error',
          timestamp: new Date(),
        });
      }
    });

    const allResponses = [...successfulResponses, ...failedResponses];
    
    return {
      responses: allResponses,
      summary: this.createSummaries(allResponses),
      timestamp: new Date(),
    };
  }

  async querySingleProvider(
    providerName: string,
    messages: Message[],
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<AIResponse> {
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      return {
        provider: {
          name: providerName as any,
          displayName: providerName,
          model: 'unknown',
        },
        content: '',
        error: `Provider ${providerName} not configured`,
        timestamp: new Date(),
      };
    }

    return provider.sendMessage(messages, options);
  }

  private createSummaries(responses: AIResponse[]): AggregatedResponse['summary'] {
    const summary: AggregatedResponse['summary'] = {};
    
    responses.forEach(response => {
      if (response.content) {
        const preview = response.content.length > 200 
          ? response.content.substring(0, 197) + '...'
          : response.content;
        summary[response.provider.name] = preview;
      } else if (response.error) {
        summary[response.provider.name] = `Error: ${response.error}`;
      }
    });

    return summary;
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}