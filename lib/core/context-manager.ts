import { Message, ConversationContext } from '@/types';
import { FileStorageManager, RoutingDecision } from './file-storage';

export class ContextManager {
  private conversations: Map<string, ConversationContext> = new Map();
  private maxMessagesPerContext = 20;
  private maxTokensPerContext = 12000;
  private fileStorage: FileStorageManager;
  private isServerless: boolean;

  constructor() {
    this.fileStorage = new FileStorageManager();
    // Detect if running in serverless environment (like Vercel)
    this.isServerless = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  }

  createConversation(id?: string): ConversationContext {
    const conversationId = id || this.generateId();
    
    const context: ConversationContext = {
      id: conversationId,
      messages: [],
      aiContexts: {
        openai: [],
        anthropic: [],
        gemini: [],
        grok: [],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.conversations.set(conversationId, context);
    return context;
  }

  getConversation(id: string): ConversationContext | undefined {
    return this.conversations.get(id);
  }

  addMessage(conversationId: string, message: Message): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    conversation.messages.push(message);
    conversation.updatedAt = new Date();

    this.trimContextIfNeeded(conversation);
  }

  async addAIMessage(
    conversationId: string,
    provider: keyof ConversationContext['aiContexts'],
    message: Message
  ): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    conversation.aiContexts[provider].push(message);
    conversation.updatedAt = new Date();

    this.trimAIContextIfNeeded(conversation.aiContexts[provider]);

    // Save to file storage (skip in serverless environments)
    if (!this.isServerless) {
      await this.fileStorage.saveProviderContext(
        conversationId,
        provider,
        conversation.aiContexts[provider]
      );
    }
  }

  async getMessagesForProvider(
    conversationId: string,
    provider: keyof ConversationContext['aiContexts'],
    includeSystemPrompt: boolean = true
  ): Promise<Message[]> {
    let conversation = this.conversations.get(conversationId);
    
    // If not in memory, try to load from file storage (skip in serverless)
    if (!conversation && !this.isServerless) {
      const exists = await this.fileStorage.conversationExists(conversationId);
      if (exists) {
        conversation = await this.loadConversationFromStorage(conversationId);
      }
    }

    const messages: Message[] = [];
    
    if (includeSystemPrompt) {
      messages.push({
        role: 'system',
        content: 'You are a helpful AI assistant. Provide clear, accurate, and concise responses.',
      });
    }

    if (conversation) {
      return [...messages, ...conversation.aiContexts[provider]];
    }

    return messages;
  }

  private async loadConversationFromStorage(conversationId: string): Promise<ConversationContext | undefined> {
    try {
      // Load AI contexts from storage
      const openaiMessages = await this.fileStorage.loadProviderContext(conversationId, 'openai');
      const anthropicMessages = await this.fileStorage.loadProviderContext(conversationId, 'anthropic');
      const geminiMessages = await this.fileStorage.loadProviderContext(conversationId, 'gemini');
      const grokMessages = await this.fileStorage.loadProviderContext(conversationId, 'grok');

      // Load master context
      const { messages } = await this.fileStorage.loadMeanGPTMaster(conversationId);

      const conversation: ConversationContext = {
        id: conversationId,
        messages: messages.map(msg => ({
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          timestamp: new Date(msg.timestamp)
        })),
        aiContexts: {
          openai: openaiMessages,
          anthropic: anthropicMessages,
          gemini: geminiMessages,
          grok: grokMessages,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.conversations.set(conversationId, conversation);
      return conversation;
    } catch (error) {
      console.error(`Failed to load conversation ${conversationId}:`, error);
      return undefined;
    }
  }

  async getMasterContext(conversationId: string): Promise<Message[]> {
    let conversation = this.conversations.get(conversationId);
    
    // If not in memory, try to load from file storage (skip in serverless)
    if (!conversation && !this.isServerless) {
      const exists = await this.fileStorage.conversationExists(conversationId);
      if (exists) {
        conversation = await this.loadConversationFromStorage(conversationId);
      }
    }

    if (!conversation) {
      return [
        {
          role: 'system',
          content: `You are MeanGPT, an AI orchestrator that manages responses from multiple AI providers (OpenAI, Anthropic, Gemini, and Grok). 
          Your role is to:
          1. Analyze user questions to determine if they need to be forwarded to other AIs
          2. Summarize responses from multiple AIs
          3. Provide mean/average answers when appropriate
          4. Select the best answer based on accuracy and completeness
          5. Handle follow-up questions intelligently`,
        }
      ];
    }

    return [
      {
        role: 'system',
        content: `You are MeanGPT, an AI orchestrator that manages responses from multiple AI providers (OpenAI, Anthropic, Gemini, and Grok). 
        Your role is to:
        1. Analyze user questions to determine if they need to be forwarded to other AIs
        2. Summarize responses from multiple AIs
        3. Provide mean/average answers when appropriate
        4. Select the best answer based on accuracy and completeness
        5. Handle follow-up questions intelligently`,
      },
      ...conversation.messages,
    ];
  }

  async shouldForwardToAIs(conversationId: string, userMessage: string): Promise<{
    shouldForward: boolean;
    providers?: string[];
    reason: string;
  }> {
    const conversation = this.conversations.get(conversationId);
    
    // For first message, always forward to get comprehensive responses
    if (!conversation || conversation.messages.length === 0) {
      return {
        shouldForward: true,
        reason: 'First message in conversation - getting comprehensive responses',
      };
    }

    // Prepare conversation context for routing AI
    const contextMessages = conversation.messages.slice(-6); // Last 6 messages for context
    const contextSummary = contextMessages.map(msg => 
      `${msg.role}: ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}`
    ).join('\n');

    const routingPrompt = `You are MeanGPT's intelligent routing system. Your job is to analyze conversations and decide how to handle user messages.

## About MeanGPT System:
**MeanGPT** is an AI orchestrator that coordinates responses from 4 AI providers:
- **OpenAI ChatGPT** (gpt-4o)
- **Anthropic Claude** (claude-sonnet-4)  
- **Google Gemini** (gemini-2.5-flash)
- **xAI Grok** (grok-3)

**MeanGPT's Core Functions:**
1. **AI Coordination**: Forwards questions to multiple AIs and aggregates their responses
2. **Response Analysis**: Compares, contrasts, and synthesizes AI responses
3. **Best Answer Selection**: Identifies the most accurate/helpful response
4. **Mean/Average Answers**: Provides consolidated answers combining insights from all AIs
5. **Direct Interaction**: Can respond personally for questions about itself, identity, or system functionality

## Routing Decision Options:
**FORWARD_ALL**: Send to all 4 AIs (ChatGPT, Claude, Gemini, Grok)
**FORWARD_SPECIFIC**: Send to specific AIs only (specify which ones)
**DIRECT_REPLY**: MeanGPT responds directly without forwarding

## When to use DIRECT_REPLY:
- User directly addresses MeanGPT ("hey meangpt", "mean gpt only respond", etc.)
- Identity questions ("what is your name", "who are you", "introduce yourself")
- Questions about MeanGPT functionality ("how do you work", "what do you do", "explain meangpt")
- Follow-up questions about MeanGPT's previous analysis or methodology
- Meta-questions about the AI coordination process itself

## When to use FORWARD_SPECIFIC:
- User mentions specific AI names ("ask chatgpt", "what does claude think", "gemini vs grok")
- Questions that would benefit from particular AI expertise
- User requests comparison between specific AIs

## When to use FORWARD_ALL:
- General knowledge questions
- Complex topics requiring multiple perspectives
- Fact-checking or verification needs
- New topics not specifically targeting MeanGPT or specific AIs

## Recent Conversation Context:
${contextSummary}

## Current User Message:
"${userMessage}"

Analyze the context and current message. Respond with ONLY a JSON object in this exact format:
{
  "decision": "FORWARD_ALL" | "FORWARD_SPECIFIC" | "DIRECT_REPLY",
  "providers": ["openai", "anthropic", "gemini", "grok"] | ["specific", "providers"] | null,
  "reason": "Clear explanation of why this decision was made"
}`;

    try {
      // Use OpenAI for routing decisions (fast and reliable)
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Faster, cheaper model for routing
          messages: [
            {
              role: 'system',
              content: routingPrompt
            }
          ],
          temperature: 0.1, // Low temperature for consistent routing decisions
          max_tokens: 200,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const routingResponse = data.choices[0]?.message?.content;

      if (!routingResponse) {
        throw new Error('No routing response received');
      }

      // Parse the JSON response
      const routingDecision = JSON.parse(routingResponse.trim());

      // Convert to expected format
      return {
        shouldForward: routingDecision.decision !== 'DIRECT_REPLY',
        providers: routingDecision.providers,
        reason: routingDecision.reason,
      };

    } catch (error) {
      console.error('Routing AI error, falling back to simple logic:', error);
      
      // Fallback to simple pattern matching if AI routing fails
      const lowerMessage = userMessage.toLowerCase();
      
      if (lowerMessage.includes('meangpt') || lowerMessage.includes('mean gpt') || 
          lowerMessage.includes('what is your name') || lowerMessage.includes('who are you')) {
        return {
          shouldForward: false,
          reason: 'Fallback: Direct MeanGPT interaction detected',
        };
      }
      
      return {
        shouldForward: true,
        reason: 'Fallback: General question routing',
      };
    }
  }

  private isFollowUpQuestion(message: string): boolean {
    const followUpPatterns = [
      /^(and |but |also |what about |how about )/i,
      /^(that's |that is |it's |it is )/i,
      /^(why |explain |clarify )/i,
      /(wrong|incorrect|mistake|error)/i,
      /^(the |this |these |those )/i,
    ];

    return followUpPatterns.some(pattern => pattern.test(message));
  }

  private trimContextIfNeeded(conversation: ConversationContext): void {
    if (conversation.messages.length > this.maxMessagesPerContext) {
      const toRemove = conversation.messages.length - this.maxMessagesPerContext;
      const removed = conversation.messages.splice(0, toRemove);
      
      const summary = this.createSummary(removed);
      conversation.messages.unshift({
        role: 'system',
        content: `Previous conversation summary: ${summary}`,
      });
    }
  }

  private trimAIContextIfNeeded(messages: Message[]): void {
    if (messages.length > this.maxMessagesPerContext) {
      const toRemove = messages.length - this.maxMessagesPerContext;
      const removed = messages.splice(0, toRemove);
      
      const summary = this.createSummary(removed);
      messages.unshift({
        role: 'system',
        content: `Previous context summary: ${summary}`,
      });
    }
  }

  private createSummary(messages: Message[]): string {
    const topics = messages
      .filter(m => m.role === 'user')
      .map(m => m.content.substring(0, 50))
      .join(', ');
    
    return `Topics discussed: ${topics}`;
  }

  private generateId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  clearConversation(id: string): void {
    this.conversations.delete(id);
  }

  getAllConversations(): ConversationContext[] {
    return Array.from(this.conversations.values());
  }
}