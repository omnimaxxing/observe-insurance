import { NextResponse } from 'next/server'

/**
 * Vonage Answer URL - Called when an inbound call is received
 * Returns NCCO to connect call to ElevenLabs via WebSocket connector
 */
async function handleCall(request: Request) {
  try {
    // Vonage sends data as query params for GET requests
    const url = new URL(request.url)
    const from = url.searchParams.get('from') || ''
    const to = url.searchParams.get('to') || ''
    const uuid = url.searchParams.get('uuid') || ''
    const conversation_uuid = url.searchParams.get('conversation_uuid') || ''
    
    console.log('================================================================================')
    console.log('📞 Vonage Inbound Call')
    console.log('📥 From:', from, 'To:', to)
    console.log('📥 UUID:', uuid)
    console.log('📥 Conversation:', conversation_uuid)
    
    // Get connector hostname from environment
    const connectorHost = process.env.VONAGE_CONNECTOR_HOST
    
    if (!connectorHost) {
      console.error('❌ VONAGE_CONNECTOR_HOST not configured')
      return NextResponse.json([
        {
          action: 'talk',
          text: 'Sorry, the service is not configured. Please contact support.',
        },
      ])
    }
    
    // Get the host for webhook callbacks (your Next.js app)
    const host = request.headers.get('host') || ''
    const baseUrl = `https://${host}`
    const webhookUrl = `${baseUrl}/api/vonage/webhook`
    
    // Build WebSocket URL for the connector with query params
    const wsUrl = `wss://${connectorHost}/socket?webhook_url=${encodeURIComponent(webhookUrl)}&peer_uuid=${uuid}`
    
    // NCCO to connect call to ElevenLabs via WebSocket connector
    const ncco = [
      {
        action: 'connect',
        eventUrl: [`${baseUrl}/api/vonage/events`],
        from: to, // Your Vonage number
        endpoint: [
          {
            type: 'websocket',
            uri: wsUrl,
            'content-type': 'audio/l16;rate=16000',
            headers: {
              'call-uuid': uuid,
              'conversation-uuid': conversation_uuid,
              'webhook-url': webhookUrl,
              'from': from,
              'to': to,
            },
          },
        ],
      },
    ]
    
    console.log('📤 NCCO Response:', JSON.stringify(ncco, null, 2))
    console.log('🔗 Connecting to WebSocket:', wsUrl)
    console.log('================================================================================\n')
    
    return NextResponse.json(ncco)
  } catch (error) {
    console.error('❌ Error in Vonage answer webhook:', error)
    
    // Fallback NCCO
    return NextResponse.json([
      {
        action: 'talk',
        text: 'Sorry, we are experiencing technical difficulties. Please try again later.',
      },
    ])
  }
}

// Vonage uses GET for answer webhooks
export async function GET(request: Request) {
  return handleCall(request)
}

// Also support POST for testing
export async function POST(request: Request) {
  return handleCall(request)
}
