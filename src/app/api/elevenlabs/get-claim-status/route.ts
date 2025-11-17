import { NextRequest, NextResponse } from 'next/server';
import { getClaimStatus } from '@/lib/vapi/functions/getClaimStatus';
import { requireAuth } from '@/lib/auth/requireAuth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { claimNumber, customerId } = body;
    
    // Extract conversationId from ElevenLabs custom header (set in tool config)
    const conversationId = req.headers.get('conversationid') || // ElevenLabs custom header
                          req.headers.get('x-conversation-id') ||
                          body.conversationId ||
                          `customer_${customerId}`; // Fallback: stable per customer

    console.log('\n' + '='.repeat(80));
    console.log('🔧 ElevenLabs Tool: getClaimStatus');
    console.log('📥 Input:', { claimNumber, customerId, conversationId });

    // AUTH GUARD: Verify session before accessing claims (if conversationId provided)
    if (conversationId) {
      const authCheck = await requireAuth(conversationId, customerId);
      if (!authCheck.authenticated) {
        console.log('❌ Authentication failed');
        console.log('='.repeat(80) + '\n');
        return authCheck.response!;
      }
      console.log('✅ Authentication verified (session-based)');
    } else {
      console.warn('⚠️ No conversationId - skipping session verification (legacy mode)');
    }

    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId is required - customer must be authenticated first' },
        { status: 400 }
      );
    }

    const result = await getClaimStatus({
      claimNumber: claimNumber || undefined,
      customerId,
    });

    console.log('📤 Result:', result.success ? 'Success' : result.error);
    console.log('='.repeat(80) + '\n');

    return NextResponse.json(result);
  } catch (error) {
    console.error('getClaimStatus API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
