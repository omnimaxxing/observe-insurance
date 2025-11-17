# Vonage → ElevenLabs Direct SIP Integration

**Simplest approach** - Connect Vonage directly to ElevenLabs using SIP. No WebSocket connector needed!

## Architecture

```
Customer Phone → Vonage Number → ElevenLabs (SIP) → Your API Tools
```

✅ Works on Vercel  
✅ No separate connector to deploy  
✅ Lower latency  
✅ Simpler setup  

---

## Setup Steps

### 1. Enable SIP in ElevenLabs

1. Go to [ElevenLabs Agents Dashboard](https://elevenlabs.io/app/conversational-ai)
2. Select your agent
3. Click **"Telephony"** tab
4. Enable **"SIP Trunk"**
5. Note your **Agent ID** (you'll need this)

The SIP URI will be: `sip:{your-agent-id}@sip.elevenlabs.io`

### 2. Update Environment Variables

Add to your `.env.local`:

```bash
# ElevenLabs
ELEVENLABS_AGENT_ID=your_agent_id_here
ELEVENLABS_API_KEY=your_api_key_here
```

### 3. Deploy to Vercel

```bash
vercel --prod
```

Note your production URL (e.g., `your-app.vercel.app`)

### 4. Configure Vonage Application

Go to [Vonage Dashboard](https://dashboard.nexmo.com/applications) → Your Application

**Answer URL:**
```
https://your-app.vercel.app/api/vonage/answer
```

**Event URL:**
```
https://your-app.vercel.app/api/vonage/events
```

**Capabilities:**
- ✅ Voice

Save the application.

### 5. Link Your Phone Number

1. Go to **Numbers** → **Your Numbers**
2. Click **Edit** on your Vonage number
3. Select your Voice Application
4. **Save**

---

## Testing

### Test the Answer URL

```bash
curl https://your-app.vercel.app/api/vonage/answer
```

Should return: `{"status":"ok"}`

### Make a Test Call

1. Call your Vonage number from your phone
2. You should be connected directly to your ElevenLabs agent
3. Have a conversation!

### Check Logs

**Vercel Dashboard:**
- Go to your project → Functions → Logs
- Watch for incoming calls

**ElevenLabs Dashboard:**
- Go to your agent → Analytics
- See call history and transcripts

---

## How It Works

1. **Customer calls** your Vonage number
2. **Vonage requests NCCO** from your `/api/vonage/answer` endpoint
3. **Your API returns** SIP connection instructions
4. **Vonage connects** directly to ElevenLabs via SIP
5. **ElevenLabs agent** handles the conversation
6. **Agent calls your tools** at `/api/elevenlabs/*` endpoints
7. **Your tools** return data to ElevenLabs
8. **Agent responds** to customer

---

## Passing Customer Phone Number

The customer's phone number is passed to ElevenLabs in the SIP headers:

```typescript
headers: {
  'X-Customer-Phone': from,  // Customer's phone number
}
```

You can access this in your ElevenLabs agent's first tool call (e.g., `verifyCustomer`) by configuring the tool to receive it as a parameter.

### Option: Auto-verify by Phone

Update your `verifyCustomer` tool in ElevenLabs to accept the phone number from SIP headers automatically:

1. In ElevenLabs tool config, add a parameter:
   - Name: `phoneNumber`
   - Type: `string`
   - Source: `sip_header.X-Customer-Phone`

2. Agent will automatically call `verifyCustomer` with the customer's phone on connection

---

## Troubleshooting

### "Call connects but no audio"

- ✅ Verify `ELEVENLABS_AGENT_ID` is correct
- ✅ Check agent is published in ElevenLabs dashboard
- ✅ Ensure SIP is enabled for your agent

### "Call fails immediately"

- ✅ Check Answer URL is correct in Vonage dashboard
- ✅ Verify Answer URL returns valid NCCO (test with curl)
- ✅ Check Vercel logs for errors

### "Agent doesn't call my tools"

- ✅ Verify tool URLs are publicly accessible
- ✅ Check tool configurations in ElevenLabs dashboard
- ✅ Test tools directly with curl

### "Phone number not being passed"

- ✅ Check SIP headers in ElevenLabs logs
- ✅ Verify tool parameter configuration
- ✅ Test with a simple tool that logs all parameters

---

## Advantages vs WebSocket Connector

| Feature | SIP (This Method) | WebSocket Connector |
|---------|-------------------|---------------------|
| **Deployment** | Vercel ✅ | Separate server needed |
| **Complexity** | Simple | Complex |
| **Latency** | Lower | Higher |
| **Maintenance** | Minimal | More moving parts |
| **Cost** | Lower | Higher (extra server) |

---

## Next Steps

1. ✅ Test with a real call
2. ✅ Configure auto-verification with phone number
3. ✅ Set up call recording (optional)
4. ✅ Add analytics/monitoring
5. ✅ Configure business hours handling
6. ✅ Set up voicemail/fallback

---

## Advanced: Business Hours

Add business hours check to your answer route:

```typescript
// Check if within business hours
const now = new Date()
const hour = now.getHours()
const day = now.getDay()

const isBusinessHours = 
  day >= 1 && day <= 5 &&  // Monday-Friday
  hour >= 9 && hour < 17    // 9am-5pm

if (!isBusinessHours) {
  return NextResponse.json([
    {
      action: 'talk',
      text: 'Thank you for calling Observe Insurance. Our office hours are Monday through Friday, 9am to 5pm. Please call back during business hours or visit our website.',
    },
  ])
}

// Otherwise, connect to ElevenLabs...
```

---

## Support

- **Vonage SIP Docs:** https://developer.vonage.com/voice/voice-api/code-snippets/connect-a-call-to-a-sip-endpoint
- **ElevenLabs SIP:** https://elevenlabs.io/docs/agents-platform/telephony
- **Vonage NCCO Reference:** https://developer.vonage.com/voice/voice-api/ncco-reference

---

## Summary

This is the **recommended approach** for Vonage + ElevenLabs integration:

✅ No WebSocket connector needed  
✅ Works perfectly on Vercel  
✅ Simpler architecture  
✅ Lower latency  
✅ Easier to maintain  

Just configure SIP in ElevenLabs, update your environment variables, and deploy!
