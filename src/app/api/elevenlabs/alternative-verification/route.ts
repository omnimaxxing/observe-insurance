import { NextRequest, NextResponse } from 'next/server';
import { alternativeVerification } from '@/lib/vapi/functions/alternativeVerification';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { method, email, firstName, lastName, dateOfBirth } = body;

    console.log('\n' + '='.repeat(80));
    console.log('🔧 ElevenLabs Tool: alternativeVerification');
    console.log('📥 Input:', { method, email, firstName, lastName, dateOfBirth });

    if (!method || !['email', 'name_dob'].includes(method)) {
      return NextResponse.json(
        { error: 'method must be "email" or "name_dob"' },
        { status: 400 }
      );
    }

    if (method === 'email' && !email) {
      return NextResponse.json(
        { error: 'email is required for email method' },
        { status: 400 }
      );
    }

    if (method === 'name_dob' && (!firstName || !lastName || !dateOfBirth)) {
      return NextResponse.json(
        { error: 'firstName, lastName, and dateOfBirth are required for name_dob method' },
        { status: 400 }
      );
    }

    const result = await alternativeVerification({
      method: method as "email" | "name_dob",
      email: email || undefined,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      dateOfBirth: dateOfBirth || undefined,
    });

    console.log('📤 Result:', result.success ? `Found customer` : result.error);
    console.log('='.repeat(80) + '\n');

    // ElevenLabs will remember customerId from this response
    return NextResponse.json(result);
  } catch (error) {
    console.error('alternativeVerification API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
