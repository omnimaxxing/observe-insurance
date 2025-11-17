/**
 * Vapi Assistant Setup Script
 * Run this to create or update your Vapi assistant with tools
 * 
 * Usage:
 * pnpm vapi:setup
 */

import { VapiClient } from "@vapi-ai/server-sdk";
import { config } from "dotenv";

// Load environment variables from .env.local
config({ path: ".env.local" });

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "http://localhost:3000";
const EXISTING_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID;

if (!VAPI_API_KEY) {
  console.error("❌ VAPI_API_KEY is not set in environment variables");
  process.exit(1);
}

const client = new VapiClient({ token: VAPI_API_KEY });

// Define assistant configuration (reusable for create/update)
const ASSISTANT_CONFIG: any = {
  name: "Observe Insurance Customer Service Agent",
  
  firstMessage: "Hello! Thank you for calling Observe Insurance. I'm your virtual assistant here to help with claims, policy questions, and general inquiries. To get started, could you please provide the phone number associated with your account?",
  
  model: {
    provider: "openai",
    model: "gpt-4o-mini",
    temperature: 0.7,
    messages: [{
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
- Call verifyCustomer tool with the phone number
- The tool will return a customer name and message asking for confirmation

Step 2: Confirm Identity
- Read the EXACT message from verifyCustomer: "Am I speaking with [Full Name]?"
- Wait for customer to confirm YES or NO
- Call confirmIdentity tool with { confirmed: true/false }
- If confirmed: Authentication complete, proceed to help
- If not confirmed: Escalate to human agent

Step 3: Provide Service (ONLY AFTER confirmIdentity succeeds)
- For claim inquiries: use getClaimStatus tool
- For policy questions: use searchKnowledgeBase tool
- For escalation: use endCall with reason "escalate"

**NEVER call getClaimStatus or searchKnowledgeBase before confirmIdentity succeeds!**

Important Guidelines:
- Be concise and natural in your responses
- Don't make up information - use the tools provided
- If uncertain, escalate to a human agent
- Always confirm you have the correct information before ending calls
- Speak in a warm, empathetic manner especially when discussing claims`
    }]
  },

  voice: {
    provider: "playht",
    voiceId: "jennifer",
  },

  transcriber: {
    provider: "deepgram",
    model: "nova-2",
    language: "en-US",
  },

  server: {
    url: `${PUBLIC_BASE_URL}/api/vapi/webhook`,
  },

  endCallMessage: "Thank you for calling Observe Insurance. Have a great day!",
};

async function setupAssistant() {
  console.log("🚀 Setting up Vapi Assistant for Observe Insurance...\n");

  try {
    let assistant: any;
    let isUpdate = false;

    // Check if assistant already exists
    if (EXISTING_ASSISTANT_ID) {
      console.log(`📝 Found existing assistant ID: ${EXISTING_ASSISTANT_ID}`);
      console.log("   Updating existing assistant...\n");
      
      try {
        assistant = await client.assistants.update(
          EXISTING_ASSISTANT_ID,
          ASSISTANT_CONFIG
        );
        isUpdate = true;
        console.log("✅ Assistant updated successfully!");
      } catch (error) {
        console.log("⚠️  Could not update existing assistant, creating new one...");
        assistant = await client.assistants.create(ASSISTANT_CONFIG);
        console.log("✅ Assistant created successfully!");
      }
    } else {
      console.log("📝 No existing assistant found, creating new one...\n");
      assistant = await client.assistants.create(ASSISTANT_CONFIG);
      console.log("✅ Assistant created successfully!");
    }

    console.log(`   ID: ${assistant.id}`);
    console.log(`   Name: ${assistant.name}\n`);

    // Now create tools
    console.log("🔧 Creating custom tools...\n");

    const verifyTool = await client.tools.create({
      type: "function",
      async: false,
      function: {
        name: "verifyCustomer",
        description: "Step 1 of authentication. Lookup customer by phone number. Returns customer name that MUST be read back for confirmation. Do NOT proceed without calling confirmIdentity next.",
        parameters: {
          type: "object",
          properties: {
            phoneNumber: {
              type: "string",
              description: "The customer's phone number exactly as spoken (any format accepted: 555-123-4567, 5551234567, (555) 123-4567, etc.)",
            },
          },
          required: ["phoneNumber"],
        },
      },
      server: {
        url: `${PUBLIC_BASE_URL}/api/vapi/webhook`,
      },
    });
    console.log(`   ✅ Created tool: verifyCustomer (${verifyTool.id})`);

    const confirmTool = await client.tools.create({
      type: "function",
      async: false,
      function: {
        name: "confirmIdentity",
        description: "Step 2 of authentication. Confirm customer identity after reading their name from verifyCustomer. MUST be called before any other service tools.",
        parameters: {
          type: "object",
          properties: {
            confirmed: {
              type: "boolean",
              description: "True if customer confirmed their identity, false if they denied",
            },
            callId: {
              type: "string",
              description: "The call ID for state tracking",
            },
          },
          required: ["confirmed", "callId"],
        },
      },
      server: {
        url: `${PUBLIC_BASE_URL}/api/vapi/webhook`,
      },
    });
    console.log(`   ✅ Created tool: confirmIdentity (${confirmTool.id})`);

    const claimStatusTool = await client.tools.create({
      type: "function",
      async: false,
      function: {
        name: "getClaimStatus",
        description: "Get claim status. REQUIRES confirmIdentity to have been called successfully first. Will be rejected if customer not authenticated.",
        parameters: {
          type: "object",
          properties: {
            customerId: {
              type: "string",
              description: "The verified customer's ID from the verifyCustomer response",
            },
            claimNumber: {
              type: "string",
              description: "Optional specific claim number. If not provided, returns most recent claim.",
            },
          },
          required: ["customerId"],
        },
      },
      server: {
        url: `${PUBLIC_BASE_URL}/api/vapi/webhook`,
      },
    });
    console.log(`   ✅ Created tool: getClaimStatus (${claimStatusTool.id})`);

    const knowledgeBaseTool = await client.tools.create({
      type: "function",
      async: false,
      function: {
        name: "searchKnowledgeBase",
        description: "Search knowledge base for policy/FAQ answers. REQUIRES confirmIdentity to have been called successfully first. Will be rejected if customer not authenticated.",
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
      server: {
        url: `${PUBLIC_BASE_URL}/api/vapi/webhook`,
      },
    });
    console.log(`   ✅ Created tool: searchKnowledgeBase (${knowledgeBaseTool.id})`);

    const endCallTool = await client.tools.create({
      type: "function",
      async: false,
      function: {
        name: "endCall",
        description: "End the call or escalate to a human agent. Use when the customer is satisfied or when you need to transfer them.",
        parameters: {
          type: "object",
          properties: {
            reason: {
              type: "string",
              enum: ["completed", "escalate"],
              description: "Reason for ending: 'completed' if customer is satisfied, 'escalate' to transfer to human agent",
            },
            summary: {
              type: "string",
              description: "Brief summary of the call",
            },
          },
          required: ["reason"],
        },
      },
      server: {
        url: `${PUBLIC_BASE_URL}/api/vapi/webhook`,
      },
    });
    console.log(`   ✅ Created tool: endCall (${endCallTool.id})\n`);

    // Note: Tools are linked via the assistant's model messages and server URL
    // The assistant will automatically call tools defined at the server endpoint
    console.log("🔗 Tools configured via webhook endpoint\n");
    
    const toolsList = [
      verifyTool.id,
      confirmTool.id,
      claimStatusTool.id,
      knowledgeBaseTool.id,
      endCallTool.id,
    ];
    const updatedAssistant = assistant;

    console.log("✅ Tools configured successfully!\n");
    console.log("📋 Setup Summary:");
    console.log("─".repeat(50));
    console.log(`Mode: ${isUpdate ? "UPDATE" : "CREATE"}`);
    console.log(`Assistant ID: ${updatedAssistant.id}`);
    console.log(`Assistant Name: ${updatedAssistant.name}`);
    console.log(`Webhook URL: ${PUBLIC_BASE_URL}/api/vapi/webhook`);
    console.log(`Tools: ${toolsList.length} configured`);
    console.log("─".repeat(50));
    
    if (!isUpdate) {
      console.log("\n📝 IMPORTANT - First Time Setup:");
      console.log("1. Add this to your .env.local file:");
      console.log(`   VAPI_ASSISTANT_ID=${updatedAssistant.id}`);
      console.log("\n2. Create a phone number in Vapi dashboard:");
      console.log("   - Go to https://dashboard.vapi.ai/phone-numbers");
      console.log("   - Click 'Create Phone Number'");
      console.log("   - Select 'Free Vapi Number' and choose area code");
      console.log(`   - Attach assistant: ${updatedAssistant.id}`);
      console.log("\n3. Test by calling the phone number!");
    } else {
      console.log("\n✅ Configuration synced to Vapi!");
      console.log("   Your assistant has been updated with the latest config.");
      console.log("   No further action needed - test by calling your phone number.");
    }
    
    console.log("\n🎉 Setup complete!\n");
    console.log("💡 Tip: Run this script anytime to update your assistant config.\n");

    return updatedAssistant;
  } catch (error) {
    console.error("❌ Error setting up assistant:", error);
    if (error instanceof Error) {
      console.error("   Message:", error.message);
    }
    process.exit(1);
  }
}

// Run if called directly (only in non-import context)
if (import.meta.url === `file://${process.argv[1]}`) {
  setupAssistant();
}

export { setupAssistant };
