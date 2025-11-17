import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer } from '@/lib/vapi/functions/verifyCustomer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumber } = body;

    console.log('\n' + '='.repeat(80));
    console.log('🔧 ElevenLabs Tool: verifyCustomer');
    console.log('📥 Input:', { phoneNumber });

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'phoneNumber is required' },
        { status: 400 }
      );
    }

    // Call the verification function
    const result = await verifyCustomer({ phoneNumber });

    console.log('📤 Result:', result.success ? `Found: ${result.customerName}` : result.error);
    console.log('='.repeat(80) + '\n');

    // ElevenLabs will remember customerId from this response
    return NextResponse.json(result);
  } catch (error) {
    console.error('verifyCustomer API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
