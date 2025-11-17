import { NextRequest, NextResponse } from 'next/server';
import { sendVerificationCode } from '@/lib/vapi/functions/sendVerificationCode';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, customerId, customerName } = body;

    console.log('\n' + '='.repeat(80));
    console.log('🔧 ElevenLabs Tool: sendVerificationCode');
    console.log('📥 Input:', { email, customerId, customerName });

    if (!email || !customerId || !customerName) {
      return NextResponse.json(
        { error: 'email, customerId, and customerName are required' },
        { status: 400 }
      );
    }

    // Note: We need a conversation_id for the code storage
    // For now, we'll use customerId as a fallback
    const result = await sendVerificationCode({
      email,
      customerId,
      customerName,
      callId: `elevenlabs-${customerId}`, // Temporary ID for code storage
    });

    console.log('📤 Result:', result.success ? 'Code sent' : result.error);
    console.log('='.repeat(80) + '\n');

    return NextResponse.json(result);
  } catch (error) {
    console.error('sendVerificationCode API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
