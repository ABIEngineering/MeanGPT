import { GoogleGenerativeAI } from '@google/generative-ai';
import { BaseAIProvider } from './base';
import { Message, AIResponse } from '@/types';

export class GeminiProvider extends BaseAIProvider {
  private client: GoogleGenerativeAI;

  constructor(apiKey: string, model: string = 'gemini-2.5-flash') {
    super(apiKey, model, {
      name: 'gemini',
      displayName: 'Google Gemini',
      model,
    });
    
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async sendMessage(
    messages: Message[],
    options = {
      temperature: 0.7,
      maxTokens: 4000,
      stream: false,
    }
  ): Promise<AIResponse> {
    const maxRetries = 2;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const model = this.client.getGenerativeModel({ 
          model: this.model,
          generationConfig: {
            temperature: options.temperature,
            maxOutputTokens: options.maxTokens,
          },
        });

        const formattedHistory = this.formatMessagesForGemini(messages);
        
        const chat = model.startChat({
          history: formattedHistory.history,
        });

        // Add timeout wrapper
        const sendWithTimeout = () => {
          return Promise.race([
            chat.sendMessage(formattedHistory.currentMessage),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000)
            )
          ]);
        };

        const result = await sendWithTimeout() as any;
        const response = await result.response;
        
        return {
          provider: this.provider,
          content: response.text(),
          timestamp: new Date(),
        };
      } catch (error: any) {
        lastError = error;
        
        // If it's a 503 error, wait a bit before retrying
        if (error.message?.includes('503') || error.message?.includes('overloaded')) {
          if (attempt < maxRetries) {
            console.log(`Gemini attempt ${attempt} failed with 503, retrying in ${attempt * 2}s...`);
            await new Promise(resolve => setTimeout(resolve, attempt * 2000));
            continue;
          }
        }
        
        // For other errors, don't retry
        break;
      }
    }

    return this.handleError(lastError);
  }

  countTokens(messages: Message[]): number {
    const text = messages.map(m => m.content).join(' ');
    return Math.ceil(text.length / 4);
  }

  private formatMessagesForGemini(messages: Message[]): {
    history: Array<{ role: string; parts: Array<{ text: string }> }>;
    currentMessage: string;
  } {
    const allMessages = [...messages];
    const lastMessage = allMessages.pop();
    
    const history = allMessages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

    const systemMessage = messages.find(m => m.role === 'system');
    const currentMessage = systemMessage 
      ? `${systemMessage.content}\n\n${lastMessage?.content || ''}`
      : lastMessage?.content || '';

    return { history, currentMessage };
  }
}