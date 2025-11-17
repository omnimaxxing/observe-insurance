# Voice Flow Steps & Integration Points

## Complete Voice Flow (Greeting → Authentication → API Call → Response → Fallback)

### Stage 1: GREETING

```
Customer calls → Vonage answers → /api/vonage/answer returns NCCO → WebSocket connects

Agent: "Thank you for calling Observe Insurance! This is Martha speaking. 
        Can you please provide the phone number associated with your account?"

Logging:
✅ Call UUID: abc-123 initiated
✅ WebSocket established to Railway connector
✅ ElevenLabs agent activated
```

### Stage 2: AUTHENTICATION (Primary - Phone)

```
Customer: "314-326-6906"
  ↓ STT (Speech-to-Text)
  ↓ NLU extracts phone number
  ↓ Tool Call: verifyCustomer(phoneNumber)
  ↓ API: POST /api/elevenlabs/verify-customer
  ↓ DB Query: SELECT * FROM customers WHERE phone = '+13143266906'
  ↓ Return: { customerId: 1, customerName: "Jake Palmer" }
  ↓ TTS: "Am I speaking with Jake Palmer?"

Customer: "Yes"
  ↓ Tool Call: confirmIdentity(customerId: 1, confirmed: true)
  ↓ API: POST /api/elevenlabs/confirm-identity
  ↓ Return: { authenticated: true }
  ↓ TTS: "Great! How can I help you today?"

Logging:
✅ Customer 1 verified via phone
✅ Authentication method: phone
✅ Time to auth: 12s
```

### Stage 2B: AUTHENTICATION (Fallback - Email)

```
Customer: "I don't know my phone number"
  ↓ Agent: "Can you provide your email?"

Customer: "jake@example.com"
  ↓ Tool Call: alternativeVerification(method="email", email="jake@example.com")
  ↓ API: POST /api/elevenlabs/alternative-verification
  ↓ DB Query: SELECT * FROM customers WHERE email = 'jake@example.com'
  ↓ Return: { customerId: 1, customerName: "Jake Palmer" }
  ↓ Tool Call: sendVerificationCode(customerId: 1)
  ↓ API: POST /api/elevenlabs/send-verification-code
  ↓ Generate code: "ABC123", expires in 10min
  ↓ Send email via Resend API
  ↓ TTS: "I've sent a code to your email"

Customer: "ABC123"
  ↓ Tool Call: verifyEmailCode(customerId: 1, code: "ABC123")
  ↓ API: POST /api/elevenlabs/verify-email-code
  ↓ Validate code & expiry
  ↓ Return: { success: true, verified: true }
  ↓ Tool Call: confirmIdentity(customerId: 1, confirmed: true)
  ↓ TTS: "Perfect! You're verified."

Logging:
✅ Customer 1 verified via email
✅ Verification code sent and validated
✅ Authentication method: email
```

### Stage 3: API CALL (Service Request)

```
Customer: "What's my claim status?"
  ↓ STT → NLU (Intent: claim_status_inquiry)
  ↓ Tool Call: getClaimStatus(customerId: 1)
  ↓ API: POST /api/elevenlabs/get-claim-status
  ↓ Verify: customerId exists & authenticated
  ↓ DB Query: SELECT * FROM claims WHERE customer_id = 1
  ↓ Return: {
      claims: [{
        claimNumber: "OBS-QDN8-BMKK",
        status: "review",
        description: "Property damage claim",
        submittedDate: "2024-01-15",
        estimatedResolution: "2024-02-01"
      }]
    }

Logging:
✅ Tool call: getClaimStatus
✅ Customer: 1, Claims found: 1
✅ Response time: 245ms
```

### Stage 4: RESPONSE HANDLING

```
Agent formats response naturally:
TTS: "Your claim OBS-QDN8-BMKK is currently under review. 
      It was submitted on January 15th and we expect to 
      complete our review by February 1st."

Audio flows: ElevenLabs → Base64 → Connector → L16 → Vonage → Customer

Follow-up:
Customer: "Can I upload more documents?"
  ↓ Tool Call: sendUploadLink(customerId: 1, claimNumber: "OBS-QDN8-BMKK")
  ↓ API: POST /api/elevenlabs/send-upload-link
  ↓ Generate secure token (JWT, expires 24h)
  ↓ Send email with upload URL
  ↓ TTS: "I've sent an upload link to your email"

Logging:
✅ Response delivered successfully
✅ Upload link sent to jake@example.com
✅ Token expires: 2024-01-16 12:00:00
```

### Stage 5: FALLBACK HANDLING

```
Scenario A: Unknown Intent
Customer: "I want to change my policy"
  ↓ NLU: Intent unclear
  ↓ Tool Call: searchKnowledgeBase(query: "change policy")
  ↓ API: POST /api/elevenlabs/search-knowledge
  ↓ DB Query: Full-text search on knowledge_articles
  ↓ If found: Return relevant article
  ↓ If not found: "I don't have information about that. 
                   Let me connect you with an agent."

Scenario B: API Timeout
Tool call takes >15 seconds
  ↓ ElevenLabs timeout
  ↓ Agent: "I'm having trouble accessing that information. 
            Let me try again."
  ↓ Retry once
  ↓ If still fails: "I'm experiencing technical difficulties. 
                     Please try again in a moment."

Scenario C: Authentication Failure
Customer not found in database
  ↓ verifyCustomer returns: { success: false, error: "not_found" }
  ↓ Agent: "I couldn't find an account with that information. 
            Would you like to try a different verification method?"

Scenario D: Database Error
Connection pool exhausted
  ↓ Payload query throws error
  ↓ API returns 503 Service Unavailable
  ↓ Agent: "I'm experiencing technical difficulties. 
            Please try again in a moment or call back."

Logging:
❌ Unknown intent: "change policy" (for training)
❌ API timeout: getClaimStatus after 15s
❌ Customer not found: phone +15551234567
❌ Database error: Connection pool exhausted
```

### Stage 6: CALL CONCLUSION

```
Agent: "Is there anything else I can help you with?"
Customer: "No, that's all. Thank you!"
Agent: "You're welcome! Have a great day!"

[Customer hangs up]
  ↓ WebSocket disconnected
  ↓ Vonage event: call_completed
  ↓ ElevenLabs webhook: conversation_end

Logging:
✅ Call completed, duration: 64s
✅ Conversation ID: conv_123
✅ Initiating post-call processing
```

### Stage 7: POST-CALL PROCESSING

```
ElevenLabs → POST /api/elevenlabs/conversation-end
  ↓ Verify webhook signature (HMAC SHA-256)
  ↓ Parse conversation data
  ↓ Extract transcript (7 messages)
  ↓ AI Analysis (Groq Llama 3.1):
      • Intent: "claim_status"
      • Sentiment: "neutral"
      • Authenticated: true
      • Claims: ["OBS-QDN8-BMKK"]
      • Summary: "Customer called to check claim status..."
  ↓ Find customer by phone: +13143266906
  ↓ Save to Payload CMS conversations table
  ↓ Return success

Logging:
🤖 Analyzing conversation with Groq...
✅ Conversation analysis complete
✅ Conversation conv_123 saved to database
📊 Stats: 7 messages, 64s duration
🎯 Intent: claim_status, Sentiment: neutral, Auth: true
📋 Claims discussed: OBS-QDN8-BMKK
```

---

## Integration Points

### 1. Telephony (Vonage)

- **Type**: REST + WebSocket
- **Answer**: GET `/api/vonage/answer` → Returns NCCO JSON
- **Events**: POST `/api/vonage/events` → Receives call lifecycle
- **Audio**: WebSocket L16 PCM 16kHz 16-bit
- **Error Handling**: Retry with exponential backoff

### 2. AI/LLM (ElevenLabs)

- **Type**: WebSocket + REST webhooks
- **STT**: Real-time speech transcription
- **NLU**: Intent classification, entity extraction
- **LLM**: Response generation, conversation flow
- **TTS**: Voice synthesis (Rachel voice)
- **Tools**: JSON-RPC function calling
- **Webhook**: POST `/api/elevenlabs/conversation-end`

### 3. AI Analysis (Groq)

- **Type**: REST API (Vercel AI SDK)
- **Model**: llama-3.1-8b-instant
- **Purpose**: Post-call intent, sentiment, claim extraction
- **Input**: Transcript array
- **Output**: Structured JSON analysis
- **Error Handling**: Skip if timeout, use ElevenLabs data

### 4. Data Storage (Payload CMS + PostgreSQL)

- **Type**: ORM (Payload SDK)
- **Collections**: customers, claims, conversations, knowledge_articles
- **Queries**: findByPhone, findByEmail, findByClaimNumber
- **Connection**: Vercel Postgres with pooling
- **Error Handling**: Retry 3x, return 503 if failed

### 5. File Storage (Vercel Blob)

- **Type**: REST API
- **Purpose**: Claim document uploads
- **Operations**: PUT (upload), GET (download), DELETE
- **Max Size**: 50MB per file
- **Types**: PDF, JPG, PNG, DOCX

### 6. Email (Resend)

- **Type**: REST API
- **Purpose**: Verification codes, upload links
- **Rate Limit**: 3 codes per hour per customer
- **Expiry**: Codes 10min, links 24h
- **Error Handling**: Queue retry, inform agent

### 7. Audio Bridge (Railway Connector)

- **Type**: Dual WebSocket proxy
- **Vonage Side**: L16 PCM audio
- **ElevenLabs Side**: Base64 audio
- **Conversion**: Bidirectional format translation
- **Transcript Relay**: POST `/api/vonage/webhook`
- **Error Handling**: Reconnect 3x, graceful degradation

---

## Monitoring & Logging Touchpoints

### Error Capture

**1. API Routes** (`/api/*`)

```
✅ HTTP errors (400, 401, 500)
✅ Database failures
✅ External API timeouts
✅ Validation errors
✅ Authentication failures

Format:
console.error('❌ Error in [endpoint]:', {
  error: error.message,
  customerId: req.body.customerId,
  timestamp: new Date().toISOString()
})
```

**2. WebSocket Connector**

```
✅ Connection failures
✅ Audio stream interruptions
✅ ElevenLabs API errors
✅ Webhook POST failures

Recovery:
- Reconnect (max 3 retries)
- Continue without webhook if needed
- Close if unrecoverable
```

**3. Database**

```
✅ Connection pool exhaustion
✅ Query timeouts (>30s)
✅ Constraint violations
✅ Transaction rollbacks

Metrics:
- Query execution time
- Pool utilization
- Failed transaction count
```

**4. External APIs**

```
✅ Network timeouts
✅ Rate limiting (429)
✅ Authentication failures (401)
✅ Service unavailable (503)

Fallbacks:
- Groq timeout: Use ElevenLabs data
- Resend failure: Log & inform agent
- Tool timeout: Return cached data
```

### Metrics Collection

**Call Metrics** (`/api/vonage/events`)

- call_initiated_count
- call_completed_count
- average_call_duration
- total_call_cost
- calls_by_hour

**Authentication Metrics** (Tool endpoints)

- auth_success_rate: 92%
- auth_method_distribution:
  - phone: 65%
  - email: 25%
  - name_dob: 10%
- average_auth_time: 18s

**Tool Usage** (Each tool endpoint)

- tool_calls_by_type
- tool_success_rate: 96%
- tool_response_time (p50/p95/p99)
- tool_error_rate: 4%

**AI Analysis** (`/api/elevenlabs/conversation-end`)

- intent_distribution
- sentiment_distribution
- groq_analysis_time
- analysis_failure_rate

**Storage**: Console logs → Vercel logs → Can export to analytics DB

---

## Key Touchpoints Summary

✅ **Greeting**: Vonage → Next.js → Connector → ElevenLabs
✅ **Authentication**: 3 methods (phone, email, name+DOB)
✅ **API Calls**: Tool endpoints with 15s timeout
✅ **Response**: Natural TTS delivery via audio bridge
✅ **Fallback**: Unknown intent → Knowledge search → Human escalation
✅ **Errors**: Captured at API, WebSocket, DB, External API layers
✅ **Metrics**: Call, auth, tool, AI analysis tracked
✅ **Post-Call**: Groq AI analysis → Payload CMS storage
