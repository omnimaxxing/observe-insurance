import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import payloadConfig from '@/payload.config'

// In-memory store for active conversations
const activeConversations = new Map<string, {
  conversationId?: string
  transcript: Array<{ timestamp: Date; speaker: 'user' | 'agent'; text: string }>
  startTime: Date
}>()

/**
 * Vonage Webhook - Receives transcripts and agent responses from the connector
 * This is called by the Railway connector, not by Vonage directly
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    console.log('================================================================================')
    console.log('📞 Vonage Connector Webhook')
    console.log('📥 Data:', JSON.stringify(body, null, 2))
    console.log('================================================================================\n')
    
    const { type, transcript, response, call_uuid } = body
    
    // Initialize conversation if not exists
    if (!activeConversations.has(call_uuid)) {
      activeConversations.set(call_uuid, {
        transcript: [],
        startTime: new Date(),
      })
    }
    
    const conversation = activeConversations.get(call_uuid)!
    
    // Log different event types and add to transcript
    if (type === 'user_transcript') {
      console.log(`👤 User said: ${transcript}`)
      conversation.transcript.push({
        timestamp: new Date(),
        speaker: 'user',
        text: transcript,
      })
    } else if (type === 'agent_response') {
      console.log(`🤖 Agent said: ${response}`)
      conversation.transcript.push({
        timestamp: new Date(),
        speaker: 'agent',
        text: response,
      })
    }
    
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('❌ Error processing Vonage webhook:', error)
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 })
  }
}

// Export the active conversations map for use in other endpoints
export { activeConversations }

// Allow GET for testing
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Vonage Webhook endpoint is configured',
    timestamp: new Date().toISOString(),
  })
}
