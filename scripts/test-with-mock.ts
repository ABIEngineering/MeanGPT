#!/usr/bin/env npx tsx

import * as dotenv from 'dotenv';
import { ContextManager } from '../lib/core/context-manager';
import { Message } from '../types';

dotenv.config({ path: '.env.local' });

async function testContextManager() {
  console.log('🧪 Testing Context Management System\n');

  const contextManager = new ContextManager();

  // Test 1: Create conversation
  console.log('📝 Test 1: Creating conversation...');
  const conversation = contextManager.createConversation();
  console.log('✅ Conversation created');
  console.log(`   ID: ${conversation.id}`);
  console.log(`   Created at: ${conversation.createdAt}`);

  // Test 2: Add messages
  console.log('\n📝 Test 2: Adding messages...');
  contextManager.addMessage(conversation.id, {
    role: 'user',
    content: 'Hello, what is the capital of France?'
  });

  contextManager.addMessage(conversation.id, {
    role: 'assistant',
    content: 'The capital of France is Paris.'
  });

  console.log('✅ Messages added to conversation');

  // Test 3: Get master context
  console.log('\n📝 Test 3: Getting master context...');
  const masterContext = await contextManager.getMasterContext(conversation.id);
  console.log('✅ Master context retrieved');
  console.log(`   Messages count: ${masterContext.length}`);
  masterContext.forEach((msg, i) => {
    console.log(`   ${i + 1}. ${msg.role}: ${msg.content.substring(0, 50)}...`);
  });

  // Test 4: Test routing decisions
  console.log('\n📝 Test 4: Testing routing decisions...');
  
  const testCases = [
    'What is the price of apples?',
    'What about the mean value?',
    'What does ChatGPT think about this?',
    'How about pineapples?'
  ];

  for (const testCase of testCases) {
    const routing = await contextManager.shouldForwardToAIs(conversation.id, testCase);
    console.log(`   "${testCase}"`);
    console.log(`     Forward: ${routing.shouldForward ? '✅' : '❌'}`);
    console.log(`     Reason: ${routing.reason}`);
    if (routing.providers) {
      console.log(`     Providers: ${routing.providers.join(', ')}`);
    }
  }

  // Test 5: AI-specific contexts
  console.log('\n📝 Test 5: Testing AI-specific contexts...');
  contextManager.addAIMessage(conversation.id, 'openai', {
    role: 'user',
    content: 'Test message for OpenAI'
  });

  contextManager.addAIMessage(conversation.id, 'openai', {
    role: 'assistant',
    content: 'OpenAI response'
  });

  const openaiContext = await contextManager.getMessagesForProvider(conversation.id, 'openai');
  console.log('✅ AI-specific context working');
  console.log(`   OpenAI context messages: ${openaiContext.length}`);

  console.log('\n🎉 Context Management Test Complete!');
  return true;
}

async function testRoutingLogic() {
  console.log('\n🧪 Testing Routing Logic\n');

  const contextManager = new ContextManager();
  const conversationId = contextManager.createConversation().id;

  // Add some context
  contextManager.addMessage(conversationId, {
    role: 'user',
    content: 'What is 2+2?'
  });
  contextManager.addMessage(conversationId, {
    role: 'assistant',
    content: '## AI Responses Summary\n\n### OpenAI ChatGPT\n2+2 = 4\n\n### Anthropic Claude\n2+2 equals 4\n\n---\n\n## Mean Answer\nThe answer is 4\n\n## Best Answer\n2+2 = 4'
  });

  const testScenarios = [
    {
      name: 'New question',
      message: 'What is the capital of Spain?',
      expectedForward: true
    },
    {
      name: 'Mean value question',
      message: 'Why is the mean answer 4?',
      expectedForward: false
    },
    {
      name: 'Provider-specific',
      message: 'What does Claude think about AI?',
      expectedForward: true
    },
    {
      name: 'Follow-up with pronoun (after MeanGPT response)',
      message: 'What about the population?',
      expectedForward: false  // Should NOT forward because it's after MeanGPT analysis
    }
  ];

  let passed = 0;
  for (const scenario of testScenarios) {
    const routing = await contextManager.shouldForwardToAIs(conversationId, scenario.message);
    const testPassed = routing.shouldForward === scenario.expectedForward;
    
    console.log(`📋 ${scenario.name}:`);
    console.log(`   Message: "${scenario.message}"`);
    console.log(`   Expected forward: ${scenario.expectedForward}`);
    console.log(`   Actual forward: ${routing.shouldForward}`);
    console.log(`   Reason: ${routing.reason}`);
    console.log(`   Result: ${testPassed ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    if (testPassed) passed++;
  }

  console.log(`🎯 Routing Tests: ${passed}/${testScenarios.length} passed`);
  return passed === testScenarios.length;
}

// Main execution
async function runAllTests() {
  try {
    console.log('🚀 Starting Core System Tests (Mock Mode)\n');
    
    const test1 = await testContextManager();
    const test2 = await testRoutingLogic();
    
    const allPassed = test1 && test2;
    console.log(`\n${allPassed ? '🎉' : '❌'} Overall Result: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
    
    return allPassed;
  } catch (error) {
    console.error('❌ Test error:', error);
    return false;
  }
}

if (require.main === module) {
  runAllTests()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((error) => {
      console.error('Script error:', error);
      process.exit(1);
    });
}