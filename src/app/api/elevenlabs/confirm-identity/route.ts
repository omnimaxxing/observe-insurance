import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/auth/sessionManager';
import { getPayload } from 'payload';
import payloadConfig from '@/payload.config';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { confirmed, customerId, customerName, customerEmail, verificationMethod } = body;
    
    // Extract conversationId from ElevenLabs custom header (set in tool config)
    const conversationId = req.headers.get('conversationid') || // ElevenLabs custom header
                          req.headers.get('x-conversation-id') ||
                          body.conversationId ||
                          `customer_${customerId}`; // Fallback: stable per customer

    console.log('\n' + '='.repeat(80));
    console.log('🔧 ElevenLabs Tool: confirmIdentity');
    console.log('📥 Input:', { confirmed, customerId, conversationId });

    if (typeof confirmed !== 'boolean') {
      return NextResponse.json(
        { error: 'confirmed must be a boolean' },
        { status: 400 }
      );
    }

    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId is required - customer must be verified first' },
        { status: 400 }
      );
    }

    if (confirmed) {

      // Fetch customer details if not provided
      let name = customerName;
      let email = customerEmail;
      let method = verificationMethod || 'phone';

      if (!name || !email) {
        const payload = await getPayload({ config: payloadConfig });
        const customer = await payload.findByID({
          collection: 'customers',
          id: customerId,
        });
        name = name || `${customer.firstName} ${customer.lastName}`;
        email = email || customer.email;
      }

      // Create authenticated session
      await createSession(conversationId, {
        customerId,
        customerName: name,
        customerEmail: email,
        verificationMethod: method,
      });

      console.log('✅ Identity confirmed - authenticated');
      console.log('🔐 Session created for conversation:', conversationId);
      console.log('='.repeat(80) + '\n');
      
      return NextResponse.json({
        success: true,
        authenticated: true,
        customerId, // Return it so ElevenLabs keeps tracking it
        message: 'Identity confirmed - you are now authenticated',
      });
    } else {
      console.log('❌ Identity NOT confirmed');
      console.log('='.repeat(80) + '\n');
      
      return NextResponse.json({
        success: false,
        authenticated: false,
        escalate: true,
        message: 'Identity not confirmed - please try another verification method or speak with a representative',
      });
    }
  } catch (error) {
    console.error('confirmIdentity API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
