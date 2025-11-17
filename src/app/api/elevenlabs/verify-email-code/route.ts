import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailCode } from '@/lib/vapi/functions/verifyEmailCode';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, customerId } = body;

    console.log('\n' + '='.repeat(80));
    console.log('🔧 ElevenLabs Tool: verifyEmailCode');
    console.log('📥 Input:', { code: code?.substring(0, 2) + '****', customerId });

    if (!code) {
      return NextResponse.json(
        { error: 'code is required' },
        { status: 400 }
      );
    }

    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId is required' },
        { status: 400 }
      );
    }

    const result = await verifyEmailCode({ 
      code, 
      callId: `elevenlabs-${customerId}` // Match the ID from sendVerificationCode
    });

    console.log('📤 Result:', result.success ? 'Code verified' : result.error);
    console.log('='.repeat(80) + '\n');

    return NextResponse.json(result);
  } catch (error) {
    console.error('verifyEmailCode API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
