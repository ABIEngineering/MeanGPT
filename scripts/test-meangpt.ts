#!/usr/bin/env npx tsx

import { MeanGPTRouter } from '../lib/core/router';
import * as readline from 'readline';

class MeanGPTTester {
  private router: MeanGPTRouter;
  private conversationId: string;
  private rl: readline.Interface;

  constructor() {
    this.router = new MeanGPTRouter();
    this.conversationId = this.router.createNewConversation();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('🤖 MeanGPT Terminal Tester');
    console.log('=========================');
    console.log(`Conversation ID: ${this.conversationId}`);
    console.log(`Available providers: ${this.router.getAvailableProviders().join(', ')}`);
    console.log('Commands:');
    console.log('  /history - Show conversation history');
    console.log('  /new - Start new conversation');
    console.log('  /test - Run automated tests');
    console.log('  /exit - Exit the tester');
    console.log('=========================\n');
  }

  async start() {
    this.promptUser();
  }

  private promptUser() {
    this.rl.question('You: ', async (input) => {
      const trimmed = input.trim();
      
      if (trimmed === '/exit') {
        console.log('Goodbye!');
        this.rl.close();
        return;
      }
      
      if (trimmed === '/history') {
        await this.showHistory();
        this.promptUser();
        return;
      }
      
      if (trimmed === '/new') {
        this.conversationId = this.router.createNewConversation();
        console.log(`✨ Started new conversation: ${this.conversationId}\n`);
        this.promptUser();
        return;
      }
      
      if (trimmed === '/test') {
        await this.runAutomatedTests();
        this.promptUser();
        return;
      }

      if (trimmed.length === 0) {
        this.promptUser();
        return;
      }

      await this.processMessage(trimmed);
      this.promptUser();
    });
  }

  private async processMessage(message: string) {
    console.log('\n🔄 Processing your message...\n');
    
    try {
      const startTime = Date.now();
      const result = await this.router.processMessage(this.conversationId, message);
      const duration = Date.now() - startTime;

      console.log(`📊 Routing Decision: ${result.routing.reason}`);
      if (result.routing.providers) {
        console.log(`🎯 Targeted providers: ${result.routing.providers.join(', ')}`);
      }
      console.log(`⏱️  Processing time: ${duration}ms\n`);

      console.log('📝 MeanGPT Response:');
      console.log('==================');
      console.log(result.response);
      console.log('==================\n');

      if (result.aggregatedData) {
        console.log('📈 Response Analytics:');
        console.log(`- Successful responses: ${result.aggregatedData.responses.filter(r => !r.error).length}`);
        console.log(`- Failed responses: ${result.aggregatedData.responses.filter(r => r.error).length}`);
        if (result.aggregatedData.responses.some(r => r.tokensUsed)) {
          const totalTokens = result.aggregatedData.responses
            .reduce((sum, r) => sum + (r.tokensUsed || 0), 0);
          console.log(`- Total tokens used: ${totalTokens}`);
        }
        console.log('');
      }

    } catch (error) {
      console.error('❌ Error processing message:', error);
      console.log('');
    }
  }

  private async showHistory() {
    const history = await this.router.getConversationHistory(this.conversationId);
    
    console.log('\n📚 Conversation History:');
    console.log('========================');
    
    if (history.length === 0) {
      console.log('No messages in this conversation yet.');
    } else {
      history.forEach((msg, index) => {
        const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : '';
        console.log(`${index + 1}. [${timestamp}] ${msg.role.toUpperCase()}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
      });
    }
    console.log('========================\n');
  }

  private async runAutomatedTests() {
    console.log('\n🧪 Running Automated Tests...\n');

    const testCases = [
      {
        name: 'Basic Question',
        message: 'What is the capital of France?',
        expectForward: true
      },
      {
        name: 'Numeric Question (for mean calculation)',
        message: 'What is the current price of Bitcoin in USD?',
        expectForward: true
      },
      {
        name: 'Follow-up Question',
        message: 'What about the mean value?',
        expectForward: false
      },
      {
        name: 'Provider-specific Question',
        message: 'What does ChatGPT think about AI safety?',
        expectForward: true
      }
    ];

    for (const testCase of testCases) {
      console.log(`🔸 Testing: ${testCase.name}`);
      console.log(`   Question: "${testCase.message}"`);
      
      try {
        const result = await this.router.processMessage(this.conversationId, testCase.message);
        
        const wasForwarded = result.routing.shouldForward;
        const testPassed = wasForwarded === testCase.expectForward;
        
        console.log(`   Expected forward: ${testCase.expectForward}, Actual: ${wasForwarded}`);
        console.log(`   Result: ${testPassed ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`   Reason: ${result.routing.reason}`);
        console.log('');
        
      } catch (error) {
        console.log(`   Result: ❌ ERROR - ${error}`);
        console.log('');
      }
    }
  }
}

// Check if API keys are set
function checkEnvironment() {
  const requiredVars = ['OPENAI_API_KEY'];
  const missing = requiredVars.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.log('⚠️  Warning: Missing API keys:', missing.join(', '));
    console.log('   Some providers will not work. Set them in .env.local\n');
  } else {
    console.log('✅ Environment check passed\n');
  }
}

// Main execution
async function main() {
  checkEnvironment();
  const tester = new MeanGPTTester();
  await tester.start();
}

if (require.main === module) {
  main().catch(console.error);
}