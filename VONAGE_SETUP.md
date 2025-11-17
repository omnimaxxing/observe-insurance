# Vonage + ElevenLabs Integration Setup

Connect your Vonage phone number to your ElevenLabs AI agent for voice calls.

## Architecture

```
Vonage Phone Call
    ↓
Next.js Answer URL (/api/vonage/answer)
    ↓
WebSocket Connector (ngrok)
    ↓
ElevenLabs Agent
```

---

## Step-by-Step Setup

### 1. Get Your Credentials

**ElevenLabs:**

- API Key: Dashboard → My Account → API Keys
- Agent ID: Agents Platform → Select Agent → Settings → Copy Agent ID

**Vonage:**

- API Key & Secret: [Vonage Dashboard](https://dashboard.nexmo.com)
- Application ID: Create a Voice Application (or use existing)
- Phone Number: Purchase/assign a number to your application

### 2. Set Up WebSocket Connector

```bash
# In your project root
mkdir vonage-connector
cd vonage-connector

# Clone the connector
git clone https://github.com/nexmo-se/elevenlabs-agent-ws-connector.git .
npm install

# Create .env file
cat > .env << EOF
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_AGENT_ID=your_agent_id
PORT=6000
EOF
```

### 3. Expose Connector with ngrok

```bash
# In vonage-connector directory
ngrok http 6000
```

**Copy the ngrok URL** (e.g., `abc123.ngrok-free.app`) - you'll need this!

### 4. Start the Connector

```bash
# In vonage-connector directory
node elevenlabs-agent-ws-connector.cjs
```

Keep this running!

### 5. Configure Environment Variables

Add to your `.env.local`:

```bash
# Vonage Configuration
VONAGE_CONNECTOR_HOST=abc123.ngrok-free.app  # Your ngrok URL (NO https://)

# ElevenLabs (if not already set)
ELEVENLABS_API_KEY=your_key
ELEVENLABS_AGENT_ID=your_agent_id
```

### 6. Deploy Your Next.js App

**Deploy to Vercel:**

```bash
vercel --prod
```

Note your Next.js public URL (e.g., `your-app.vercel.app`)

**IMPORTANT:** Vercel does NOT support WebSockets, so the connector must be deployed separately (see Production Deployment section below).

### 7. Configure Vonage Application

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

**Save the application**

### 8. Link Phone Number

In Vonage Dashboard:

1. Go to Numbers → Your Numbers
2. Click "Edit" on your number
3. Select your Voice Application
4. Save

---

## Testing

### Test 1: Check Endpoints

```bash
# Test Answer URL
curl https://your-app.vercel.app/api/vonage/answer

# Test Events URL
curl https://your-app.vercel.app/api/vonage/events
```

Both should return `{"status":"ok"}`

### Test 2: Make a Call

Call your Vonage number from your phone:

1. You should hear: "Please wait while we connect you."
2. Connection to ElevenLabs agent
3. Agent greets you
4. Have a conversation!

### Test 3: Check Logs

**Next.js logs:**

```bash
npm run dev
# Watch for Vonage events
```

**Connector logs:**

```bash
# In vonage-connector directory
# Watch for WebSocket connections
```

---

## Troubleshooting

### "Call failed immediately"

- ✅ Check ngrok is running for connector
- ✅ Check connector is running (`node elevenlabs-agent-ws-connector.cjs`)
- ✅ Verify `VONAGE_CONNECTOR_HOST` in `.env.local` (no `https://`)

### "No audio"

- ✅ Check ElevenLabs API key and Agent ID
- ✅ Verify agent is published in ElevenLabs dashboard
- ✅ Check connector logs for errors

### "Answer URL not found"

- ✅ Verify Next.js is deployed and accessible
- ✅ Check Answer URL in Vonage dashboard matches your domain
- ✅ Test endpoint with curl

### "WebSocket connection failed"

- ✅ Ensure ngrok URL doesn't include `https://` in `VONAGE_CONNECTOR_HOST`
- ✅ Check connector is listening on port 6000
- ✅ Verify firewall isn't blocking WebSocket connections

---

## Production Deployment

**CRITICAL:** The WebSocket connector CANNOT run on Vercel (no WebSocket support). Deploy it separately:

### Recommended: Railway (Easiest)

1. **Create `Dockerfile` in `vonage-connector/`:**

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 6000
CMD ["node", "elevenlabs-agent-ws-connector.cjs"]
```

2. **Deploy to Railway:**

```bash
cd vonage-connector
# Install Railway CLI
npm i -g @railway/cli
# Login and deploy
railway login
railway init
railway up
```

3. **Set environment variables in Railway dashboard:**

   - `ELEVENLABS_API_KEY`
   - `ELEVENLABS_AGENT_ID`
   - `PORT=6000`
4. **Get your Railway URL** (e.g., `your-app.railway.app`)
5. **Update `.env.local` in Next.js:**

   ```
   VONAGE_CONNECTOR_HOST=your-app.railway.app
   ```
6. **Redeploy Next.js to Vercel**

### Alternative: Fly.io

```bash
cd vonage-connector
fly launch
fly deploy
```

### Alternative: Render

1. Create new Web Service
2. Connect GitHub repo
3. Build command: `npm install`
4. Start command: `node elevenlabs-agent-ws-connector.cjs`
5. Add environment variables

### Alternative: DigitalOcean App Platform

Similar to Railway - supports WebSockets and Docker.

---

## Architecture Diagram

```
┌─────────────────┐
│  Customer Phone │
└────────┬────────┘
         │ Calls Vonage Number
         ↓
┌─────────────────────────────┐
│  Vonage Voice Platform      │
│  - Receives call            │
│  - Requests NCCO            │
└────────┬────────────────────┘
         │ HTTP POST
         ↓
┌─────────────────────────────┐
│  Next.js API                │
│  /api/vonage/answer         │
│  - Returns NCCO with        │
│    WebSocket connect action │
└────────┬────────────────────┘
         │ WebSocket (L16 audio)
         ↓
┌─────────────────────────────┐
│  WebSocket Connector        │
│  (ngrok/cloud)              │
│  - Converts L16 ↔ base64    │
│  - Relays audio             │
└────────┬────────────────────┘
         │ WebSocket (base64)
         ↓
┌─────────────────────────────┐
│  ElevenLabs Agent           │
│  - Processes speech         │
│  - Calls your tools         │
│  - Generates responses      │
└─────────────────────────────┘
         │
         ↓
┌─────────────────────────────┐
│  Your API Endpoints         │
│  /api/elevenlabs/*          │
│  - verifyCustomer           │
│  - getClaimStatus           │
│  - etc.                     │
└─────────────────────────────┘
```

---

## Next Steps

1. ✅ Test with a real call
2. ✅ Monitor logs for issues
3. ✅ Deploy connector to production
4. ✅ Set up call recording (optional)
5. ✅ Configure fallback numbers
6. ✅ Add analytics/monitoring

---

## Useful Commands

```bash
# Start everything locally
cd vonage-connector && node elevenlabs-agent-ws-connector.cjs &
ngrok http 6000 &
cd .. && npm run dev

# Check if services are running
curl http://localhost:6000/health  # Connector
curl http://localhost:3000/api/vonage/answer  # Next.js

# View logs
tail -f vonage-connector/logs/*.log  # Connector logs
```

---

## Support

- **Vonage Docs:** https://developer.vonage.com/voice/voice-api/overview
- **ElevenLabs Docs:** https://elevenlabs.io/docs/agents-platform
- **Connector Repo:** https://github.com/nexmo-se/elevenlabs-agent-ws-connector
