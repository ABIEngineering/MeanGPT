# MeanGPT - Multi-AI Consensus System

A web application that queries multiple AI providers (OpenAI, Anthropic, Gemini, Grok) simultaneously and provides consensus answers through intelligent aggregation.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- API keys for AI providers

### Setup

1. **Clone and install dependencies:**
```bash
cd meangpt
npm install
```

2. **Configure API keys in `.env.local`:**
```env
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here  
GEMINI_API_KEY=your_gemini_api_key_here
GROK_API_KEY=your_grok_api_key_here

# Optional model configurations
OPENAI_MODEL=gpt-4o-mini
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
GEMINI_MODEL=gemini-1.5-flash
```

3. **Start the development server:**
```bash
npm run dev
```

4. **Open [http://localhost:3000](http://localhost:3000) to access the web interface**

## 🧪 Testing Options

### Option 1: Web Interface
- Navigate to `http://localhost:3000`
- Use the built-in chat interface
- View routing decisions and provider responses in real-time

### Option 2: Terminal Testing
```bash
# Run interactive terminal tester
npx tsx scripts/test-meangpt.ts

# Available commands in terminal:
# /history - Show conversation history
# /new - Start new conversation  
# /test - Run automated tests
# /exit - Exit the tester
```

### Option 3: API Testing
Test the REST endpoints directly:

```bash
# Check available providers
curl http://localhost:3000/api/providers

# Send a message
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the capital of France?"}'

# Get conversation history
curl http://localhost:3000/api/conversations/{conversation_id}/history
```

## 🏗️ Architecture

### Core Components

```
lib/
├── providers/       # AI provider integrations
│   ├── base.ts     # Abstract provider interface
│   ├── openai.ts   # OpenAI ChatGPT
│   ├── anthropic.ts # Anthropic Claude
│   ├── gemini.ts   # Google Gemini
│   └── grok.ts     # xAI Grok
├── core/           # Core functionality
│   ├── orchestrator.ts  # Parallel API calls
│   ├── aggregator.ts    # Response analysis
│   ├── context-manager.ts # Conversation context
│   └── router.ts        # Smart routing logic
└── types/          # TypeScript definitions
```

### Key Features

1. **Provider Abstraction**: Unified interface for all AI providers
2. **Parallel Processing**: Simultaneous API calls for efficiency  
3. **Smart Routing**: Determines when to forward vs. answer directly
4. **Context Management**: Maintains separate contexts per AI + master context
5. **Response Aggregation**: Calculates mean and selects best answers
6. **Error Handling**: Graceful fallbacks when providers fail

## 🔄 How It Works

### Conversation Flow
```
User Question → MeanGPT Router → Routing Decision
                     ↓
    Forward to AIs ←→ Direct Response
         ↓
    Parallel API Calls → Response Aggregation → Final Answer
```

### Routing Logic
- **Forward to all AIs**: New topics, general questions
- **Forward to specific AIs**: Provider mentions (e.g., "What does ChatGPT think?")
- **Direct response**: Follow-ups about MeanGPT analysis, mean values

### Example Interactions

**Basic Question:**
```
User: "What is the capital of France?"
→ Forwards to all 4 AIs
→ Shows individual responses 
→ Provides mean consensus answer
```

**Follow-up:**
```
User: "What about the population?"
→ Forwards to all AIs (new topic)
```

**MeanGPT-specific:**
```
User: "Why is the mean value so high?"
→ Direct response from MeanGPT (no forwarding)
```

## 🔧 Development

### Project Structure
```
meangpt/
├── app/                 # Next.js app router
│   ├── api/            # REST API endpoints
│   └── page.tsx        # Main web interface
├── lib/                # Core functionality
├── scripts/            # Testing scripts
├── types/              # TypeScript types
├── .env.local          # API keys (create this)
└── package.json
```

### Adding New Providers
1. Create provider class extending `BaseAIProvider`
2. Implement `sendMessage()` and `countTokens()` methods
3. Add to orchestrator initialization
4. Update type definitions

### Testing Your Changes
```bash
# Test terminal interface
npx tsx scripts/test-meangpt.ts

# Test web interface  
npm run dev

# Check TypeScript
npm run build
```

## 📝 API Reference

### POST /api/chat
Send a message to MeanGPT
```json
{
  "message": "Your question",
  "conversationId": "optional_conversation_id"
}
```

### GET /api/providers
List available AI providers
```json
{
  "success": true,
  "providers": [{"name": "openai", "displayName": "OpenAI ChatGPT"}]
}
```

### GET /api/conversations/:id/history
Get conversation history
```json
{
  "success": true,
  "messages": [{"role": "user", "content": "..."}]
}
```

## 🎯 Next Steps

- [ ] Add streaming responses
- [ ] Implement response caching
- [ ] Add user authentication
- [ ] Integrate with V0 GUI
- [ ] Add conversation persistence
- [ ] Implement rate limiting

## 🐛 Troubleshooting

**No providers available:**
- Check API keys in `.env.local`
- Verify key format and permissions

**API errors:**
- Check network connectivity
- Verify API quotas and billing
- Review provider status pages

**TypeScript errors:**
- Run `npm run build` to check
- Ensure all types are properly defined

---

Built with Next.js, TypeScript, and the power of multiple AI providers! 🤖