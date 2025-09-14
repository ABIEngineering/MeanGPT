import { AIResponse, AggregatedResponse, Message } from '@/types';
import { OpenAIProvider } from '../providers/openai';

export class ResponseAggregator {
  private meanGPT: OpenAIProvider | null = null;

  constructor() {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      this.meanGPT = new OpenAIProvider(openaiKey, 'gpt-4o-mini');
    }
  }

  async analyzeResponses(
    aggregatedResponse: AggregatedResponse,
    originalQuestion: string
  ): Promise<AggregatedResponse> {
    const validResponses = aggregatedResponse.responses.filter(r => r.content && !r.error);
    
    if (validResponses.length === 0) {
      return {
        ...aggregatedResponse,
        meanAnswer: 'All AI providers failed to respond.',
        bestAnswer: 'No responses available.',
      };
    }

    if (validResponses.length === 1) {
      const singleResponseAnswer = await this.calculateMeanAnswer(validResponses, originalQuestion, aggregatedResponse.responses);
      return {
        ...aggregatedResponse,
        meanAnswer: singleResponseAnswer,
        bestAnswer: validResponses[0].content,
      };
    }

    const meanAnswer = await this.calculateMeanAnswer(validResponses, originalQuestion, aggregatedResponse.responses);
    const bestAnswer = await this.selectBestAnswer(validResponses, originalQuestion);

    return {
      ...aggregatedResponse,
      meanAnswer,
      bestAnswer,
    };
  }

  private async calculateMeanAnswer(
    responses: AIResponse[],
    originalQuestion: string,
    allResponses: AIResponse[]
  ): Promise<string> {
    if (!this.meanGPT) {
      return this.simpleAverage(responses);
    }

    const analysisPrompt = this.createMeanAnalysisPrompt(allResponses, originalQuestion);
    
    try {
      const result = await this.meanGPT.sendMessage([
        { role: 'system', content: 'You are MeanGPT, an AI that synthesizes multiple AI responses into a consensus answer.' },
        { role: 'user', content: analysisPrompt }
      ], { maxTokens: 8000, temperature: 0.3, stream: false });

      return result.content || this.simpleAverage(responses);
    } catch (error) {
      console.error('Error calculating mean answer:', error);
      return this.simpleAverage(responses);
    }
  }

  private async selectBestAnswer(
    responses: AIResponse[],
    originalQuestion: string
  ): Promise<string> {
    if (!this.meanGPT) {
      return responses[0].content;
    }

    const selectionPrompt = this.createBestAnswerPrompt(responses, originalQuestion);
    
    try {
      const result = await this.meanGPT.sendMessage([
        { role: 'system', content: 'You are MeanGPT, an AI that evaluates and selects the best response from multiple AI providers.' },
        { role: 'user', content: selectionPrompt }
      ], { maxTokens: 8000, temperature: 0.3, stream: false });

      return result.content || responses[0].content;
    } catch (error) {
      console.error('Error selecting best answer:', error);
      return responses[0].content;
    }
  }

  private createMeanAnalysisPrompt(responses: AIResponse[], question: string): string {
    const getLogoPath = (providerName: string): string => {
      const timestamp = Date.now(); // Cache busting
      switch (providerName.toLowerCase()) {
        case 'openai chatgpt': return `/AILogos/ChatGPTLogo.png?v=${timestamp}`;
        case 'anthropic claude': return `/AILogos/ClaudeLogo.png?v=${timestamp}`;
        case 'google gemini': return `/AILogos/GemeniLogo.png?v=${timestamp}`;
        case 'xai grok': return `/AILogos/GrokLogo.png?v=${timestamp}`;
        default: return '';
      }
    };

    const responsesText = responses.map((r, i) => {
      const logoPath = getLogoPath(r.provider.displayName);
      const logoMarkdown = logoPath ? `![${r.provider.displayName}](${logoPath})` : '';
      const content = r.error ? `*Error: ${r.error}*` : (r.content || '*No response received*');
      return `${logoMarkdown} **${r.provider.displayName}:** ${content}`;
    }).join('\n\n---\n\n');

    return `Original Question: "${question}"

Here are the individual AI responses:

${responsesText}

Your task: Analyze these responses and provide a synthesized answer. Return your response in this EXACT format:

## AI Responses

${responsesText}

---

## ![MeanGPT](/AILogos/MeanGPTLogo.svg?v=${Date.now()}) Consolidated Answer

**Answer:** [Your direct, clear answer to the question]

**Key Details:** [2-3 most important supporting facts]

**Note:** [Any important caveats if needed]

IMPORTANT: You must include both the AI Responses section (exactly as shown above) AND the Consolidated Answer section. Do not truncate or skip either section.`;
  }

  private createBestAnswerPrompt(responses: AIResponse[], question: string): string {
    const responsesText = responses.map((r, i) => 
      `${r.provider.displayName}:\n${r.content}`
    ).join('\n\n---\n\n');

    return `Original Question: "${question}"

The following are responses from different AI providers:

${responsesText}

---

Evaluate these responses and provide what you consider the BEST answer based on:
1. Accuracy and correctness
2. Completeness
3. Clarity and coherence
4. Relevance to the question

Either select and refine one of the existing answers, or create an improved version that addresses any shortcomings.`;
  }

  private simpleAverage(responses: AIResponse[]): string {
    const contents = responses.map(r => r.content).filter(Boolean);
    
    if (this.areNumericResponses(contents)) {
      return this.calculateNumericMean(contents);
    }
    
    return `Combined response from ${responses.length} AIs:\n\n` +
           responses.map(r => `${r.provider.displayName}: ${r.content}`).join('\n\n');
  }

  private areNumericResponses(contents: string[]): boolean {
    const numericPattern = /^\$?[\d,]+\.?\d*$/;
    return contents.every(content => {
      const trimmed = content.trim();
      return numericPattern.test(trimmed) || 
             trimmed.split('\n').some(line => numericPattern.test(line.trim()));
    });
  }

  private calculateNumericMean(contents: string[]): string {
    const numbers = contents.map(content => {
      const match = content.match(/\$?([\d,]+\.?\d*)/);
      if (match) {
        return parseFloat(match[1].replace(/,/g, ''));
      }
      return 0;
    }).filter(n => n > 0);

    if (numbers.length === 0) return 'Unable to calculate mean';
    
    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    return `Mean value: $${mean.toFixed(2)}`;
  }

  createFormattedResponse(aggregated: AggregatedResponse): string {
    let formatted = '## AI Responses Summary\n\n';

    aggregated.responses.forEach(response => {
      formatted += `### ${response.provider.displayName}\n`;
      if (response.error) {
        formatted += `*Error: ${response.error}*\n\n`;
      } else {
        formatted += `${response.content}\n\n`;
      }
    });

    if (aggregated.meanAnswer) {
      formatted += `---\n\n## Mean Answer\n${aggregated.meanAnswer}\n\n`;
    }

    if (aggregated.bestAnswer && aggregated.bestAnswer !== aggregated.meanAnswer) {
      formatted += `## Best Answer\n${aggregated.bestAnswer}\n\n`;
    }

    return formatted;
  }
}