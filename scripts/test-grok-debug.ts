#!/usr/bin/env npx tsx

import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function debugGrokAPI() {
  console.log('🧪 Debugging Grok API\n');

  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    console.log('❌ GROK_API_KEY not found');
    return;
  }

  console.log('✅ Grok API key found');
  console.log(`   Key preview: ${apiKey.substring(0, 15)}...`);

  // Test different endpoints and configurations
  const testConfigs = [
    {
      name: 'Current configuration (grok-beta)',
      url: 'https://api.x.ai/v1/chat/completions',
      model: 'grok-beta'
    },
    {
      name: 'Try grok-2-012 model',
      url: 'https://api.x.ai/v1/chat/completions',
      model: 'grok-2-012'
    },
    {
      name: 'Try grok-2 model',  
      url: 'https://api.x.ai/v1/chat/completions',
      model: 'grok-2'
    },
    {
      name: 'Try latest model name',
      url: 'https://api.x.ai/v1/chat/completions', 
      model: 'grok-3'
    }
  ];

  for (const config of testConfigs) {
    console.log(`\n🔍 Testing: ${config.name}`);
    console.log(`   URL: ${config.url}`);
    console.log(`   Model: ${config.model}`);

    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'user', content: 'Hello! Respond with just: Hello from Grok!' }
          ],
          temperature: 0.7,
          max_tokens: 50,
        }),
      });

      console.log(`   Status: ${response.status} ${response.statusText}`);
      console.log(`   Headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)}`);

      if (response.ok) {
        const data = await response.json();
        console.log('   ✅ SUCCESS!');
        console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
        return; // Exit on first success
      } else {
        const errorText = await response.text();
        console.log(`   ❌ Error: ${errorText}`);
      }

    } catch (error) {
      console.log(`   ❌ Network Error: ${error}`);
    }
  }

  // Test authentication by hitting a simple endpoint
  console.log('\n🔍 Testing authentication with models endpoint...');
  try {
    const modelsResponse = await fetch('https://api.x.ai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    console.log(`   Models endpoint status: ${modelsResponse.status}`);
    if (modelsResponse.ok) {
      const models = await modelsResponse.json();
      console.log('   Available models:');
      console.log(JSON.stringify(models, null, 2));
    } else {
      const errorText = await modelsResponse.text();
      console.log(`   Models error: ${errorText}`);
    }
  } catch (error) {
    console.log(`   Models request failed: ${error}`);
  }
}

// Main execution
if (require.main === module) {
  debugGrokAPI().catch(console.error);
}