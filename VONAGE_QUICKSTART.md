# Vonage + ElevenLabs Quick Start

Connect your Vonage phone number to ElevenLabs Conversational AI agent.

## What You Need

- Vonage phone number
- ElevenLabs agent (already created)
- 15 minutes

---

## Step 1: Set Up WebSocket Connector

The connector translates audio between Vonage and ElevenLabs.

```bash
# In your project root
cd /Users/jp/Developer/Observe/observe-insurance
mkdir vonage-connector
cd vonage-connector

# Clone the connector
git clone https://github.com/nexmo-se/elevenlabs-agent-ws-connector.git .
npm install
```

Create `.env` file:

```bash
cat > .env << 'EOF'
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_AGENT_ID=your_agent_id
PORT=6000
EOF
```

**Get your credentials:**
- API Key: ElevenLabs Dashboard → Profile → API Keys
- Agent ID: Agents Platform → Your Agent → Settings → Copy Agent ID

---

## Step 2: Start the Connector

```bash
# In vonage-connector directory
node elevenlabs-agent-ws-connector.cjs
```

You should see:
```
Server listening on port 6000
```

Keep this terminal running!

---

## Step 3: Expose with ngrok

Open a **new terminal**:

```bash
ngrok http 6000
```

You'll see something like:
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:6000
```

**Copy the URL** (without `https://`): `abc123.ngrok-free.app`

Keep this terminal running too!

---

## Step 4: Update Your Next.js App

Add to `.env.local`:

```bash
VONAGE_CONNECTOR_HOST=abc123.ngrok-free.app
ELEVENLABS_AGENT_ID=your_agent_id
```

Start your Next.js app:

```bash
# In project root
npm run dev
```

---

## Step 5: Expose Next.js (if testing locally)

Open **another terminal**:

```bash
ngrok http 3000
```

Copy the URL (e.g., `https://xyz789.ngrok-free.app`)

**OR** if already deployed to Vercel, use your Vercel URL.

---

## Step 6: Configure Vonage

Go to [Vonage Dashboard](https://dashboard.nexmo.com/applications)

1. Select your Voice Application (or create one)
2. Set **Answer URL**:
   ```
   https://xyz789.ngrok-free.app/api/vonage/answer
   ```
   (or your Vercel URL)

3. Set **Event URL**:
   ```
   https://xyz789.ngrok-free.app/api/vonage/events
   ```

4. Save the application

5. Go to **Numbers** → **Your Numbers**
6. Click **Edit** on your number
7. Link it to your Voice Application
8. Save

---

## Step 7: Test!

Call your Vonage number from your phone.

You should:
1. Hear a brief connection message
2. Be connected to your ElevenLabs agent
3. Have a conversation!

---

## Troubleshooting

### "Call connects but no audio"

Check all 3 terminals are running:
- ✅ `node elevenlabs-agent-ws-connector.cjs` (port 6000)
- ✅ `ngrok http 6000` (connector ngrok)
- ✅ `npm run dev` (Next.js on port 3000)

### "Call fails immediately"

1. Test your Answer URL:
   ```bash
   curl https://xyz789.ngrok-free.app/api/vonage/answer
   ```
   Should return: `{"status":"ok"}`

2. Check `VONAGE_CONNECTOR_HOST` in `.env.local` has NO `https://`

3. Verify connector is running:
   ```bash
   curl http://localhost:6000
   ```

### "Connection refused"

- ✅ Make sure ngrok URLs are correct
- ✅ Restart ngrok if it expired (free tier times out)
- ✅ Check firewall isn't blocking connections

---

## What's Happening

```
1. Customer calls Vonage number
   ↓
2. Vonage requests NCCO from /api/vonage/answer
   ↓
3. Your API returns WebSocket connection info
   ↓
4. Vonage connects to your connector via WebSocket
   ↓
5. Connector converts audio format and forwards to ElevenLabs
   ↓
6. ElevenLabs agent processes speech and calls your tools
   ↓
7. Your tools (/api/elevenlabs/*) return data
   ↓
8. Agent responds to customer
```

---

## Production Deployment

For production, deploy the connector to a permanent server:

### Option 1: Railway (Recommended)

1. Create `Dockerfile` in `vonage-connector/`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 6000
CMD ["node", "elevenlabs-agent-ws-connector.cjs"]
```

2. Deploy:

```bash
cd vonage-connector
npm i -g @railway/cli
railway login
railway init
railway up
```

3. Set environment variables in Railway dashboard
4. Get your Railway URL (e.g., `your-app.railway.app`)
5. Update `VONAGE_CONNECTOR_HOST` in Vercel environment variables
6. Redeploy Next.js

### Option 2: Fly.io

```bash
cd vonage-connector
fly launch
fly deploy
```

### Option 3: Render

1. Create Web Service
2. Connect repo
3. Build: `npm install`
4. Start: `node elevenlabs-agent-ws-connector.cjs`
5. Add environment variables

---

## Architecture Summary

**Development:**
- Next.js: `localhost:3000` + ngrok
- Connector: `localhost:6000` + ngrok
- ElevenLabs: Cloud
- Your tools: `localhost:3000` + ngrok

**Production:**
- Next.js: Vercel
- Connector: Railway/Fly.io/Render
- ElevenLabs: Cloud
- Your tools: Vercel (same as Next.js)

---

## Next Steps

1. ✅ Test the call flow
2. ✅ Deploy connector to Railway/Fly.io
3. ✅ Update Vonage with production URLs
4. ✅ Monitor call logs
5. ✅ Add call recording (optional)
6. ✅ Set up analytics

---

## Quick Commands Reference

```bash
# Start everything (development)
cd vonage-connector && node elevenlabs-agent-ws-connector.cjs &
ngrok http 6000 &
cd .. && npm run dev &
ngrok http 3000

# Check if services are running
curl http://localhost:6000  # Connector
curl http://localhost:3000/api/vonage/answer  # Next.js

# View logs
# Connector logs in terminal
# Next.js logs in terminal
# Vonage logs in dashboard
# ElevenLabs logs in dashboard
```

---

## Support

- Connector Repo: https://github.com/nexmo-se/elevenlabs-agent-ws-connector
- Vonage Docs: https://developer.vonage.com/voice/voice-api/overview
- ElevenLabs Docs: https://elevenlabs.io/docs/agents-platform
