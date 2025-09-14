import { NextRequest, NextResponse } from 'next/server';
import { MeanGPTRouter } from '@/lib/core/router';

const router = new MeanGPTRouter();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, conversationId } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const finalConversationId = conversationId || router.createNewConversation();

    const result = await router.processMessage(finalConversationId, message);

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'MeanGPT Chat API',
    endpoints: {
      'POST /api/chat': 'Send a message to MeanGPT',
      'GET /api/providers': 'List available AI providers',
      'GET /api/conversations/:id/history': 'Get conversation history'
    },
    version: '1.0.0'
  });
}