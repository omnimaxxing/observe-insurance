import { NextRequest, NextResponse } from "next/server";
import { ASSISTANT_CONFIG } from "@/lib/vapi/assistant-config";
import { vapiFunctions } from "@/lib/vapi/functions";
import { sessionStore } from "@/lib/vapi/session-store";

// ============================================================================
// VAPI WEBHOOK EVENT TYPES
// ============================================================================

enum VapiWebhookEvent {
  ASSISTANT_REQUEST = "assistant-request",
  FUNCTION_CALL = "function-call",
  TOOL_CALLS = "tool-calls",
  STATUS_UPDATE = "status-update",
  END_OF_CALL_REPORT = "end-of-call-report",
  HANG = "hang",
  SPEECH_UPDATE = "speech-update",
  TRANSCRIPT = "transcript",
  CONVERSATION_UPDATE = "conversation-update",
}

// ============================================================================
// WEBHOOK HANDLERS
// ============================================================================

/**
 * Handle assistant-request event
 * Returns the assistant configuration dynamically with inline functions
 */
async function handleAssistantRequest(payload: any) {
  console.log("\n" + "=".repeat(80));
  console.log("📞 ASSISTANT REQUEST");
  console.log("=".repeat(80));
  
  const callId = payload.call?.id;
  const phoneNumber = payload.call?.customer?.number;
  
  console.log("Call ID:", callId);
  console.log("Customer Number:", phoneNumber);
  
  // Initialize session for this call
  if (callId && phoneNumber) {
    await sessionStore.getOrCreateSession(callId, phoneNumber);
  }
  
  // Return the assistant config with inline functions
  const response = { assistant: ASSISTANT_CONFIG };
  
  console.log("✅ Returning assistant config with", ASSISTANT_CONFIG.model.functions.length, "functions");
  console.log("=".repeat(80) + "\n");
  
  return response;
}

/**
 * Handle function-call event
 * Executes the requested function and returns the result
 */
async function handleFunctionCall(payload: any) {
  const { functionCall } = payload;
  
  if (!functionCall) {
    console.error("❌ No functionCall in payload");
    throw new Error("Invalid Request: No function call provided");
  }

  const { name, parameters } = functionCall;
  
  console.log("\n" + "=".repeat(80));
  console.log(`🔧 FUNCTION CALL: ${name}`);
  console.log("=".repeat(80));
  console.log("📥 Parameters:", JSON.stringify(parameters, null, 2));

  // Check if function exists in registry
  if (!(name in vapiFunctions)) {
    console.error(`❌ Function '${name}' not found in registry`);
    console.log("=".repeat(80) + "\n");
    return {
      result: `I encountered an error. The function '${name}' is not available.`,
    };
  }

  try {
    // Execute the function
    const fn = vapiFunctions[name as keyof typeof vapiFunctions];
    const result = await fn(parameters);
    
    console.log("📤 Function Result:", JSON.stringify(result, null, 2));
    console.log("=".repeat(80) + "\n");
    
    return result;
  } catch (error) {
    console.error(`❌ Error executing function '${name}':`, error);
    console.log("=".repeat(80) + "\n");
    
    return {
      result: "I encountered an error processing your request. Let me connect you with a representative.",
      error: true,
    };
  }
}

/**
 * Handle end-of-call-report event
 * Log call summary and transcript, end session
 */
async function handleEndOfCallReport(payload: any) {
  const callId = payload.call?.id;
  
  console.log("\n" + "=".repeat(80));
  console.log("📊 END OF CALL REPORT");
  console.log("=".repeat(80));
  console.log("Call ID:", callId);
  console.log("Duration:", payload.endedAt ? `${Math.round((new Date(payload.endedAt).getTime() - new Date(payload.call?.createdAt).getTime()) / 1000)}s` : "N/A");
  console.log("Summary:", payload.summary || "N/A");
  
  if (payload.transcript) {
    console.log("\n📝 Transcript:");
    // Format transcript for readability - parse and display conversation
    const lines = payload.transcript.split('\n').filter((line: string) => line.trim());
    lines.forEach((line: string) => console.log(line));
  }
  
  // End the session for this call
  if (callId) {
    await sessionStore.endSession(callId);
  }
  
  console.log("=".repeat(80) + "\n");
  
  // Could store this in database here
  return { received: true };
}

/**
 * Handle status-update event
 * Log call status changes
 */
function handleStatusUpdate(payload: any) {
  console.log(`📡 Status Update: Call ${payload.call?.id} - ${payload.status}`);
  return { received: true };
}

// ============================================================================
// MAIN WEBHOOK HANDLER
// ============================================================================

/**
 * Vapi Webhook POST Handler
 * 
 * Handles all Vapi webhook events:
 * - assistant-request: Returns assistant config with inline functions
 * - function-call: Executes functions and returns results
 * - end-of-call-report: Logs call summary
 * - status-update: Logs status changes
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message } = body;

    // Skip verbose logging for frequent real-time events
    const silentEvents = [VapiWebhookEvent.SPEECH_UPDATE, VapiWebhookEvent.CONVERSATION_UPDATE];
    const isSilent = silentEvents.includes(message?.type);
    
    if (!isSilent) {
      console.log(`\n${"=".repeat(80)}`);
      console.log(`📥 VAPI WEBHOOK: ${message?.type || "unknown"}`);
      console.log(`${"=".repeat(80)}\n`);
    }

    // Handle different event types
    switch (message?.type) {
      case VapiWebhookEvent.ASSISTANT_REQUEST:
        const assistantResponse = await handleAssistantRequest(message);
        return NextResponse.json(assistantResponse);

      case VapiWebhookEvent.FUNCTION_CALL:
        const functionResponse = await handleFunctionCall(message);
        return NextResponse.json(functionResponse);

      case VapiWebhookEvent.TOOL_CALLS:
        // Handle tool-calls event (batch of function calls)
        const toolCallList = message.toolCallList || message.toolCalls || [];
        const results = [];
        const callId = message.call?.id;
        
        for (const toolCall of toolCallList) {
          // Structure is: { id, type, function: { name, arguments } }
          const id = toolCall.id;
          const name = toolCall.function?.name;
          const args = toolCall.function?.arguments;
          
          console.log(`\n🔧 Tool Call: ${name}`);
          console.log(`📥 Args:`, JSON.stringify(args, null, 2));
          
          try {
            if (!(name in vapiFunctions)) {
              results.push({
                toolCallId: id,
                result: `Function '${name}' not found`,
              });
              continue;
            }
            
            const fn = vapiFunctions[name as keyof typeof vapiFunctions];
            
            // Inject callId into args for session management
            const argsWithCallId = { ...args, callId };
            const result = await fn(argsWithCallId);
            
            console.log(`📤 Result:`, JSON.stringify(result, null, 2));
            
            // Check if this is a transfer request
            if ((result as any).action === "TRANSFER_CALL" && (result as any).transferDestination) {
              const transferDest = (result as any).transferDestination;
              const transferMsg = (result as any).message || "Transferring your call now. Please hold.";
              
              console.log(`📞 TRANSFER REQUESTED: Forwarding call to ${transferDest}`);
              
              // Return transfer instruction to Vapi
              results.push({
                toolCallId: id,
                result: result,
              });
              
              // Immediately return with transfer instruction
              return NextResponse.json({
                results,
                transferCall: {
                  destination: transferDest,
                  message: transferMsg,
                },
              });
            }
            
            // Return the full structured data object for AI to interpret
            // The AI will read the fields (success, customerName, status, etc) and respond naturally
            results.push({
              toolCallId: id,
              result: result, // Return full structured data, not just a string
            });
          } catch (error) {
            console.error(`❌ Error in ${name}:`, error);
            results.push({
              toolCallId: id,
              result: "I encountered an error. Let me connect you with a representative.",
            });
          }
        }
        
        return NextResponse.json({ results });

      case VapiWebhookEvent.END_OF_CALL_REPORT:
        const reportResponse = await handleEndOfCallReport(message);
        return NextResponse.json(reportResponse);

      case VapiWebhookEvent.STATUS_UPDATE:
        const statusResponse = handleStatusUpdate(message);
        return NextResponse.json(statusResponse);

      default:
        // Silently acknowledge frequent real-time events
        if (!isSilent) {
          console.log(`ℹ️ Unhandled event type: ${message?.type}`);
        }
        return NextResponse.json({ received: true });
    }
  } catch (error) {
    console.error("❌ Webhook error:", error);
    return NextResponse.json(
      {
        error: "Webhook processing failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
