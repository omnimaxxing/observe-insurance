# Vapi AI Phone Agent

## Quick Start

1. **Get your Vapi API key** from https://dashboard.vapi.ai
2. **Add to `.env.local`**:
   ```bash
   VAPI_API_KEY=your-key-here
   PUBLIC_BASE_URL=https://your-ngrok-url.ngrok-free.app
   ```
3. **Run setup**:
   ```bash
   npm run vapi:setup
   ```
4. **Create phone number** in Vapi dashboard and attach the assistant ID
5. **Call the number** and test!

## Files Created

- **`src/app/api/vapi/webhook/route.ts`** - Webhook handler for all tool calls
- **`src/lib/vapi/setup-assistant.ts`** - Script to create/configure assistant
- **`src/lib/vapi/agent-flow.md`** - Conversation flow diagrams
- **`VAPI_SETUP.md`** - Complete setup documentation

## Tools Implemented

| Tool | Purpose | Route |
|------|---------|-------|
| `verifyCustomer` | Phone number lookup | Uses Payload Customers collection |
| `getClaimStatus` | Claim information | Uses Payload Claims collection |
| `searchKnowledgeBase` | FAQ search | Uses Upstash Vector index |
| `endCall` | End/escalate call | Logs summary |

## Architecture

```
Vapi Cloud ←→ Your Webhook ←→ Payload CMS
                            ←→ Upstash Vector
```

Vapi handles all voice infrastructure (STT, LLM, TTS, telephony). Your app provides data through webhook endpoints.

## Testing

```bash
# Test webhook locally
curl -X POST http://localhost:3000/api/vapi/webhook \
  -H "Content-Type: application/json" \
  -d '{"message":{"type":"tool-calls","toolCallList":[{"id":"test","name":"verifyCustomer","arguments":{"phoneNumber":"555-123-4567"}}]}}'
```

## Next Steps

See **`VAPI_SETUP.md`** for complete documentation including:
- Production deployment
- Custom tool creation
- Voice customization
- Troubleshooting guide
