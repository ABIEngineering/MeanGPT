export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export interface AIProvider {
  name: 'openai' | 'anthropic' | 'gemini' | 'grok';
  displayName: string;
  model: string;
}

export interface AIResponse {
  provider: AIProvider;
  content: string;
  error?: string;
  timestamp: Date;
  tokensUsed?: number;
}

export interface AggregatedResponse {
  responses: AIResponse[];
  summary: {
    openai?: string;
    anthropic?: string;
    gemini?: string;
    grok?: string;
  };
  meanAnswer?: string;
  bestAnswer?: string;
  timestamp: Date;
}

export interface ConversationContext {
  id: string;
  userId?: string;
  messages: Message[];
  aiContexts: {
    openai: Message[];
    anthropic: Message[];
    gemini: Message[];
    grok: Message[];
  };
  createdAt: Date;
  updatedAt: Date;
}