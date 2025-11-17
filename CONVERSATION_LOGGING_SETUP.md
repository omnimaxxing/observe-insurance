# Conversation Logging Setup

Store all ElevenLabs conversations in Payload CMS for analytics, compliance, and observability.

## What's Been Created

### 1. Payload Collection: `Conversations`

Location: `/src/collections/Conversations/index.ts`

**Stores:**
- Full conversation transcripts
- Call metadata (duration, timestamps, phone numbers)
- Customer linkage (if identified)
- Analytics (message counts, response times, interruptions)
- Tool calls made during conversation
- AI-generated summary
- Sentiment analysis
- Call intent classification

### 2. Webhook Endpoints

**`/api/vonage/webhook`** - Real-time transcript collection
- Receives transcripts from Railway connector
- Stores in memory during active call
- Logs user and agent messages

**`/api/elevenlabs/conversation-end`** - Final conversation storage
- Called by ElevenLabs when conversation ends
- Saves complete conversation to Payload CMS
- Links to customer if phone number matches
- Calculates analytics

---

## Setup Steps

### Step 1: Regenerate Payload Types

```bash
pnpm payload generate:types
```

This creates TypeScript types for the new `Conversations` collection.

### Step 2: Configure ElevenLabs Webhook

1. Go to [ElevenLabs Dashboard](https://elevenlabs.io/app/conversational-ai)
2. Select your agent
3. Go to **Settings** → **Webhooks**
4. Add webhook for **"Conversation End"** event
5. Set URL to: `https://your-domain.com/api/elevenlabs/conversation-end`
6. Save

### Step 3: Test

Make a test call and check:
1. Conversation appears in Payload CMS admin (`/admin/collections/conversations`)
2. Transcript is complete
3. Customer is linked (if phone matched)
4. Analytics are calculated

---

## Conversation Data Structure

```typescript
{
  conversationId: string          // ElevenLabs conversation ID
  agentId: string                 // ElevenLabs agent ID
  customer: Relationship          // Linked customer (if found)
  customerName: string            // Name from conversation
  customerPhone: string           // Phone from Vonage
  callUuid: string                // Vonage call UUID
  conversationUuid: string        // Vonage conversation UUID
  status: 'completed' | 'failed'  // Call status
  duration: number                // Duration in seconds
  startTime: Date
  endTime: Date
  
  transcript: [
    {
      timestamp: Date
      speaker: 'user' | 'agent'
      text: string
    }
  ]
  
  summary: string                 // AI-generated summary
  
  toolsCalled: [
    {
      toolName: string
      timestamp: Date
      parameters: object
      result: object
    }
  ]
  
  metadata: {
    authenticated: boolean
    verificationMethod: 'phone' | 'email' | 'name_dob' | 'none'
    claimsDiscussed: [{ claimNumber: string }]
    intent: 'claim_status' | 'file_claim' | 'upload_documents' | ...
    sentiment: 'positive' | 'neutral' | 'negative'
  }
  
  analytics: {
    totalMessages: number
    userMessages: number
    agentMessages: number
    averageResponseTime: number
    interruptionCount: number
  }
  
  rawData: object                 // Full ElevenLabs webhook payload
}
```

---

## ElevenLabs Webhook Payload

ElevenLabs sends this data on conversation end:

```json
{
  "conversation_id": "conv_abc123",
  "agent_id": "your_agent_id",
  "started_at": "2025-11-17T10:55:48.000Z",
  "ended_at": "2025-11-17T10:56:15.000Z",
  "duration_ms": 27000,
  "transcript": [
    {
      "role": "agent",
      "message": "Thank you for calling...",
      "timestamp": "2025-11-17T10:55:49.000Z"
    },
    {
      "role": "user",
      "message": "Hi, I need help...",
      "timestamp": "2025-11-17T10:55:52.000Z"
    }
  ],
  "metadata": {
    "customer_phone": "13143266906",
    "call_uuid": "abc123",
    "conversation_uuid": "CON-abc123",
    "authenticated": true,
    "verification_method": "phone"
  },
  "analysis": {
    "summary": "Customer called to check claim status...",
    "intent": "claim_status",
    "sentiment": "neutral",
    "interruption_count": 2
  }
}
```

---

## Viewing Conversations

### Payload Admin

Go to: `https://your-domain.com/admin/collections/conversations`

**Features:**
- Search by conversation ID, customer, phone
- Filter by date, status, intent, sentiment
- View full transcripts
- See linked customer and claims
- Export data

### API Access

```typescript
// Get recent conversations
const { docs } = await payload.find({
  collection: 'conversations',
  sort: '-createdAt',
  limit: 10,
})

// Get conversations for a customer
const { docs } = await payload.find({
  collection: 'conversations',
  where: {
    customer: { equals: customerId },
  },
})

// Search transcripts
const { docs } = await payload.find({
  collection: 'conversations',
  where: {
    'transcript.text': {
      contains: 'claim status',
    },
  },
})
```

---

## Analytics Queries

### Average call duration
```typescript
const conversations = await payload.find({
  collection: 'conversations',
  where: {
    createdAt: { greater_than: lastWeek },
  },
})

const avgDuration = conversations.docs.reduce((sum, c) => sum + (c.duration || 0), 0) / conversations.docs.length
```

### Most common intents
```typescript
const conversations = await payload.find({
  collection: 'conversations',
  limit: 1000,
})

const intents = conversations.docs.reduce((acc, c) => {
  const intent = c.metadata?.intent || 'unknown'
  acc[intent] = (acc[intent] || 0) + 1
  return acc
}, {})
```

### Customer sentiment over time
```typescript
const conversations = await payload.find({
  collection: 'conversations',
  where: {
    customer: { equals: customerId },
  },
  sort: 'createdAt',
})

const sentiments = conversations.docs.map(c => ({
  date: c.createdAt,
  sentiment: c.metadata?.sentiment,
}))
```

---

## Future Enhancements

### 1. Real-time Tool Call Logging

Update tool endpoints to log calls:

```typescript
// In each tool endpoint
await payload.update({
  collection: 'conversations',
  where: {
    callUuid: { equals: callUuid },
  },
  data: {
    toolsCalled: {
      // Append to array
      toolName: 'verifyCustomer',
      timestamp: new Date(),
      parameters: { phoneNumber },
      result: { success: true, customerId },
    },
  },
})
```

### 2. AI Summary Generation

Use Groq to generate summaries:

```typescript
import { groq } from '@ai-sdk/groq'
import { generateText } from 'ai'

const summary = await generateText({
  model: groq('llama-3.1-8b-instant'),
  prompt: `Summarize this customer service call:\n\n${transcript}`,
})
```

### 3. Automatic Customer Linking

Link conversations to customers based on:
- Phone number (already implemented)
- Email mentioned in conversation
- Claim numbers discussed
- Name + DOB verification

### 4. Compliance & Recording

- Store audio recordings (if enabled in ElevenLabs)
- Add retention policies
- GDPR/compliance flags
- Redact sensitive data (SSN, credit cards)

### 5. Dashboard & Reporting

Build analytics dashboard:
- Call volume over time
- Average handling time
- Customer satisfaction scores
- Agent performance metrics
- Common issues/intents

---

## Testing

### Test Conversation End Webhook

```bash
curl -X POST https://your-domain.com/api/elevenlabs/conversation-end \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id": "test_conv_123",
    "agent_id": "your_agent_id",
    "started_at": "2025-11-17T10:00:00.000Z",
    "ended_at": "2025-11-17T10:05:00.000Z",
    "duration_ms": 300000,
    "transcript": [
      {
        "role": "agent",
        "message": "Hello, how can I help?",
        "timestamp": "2025-11-17T10:00:01.000Z"
      },
      {
        "role": "user",
        "message": "I need claim status",
        "timestamp": "2025-11-17T10:00:05.000Z"
      }
    ],
    "metadata": {
      "customer_phone": "13143266906"
    },
    "analysis": {
      "summary": "Customer inquired about claim status",
      "intent": "claim_status",
      "sentiment": "neutral"
    }
  }'
```

---

## Success Criteria

✅ Conversations automatically saved after each call
✅ Full transcripts captured
✅ Customers linked when phone matches
✅ Analytics calculated correctly
✅ Searchable in Payload admin
✅ API access for custom queries
✅ Compliance-ready data structure

---

## Next Steps

1. Run `pnpm payload generate:types`
2. Configure ElevenLabs webhook
3. Make a test call
4. Check Payload admin for conversation
5. Build analytics dashboard (optional)
6. Set up retention policies (optional)
