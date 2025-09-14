import { NextRequest, NextResponse } from 'next/server';
import { MeanGPTRouter } from '@/lib/core/router';

const router = new MeanGPTRouter();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const conversationId = resolvedParams.id;
    
    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }

    const history = await router.getConversationHistory(conversationId);

    return NextResponse.json({
      success: true,
      conversationId,
      messages: history,
      count: history.length
    });

  } catch (error) {
    console.error('History API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch conversation history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}