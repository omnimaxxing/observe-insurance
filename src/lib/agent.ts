import { generateObject } from "ai";
import { z } from "zod";
import { groq } from "@ai-sdk/groq";

//flows to handle here
// A) Happy Path
/*
    1) Greeting - Pass
    2) Identity Verification - Pass
    3) Insurance Agent 
        a)  Answer Status of Claim
        b)  Answer FaQs from Customer by searching knowledge base
        c)  Escalate to Tier 2 Agent if unable to answer or End Call
    4) End Call
*/

// B) Secondary Verification Path
/*
    1) Greeting - Pass
    2) Identity Verification - Fail
        
    3) Secondary Verification - Pass
    4) Insurance Agent - Pass
        a)  Answer Status of Claim
        b)  Answer FaQs from Customer by searching knowledge base
        c)  Escalate to Tier 2 Agent if unable to answer or End Call
    5) End Call
*/

// C) Failed Verification Path
/*
    1) Greeting - Pass
    2) Identity Verification - Fail
        - Customer does denies the name found under their provided phone number.
    3) Secondary Verification - Fail
        a)  Ask for a secondary form of identification.
        b)  If the customer provides a secondary form of identification, verify it.
        c)  Send code to customer's email.
        d)  Email not received
    4)  Escalate to Tier 2 Agent or End Call
*/

export async function generateGreeting(userMessage?: string) {
    const greeting = await generateObject({
        model: groq("meta-llama/llama-4-maverick-17b-128e-instruct"),
        system: "You are a customer service representative for Observe Insurance. We specialize in real-estate and property risk insurance. Your job is to verify the customer's identity and then answer any questions about their claim(s) or FAQs. You will start by greeting the customer then ask them for the phone number associated with their account.",
        schema: z.object({
            message: z.string().describe("The audio response to the user after greeting them and asking for their phone number"),
            providedPhoneNumber: z.string().optional().describe("The phone number provided by the user, if any"),
        }),
        messages: [
            {
                role: 'assistant',
                content: "Hello, thank you for calling Observe Insurance. I am your service representative. Please provide the phone number associated with your account."
            },
            ...(userMessage ? [{
                role: 'user' as const,
                content: userMessage
            }] : [])
        ],
    });

    console.log('Greeting generated:', greeting.object);
    return greeting.object;
}

export async function verifyIdentity(phoneNumber: string, customerResponse?: string) {
    const identityVerification = await generateObject({
        model: groq("meta-llama/llama-4-maverick-17b-128e-instruct"),
        system: "You are a customer service representative for Observe Insurance. Your job is to verify the customer's identity. Based on the phone number the customer has given you, look up their account and greet them with their first name and last name to authenticate them.",
        schema: z.object({
            customerObject: z.object({
                customerId: z.string().describe("The customer's ID"),
                firstName: z.string().describe("The customer's first name"),
                lastName: z.string().describe("The customer's last name"),
                phoneNumber: z.string().describe("The customer's account phone number"),
            }),
            message: z.string().describe("The response to the customer with their name for verification"),
            isClientAuthenticated: z.boolean().describe("The authentication status of the customer"),
        }),
        messages: [{
            role: 'user', 
            content: `Customer provided phone number: ${phoneNumber}. ${customerResponse ? `Customer response: ${customerResponse}` : ''}`
        }]
    });

    console.log('Identity verification result:', identityVerification.object);
    return identityVerification.object;
}

export async function handleSecondaryVerification(customerData: any, userResponse: string) {
    const secondaryVerification = await generateObject({
        model: groq("meta-llama/llama-4-maverick-17b-128e-instruct"),
        system: "You are a customer service representative for Observe Insurance. Your job is to answer any questions about their claim(s) or FAQs. You have been provided with the customer's information and authentication status. If the customer is authenticated, you will greet them with their first name and last name. You will then answer any questions they have about their claim(s) or FAQs. If the customer asks a question you cannot answer, you will escalate the call to a tier 2 agent.",
        schema: z.object({
            message: z.string().describe("The audio response to the user"),
            needsEscalation: z.boolean().describe("Whether this call needs to be escalated to tier 2"),
            callComplete: z.boolean().describe("Whether the call should be ended"),
        }),
        messages: [{
            role: 'user', 
            content: `Customer data: ${JSON.stringify(customerData)}. Customer message: ${userResponse}`
        }]
    });

    console.log('Secondary verification result:', secondaryVerification.object);
    return secondaryVerification.object;
}

export async function handleContinuousConversation(
    userMessage: string, 
    conversationHistory: Array<{role: 'user' | 'assistant', content: string}>,
    currentState: string,
    customerData?: any
) {
    // Build the conversation context
    const messages = [
        {
            role: 'system' as const,
            content: `You are a customer service representative for Observe Insurance. We specialize in real-estate and property risk insurance. 

Current conversation state: ${currentState}

Your job is to:
1. If greeting/waiting for phone: Ask for and collect the customer's phone number
2. If verifying identity: Look up their account and verify their identity with their name
3. If handling inquiries: Answer questions about claims, policies, and FAQs
4. Escalate to tier 2 if needed

Always respond naturally and helpfully. Extract phone numbers when provided and determine next steps.`
        },
        ...conversationHistory,
        {
            role: 'user' as const,
            content: userMessage
        }
    ];

    const response = await generateObject({
        model: groq("meta-llama/llama-4-maverick-17b-128e-instruct"),
        schema: z.object({
            message: z.string().describe("The audio response to the customer"),
            phoneNumber: z.string().optional().nullable().describe("Phone number if extracted from customer message"),
            customerObject: z.object({
                customerId: z.string(),
                firstName: z.string(),
                lastName: z.string(),
                phoneNumber: z.string(),
            }).optional().nullable().describe("Customer info if phone number was provided and found"),
            nextState: z.string().describe("Next conversation state: greeting, wait_for_phone, verify_identity, handle_inquiry, escalate, end_call"),
            needsEscalation: z.boolean().describe("Whether to escalate to tier 2"),
            callComplete: z.boolean().describe("Whether the call should end"),
        }),
        messages
    });

    console.log('Continuous conversation result:', response.object);
    return response.object;
}


