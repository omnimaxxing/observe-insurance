# Production Deployment - Vonage + ElevenLabs

Deploy everything to production in 15 minutes. No local testing needed.

---

## Part 1: Deploy WebSocket Connector to Railway (5 min)

### 1. Run the deploy script

```bash
cd /Users/jp/Developer/Observe/observe-insurance
chmod +x vonage-connector-deploy.sh
./vonage-connector-deploy.sh
```

### 2. Install Railway CLI

```bash
npm i -g @railway/cli
```

### 3. Login to Railway

```bash
railway login
```

Browser will open - login with GitHub.

### 4. Deploy

```bash
cd vonage-connector
railway up
```

Select "Create new project" when prompted.

### 5. Set environment variables

Go to [Railway Dashboard](https://railway.app/dashboard)

1. Click your project
2. Click "Variables" tab
3. Add these variables:
   - `ELEVENLABS_API_KEY` = your ElevenLabs API key
   - `ELEVENLABS_AGENT_ID` = your agent ID
   - `PORT` = 6000

4. Click "Deploy" (it will redeploy with env vars)

### 6. Get your Railway URL

In Railway dashboard:
- Click "Settings" tab
- Under "Domains", click "Generate Domain"
- Copy the URL (e.g., `your-app.railway.app`)

**Save this URL - you'll need it!**

---

## Part 2: Deploy Next.js to Vercel (3 min)

### 1. Add environment variables to Vercel

Go to [Vercel Dashboard](https://vercel.com/dashboard)

1. Select your project (or import from GitHub if new)
2. Go to "Settings" → "Environment Variables"
3. Add these:
   - `VONAGE_CONNECTOR_HOST` = `your-app.railway.app` (NO https://)
   - `ELEVENLABS_API_KEY` = your ElevenLabs API key
   - `ELEVENLABS_AGENT_ID` = your agent ID
   - All your existing env vars (DATABASE_URI, etc.)

### 2. Deploy

```bash
cd /Users/jp/Developer/Observe/observe-insurance
vercel --prod
```

Or push to GitHub and Vercel will auto-deploy.

### 3. Get your Vercel URL

Copy your production URL (e.g., `your-app.vercel.app`)

---

## Part 3: Configure Vonage (5 min)

### 1. Go to Vonage Dashboard

[https://dashboard.nexmo.com/applications](https://dashboard.nexmo.com/applications)

### 2. Create or select Voice Application

Click "Create a new application" or select existing.

### 3. Set URLs

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

Click "Generate new application" or "Save changes"

### 4. Link your phone number

1. Go to "Numbers" → "Your numbers"
2. Click "Edit" next to your number
3. Under "Voice", select your application
4. Click "Ok"

---

## Part 4: Test (2 min)

### 1. Verify endpoints

```bash
# Test Answer URL
curl https://your-app.vercel.app/api/vonage/answer

# Test Events URL
curl https://your-app.vercel.app/api/vonage/events
```

Both should return `{"status":"ok"}`

### 2. Test connector

```bash
curl https://your-app.railway.app
```

Should return connector info or 200 OK.

### 3. Make a call!

Call your Vonage number from your phone.

You should:
1. Be connected to your ElevenLabs agent
2. Have a conversation
3. Agent calls your tools at `/api/elevenlabs/*`

---

## Monitoring

### Railway Logs (Connector)

```bash
railway logs
```

Or view in Railway dashboard → "Deployments" → "View Logs"

### Vercel Logs (Next.js)

Go to Vercel Dashboard → Your Project → "Logs"

Watch for:
- Vonage webhook calls
- Tool calls from ElevenLabs
- Any errors

### ElevenLabs Logs

Go to ElevenLabs Dashboard → Your Agent → "Analytics"

See:
- Call history
- Transcripts
- Tool calls
- Errors

---

## Troubleshooting

### "Call connects but no audio"

**Check Railway connector:**
```bash
railway logs
```

Look for WebSocket connection errors.

**Verify env vars in Railway:**
- ELEVENLABS_API_KEY
- ELEVENLABS_AGENT_ID
- PORT=6000

### "Call fails immediately"

**Check Vercel logs:**

Go to Vercel → Logs → Filter by `/api/vonage/answer`

**Verify VONAGE_CONNECTOR_HOST:**
- Should be `your-app.railway.app` (NO https://)
- Check in Vercel → Settings → Environment Variables

**Test Answer URL:**
```bash
curl https://your-app.vercel.app/api/vonage/answer
```

### "Tools not being called"

**Check tool URLs in ElevenLabs:**

Each tool should point to:
```
https://your-app.vercel.app/api/elevenlabs/[tool-name]
```

**Test tools directly:**
```bash
curl -X POST https://your-app.vercel.app/api/elevenlabs/verify-customer \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"1234567890"}'
```

---

## Architecture (Production)

```
Customer Phone
    ↓
Vonage Number
    ↓
Next.js on Vercel (/api/vonage/answer)
    ↓
WebSocket Connector on Railway
    ↓
ElevenLabs Conversational AI
    ↓
Your Tools on Vercel (/api/elevenlabs/*)
    ↓
Payload CMS Database
```

---

## Cost Estimate

**Railway:**
- Free tier: $5/month credit
- Connector uses minimal resources
- ~$0-5/month

**Vercel:**
- Hobby: Free
- Pro: $20/month (if needed)

**Vonage:**
- Per minute pricing
- ~$0.01-0.02/min

**ElevenLabs:**
- Per character pricing
- Check your plan

**Total:** ~$5-30/month depending on usage

---

## Scaling

### If connector becomes a bottleneck:

**Option 1: Scale Railway**

Railway auto-scales. Just increase resources in dashboard.

**Option 2: Multiple connectors**

Deploy multiple connectors and load balance.

**Option 3: Use Fly.io**

Better for high-traffic apps:
```bash
cd vonage-connector
fly launch
fly deploy
```

---

## Security Checklist

- ✅ Environment variables set in Railway/Vercel (not in code)
- ✅ HTTPS enabled (automatic on Railway/Vercel)
- ✅ API keys not exposed in client-side code
- ✅ Tools validate `customerId` parameter
- ✅ Database credentials secure

---

## Maintenance

### Update connector

```bash
cd vonage-connector
git pull
railway up
```

### Update Next.js

```bash
git push
# Vercel auto-deploys
```

### Monitor uptime

Set up monitoring:
- [UptimeRobot](https://uptimerobot.com) - Free
- [Better Uptime](https://betteruptime.com) - Free tier
- Ping your Answer URL every 5 minutes

---

## Backup Plan

If connector goes down:

**Option 1: Quick redeploy**
```bash
cd vonage-connector
railway up
```

**Option 2: Switch to Fly.io**

Already have Dockerfile, just:
```bash
fly launch
fly deploy
```

Update `VONAGE_CONNECTOR_HOST` in Vercel.

---

## Success Checklist

- ✅ Railway connector deployed and running
- ✅ Vercel Next.js deployed
- ✅ Environment variables set in both
- ✅ Vonage configured with correct URLs
- ✅ Phone number linked to application
- ✅ Test call successful
- ✅ Monitoring set up
- ✅ Logs accessible

---

## Quick Commands

```bash
# Check Railway status
railway status

# View Railway logs
railway logs

# Redeploy Railway
railway up

# Deploy to Vercel
vercel --prod

# Test endpoints
curl https://your-app.vercel.app/api/vonage/answer
curl https://your-app.railway.app
```

---

You're done! Call your Vonage number and talk to your AI agent. 🎉
