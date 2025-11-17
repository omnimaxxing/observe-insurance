# Call Escalation & Transfer System

## Overview

When authentication fails or customers need human assistance, the AI offers a choice:

1. **Transfer to Tier 2 Support** → Forwards call to 314-230-4536
2. **End the Call** → Politely ends conversation

## Transfer Number

**Tier 2 Escalation:** `+13142304536` (314-230-4536)

This number is hardcoded in `/src/lib/vapi/functions/endCall.ts`

## When Escalation is Offered

### Authentication Failures

- ✅ Phone number verification failed (no match)
- ✅ Email verification failed (no match or wrong code 3x)
- ✅ Name + DOB verification failed (no match)
- ✅ All verification methods exhausted

### Customer Requests

- ✅ Customer explicitly asks for human agent
- ✅ Customer says they need help
- ✅ Customer doesn't want to provide verification info

### System Issues

- ✅ Technical errors preventing service
- ✅ Complex inquiries beyond AI capabilities

## The Conversation Flow

### 1. AI Offers Choice

```
AI: "I'm unable to verify your identity through our automated system. 
     I can either transfer you to one of our representatives who can 
     help, or we can end the call for now. Which would you prefer?"
```

### 2. Customer Responds

**Option A: Transfer**

```
Customer: "Transfer me" / "I need help" / "Agent please" / "Yes"

AI: [calls endCall({ transferToAgent: true, reason: "escalate" })]
    "Let me transfer you to one of our representatives who can help 
     you with this. Please hold while I connect you."

[Call transfers to 314-230-4536]
```

**Option B: End Call**

```
Customer: "End the call" / "No thanks" / "I'll call back" / "Hang up"

AI: [calls endCall({ transferToAgent: false, reason: "customer_request" })]
    "No problem. Feel free to call us back anytime. Have a great day!"

[Call ends]
```

**Option C: Unclear Response**

```
Customer: "Um..." / "What?"

AI: "Just to confirm, would you like me to transfer you to a 
     representative, or end the call?"
```

## Technical Implementation

### `endCall` Function

Located: `/src/lib/vapi/functions/endCall.ts`

```typescript
endCall({
  reason: "escalate" | "completed" | "customer_request" | "authentication_failed",
  summary: "Brief call summary",
  transferToAgent: true | false // Key parameter!
})
```

**Returns:**

Transfer to agent:

```json
{
  "success": true,
  "action": "TRANSFER_CALL",
  "transferDestination": "+13142304536",
  "transferToHuman": true,
  "message": "Let me transfer you to one of our representatives..."
}
```

End call normally:

```json
{
  "success": true,
  "action": "END_CALL",
  "transferToHuman": false,
  "message": "Thank you for calling Observe Insurance. Have a great day!"
}
```

### Webhook Handling

Located: `/src/app/api/vapi/webhook/route.ts`

When `action === "TRANSFER_CALL"`:

```typescript
return NextResponse.json({
  results,
  transferCall: {
    destination: "+13142304536",
    message: "Transferring your call now. Please hold."
  }
});
```

Vapi receives this response and:

1. Plays the transfer message to customer
2. Initiates phone bridge to tier 2 number
3. Connects customer to human agent

## Example Scenarios

### Scenario 1: All Verification Methods Failed

```
AI: Hello, could you provide your phone number?
Customer: 555-1234
AI: [no match] Could you provide your email instead?
Customer: test@example.com
AI: [no match] Could you provide your name and DOB?
Customer: John Doe, Jan 1, 1990
AI: [no match]

AI: I'm unable to verify your identity through our automated system.
    I can either transfer you to one of our representatives who can
    help, or we can end the call for now. Which would you prefer?

Customer: Transfer me please.

AI: Let me transfer you to one of our representatives who can help
    you with this. Please hold while I connect you.
  
[Transfers to 314-230-4536]
```

### Scenario 2: Customer Declines Verification

```
AI: Could you provide the email address on your account?
Customer: I'd rather not give that out.

AI: I understand. I can either transfer you to one of our
    representatives who can help, or we can end the call for now.
    Which would you prefer?

Customer: Just end the call, I'll call back later.

AI: No problem. Feel free to call us back anytime. Have a great day!

[Call ends]
```

### Scenario 3: Customer Directly Requests Agent

```
AI: How can I help you today?
Customer: I need to speak to a person.

AI: I can transfer you to one of our representatives. Would you
    like me to do that, or is there something I can help with first?

Customer: Just transfer me.

AI: Let me transfer you to one of our representatives who can help
    you with this. Please hold while I connect you.
  
[Transfers to 314-230-4536]
```

### Scenario 4: Email Code Verification Failed (3x)

```
AI: I've sent a code to your email. Please read it to me.
Customer: A B C 1 2 3
AI: That code doesn't match. You have 2 attempts remaining.
Customer: X Y Z 4 5 6
AI: That code doesn't match. You have 1 attempt remaining.
Customer: Q R S 7 8 9
AI: [verifyEmailCode returns MAX_ATTEMPTS_EXCEEDED]

AI: Too many incorrect attempts. For your security, I can either
    transfer you to a representative who can help verify your
    identity, or we can end the call. Which would you prefer?

Customer: Transfer please.

[Transfers to 314-230-4536]
```

## Configuration

### Update Transfer Number

Edit `/src/lib/vapi/functions/endCall.ts`:

```typescript
// Line 8
const ESCALATION_PHONE_NUMBER = "+1YOUR_NUMBER_HERE";
```

### Disable Transfers (Testing Mode)

To test without actually transferring:

```typescript
// In webhook/route.ts, comment out transfer logic:
if ((result as any).action === "TRANSFER_CALL") {
  console.log(`📞 TRANSFER REQUESTED (disabled for testing)`);
  // Don't actually return transfer instruction
  // return NextResponse.json({ results, transferCall: {...} });
}
```

## Logging

### Console Output

**Transfer Request:**

```
🔧 FUNCTION: endCall
📥 Input: { reason: 'escalate', transferToAgent: true }
📞 Transferring call to tier 2 support: +13142304536
================================================================================
📤 Result: { action: "TRANSFER_CALL", transferDestination: "+13142304536" }
📞 TRANSFER REQUESTED: Forwarding call to +13142304536
```

**Normal End:**

```
🔧 FUNCTION: endCall
📥 Input: { reason: 'customer_request', transferToAgent: false }
✅ Call completed
================================================================================
📤 Result: { action: "END_CALL", message: "Thank you..." }
```

## Testing Checklist

- [ ] Test authentication failure → offer escalation
- [ ] Test customer says "transfer" → call transfers
- [ ] Test customer says "end call" → call ends
- [ ] Test unclear response → AI clarifies
- [ ] Test direct agent request → immediate transfer offer
- [ ] Verify 314-230-4536 receives transferred calls
- [ ] Check call quality during transfer
- [ ] Test transfer message plays correctly

## Troubleshooting

### Transfer Not Working

1. **Check Vapi Dashboard**

   - Verify phone number format: `+1XXXXXXXXXX`
   - Ensure account has transfer capability enabled
   - Check call logs for transfer attempts
2. **Check Webhook Logs**

   - Look for `📞 TRANSFER REQUESTED` message
   - Verify `transferCall` object in response
   - Check for any errors in webhook execution
3. **Verify Phone Number**

   - Format: `+13142304536` (E.164 format)
   - No spaces, dashes, or parentheses
   - Country code (+1) required

### AI Not Offering Choice

1. **Check System Prompt**

   - Verify Step 4 escalation flow exists
   - Ensure trigger scenarios are clear
2. **Check Function Definition**

   - `transferToAgent` should be required parameter
   - Description should mention asking customer
3. **Review Conversation**

   - AI might not recognize authentication failed
   - Check function results for proper error codes

## Future Enhancements

- [ ] Add IVR menu after transfer (press 1 for claims, 2 for policy, etc.)
- [ ] Track transfer reasons in analytics
- [ ] Add callback option instead of transfer
- [ ] Implement business hours check (transfer only during office hours)
- [ ] Add voicemail option after-hours
- [ ] Queue position announcements for transfers
