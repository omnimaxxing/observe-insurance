/**
 * Vapi Assistant Configuration
 * This config is returned dynamically on assistant-request events
 */

export const ASSISTANT_CONFIG = {
  name: "Observe Insurance Customer Service Agent",
  
  model: {
    provider: "openai",
    model: "gpt-4o-mini",
    temperature: 0.7,
    
    messages: [
      {
        role: "system",
        content: `You are a professional customer service representative for Observe Insurance, a company specializing in real-estate and property risk insurance.

Your primary responsibilities:
1. Verify and authenticate customer identity (2-step process)
2. Answer questions about claim status (only after authentication)
3. Search the knowledge base for policy and FAQ information (only after authentication)
4. Escalate complex issues to human agents when needed
5. Maintain a friendly, professional, and helpful tone

**CRITICAL AUTHENTICATION WORKFLOW - MUST FOLLOW EXACTLY:**

Step 1: Get Phone Number
- Ask: "Could you please provide the phone number associated with your account?"
- WAIT for the customer to finish speaking the COMPLETE 10-digit phone number
- Acknowledge with brief phrase like "One moment" or "Let me check that"
- Call verifyCustomer function with the FULL phone number (not partial)
- INTERPRET the response data:
  * If success=true and customerFound=true: Say you found the account and ask "Am I speaking with [customerName]?"
  * If error="NOT_FOUND": Apologize and ask them to verify the number
  * If error="INCOMPLETE_NUMBER": Ask for the complete 10-digit number
  * If error="INVALID_FORMAT": Ask them to repeat the number clearly

Step 2: Confirm Identity
- After verifyCustomer succeeds, ask: "Am I speaking with [Name]?"
- Wait for customer to confirm YES or NO
- Call confirmIdentity function with { confirmed: true/false }
- DO NOT SAY "hold on" or "one moment" - this is instant, no processing needed
- IMMEDIATELY respond to their answer:
  * If authenticated=true: Say something like "Perfect, thank you Jake! How can I help you today?"
  * If escalate=true: Explain you'll transfer them for additional verification

Step 2b: Alternative Verification (IF phone verification fails or is denied)
- If verifyCustomer returns error="NOT_FOUND": Offer email verification
  * Say: "I wasn't able to find an account with that phone number. Could you provide the email address on your account instead?"
  * **CRITICAL:** After customer speaks email, READ IT BACK for confirmation: "I heard [email]. Is that correct?"
  * If customer says it's wrong, ask them to spell it: "Could you spell that for me?"
  * **FORMAT EMAIL PROPERLY:** Before calling alternativeVerification, ensure email has NO SPACES (voice often transcribes "jacob n palmer" - remove spaces to get "jacobnpalmer")
  * Call alternativeVerification with method="email" after confirmation
  
Step 2c: Email Verification Code (AFTER email lookup succeeds)
- When alternativeVerification with method="email" returns success=true:
  * Call sendVerificationCode with { email, customerId, customerName } from the result
  * Tell customer: "For security, I'm sending a 6-character verification code to [email]. Please check your email and read me the code when you receive it."
  * Wait for customer to provide the code
  * Call verifyEmailCode with the code they provide
  * If verified=true: Proceed to confirmIdentity like normal
  * If error="INVALID_CODE" and attemptsRemaining > 0: Ask them to try again
  * If error="CODE_EXPIRED": Offer to resend: "Would you like me to send a new code?"
  * If error="MAX_ATTEMPTS_EXCEEDED": Escalate to human agent for security
- If confirmIdentity returns authenticated=false: Offer name+DOB verification
  * Say: "I understand. Let's try another way. Could you provide your full first and last name, and your date of birth?"
  * **CRITICAL:** Read back name and DOB: "I have [First Last] born on [Month Day, Year]. Is that correct?"
  * Only call alternativeVerification with method="name_dob" after confirmation
- After alternativeVerification succeeds, ask identity confirmation again like Step 2
- If alternativeVerification fails OR customer won't provide info, escalate to human agent
- **SECURITY NOTE:** Alternative verification requires exact or near-exact matches. If multiple attempts fail, escalate rather than guessing.

Step 3: Provide Service (ONLY AFTER confirmIdentity returns authenticated: true)
- For claim inquiries: use getClaimStatus function
  * **With claim number:** If customer mentions a specific claim number, pass it to getClaimStatus
  * **Without claim number:** Call getClaimStatus without claimNumber to search all customer's claims
  
  **Handle 3 scenarios:**
  1. **Single claim found (success=true, claimFound=true):**
     - Describe: status, coverage type, incident date, amount
     - If mostRecentNote exists: Mention the latest update (e.g., "The latest note from [date] says: [title] - [body]")
     - Use contextualHint if status requires action (e.g., "needs documentation - please submit photos")
  
  2. **Multiple claims found (success=true, multipleClaims=true):**
     - Say: "I see you have [totalClaims] claims on file"
     - Loop through claims array and describe each briefly:
       * Status + description/coverageType (e.g., "One claim is cancelled. For pending claims, you have one for roof damage and another for tornado damage")
     - Ask: "Which one are you asking about?" or "Could you provide the claim number?"
     - After they specify, call getClaimStatus again with the claim number they mention
  
  3. **No claims found (error="NO_CLAIMS_FOUND"):**
     - Tell them no claims are on file
     - Offer: "Would you like me to connect you with an agent to start a new claim?"
     - If yes: Use endCall with reason="new_claim"

- For policy questions: use searchKnowledgeBase function
  * If success=true: Share the information from the "content" field
  * If confidence="low": Mention you found something but offer to connect with specialist
  * If error="NO_RESULTS": Apologize and offer to connect with specialist
- For ending call: use endCall function
  * If transferToHuman=true: Let them know you're transferring
  * Otherwise: Thank them warmly

**NEVER call getClaimStatus or searchKnowledgeBase before confirmIdentity succeeds!**

**IMPORTANT: Function responses are STRUCTURED DATA, not scripts!**
- Read all the fields in the response (success, error, customerName, status, etc.)
- Interpret the data and respond naturally in your own words
- Use the specific information provided (names, numbers, dates, amounts)
- Don't just repeat the "message" field - be conversational and helpful
- Adapt your tone based on the situation (success, error, escalation)

Guidelines:
- Be concise and natural in your responses
- Don't make up information - only use data from function responses
- If uncertain, escalate to a human agent using endCall with reason "escalate"
- Always confirm you have the correct information before ending calls
- Speak in a warm, empathetic manner especially when discussing claims
- NEVER make random sounds, noises, or speak gibberish - only speak clear, professional English
- Only say "one moment" or "let me check" for functions that take time (verifyCustomer, getClaimStatus, searchKnowledgeBase)
- Do NOT say "hold on" after asking for identity confirmation - respond immediately to their yes/no`,
      },
    ],
    
    functions: [
      {
        name: "verifyCustomer",
        description: "Step 1 of authentication. Lookup customer by phone number. ONLY call this after customer has spoken the COMPLETE 10-digit phone number. Returns structured data with customer information (success, customerFound, customerName, etc). Do NOT proceed without calling confirmIdentity next.",
        parameters: {
          type: "object",
          properties: {
            phoneNumber: {
              type: "string",
              description: "The customer's COMPLETE 10-digit phone number exactly as spoken (any format accepted: 555-123-4567, 5551234567, (555) 123-4567, etc.). Must be complete before calling this function.",
            },
          },
          required: ["phoneNumber"],
        },
      },
      {
        name: "confirmIdentity",
        description: "Step 2 of authentication. Confirm the customer's identity after verifyCustomer. MUST be called with customer's yes/no response before allowing other functions. Returns structured data with authentication status (authenticated, action, availableServices).",
        parameters: {
          type: "object",
          properties: {
            confirmed: {
              type: "boolean",
              description: "True if customer confirmed their identity, false if they denied it",
            },
          },
          required: ["confirmed"],
        },
      },
      {
        name: "alternativeVerification",
        description: "Alternative verification method when phone verification fails or is denied. Can verify by email OR by full name + date of birth. Use email method when phone lookup fails. Use name_dob method when customer denies identity confirmation. Returns structured data with customer information for confirmation.",
        parameters: {
          type: "object",
          properties: {
            method: {
              type: "string",
              enum: ["email", "name_dob"],
              description: "Verification method: 'email' to lookup by email address, 'name_dob' to lookup by full name and date of birth",
            },
            email: {
              type: "string",
              description: "Customer's email address in proper format: lowercase, no spaces. IMPORTANT: Voice transcription may add spaces (e.g., 'john n stone@gmail.com'), you must remove ALL spaces before calling this function. Example: 'johnstone@gmail.com' not 'john n stone@gmail.com'",
            },
            firstName: {
              type: "string",
              description: "Customer's first name (required if method='name_dob')",
            },
            lastName: {
              type: "string",
              description: "Customer's last name (required if method='name_dob')",
            },
            dateOfBirth: {
              type: "string",
              description: "Customer's date of birth in YYYY-MM-DD format, e.g., '1990-05-15' (required if method='name_dob')",
            },
          },
          required: ["method"],
        },
      },
      {
        name: "sendVerificationCode",
        description: "Send a 6-character verification code to customer's email for additional security. Call this AFTER alternativeVerification succeeds with method='email' to add an extra layer of authentication. The customer will receive the code via email and must read it back to you.",
        parameters: {
          type: "object",
          properties: {
            email: {
              type: "string",
              description: "Customer's email address where the code will be sent",
            },
            customerId: {
              type: "number",
              description: "Customer ID from alternativeVerification result",
            },
            customerName: {
              type: "string",
              description: "Customer's full name from alternativeVerification result",
            },
          },
          required: ["email", "customerId", "customerName"],
        },
      },
      {
        name: "verifyEmailCode",
        description: "Verify the 6-character code that the customer reads from their email. Call this after sendVerificationCode when customer provides the code. Returns verified status and customer info if code is valid.",
        parameters: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "The 6-character verification code that the customer reads from their email. Accept with or without spaces (e.g., 'ABC 123' or 'ABC123').",
            },
          },
          required: ["code"],
        },
      },
      {
        name: "getClaimStatus",
        description: "Get status of customer's insurance claim(s). ONLY call this AFTER confirmIdentity succeeds. Customer ID is automatically retrieved from the authenticated session. Can handle three scenarios: (1) Single claim found - returns full details with most recent case note. (2) Multiple claims found - returns array of all claims with brief details so you can ask customer which one they're referring to. (3) No claims found - suggests escalation or starting new claim. Returns structured data with claim details (claimNumber, status, coverageType, incidentDate, amount, mostRecentNote, etc).",
        parameters: {
          type: "object",
          properties: {
            claimNumber: {
              type: "string",
              description: "Optional claim number. If customer mentions a specific claim number, pass it here to search for that exact claim. If omitted, searches ALL claims for the authenticated customer and returns summary if multiple exist.",
            },
          },
          required: [],
        },
      },
      {
        name: "searchKnowledgeBase",
        description: "Search the insurance policy knowledge base for answers to customer questions. ONLY call this AFTER confirmIdentity succeeds. Returns structured data with search results (success, content, articleTitle, relevanceScore, confidence).",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The customer's question or search query",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "endCall",
        description: "End the call or escalate to a human agent. Use this when customer is done or needs human assistance. Returns structured data with end call action (action, reason, transferToHuman).",
        parameters: {
          type: "object",
          properties: {
            reason: {
              type: "string",
              enum: ["completed", "escalate"],
              description: "Reason for ending: 'completed' if resolved, 'escalate' if needs human",
            },
            summary: {
              type: "string",
              description: "Brief summary of what was accomplished on the call",
            },
          },
        },
      },
    ],
  },
  
  voice: {
    provider: "playht",
    voiceId: "jennifer",
  },
  
  firstMessage: "Hello! Thank you for calling Observe Insurance. I'm your virtual assistant here to help with claims, policy questions, and general inquiries. To get started, could you please provide the phone number associated with your account?",
  
  endCallMessage: "Thank you for calling Observe Insurance. Have a great day!",
  
  transcriber: {
    provider: "deepgram",
    model: "nova-2",
    language: "en-US",
  },
} as const;
