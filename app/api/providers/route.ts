import { NextResponse } from 'next/server';
import { MeanGPTRouter } from '@/lib/core/router';

const router = new MeanGPTRouter();

export async function GET() {
  try {
    const providers = router.getAvailableProviders();
    
    return NextResponse.json({
      success: true,
      providers: providers.map(name => ({
        name,
        displayName: name.charAt(0).toUpperCase() + name.slice(1),
        status: 'available'
      })),
      total: providers.length
    });

  } catch (error) {
    console.error('Providers API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch providers',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}