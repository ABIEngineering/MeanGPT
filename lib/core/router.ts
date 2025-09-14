import { ContextManager } from './context-manager';
import { AIOrchestrator } from './orchestrator';
import { ResponseAggregator } from './aggregator';
import { Message, AggregatedResponse } from '@/types';

export class MeanGPTRouter {
  private contextManager: ContextManager;
  private orchestrator: AIOrchestrator;
  private aggregator: ResponseAggregator;

  constructor() {
    this.contextManager = new ContextManager();
    this.orchestrator = new AIOrchestrator();
    this.aggregator = new ResponseAggregator();
  }

  async processMessage(
    conversationId: string,
    userMessage: string
  ): Promise<{
    response: string;
    conversationId: string;
    routing: {
      shouldForward: boolean;
      providers?: string[];
      reason: string;
    };
    aggregatedData?: AggregatedResponse;
  }> {
    let conversation = this.contextManager.getConversation(conversationId);
    if (!conversation) {
      conversation = this.contextManager.createConversation(conversationId);
    }

    const userMsg: Message = {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };

    this.contextManager.addMessage(conversationId, userMsg);

    const routing = await this.contextManager.shouldForwardToAIs(conversationId, userMessage);

    if (!routing.shouldForward) {
      const response = await this.handleDirectResponse(conversationId, userMessage);
      return {
        response,
        conversationId,
        routing,
      };
    }

    const aggregatedResponse = await this.handleAIForwarding(
      conversationId,
      userMessage,
      routing.providers
    );

    const analyzedResponse = await this.aggregator.analyzeResponses(
      aggregatedResponse,
      userMessage
    );

    const formattedResponse = this.aggregator.createFormattedResponse(analyzedResponse);

    const assistantMsg: Message = {
      role: 'assistant',
      content: formattedResponse,
      timestamp: new Date(),
    };

    this.contextManager.addMessage(conversationId, assistantMsg);

    return {
      response: formattedResponse,
      conversationId,
      routing,
      aggregatedData: analyzedResponse,
    };
  }

  private async handleDirectResponse(
    conversationId: string,
    userMessage: string
  ): Promise<string> {
    const context = await this.contextManager.getMasterContext(conversationId);
    const messages = [...context, { role: 'user', content: userMessage }] as Message[];

    const directResponse = await this.orchestrator.querySingleProvider(
      'openai',
      messages
    );

    if (directResponse.error) {
      return `MeanGPT: I encountered an error processing your request: ${directResponse.error}`;
    }

    return directResponse.content;
  }

  private async handleAIForwarding(
    conversationId: string,
    userMessage: string,
    specificProviders?: string[]
  ): Promise<AggregatedResponse> {
    const providers = ['openai', 'anthropic', 'gemini', 'grok'];
    const activeProviders = specificProviders || providers;

    const responses = await Promise.all(
      activeProviders.map(async (provider) => {
        const context = await this.contextManager.getMessagesForProvider(
          conversationId,
          provider as 'openai' | 'anthropic' | 'gemini' | 'grok'
        );

        const messages = [...context, { role: 'user', content: userMessage }] as Message[];

        const response = await this.orchestrator.querySingleProvider(provider, messages);

        await this.contextManager.addAIMessage(
          conversationId,
          provider as 'openai' | 'anthropic' | 'gemini' | 'grok',
          { role: 'user', content: userMessage }
        );

        if (!response.error) {
          await this.contextManager.addAIMessage(
            conversationId,
            provider as 'openai' | 'anthropic' | 'gemini' | 'grok',
            { role: 'assistant', content: response.content }
          );
        }

        return response;
      })
    );

    return {
      responses,
      summary: {},
      timestamp: new Date(),
    };
  }

  async getConversationHistory(conversationId: string): Promise<Message[]> {
    return await this.contextManager.getMasterContext(conversationId);
  }

  createNewConversation(): string {
    const conversation = this.contextManager.createConversation();
    return conversation.id;
  }

  getAvailableProviders(): string[] {
    return this.orchestrator.getAvailableProviders();
  }
}