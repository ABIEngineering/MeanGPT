#!/usr/bin/env npx tsx

import * as dotenv from 'dotenv';
import { OpenAIProvider } from '../lib/providers/openai';
import { Message } from '../types';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testOpenAIProvider() {
  console.log('🧪 Testing OpenAI Provider Only\n');

  // Check if API key is set
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('❌ OPENAI_API_KEY not found in environment variables');
    console.log('Please set it in .env.local file');
    return;
  }

  console.log('✅ OpenAI API key found');
  console.log(`   Key preview: ${apiKey.substring(0, 10)}...`);

  // Initialize provider
  try {
    const provider = new OpenAIProvider(apiKey, 'gpt-4o-mini');
    console.log('✅ OpenAI provider initialized');
    console.log(`   Model: ${provider.provider.model}`);
    console.log(`   Display name: ${provider.provider.displayName}\n`);

    // Test basic message
    console.log('📤 Testing basic message...');
    const testMessages: Message[] = [
      { role: 'user', content: 'Hello! Please respond with exactly "Hello World" and nothing else.' }
    ];

    console.log('   Sending message:', testMessages[0].content);
    
    const response = await provider.sendMessage(testMessages, {
      temperature: 0.1,
      maxTokens: 50,
      stream: false
    });

    if (response.error) {
      console.log('❌ OpenAI API call failed');
      console.log(`   Error: ${response.error}`);
      return;
    }

    console.log('✅ OpenAI API call successful');
    console.log(`   Response: "${response.content}"`);
    console.log(`   Tokens used: ${response.tokensUsed || 'unknown'}`);
    console.log(`   Timestamp: ${response.timestamp}\n`);

    // Test token counting
    console.log('📊 Testing token counting...');
    const tokenCount = provider.countTokens(testMessages);
    console.log(`   Estimated tokens: ${tokenCount}`);

    // Test conversation context
    console.log('\n🔄 Testing conversation context...');
    const conversationMessages: Message[] = [
      { role: 'user', content: 'My name is John' },
      { role: 'assistant', content: 'Hello John! Nice to meet you.' },
      { role: 'user', content: 'What is my name?' }
    ];

    console.log('   Sending conversation with context...');
    const contextResponse = await provider.sendMessage(conversationMessages, {
      temperature: 0.1,
      maxTokens: 50,
      stream: false
    });

    if (contextResponse.error) {
      console.log('❌ Context test failed');
      console.log(`   Error: ${contextResponse.error}`);
      return;
    }

    console.log('✅ Context test successful');
    console.log(`   Response: "${contextResponse.content}"`);
    
    const shouldMentionJohn = contextResponse.content.toLowerCase().includes('john');
    console.log(`   Context preserved: ${shouldMentionJohn ? '✅' : '❌'}`);

    console.log('\n🎉 OpenAI Provider Test Complete!');
    return true;

  } catch (error) {
    console.log('❌ Unexpected error during test');
    console.log(`   Error: ${error}`);
    return false;
  }
}

// Main execution
if (require.main === module) {
  testOpenAIProvider()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test script error:', error);
      process.exit(1);
    });
}