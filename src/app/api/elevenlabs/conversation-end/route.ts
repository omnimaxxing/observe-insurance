import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import payloadConfig from '@/payload.config'
import crypto from 'crypto'
import { analyzeConversation } from '@/lib/ai/analyzeConversation'

/**
 * ElevenLabs Conversation End Webhook
 * Called when a conversation ends - stores full conversation to Payload CMS
 * 
 * Configure in ElevenLabs: Agent Settings → Webhooks → Conversation End
 * URL: https://your-domain.com/api/elevenlabs/conversation-end
 */
export async function POST(request: Request) {
  try {
    // Verify webhook signature
    const signature = request.headers.get('xi-signature')
    const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET
    
    if (webhookSecret && signature) {
      const rawBody = await request.text()
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex')
      
      if (signature !== expectedSignature) {
        console.error('❌ Invalid webhook signature')
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        )
      }
      
      // Parse body after verification
      var body = JSON.parse(rawBody)
    } else {
      // No signature verification (dev mode)
      var body = await request.json()
    }
    
    console.log('================================================================================')
    console.log('🎙️ ElevenLabs Conversation End')
    console.log('📥 Payload:', JSON.stringify(body, null, 2))
    console.log('================================================================================\n')
    
    const payload = await getPayload({ config: payloadConfig })
    
    // Extract conversation data from ElevenLabs webhook
    // Data is nested in body.data
    const webhookData = body.data || body
    const {
      conversation_id,
      agent_id,
      transcript,
      metadata,
      analysis,
    } = webhookData
    
    // Get timestamps from metadata
    const start_time_unix = metadata?.start_time_unix_secs
    const call_duration_secs = metadata?.call_duration_secs
    
    // Parse transcript into our format
    const transcriptArray = transcript
      ?.map((item: any) => ({
        timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
        speaker: item.role === 'user' ? 'user' : 'agent',
        text: item.message || item.text || '',
      }))
      .filter((item: any) => item.text.trim().length > 0) // Remove empty messages
      || []
    
    // Calculate analytics
    const userMessages = transcriptArray.filter((t: any) => t.speaker === 'user').length
    const agentMessages = transcriptArray.filter((t: any) => t.speaker === 'agent').length
    
    // AI Analysis with Groq
    const aiAnalysis = await analyzeConversation(transcriptArray)
    
    // Extract metadata
    const customerPhone = metadata?.customer_phone || metadata?.from
    const callUuid = metadata?.call_uuid || metadata?.vonage_call_uuid
    const conversationUuid = metadata?.conversation_uuid || metadata?.vonage_conversation_uuid
    
    // Try to find customer by phone
    let customerId = null
    if (customerPhone) {
      try {
        const { docs: customers } = await payload.find({
          collection: 'customers',
          where: {
            phone: {
              equals: customerPhone,
            },
          },
          limit: 1,
        })
        
        if (customers.length > 0) {
          customerId = customers[0].id
        }
      } catch (error) {
        console.error('Error finding customer:', error)
      }
    }
    
    // Create conversation record
    const conversation = await payload.create({
      collection: 'conversations',
      data: {
        conversationId: conversation_id,
        agentId: agent_id,
        customer: customerId,
        customerPhone,
        callUuid,
        conversationUuid,
        status: 'completed',
        duration: call_duration_secs || null,
        startTime: start_time_unix ? new Date(start_time_unix * 1000).toISOString() : new Date().toISOString(),
        endTime: start_time_unix && call_duration_secs 
          ? new Date((start_time_unix + call_duration_secs) * 1000).toISOString()
          : new Date().toISOString(),
        transcript: transcriptArray,
        summary: aiAnalysis?.summary || analysis?.transcript_summary || null,
        metadata: {
          authenticated: aiAnalysis?.authenticated || metadata?.authenticated || false,
          verificationMethod: metadata?.verification_method || 'none',
          claimsDiscussed: aiAnalysis?.claimsDiscussed?.map(cn => ({ claimNumber: cn })) || [],
          intent: aiAnalysis?.intent || null,
          sentiment: aiAnalysis?.sentiment || null,
        },
        analytics: {
          totalMessages: transcriptArray.length,
          userMessages,
          agentMessages,
          interruptionCount: analysis?.interruption_count || 0,
        },
        rawData: body,
      },
    })
    
    console.log(`✅ Conversation ${conversation_id} saved to database`)
    console.log(`📊 Stats: ${transcriptArray.length} messages, ${call_duration_secs || 0}s duration`)
    if (aiAnalysis) {
      console.log(`🎯 Intent: ${aiAnalysis.intent}, Sentiment: ${aiAnalysis.sentiment}, Auth: ${aiAnalysis.authenticated}`)
      if (aiAnalysis.claimsDiscussed.length > 0) {
        console.log(`📋 Claims discussed: ${aiAnalysis.claimsDiscussed.join(', ')}`)
      }
    }
    
    return NextResponse.json({
      success: true,
      conversationId: conversation.id,
    })
  } catch (error) {
    console.error('❌ Error saving conversation:', error)
    return NextResponse.json(
      { error: 'Failed to save conversation' },
      { status: 500 }
    )
  }
}

// Allow GET for testing
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'ElevenLabs Conversation End webhook is configured',
    timestamp: new Date().toISOString(),
  })
}
