import { NextRequest, NextResponse } from 'next/server';
import { searchKnowledgeBase } from '@/lib/vapi/functions/searchKnowledgeBase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, customerId } = body;

    console.log('\n' + '='.repeat(80));
    console.log('🔧 ElevenLabs Tool: searchKnowledgeBase');
    console.log('📥 Input:', { query, customerId });

    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId is required - customer must be authenticated first' },
        { status: 400 }
      );
    }

    if (!query) {
      return NextResponse.json(
        { error: 'query is required' },
        { status: 400 }
      );
    }

    const result = await searchKnowledgeBase({ query });

    console.log('📤 Result:', result.success ? 'Found article' : result.error);
    console.log('='.repeat(80) + '\n');

    return NextResponse.json(result);
  } catch (error) {
    console.error('searchKnowledgeBase API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
