import { AIResponse as BackendAIResponse, AggregatedResponse } from '@/types';

// V0 UI interfaces
export interface UIAIResponse {
  model: string;
  response: string;
  status: "loading" | "complete";
}

export interface UIConversationTurn {
  question: string;
  responses: UIAIResponse[];
  finalAnswer: string;
}

// Backend response format expected from /api/chat
export interface BackendChatResponse {
  success: boolean;
  data?: {
    response: string;
    conversationId: string;
    routing: {
      shouldForward: boolean;
      providers?: string[];
      reason: string;
    };
    aggregatedData?: AggregatedResponse;
  };
  error?: string;
}

export class UIAdapter {
  /**
   * Convert backend AggregatedResponse to V0 UI format
   */
  static adaptAggregatedResponseToUI(
    question: string,
    aggregatedData: AggregatedResponse
  ): UIConversationTurn {
    const responses: UIAIResponse[] = [];
    
    // Convert AIResponse[] to UIAIResponse[]
    aggregatedData.responses.forEach((aiResponse: BackendAIResponse) => {
      responses.push({
        model: UIAdapter.formatProviderName(aiResponse.provider.displayName),
        response: aiResponse.content,
        status: "complete"
      });
    });

    return {
      question,
      responses,
      finalAnswer: aggregatedData.meanAnswer || ""
    };
  }

  /**
   * Convert provider name to display format
   */
  static formatProviderName(providerName: string): string {
    const nameMap: Record<string, string> = {
      'openai': 'ChatGPT',
      'anthropic': 'Claude',
      'gemini': 'Gemini',
      'grok': 'Grok'
    };
    
    return nameMap[providerName] || providerName;
  }

  /**
   * Create loading state conversation turn
   */
  static createLoadingTurn(question: string, activeProviders: string[] = ['openai', 'anthropic', 'gemini', 'grok']): UIConversationTurn {
    const responses: UIAIResponse[] = activeProviders.map(provider => ({
      model: UIAdapter.formatProviderName(provider),
      response: "",
      status: "loading" as const
    }));

    return {
      question,
      responses,
      finalAnswer: ""
    };
  }

  /**
   * Update a specific provider response in a conversation turn
   */
  static updateProviderResponse(
    turn: UIConversationTurn,
    providerName: string,
    response: string
  ): UIConversationTurn {
    const displayName = UIAdapter.formatProviderName(providerName);
    
    return {
      ...turn,
      responses: turn.responses.map(resp => 
        resp.model === displayName 
          ? { ...resp, response, status: "complete" as const }
          : resp
      )
    };
  }

  /**
   * Update final answer in conversation turn
   */
  static updateFinalAnswer(turn: UIConversationTurn, finalAnswer: string): UIConversationTurn {
    return {
      ...turn,
      finalAnswer
    };
  }

  /**
   * Check if all providers have completed
   */
  static areAllProvidersComplete(turn: UIConversationTurn): boolean {
    return turn.responses.every(resp => resp.status === "complete");
  }

  /**
   * Get list of active provider names from conversation turn
   */
  static getActiveProviders(turn: UIConversationTurn): string[] {
    return turn.responses.map(resp => {
      // Convert display names back to provider names
      const reverseMap: Record<string, string> = {
        'ChatGPT': 'openai',
        'Claude': 'anthropic', 
        'Gemini': 'gemini',
        'Grok': 'grok'
      };
      return reverseMap[resp.model] || resp.model.toLowerCase();
    });
  }
}