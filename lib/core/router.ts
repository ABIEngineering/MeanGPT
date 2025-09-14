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

    // Get context for the primary provider (usually first in list)
    const primaryProvider = activeProviders[0];
    const context = await this.contextManager.getMessagesForProvider(
      conversationId,
      primaryProvider as 'openai' | 'anthropic' | 'gemini' | 'grok'
    );

    const messages = [...context, { role: 'user', content: userMessage }] as Message[];

    // Use the orchestrator's queryAllProviders which handles failures gracefully
    const result = await this.orchestrator.queryAllProviders(messages, {
      providers: activeProviders,
      temperature: 0.7,
      maxTokens: 4000
    });

    // Add messages to context for each provider
    for (const provider of activeProviders) {
      await this.contextManager.addAIMessage(
        conversationId,
        provider as 'openai' | 'anthropic' | 'gemini' | 'grok',
        { role: 'user', content: userMessage }
      );

      // Find the response for this provider
      const providerResponse = result.responses.find(r => r.provider.name === provider);
      if (providerResponse && !providerResponse.error) {
        await this.contextManager.addAIMessage(
          conversationId,
          provider as 'openai' | 'anthropic' | 'gemini' | 'grok',
          { role: 'assistant', content: providerResponse.content }
        );
      }
    }

    return result;
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