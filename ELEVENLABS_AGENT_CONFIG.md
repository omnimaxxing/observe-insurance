# ElevenLabs Conversational AI Agent Configuration

## System Prompt

```
You are a professional customer service agent for Observe Insurance, specializing in real-estate and property insurance.

Your role:
- Authenticate customers using phone, email, or name+DOB verification
- Help with claim status inquiries
- Answer policy questions using the knowledge base
- Send secure document upload links
- Escalate complex issues to human agents

Guidelines:
- Be conversational and professional
- Use tools to verify information - never guess
- Let customers tell you what they need
- Escalate when uncertain
- Never read alphanumeric codes aloud (like claim numbers)
```

## Tool Definitions

### 1. verifyCustomer
**URL:** `https://your-domain.com/api/elevenlabs/verify-customer`  
**Description:** Verify customer identity by phone number. This is the first step of authentication. Returns customerId if successful.

**Parameters:**
```json
{
  "phoneNumber": "string (required) - Customer's 10-digit phone number"
}
```

**Response:**
```json
{
  "success": true,
  "customerFound": true,
  "customerId": 123,
  "customerName": "Jake Palmer",
  "firstName": "Jake",
  "lastName": "Palmer",
  "phoneNumber": "+13143266906"
}
```

---

### 2. confirmIdentity
**URL:** `https://your-domain.com/api/elevenlabs/confirm-identity`  
**Description:** Confirm customer identity after verification. Ask "Am I speaking with [Name]?" and call this with their yes/no response.

**Parameters:**
```json
{
  "confirmed": "boolean (required) - true if customer confirms, false if denies",
  "customerId": "number (required) - from verifyCustomer response"
}
```

**Response:**
```json
{
  "success": true,
  "authenticated": true,
  "customerId": 123,
  "message": "Identity confirmed - you are now authenticated"
}
```

---

### 3. alternativeVerification
**URL:** `https://your-domain.com/api/elevenlabs/alternative-verification`  
**Description:** Alternative verification when phone fails. Can verify by email OR name+DOB. Returns customerId if successful.

**Parameters:**
```json
{
  "method": "string (required) - 'email' or 'name_dob'",
  "email": "string (required if method=email) - Customer's email address",
  "firstName": "string (required if method=name_dob)",
  "lastName": "string (required if method=name_dob)",
  "dateOfBirth": "string (required if method=name_dob) - Format: YYYY-MM-DD"
}
```

**Response:**
```json
{
  "success": true,
  "customerFound": true,
  "customerId": 123,
  "customerName": "Jake Palmer",
  "email": "jacobnpalmer@proton.me",
  "verificationMethod": "EMAIL"
}
```

---

### 4. sendVerificationCode
**URL:** `https://your-domain.com/api/elevenlabs/send-verification-code`  
**Description:** Send 6-character verification code to customer's email for additional security. Required after email or name+DOB verification.

**Parameters:**
```json
{
  "email": "string (required) - from alternativeVerification response",
  "customerId": "number (required) - from alternativeVerification response",
  "customerName": "string (required) - from alternativeVerification response"
}
```

**Response:**
```json
{
  "success": true,
  "codeSent": true,
  "email": "jacobnpalmer@proton.me",
  "expiresInSeconds": 300,
  "message": "A 6-character verification code has been sent to jacobnpalmer@proton.me"
}
```

---

### 5. verifyEmailCode
**URL:** `https://your-domain.com/api/elevenlabs/verify-email-code`  
**Description:** Verify the 6-character code customer reads from their email.

**Parameters:**
```json
{
  "code": "string (required) - 6-character code from email",
  "customerId": "number (required) - customer being verified"
}
```

**Response:**
```json
{
  "success": true,
  "verified": true,
  "customerId": 123,
  "customerName": "Jake Palmer",
  "email": "jacobnpalmer@proton.me"
}
```

---

### 6. getClaimStatus
**URL:** `https://your-domain.com/api/elevenlabs/get-claim-status`  
**Description:** Get claim status for authenticated customer. ONLY call after confirmIdentity succeeds. Can search specific claim or list all claims.

**Parameters:**
```json
{
  "customerId": "number (required) - from authentication",
  "claimNumber": "string (optional) - specific claim to lookup"
}
```

**Response (Single Claim):**
```json
{
  "success": true,
  "claimFound": true,
  "claimNumber": "OBS-QDN8-BMKK",
  "status": "review",
  "coverageType": "property",
  "incidentDate": "2025-11-10T12:00:00.000Z",
  "amount": 100,
  "description": "Tornado damage to office roof",
  "mostRecentNote": {
    "title": "Conversation with Customer on 11/16",
    "body": "Requested images of claim item"
  }
}
```

**Response (Multiple Claims):**
```json
{
  "success": true,
  "multipleClaims": true,
  "totalClaims": 2,
  "claims": [
    {
      "claimNumber": "OBS-ZMJG-ZLUE",
      "coverageType": "fire",
      "incidentMonth": "October 2025"
    },
    {
      "claimNumber": "OBS-QDN8-BMKK",
      "coverageType": "property",
      "incidentMonth": "November 2025"
    }
  ],
  "message": "List claims briefly, ask which one they're calling about"
}
```

---

### 7. searchKnowledgeBase
**URL:** `https://your-domain.com/api/elevenlabs/search-knowledge-base`  
**Description:** Search knowledge base for policy information and FAQs. ONLY call after confirmIdentity succeeds.

**Parameters:**
```json
{
  "query": "string (required) - Customer's question",
  "customerId": "number (required) - from authentication"
}
```

**Response:**
```json
{
  "success": true,
  "articleFound": true,
  "articleTitle": "Office Hours and Contact Information",
  "content": "Our office hours are 9 AM to 5 PM, 7 days a week...",
  "excerpt": "Quick summary of the article"
}
```

---

### 8. sendUploadLink
**URL:** `https://your-domain.com/api/elevenlabs/send-upload-link`  
**Description:** Send secure document upload link to customer's email for a specific claim. ONLY call after confirmIdentity succeeds.

**Parameters:**
```json
{
  "claimNumber": "string (required) - Claim to upload documents for",
  "customerId": "number (required) - from authentication"
}
```

**Response:**
```json
{
  "success": true,
  "linkSent": true,
  "email": "jacobnpalmer@proton.me",
  "claimNumber": "OBS-QDN8-BMKK",
  "expiresInHours": 24,
  "message": "Secure upload link sent to jacobnpalmer@proton.me"
}
```

---

## Authentication Flow

### Primary Flow (Phone)
1. **verifyCustomer** → Returns `customerId`
2. **confirmIdentity** with `customerId` → Returns `authenticated: true`
3. Now can call service tools (getClaimStatus, searchKnowledgeBase, sendUploadLink)

### Alternative Flow (Email)
1. **alternativeVerification** (method: "email") → Returns `customerId`, `email`, `customerName`
2. **sendVerificationCode** with `email`, `customerId`, `customerName`
3. **verifyEmailCode** with `code`, `customerId` → Returns `verified: true`
4. **confirmIdentity** with `customerId` → Returns `authenticated: true`
5. Now can call service tools

### Alternative Flow (Name+DOB)
1. **alternativeVerification** (method: "name_dob") → Returns `customerId`, `email`, `customerName`
2. **sendVerificationCode** with `email`, `customerId`, `customerName`
3. **verifyEmailCode** with `code`, `customerId` → Returns `verified: true`
4. **confirmIdentity** with `customerId` → Returns `authenticated: true`
5. Now can call service tools

---

## Key Differences from Vapi

✅ **No session store needed** - ElevenLabs maintains conversation context  
✅ **customerId tracking** - ElevenLabs remembers customerId from tool responses  
✅ **Simpler prompts** - Let tools enforce workflow via parameter validation  
✅ **Better state management** - No re-authentication mid-conversation  
✅ **Native context** - Tools automatically receive previous tool outputs  

---

## Testing Checklist

- [ ] Phone verification → confirmIdentity → getClaimStatus
- [ ] Email verification → sendCode → verifyCode → confirmIdentity → searchKnowledgeBase
- [ ] Name+DOB verification → sendCode → verifyCode → confirmIdentity → sendUploadLink
- [ ] Multiple claims handling
- [ ] Failed verification → alternative methods
- [ ] Code expiration and retry logic
- [ ] Escalation flows
