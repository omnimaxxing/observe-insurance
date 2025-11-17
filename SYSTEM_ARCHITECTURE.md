# Observe Insurance - Complete System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CUSTOMER INTERACTION LAYER                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📱 Customer Phone Call  →  🌐 Vonage Voice Platform                       │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CALL ROUTING LAYER                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Next.js API (Vercel)                                                       │
│  └─ /api/vonage/answer  →  Returns NCCO with WebSocket connection info     │
│  └─ /api/vonage/events  →  Logs call events (started, completed, etc.)     │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                       AUDIO STREAMING LAYER                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  WebSocket Connector (Railway)                                              │
│  └─ Converts audio: Vonage L16 ↔ ElevenLabs base64                        │
│  └─ Relays real-time audio bidirectionally                                  │
│  └─ Sends transcripts to /api/vonage/webhook                               │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CONVERSATIONAL AI LAYER                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ElevenLabs Conversational AI Agent                                         │
│  └─ Speech-to-Text (STT)                                                    │
│  └─ Natural Language Understanding (NLU)                                    │
│  └─ Tool/Function Calling                                                   │
│  └─ Text-to-Speech (TTS)                                                    │
│  └─ Conversation Management                                                 │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BUSINESS LOGIC LAYER                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Next.js API Routes (Vercel) - /api/elevenlabs/*                           │
│                                                                             │
│  Authentication Tools:                                                      │
│  ├─ verifyCustomer         → Phone number lookup                           │
│  ├─ confirmIdentity        → Identity confirmation                          │
│  ├─ alternativeVerification → Email or Name+DOB lookup                     │
│  ├─ sendVerificationCode   → Email verification code                       │
│  └─ verifyEmailCode        → Code validation                               │
│                                                                             │
│  Service Tools:                                                             │
│  ├─ getClaimStatus         → Claim information retrieval                   │
│  ├─ searchKnowledgeBase    → FAQ/knowledge search                          │
│  └─ sendUploadLink         → Document upload link generation               │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DATA LAYER                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Payload CMS + PostgreSQL (Vercel)                                          │
│                                                                             │
│  Collections:                                                               │
│  ├─ Customers       → Customer profiles, contact info                      │
│  ├─ Claims          → Insurance claims, status, documents                  │
│  ├─ Conversations   → Call transcripts, AI analysis, metrics               │
│  ├─ Knowledge       → FAQ articles, help content                           │
│  └─ Media           → File uploads (Vercel Blob Storage)                   │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                      AI ANALYSIS LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Groq AI (Llama 3.1)                                                        │
│  ├─ Claim description generation                                            │
│  ├─ Conversation intent analysis                                            │
│  ├─ Sentiment analysis                                                      │
│  └─ Claim number extraction                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Call Flow Diagram

```
┌──────────────┐
│   Customer   │
│    Calls     │
│ 555-123-4567 │
└──────┬───────┘
       │
       │ 1. Initiates call
       ↓
┌─────────────────────────────────────────────────────────────┐
│                    Vonage Voice Platform                    │
│  • Receives inbound call                                    │
│  • Looks up application configuration                       │
└──────┬──────────────────────────────────────────────────────┘
       │
       │ 2. HTTP GET request
       │    /api/vonage/answer?from=555-123-4567&uuid=abc123
       ↓
┌─────────────────────────────────────────────────────────────┐
│              Next.js API (Vercel)                           │
│              /api/vonage/answer                             │
│                                                             │
│  • Receives call metadata                                   │
│  • Builds WebSocket URL with webhook_url & peer_uuid        │
│  • Returns NCCO (Nexmo Call Control Object)                │
│                                                             │
│  NCCO Response:                                             │
│  {                                                          │
│    "action": "connect",                                     │
│    "endpoint": [{                                           │
│      "type": "websocket",                                   │
│      "uri": "wss://connector.railway.app/socket?..."       │
│    }]                                                       │
│  }                                                          │
└──────┬──────────────────────────────────────────────────────┘
       │
       │ 3. Establishes WebSocket connection
       │    Audio stream: L16 format, 16kHz
       ↓
┌─────────────────────────────────────────────────────────────┐
│         WebSocket Connector (Railway)                       │
│         elevenlabs-agent-ws-connector                       │
│                                                             │
│  • Receives L16 audio from Vonage                          │
│  • Converts to base64 for ElevenLabs                       │
│  • Establishes WebSocket to ElevenLabs                     │
│  • Relays audio bidirectionally                            │
│  • Sends transcripts to webhook_url                        │
└──────┬────────────────────────────┬─────────────────────────┘
       │                            │
       │ 4a. Audio stream           │ 4b. Transcripts
       │     (base64)               │     (HTTP POST)
       ↓                            ↓
┌──────────────────────┐    ┌─────────────────────────────────┐
│   ElevenLabs Agent   │    │  /api/vonage/webhook            │
│                      │    │                                 │
│  • STT: Speech→Text  │    │  • Receives user transcripts    │
│  • NLU: Understand   │    │  • Receives agent responses     │
│  • Decide action     │    │  • Stores in memory             │
│  • TTS: Text→Speech  │    │  • Logs to console              │
└──────┬───────────────┘    └─────────────────────────────────┘
       │
       │ 5. Tool call decision
       │    "Customer said: 314-326-6906"
       │    → Call verifyCustomer tool
       ↓
┌─────────────────────────────────────────────────────────────┐
│           /api/elevenlabs/verifyCustomer                    │
│                                                             │
│  Input: { phoneNumber: "314-326-6906" }                    │
│                                                             │
│  Process:                                                   │
│  1. Normalize phone: +13143266906                          │
│  2. Query Payload CMS:                                      │
│     SELECT * FROM customers WHERE phone = '+13143266906'   │
│  3. Return customer data                                    │
│                                                             │
│  Output: {                                                  │
│    success: true,                                           │
│    customerId: 1,                                           │
│    customerName: "Jake Palmer",                             │
│    email: "jake@example.com"                                │
│  }                                                          │
└──────┬──────────────────────────────────────────────────────┘
       │
       │ 6. ElevenLabs stores customerId in dynamic variables
       │    Now available for all subsequent tool calls
       ↓
┌─────────────────────────────────────────────────────────────┐
│           /api/elevenlabs/confirmIdentity                   │
│                                                             │
│  Input: {                                                   │
│    customerId: 1,                                           │
│    confirmed: true                                          │
│  }                                                          │
│                                                             │
│  Output: {                                                  │
│    authenticated: true,                                     │
│    message: "Identity confirmed"                            │
│  }                                                          │
└──────┬──────────────────────────────────────────────────────┘
       │
       │ 7. Customer asks: "What's my claim status?"
       ↓
┌─────────────────────────────────────────────────────────────┐
│           /api/elevenlabs/getClaimStatus                    │
│                                                             │
│  Input: {                                                   │
│    customerId: 1,                                           │
│    claimNumber: null  // Get all claims                     │
│  }                                                          │
│                                                             │
│  Process:                                                   │
│  1. Verify customerId exists                                │
│  2. Query claims:                                           │
│     SELECT * FROM claims                                    │
│     WHERE customer_id = 1                                   │
│  3. Format response                                         │
│                                                             │
│  Output: {                                                  │
│    success: true,                                           │
│    claims: [{                                               │
│      claimNumber: "OBS-QDN8-BMKK",                         │
│      status: "review",                                      │
│      description: "Property damage claim..."                │
│    }]                                                       │
│  }                                                          │
└──────┬──────────────────────────────────────────────────────┘
       │
       │ 8. Agent responds with claim info
       │    Audio flows back through connector to Vonage
       ↓
┌─────────────────────────────────────────────────────────────┐
│                    Customer hears response                  │
│  "Your claim OBS-QDN8-BMKK is currently under review..."    │
└──────┬──────────────────────────────────────────────────────┘
       │
       │ 9. Call ends (customer hangs up)
       ↓
┌─────────────────────────────────────────────────────────────┐
│         ElevenLabs sends conversation_end webhook           │
│                                                             │
│  POST /api/elevenlabs/conversation-end                      │
│                                                             │
│  Payload: {                                                 │
│    conversation_id: "conv_123",                             │
│    agent_id: "agent_456",                                   │
│    transcript: [...],                                       │
│    metadata: { duration: 64, ... },                         │
│    analysis: { summary: "...", ... }                        │
│  }                                                          │
└──────┬──────────────────────────────────────────────────────┘
       │
       │ 10. Process conversation
       ↓
┌─────────────────────────────────────────────────────────────┐
│     /api/elevenlabs/conversation-end Handler                │
│                                                             │
│  1. Verify webhook signature                                │
│  2. Parse transcript                                        │
│  3. Call Groq AI for analysis:                              │
│     ┌────────────────────────────────────────┐             │
│     │  analyzeConversation(transcript)       │             │
│     │                                        │             │
│     │  → Intent: "claim_status"              │             │
│     │  → Sentiment: "neutral"                │             │
│     │  → Authenticated: true                 │             │
│     │  → Claims: ["OBS-QDN8-BMKK"]          │             │
│     │  → Summary: "Customer called to..."    │             │
│     └────────────────────────────────────────┘             │
│  4. Find customer by phone                                  │
│  5. Save to Payload CMS:                                    │
│     INSERT INTO conversations (...)                         │
└──────┬──────────────────────────────────────────────────────┘
       │
       │ 11. Conversation saved
       ↓
┌─────────────────────────────────────────────────────────────┐
│              Payload CMS Database                           │
│                                                             │
│  conversations table:                                       │
│  ├─ conversationId: "conv_123"                             │
│  ├─ customer: → customers(1)                               │
│  ├─ transcript: [{ speaker, text, timestamp }]             │
│  ├─ summary: "Customer called to check claim status..."    │
│  ├─ metadata:                                               │
│  │  ├─ intent: "claim_status"                              │
│  │  ├─ sentiment: "neutral"                                │
│  │  ├─ authenticated: true                                 │
│  │  └─ claimsDiscussed: ["OBS-QDN8-BMKK"]                 │
│  └─ analytics:                                              │
│     ├─ totalMessages: 12                                   │
│     ├─ duration: 64                                        │
│     └─ ...                                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Authentication Flow Detail

```
┌─────────────────────────────────────────────────────────────┐
│                  PRIMARY: Phone Verification                │
└─────────────────────────────────────────────────────────────┘

Customer: "My phone is 314-326-6906"
    ↓
verifyCustomer(phoneNumber: "314-326-6906")
    ↓
Query: SELECT * FROM customers WHERE phone = '+13143266906'
    ↓
Found: { id: 1, name: "Jake Palmer", email: "jake@example.com" }
    ↓
Return: { customerId: 1, customerName: "Jake Palmer" }
    ↓
Agent: "Am I speaking with Jake Palmer?"
    ↓
confirmIdentity(customerId: 1, confirmed: true)
    ↓
Return: { authenticated: true }
    ↓
✅ Customer can now use service tools


┌─────────────────────────────────────────────────────────────┐
│              ALTERNATIVE: Email Verification                │
└─────────────────────────────────────────────────────────────┘

Customer: "My email is jake@example.com"
    ↓
alternativeVerification(method: "email", email: "jake@example.com")
    ↓
Query: SELECT * FROM customers WHERE LOWER(email) = 'jake@example.com'
    ↓
Found: { id: 1, name: "Jake Palmer" }
    ↓
Return: { customerId: 1, customerName: "Jake Palmer", email: "jake@example.com" }
    ↓
sendVerificationCode(customerId: 1)
    ↓
Generate 6-digit code: "ABC123"
    ↓
Send email via Resend API
    ↓
Return: { success: true, message: "Code sent" }
    ↓
Customer: "My code is ABC123"
    ↓
verifyEmailCode(customerId: 1, code: "ABC123")
    ↓
Validate code (check expiry, attempts)
    ↓
Return: { success: true, verified: true }
    ↓
confirmIdentity(customerId: 1, confirmed: true)
    ↓
✅ Customer authenticated


┌─────────────────────────────────────────────────────────────┐
│           ALTERNATIVE: Name + DOB Verification              │
└─────────────────────────────────────────────────────────────┘

Customer: "Jake Palmer, born January 15, 1990"
    ↓
alternativeVerification(
  method: "name_dob",
  firstName: "Jake",
  lastName: "Palmer",
  dateOfBirth: "1990-01-15"
)
    ↓
Query: SELECT * FROM customers 
       WHERE firstName = 'Jake' 
       AND lastName = 'Palmer'
       AND dob = '1990-01-15'
    ↓
Found: { id: 1, email: "jake@example.com" }
    ↓
Return: { customerId: 1, customerName: "Jake Palmer", email: "jake@example.com" }
    ↓
[Same email verification flow as above]
    ↓
✅ Customer authenticated
```

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      REAL-TIME DATA FLOW                        │
└─────────────────────────────────────────────────────────────────┘

Call Active:
┌──────────┐    ┌───────────┐    ┌────────────┐    ┌──────────┐
│  Vonage  │ ←→ │ Connector │ ←→ │ ElevenLabs │ ←→ │ Next.js  │
│  (Audio) │    │ (Railway) │    │  (Agent)   │    │  (Tools) │
└──────────┘    └─────┬─────┘    └────────────┘    └────┬─────┘
                      │                                   │
                      │ Transcripts                       │ Tool Results
                      ↓                                   ↓
              ┌────────────────┐                  ┌──────────────┐
              │ /vonage/webhook│                  │  Payload CMS │
              │  (In-memory)   │                  │  (Database)  │
              └────────────────┘                  └──────────────┘


Call Ended:
┌────────────┐
│ ElevenLabs │
│   Webhook  │
└──────┬─────┘
       │
       │ POST /conversation-end
       ↓
┌──────────────────────────────────────┐
│  Conversation End Handler            │
│  1. Parse transcript                 │
│  2. Groq AI analysis                 │
│  3. Find customer                    │
│  4. Save to database                 │
└──────┬───────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│  Payload CMS - conversations table   │
│  • Full transcript                   │
│  • AI analysis (intent, sentiment)   │
│  • Customer linkage                  │
│  • Analytics & metrics               │
└──────────────────────────────────────┘
```

---

## Technology Stack

### Frontend / Admin

- **Payload CMS Admin UI** - Content management, data viewing
- **Next.js 15** - React framework, API routes
- **TypeScript** - Type safety

### Backend / API

- **Next.js API Routes** - Serverless functions
- **Payload CMS** - Headless CMS, ORM
- **PostgreSQL** - Database (Vercel Postgres)
- **Vercel Blob Storage** - File uploads

### AI / ML

- **ElevenLabs Conversational AI** - Voice agent platform
  - Speech-to-Text (STT)
  - Natural Language Understanding (NLU)
  - Text-to-Speech (TTS)
  - Tool/Function calling
- **Groq (Llama 3.1)** - AI analysis
  - Conversation intent classification
  - Sentiment analysis
  - Claim number extraction
  - Summary generation

### Telephony

- **Vonage Voice API** - Phone number, call routing
- **WebSocket Connector** - Audio streaming bridge
  - Node.js application
  - Deployed on Railway
  - Converts audio formats

### Infrastructure

- **Vercel** - Next.js hosting, serverless functions
- **Railway** - WebSocket connector hosting
- **Vercel Postgres** - Database
- **Vercel Blob** - File storage
- **Resend** - Email delivery

---

## Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                          │
└─────────────────────────────────────────────────────────────┘

1. Webhook Signature Verification
   ├─ ElevenLabs webhooks: HMAC SHA-256 signature
   └─ Prevents unauthorized webhook calls

2. Authentication Required for Service Tools
   ├─ verifyCustomer → Returns customerId
   ├─ confirmIdentity → Sets authenticated flag
   └─ Service tools → Require customerId parameter

3. Database Access Control
   ├─ Payload CMS access control
   ├─ Admin authentication required
   └─ API routes validate requests

4. Environment Variables
   ├─ API keys stored securely
   ├─ Database credentials encrypted
   └─ Webhook secrets protected

5. Data Privacy
   ├─ PII handling compliant
   ├─ Conversation transcripts stored securely
   └─ Customer data encrypted at rest
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PRODUCTION DEPLOYMENT                    │
└─────────────────────────────────────────────────────────────┘

Vercel (Next.js):
├─ /api/vonage/*           → Call routing
├─ /api/elevenlabs/*       → Tool endpoints
├─ /admin                  → Payload CMS admin
└─ Environment Variables:
   ├─ DATABASE_URL
   ├─ ELEVENLABS_API_KEY
   ├─ ELEVENLABS_AGENT_ID
   ├─ ELEVENLABS_WEBHOOK_SECRET
   ├─ GROQ_API_KEY
   ├─ RESEND_API_KEY
   └─ VONAGE_CONNECTOR_HOST

Railway (WebSocket Connector):
├─ elevenlabs-agent-ws-connector
├─ Port: 6000
├─ Public domain: kind-recreation-production.up.railway.app
└─ Environment Variables:
   ├─ ELEVENLABS_API_KEY
   ├─ ELEVENLABS_AGENT_ID
   └─ PORT=6000

Vonage Dashboard:
├─ Voice Application configured
├─ Answer URL: https://your-app.vercel.app/api/vonage/answer
├─ Event URL: https://your-app.vercel.app/api/vonage/events
└─ Phone number linked

ElevenLabs Dashboard:
├─ Agent configured with tools
├─ Tool URLs: https://your-app.vercel.app/api/elevenlabs/*
└─ Webhook: https://your-app.vercel.app/api/elevenlabs/conversation-end
```

---

## Monitoring & Observability

```
Logs:
├─ Vercel Function Logs
│  ├─ API route execution
│  ├─ Tool calls
│  └─ Errors

├─ Railway Logs
│  ├─ WebSocket connections
│  ├─ Audio streaming
│  └─ Connector errors

└─ Payload CMS Admin
   ├─ Conversation records
   ├─ Customer interactions
   └─ Analytics dashboard

Metrics Tracked:
├─ Call volume
├─ Average call duration
├─ Authentication success rate
├─ Tool call frequency
├─ Customer sentiment distribution
├─ Intent classification
└─ Error rates
```

This is your complete system! 🎉
