# Vapi AI Phone Agent Setup Guide

## Overview

This project uses [Vapi](https://vapi.ai) to power an AI phone agent for Observe Insurance. Vapi handles the complete voice infrastructure:

- **Speech-to-Text (STT)**: Transcribes customer speech using Deepgram
- **LLM**: Processes conversations with OpenAI GPT-4o-mini
- **Text-to-Speech (TTS)**: Generates natural voice responses with ElevenLabs
- **Phone Integration**: Manages inbound/outbound calls via free US phone numbers

Your Next.js application provides custom **tools** (webhooks) that the assistant calls to:

- Verify customer identity
- Look up claim status
- Search the knowledge base
- Handle escalations

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌────────────────┐
│   Customer  │◄───────►│  Vapi Cloud  │◄───────►│  Your Next.js  │
│  (Phone)    │  Voice  │  (AI Agent)  │   HTTP  │  (Tools/Data)  │
└─────────────┘         └──────────────┘         └────────────────┘
                              │                           │
                              │                           │
                        ┌─────▼─────┐             ┌───────▼────────┐
                        │ STT → LLM │             │ Payload CMS    │
                        │ → TTS     │             │ Upstash Vector │
                        └───────────┘             └────────────────┘
```

## Setup Instructions

### 1. Prerequisites

- Vapi account: https://dashboard.vapi.ai
- Public URL for webhooks (use ngrok for local development)
- Environment variables configured

### 2. Environment Configuration

Add these variables to your `.env.local`:

```bash
# Vapi API Key (get from https://dashboard.vapi.ai)
VAPI_API_KEY=your-vapi-api-key-here

# Your public base URL for webhooks
PUBLIC_BASE_URL=https://your-domain.com

# These will be filled after setup
VAPI_ASSISTANT_ID=
VAPI_PHONE_NUMBER_ID=
```

### 3. Setup Local Development with ngrok

If testing locally, expose your Next.js server:

```bash
# Install ngrok
brew install ngrok  # macOS
# or
npm install -g ngrok

# Start your Next.js dev server
npm run dev

# In another terminal, expose port 3000
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok-free.app)
# Add it to .env.local as PUBLIC_BASE_URL
```

### 4. Run the Assistant Setup Script

This script creates the Vapi assistant and configures all tools:

```bash
# Install tsx if not already installed
npm install -D tsx

# Run the setup script
npx tsx src/lib/vapi/setup-assistant.ts
```

The script will:

1. Create a Vapi assistant with your system prompt
2. Create 4 custom tools (verifyCustomer, getClaimStatus, searchKnowledgeBase, endCall)
3. Link tools to the assistant
4. Output the Assistant ID

**Copy the VAPI_ASSISTANT_ID** from the output and add it to `.env.local`

### 5. Create a Phone Number

#### Option A: Via Vapi Dashboard (Recommended for First Time)

1. Go to https://dashboard.vapi.ai/phone-numbers
2. Click **"Create Phone Number"**
3. Select **"Free Vapi Number"** tab
4. Enter a US area code (e.g., `415` for San Francisco)
5. Click **"Create"**
6. In the phone number settings:
   - Attach your assistant by selecting the Assistant ID from step 4
   - Save changes

#### Option B: Via API/CLI

```bash
# Using Vapi CLI
vapi login
vapi phone-number create --area-code 415 --assistant-id <YOUR_ASSISTANT_ID>
```

### 6. Test Your Phone Agent

Call the phone number you created! The conversation flow:

```
1. Agent: "Hello! Thank you for calling Observe Insurance..."
2. Agent: "Could you please provide the phone number on your account?"
3. Customer: "555-123-4567"
4. Agent: [Calls verifyCustomer tool] "Thank you, John Smith. How can I help?"
5. Customer: "What's the status of my claim?"
6. Agent: [Calls getClaimStatus tool] "Your claim OBS-A1B2-C3D4 for property..."
```

## Tool Reference

### 1. verifyCustomer

**Purpose**: Verify customer identity by phone number

**Parameters**:

- `phoneNumber` (string): Customer's phone number

**Returns**:

```json
{
  "verified": true,
  "customerId": "123",
  "firstName": "John",
  "lastName": "Smith",
  "message": "Thank you. I found your account, John Smith..."
}
```

### 2. getClaimStatus

**Purpose**: Retrieve claim information for a verified customer

**Parameters**:

- `customerId` (string): Customer ID from verifyCustomer
- `claimNumber` (string, optional): Specific claim number

**Returns**:

```json
{
  "found": true,
  "claimNumber": "OBS-A1B2-C3D4",
  "status": "review",
  "coverageType": "property",
  "message": "Your claim OBS-A1B2-C3D4 for property is currently review..."
}
```

### 3. searchKnowledgeBase

**Purpose**: Search knowledge articles for policy/FAQ answers

**Parameters**:

- `query` (string): Customer's question

**Returns**:

```json
{
  "found": true,
  "articleTitle": "Coverage Limits",
  "content": "Property coverage limits are determined by...",
  "message": "Based on our documentation: Property coverage limits..."
}
```

### 4. endCall

**Purpose**: End call or escalate to human agent

**Parameters**:

- `reason` (string): "completed" or "escalate"
- `summary` (string, optional): Call summary

**Returns**:

```json
{
  "success": true,
  "message": "Thank you for calling Observe Insurance..."
}
```

## Webhook Endpoint

All tool calls are handled by a single webhook endpoint:

**URL**: `https://your-domain.com/api/vapi/webhook`

**Request Format** (from Vapi):

```json
{
  "message": {
    "type": "tool-calls",
    "toolCallList": [
      {
        "id": "call_abc123",
        "name": "verifyCustomer",
        "arguments": {
          "phoneNumber": "555-123-4567"
        }
      }
    ]
  }
}
```

**Response Format** (to Vapi):

```json
{
  "results": [
    {
      "toolCallId": "call_abc123",
      "result": "{\"verified\":true,\"customerId\":\"123\"...}"
    }
  ]
}
```

## Agent Conversation Flow

### Happy Path

1. **Greeting** → Ask for phone number
2. **Verification** → Call `verifyCustomer` tool
3. **Service** → Answer claim/FAQ questions using tools
4. **End Call** → Thank customer and end

### Failed Verification Path

1. **Greeting** → Ask for phone number
2. **Verification Failed** → Phone not found
3. **Alternative Verification** → Ask for alternative info
4. **Escalation** → Call `endCall` with reason="escalate"

### Escalation Path

1. Customer requests human agent
2. AI cannot answer question
3. Call `endCall` with reason="escalate"
4. Transfer to Tier 2 support

## Customization

### Update System Prompt

Edit `src/lib/vapi/setup-assistant.ts` and modify the `content` field in the `messages` array. Then re-run the setup script.

### Add New Tools

1. Add tool handler in `src/app/api/vapi/webhook/route.ts`:

```typescript
case "newToolName":
  result = await handleNewTool(args);
  break;
```

2. Create the tool in setup script:

```typescript
const newTool = await client.tools.create({
  type: "function",
  function: {
    name: "newToolName",
    description: "What this tool does",
    parameters: { /* JSON Schema */ }
  },
  server: { url: `${PUBLIC_BASE_URL}/api/vapi/webhook` }
});
```

### Change Voice

Edit the `voice` configuration in setup script:

```typescript
voice: {
  provider: "11labs",
  voiceId: "rachel", // or "adam", "bella", etc.
}
```

Available voices: https://docs.vapi.ai/voices

## Testing & Debugging

### View Call Logs

https://dashboard.vapi.ai/calls

Each call shows:

- Full transcript
- Tool calls made
- Latency metrics
- Audio recording

### Test Webhook Locally

```bash
# Send test request to your webhook
curl -X POST http://localhost:3000/api/vapi/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "type": "tool-calls",
      "toolCallList": [{
        "id": "test_123",
        "name": "verifyCustomer",
        "arguments": {"phoneNumber": "555-123-4567"}
      }]
    }
  }'
```

### Monitor Webhook Calls

Check your Next.js console for webhook logs:

```
Vapi webhook received: {
  "message": {
    "type": "tool-calls",
    ...
  }
}
```

## Troubleshooting

### Assistant not calling tools

**Issue**: Agent responds but doesn't call your custom functions

**Fix**:

1. Verify `PUBLIC_BASE_URL` is correct and publicly accessible
2. Check webhook endpoint returns 200 status
3. Ensure tools are properly formatted in the setup script

### Phone number not working

**Issue**: Call doesn't connect or agent doesn't respond

**Fix**:

1. Wait 2-3 minutes after creating number (activation time)
2. Verify assistant is attached to phone number in dashboard
3. Check assistant has valid model and voice configuration

### Webhook timeout errors

**Issue**: Tools taking too long to respond

**Fix**:

1. Optimize database queries in tool handlers
2. Add caching for knowledge base searches
3. Set Vapi tool `async: true` for long-running operations

### Customer verification failing

**Issue**: `verifyCustomer` returns not found

**Fix**:

1. Check phone number format in Customers collection
2. Verify phone normalization logic
3. Test with exact phone format from database

## Production Deployment

### 1. Deploy to Vercel

```bash
# Push to GitHub
git push origin main

# Deploy via Vercel
vercel --prod

# Copy production URL
```

### 2. Update Environment Variables

In Vercel dashboard:

1. Go to Project Settings → Environment Variables
2. Add `VAPI_API_KEY`, `PUBLIC_BASE_URL`, etc.
3. Redeploy

### 3. Update Vapi Assistant

Run setup script with production URL:

```bash
PUBLIC_BASE_URL=https://your-app.vercel.app npx tsx src/lib/vapi/setup-assistant.ts
```

### 4. Security Considerations

- [ ] Enable Vapi webhook authentication
- [ ] Add rate limiting to webhook endpoint
- [ ] Validate all tool parameters
- [ ] Log sensitive operations
- [ ] Monitor for abuse

## Cost Estimation

### Vapi Pricing (as of setup)

- **Free tier**: 10 phone numbers, first $10 credits
- **Phone minutes**: ~$0.05/min
- **OpenAI GPT-4o-mini**: ~$0.01/call
- **ElevenLabs TTS**: ~$0.02/call
- **Deepgram STT**: ~$0.01/call

**Estimated cost per call**: $0.04 - $0.10 depending on length

### Optimization Tips

1. Use shorter system prompts
2. Cache knowledge base results
3. Set max call duration limits
4. Monitor usage in Vapi dashboard

## Resources

- **Vapi Documentation**: https://docs.vapi.ai
- **Vapi Dashboard**: https://dashboard.vapi.ai
- **Vapi Discord**: https://discord.gg/vapi
- **API Reference**: https://docs.vapi.ai/api-reference

## Support

Having issues? Check:

1. Vapi Discord community
2. This project's GitHub issues
3. Vapi documentation examples
4. Console logs in both Next.js and Vapi dashboard

---

**Happy building! 🚀**
