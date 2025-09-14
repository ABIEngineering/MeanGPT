import fs from 'fs/promises';
import path from 'path';
import { Message, AggregatedResponse } from '@/types';

export interface ConversationFiles {
  openai: string;
  anthropic: string;
  gemini: string;
  grok: string;
  meangpt: string;
  routing: string;
}

export interface RoutingDecision {
  messageIndex: number;
  query: string;
  analysis: {
    isFirstMessage: boolean;
    hasFollowUpMarkers: boolean;
    mentionsProviders: boolean;
    requiresVerification: boolean;
  };
  decision: 'forward_all' | 'forward_some' | 'direct_reply';
  selectedProviders?: string[];
  reason: string;
  timestamp: string;
}

export interface MiniSummaries {
  openai?: string;
  anthropic?: string;
  gemini?: string;
  grok?: string;
}

export interface MeanGPTMessage {
  role: 'user' | 'assistant';
  content: any;
  timestamp: string;
  routingDecision?: string;
  miniSummaries?: MiniSummaries;
  consolidatedAnswer?: string;
  fullResponses?: { [key: string]: string };
}

export class FileStorageManager {
  private conversationsDir: string;

  constructor() {
    this.conversationsDir = path.join(process.cwd(), 'conversations');
  }

  async ensureConversationDirectory(conversationId: string): Promise<string> {
    const convDir = path.join(this.conversationsDir, conversationId);
    try {
      await fs.access(convDir);
    } catch {
      await fs.mkdir(convDir, { recursive: true });
    }
    return convDir;
  }

  getConversationFiles(conversationId: string): ConversationFiles {
    const convDir = path.join(this.conversationsDir, conversationId);
    return {
      openai: path.join(convDir, 'openai_context.json'),
      anthropic: path.join(convDir, 'anthropic_context.json'),
      gemini: path.join(convDir, 'gemini_context.json'),
      grok: path.join(convDir, 'grok_context.json'),
      meangpt: path.join(convDir, 'meangpt_master.json'),
      routing: path.join(convDir, 'routing_log.json')
    };
  }

  async saveProviderContext(
    conversationId: string,
    provider: 'openai' | 'anthropic' | 'gemini' | 'grok',
    messages: Message[]
  ): Promise<void> {
    await this.ensureConversationDirectory(conversationId);
    const files = this.getConversationFiles(conversationId);
    
    const contextData = {
      conversationId,
      provider,
      model: this.getModelForProvider(provider),
      messages,
      lastUpdated: new Date().toISOString()
    };

    await fs.writeFile(files[provider], JSON.stringify(contextData, null, 2));
  }

  async loadProviderContext(
    conversationId: string,
    provider: 'openai' | 'anthropic' | 'gemini' | 'grok'
  ): Promise<Message[]> {
    const files = this.getConversationFiles(conversationId);
    
    try {
      const data = await fs.readFile(files[provider], 'utf8');
      const contextData = JSON.parse(data);
      return contextData.messages || [];
    } catch {
      return [];
    }
  }

  async saveMeanGPTMaster(
    conversationId: string,
    messages: MeanGPTMessage[],
    routingDecisions: RoutingDecision[]
  ): Promise<void> {
    await this.ensureConversationDirectory(conversationId);
    const files = this.getConversationFiles(conversationId);
    
    const masterData = {
      conversationId,
      provider: 'meangpt',
      routingDecisions,
      messages,
      lastUpdated: new Date().toISOString()
    };

    await fs.writeFile(files.meangpt, JSON.stringify(masterData, null, 2));
  }

  async loadMeanGPTMaster(conversationId: string): Promise<{
    messages: MeanGPTMessage[];
    routingDecisions: RoutingDecision[];
  }> {
    const files = this.getConversationFiles(conversationId);
    
    try {
      const data = await fs.readFile(files.meangpt, 'utf8');
      const masterData = JSON.parse(data);
      return {
        messages: masterData.messages || [],
        routingDecisions: masterData.routingDecisions || []
      };
    } catch {
      return { messages: [], routingDecisions: [] };
    }
  }

  async saveRoutingDecision(
    conversationId: string,
    decision: RoutingDecision
  ): Promise<void> {
    await this.ensureConversationDirectory(conversationId);
    const files = this.getConversationFiles(conversationId);
    
    let decisions: RoutingDecision[] = [];
    try {
      const data = await fs.readFile(files.routing, 'utf8');
      const routingData = JSON.parse(data);
      decisions = routingData.decisions || [];
    } catch {
      // File doesn't exist yet
    }

    decisions.push(decision);

    const routingData = {
      conversationId,
      decisions,
      lastUpdated: new Date().toISOString()
    };

    await fs.writeFile(files.routing, JSON.stringify(routingData, null, 2));
  }

  async generateMiniSummary(fullResponse: string, provider: string): Promise<string> {
    // For now, simple truncation. Later we can use AI to generate proper summaries
    const maxLength = 100;
    if (fullResponse.length <= maxLength) {
      return fullResponse;
    }
    
    // Find a good breaking point
    const truncated = fullResponse.substring(0, maxLength);
    const lastSentence = truncated.lastIndexOf('.');
    const lastSpace = truncated.lastIndexOf(' ');
    
    const breakPoint = lastSentence > 50 ? lastSentence + 1 : 
                     lastSpace > 50 ? lastSpace : maxLength;
    
    return fullResponse.substring(0, breakPoint) + '...';
  }

  private getModelForProvider(provider: string): string {
    const models = {
      openai: 'gpt-4o',
      anthropic: 'claude-sonnet-4-20250514',
      gemini: 'gemini-2.5-flash',
      grok: 'grok-3'
    };
    return models[provider as keyof typeof models] || 'unknown';
  }

  async conversationExists(conversationId: string): Promise<boolean> {
    const convDir = path.join(this.conversationsDir, conversationId);
    try {
      await fs.access(convDir);
      return true;
    } catch {
      return false;
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const convDir = path.join(this.conversationsDir, conversationId);
    try {
      await fs.rm(convDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to delete conversation ${conversationId}:`, error);
    }
  }
}