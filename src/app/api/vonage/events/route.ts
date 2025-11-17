import { NextResponse } from 'next/server'

/**
 * Vonage Event URL - Receives call status events
 * Logs events for monitoring and debugging
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    console.log('================================================================================')
    console.log('📞 Vonage Event')
    console.log('📥 Event:', JSON.stringify(body, null, 2))
    console.log('================================================================================\n')
    
    // You can add custom logic here based on event types:
    // - started: Call connected
    // - answered: Call answered
    // - completed: Call ended
    // - failed: Call failed
    
    const { status, uuid, conversation_uuid, timestamp } = body
    
    // Log important events
    if (status === 'completed') {
      console.log(`✅ Call ${uuid} completed at ${timestamp}`)
    } else if (status === 'failed') {
      console.error(`❌ Call ${uuid} failed:`, body)
    }
    
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('❌ Error processing Vonage event:', error)
    return NextResponse.json({ error: 'Failed to process event' }, { status: 500 })
  }
}

// Allow GET for testing
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Vonage Events URL is configured',
    timestamp: new Date().toISOString(),
  })
}
