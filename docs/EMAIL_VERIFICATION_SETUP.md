# Email Verification Code Setup

## Overview

Email verification adds a second factor of authentication by sending a one-time code to the customer's email address. This significantly improves security for alternative verification methods.

## Flow

```
1. Customer provides email → alternativeVerification finds match
2. AI calls sendVerificationCode → Code generated & sent via email
3. Customer receives email with 6-character code
4. Customer reads code to AI → AI calls verifyEmailCode
5. If valid → Customer authenticated ✅
```

## Installation

### 1. Install Resend Package

```bash
pnpm add resend
```

### 2. Set Up Resend Account

1. Go to https://resend.com and sign up
2. Verify your domain (or use their test domain for development)
3. Get your API key from the dashboard

### 3. Configure Environment Variables

Add to your `.env.local`:

```bash
# Resend API Key for sending verification emails
RESEND_API_KEY=re_xxxxxxxxxxxxx

# Upstash Redis (already configured for session store)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

### 4. Configure Sending Domain

**Option A: Development (Quick Start)**
- Use Resend's test domain: `onboarding@resend.dev`
- Emails only send to your verified email addresses
- Update `sendVerificationCode.ts` line 52:
  ```typescript
  from: 'Observe Insurance <onboarding@resend.dev>',
  ```

**Option B: Production (Custom Domain)**
1. Add your domain in Resend dashboard
2. Add DNS records (SPF, DKIM)
3. Verify domain ownership
4. Update email sender:
  ```typescript
  from: 'Observe Insurance <verify@observeinsurance.com>',
  ```

## Security Features

### Code Generation
- **6 characters**: Alphanumeric (uppercase letters + numbers)
- **Ambiguous characters removed**: No 0, O, 1, I, L
- **Example codes**: `A3H9KP`, `X7M4BT`, `Q5R8NZ`

### Redis Storage
- **TTL**: 5 minutes (300 seconds)
- **Key format**: `vapi:verification:{callId}`
- **Auto-cleanup**: Redis expires keys automatically

### Rate Limiting
- **Max attempts**: 3 attempts per code
- **After 3 failures**: Code is invalidated and customer is escalated
- **Tracking**: Attempt count stored in Redis with code

### Code Format
- **Storage**: `ABC123` (no spaces)
- **Email display**: `ABC 123` (spaced for readability)
- **Validation**: Accepts both formats (spaces removed during verification)

## Testing

### Test Flow

1. **Start a test call** with wrong phone number
2. **Provide email** when prompted
3. **Check your email** for verification code
4. **Read code to AI**: "ABC 123" or "ABC123"
5. **Verify success** in logs

### Expected Logs

```
🔧 FUNCTION: sendVerificationCode
📥 Input: { email: 'test@example.com', customerId: 1, customerName: 'John Doe' }
🔑 Code: ABC123 (formatted: ABC 123)
📧 Sending verification code to: test@example.com
✅ Email sent successfully! Email ID: abc-123-def

🔧 FUNCTION: verifyEmailCode
📥 Input: { code: 'AB****', callId: '...' }
🔍 Verification attempt 1/3 for call ...
   Provided: ABC123, Expected: ABC123
✅ Verification successful for call ...
```

## Email Template

The verification email includes:
- **Professional header** with gradient banner
- **Customer name** personalization
- **Large, formatted code** (easy to read)
- **Expiration warning** (5 minutes)
- **Security notice** (didn't request this?)
- **Mobile-responsive** design

## Error Handling

### Scenario: Invalid Code
```json
{
  "success": false,
  "verified": false,
  "error": "INVALID_CODE",
  "attemptsRemaining": 2,
  "message": "That code doesn't match. You have 2 attempts remaining."
}
```

### Scenario: Expired Code
```json
{
  "success": false,
  "verified": false,
  "error": "CODE_EXPIRED",
  "message": "The verification code has expired. Would you like me to send a new code?"
}
```

### Scenario: Max Attempts
```json
{
  "success": false,
  "verified": false,
  "error": "MAX_ATTEMPTS_EXCEEDED",
  "escalate": true,
  "message": "Too many incorrect attempts. Transferring to representative..."
}
```

## AI Conversation Example

```
AI: I wasn't able to find an account with that phone number. 
    Could you provide the email address on your account?

Customer: It's john dot smith at gmail dot com

AI: I heard john.smith@gmail.com. Is that correct?

Customer: Yes

AI: [calls alternativeVerification with method="email"]
    [receives success=true with customer data]
    
AI: [calls sendVerificationCode]
    For security, I'm sending a 6-character verification code to 
    john.smith@gmail.com. Please check your email and read me 
    the code when you receive it.

Customer: I got it. It's A B C space 1 2 3

AI: [calls verifyEmailCode with code="ABC 123"]
    [receives verified=true]
    
    Perfect! I've verified your identity. Am I speaking with John Smith?

Customer: Yes

AI: [calls confirmIdentity with confirmed=true]
    Great, John! How can I help you today?
```

## Production Considerations

### Monitoring
- Track email delivery rates in Resend dashboard
- Monitor Redis key expiration patterns
- Alert on high verification failure rates

### Rate Limiting (Future Enhancement)
- Limit verification code sends per email (e.g., 5 per hour)
- Prevent abuse with IP-based rate limiting
- Add CAPTCHA if suspicious patterns detected

### Compliance
- Email delivery follows CAN-SPAM guidelines
- Verification codes are single-use
- No PII stored in Redis longer than 5 minutes
- Codes automatically deleted after use or expiration

## Troubleshooting

### Issue: Email not received
1. Check Resend dashboard for delivery status
2. Verify email address is correct in logs
3. Check spam folder
4. Ensure domain is verified (production)

### Issue: Code validation fails
1. Check Redis connection
2. Verify code hasn't expired (5 min TTL)
3. Check for typos in code entry
4. Review logs for normalization issues

### Issue: TypeScript errors
```bash
# Install Resend types
pnpm add resend

# Rebuild Next.js
pnpm dev
```
