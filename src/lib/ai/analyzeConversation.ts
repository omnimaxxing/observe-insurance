import { groq } from '@ai-sdk/groq'
import { generateObject } from 'ai'
import { z } from 'zod'

const ConversationAnalysisSchema = z.object({
  intent: z.enum(['claim_status', 'file_claim', 'upload_documents', 'general_inquiry', 'other']).describe('Primary reason for the call'),
  sentiment: z.enum(['positive', 'neutral', 'negative']).describe('Overall customer sentiment during the call'),
  summary: z.string().describe('2-3 sentence summary of what happened in the conversation'),
  authenticated: z.boolean().describe('Was the customer successfully authenticated/verified?'),
  claimsDiscussed: z.array(z.string()).describe('List of claim numbers mentioned (format: OBS-XXXX-XXXX)'),
  keyTopics: z.array(z.string()).describe('Main topics discussed (max 5)'),
})

export type ConversationAnalysis = z.infer<typeof ConversationAnalysisSchema>

export async function analyzeConversation(transcript: Array<{
  speaker: 'user' | 'agent'
  text: string
}>): Promise<ConversationAnalysis | null> {
  if (!process.env.GROQ_API_KEY) {
    console.warn('⚠️ GROQ_API_KEY not configured - skipping conversation analysis')
    return null
  }

  if (!transcript || transcript.length === 0) {
    console.warn('⚠️ Empty transcript - skipping analysis')
    return null
  }

  try {
    console.log('🤖 Analyzing conversation with Groq...')
    
    // Format transcript for AI
    const formattedTranscript = transcript
      .map(t => `${t.speaker === 'user' ? 'Customer' : 'Agent'}: ${t.text}`)
      .join('\n')

    const { object } = await generateObject({
      model: groq('llama-3.3-70b-versatile'),
      schema: ConversationAnalysisSchema,
      mode: 'json',
      prompt: `Analyze this insurance customer service call transcript and extract key information.

Transcript:
${formattedTranscript}

Instructions:
- Determine the primary intent/reason for the call
- Assess the customer's overall sentiment
- Identify if the customer was successfully authenticated
- Extract all claim numbers mentioned
- Provide a brief summary of the conversation

Return a JSON object with these exact fields:
- intent: string (e.g., "claim_status", "file_claim", "general_inquiry")
- sentiment: string ("positive", "neutral", "negative")
- authenticated: boolean
- claimsDiscussed: array of claim numbers (strings)
- summary: string (2-3 sentences)`,
    })

    console.log('✅ Conversation analysis complete:', {
      intent: object.intent,
      sentiment: object.sentiment,
      authenticated: object.authenticated,
      claimsCount: object.claimsDiscussed.length,
    })

    return object
  } catch (error) {
    console.error('❌ Failed to analyze conversation with Groq:', error)
    return null
  }
}
