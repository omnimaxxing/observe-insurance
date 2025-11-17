import { sessionStore } from "../session-store";

interface ConfirmIdentityParams {
  confirmed: boolean;
  callId?: string; // Vapi call ID for session management
}

export async function confirmIdentity({ confirmed, callId }: ConfirmIdentityParams) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔧 FUNCTION: confirmIdentity`);
  console.log(`📥 Input: confirmed=${confirmed}`);

  if (confirmed) {
    console.log(`✅ Identity confirmed - customer authenticated`);
    
    // Mark session as fully authenticated
    if (callId) {
      sessionStore.setAuthenticated(callId, true);
    }
    
    console.log(`${"=".repeat(80)}\n`);
    
    return {
      success: true,
      authenticated: true,
      action: "PROCEED_TO_SERVICE",
      availableServices: ["checkClaimStatus", "searchKnowledgeBase", "generalInquiry"],
      message: "Identity confirmed - customer authenticated and ready for service",
    };
  } else {
    console.log(`❌ Identity NOT confirmed - escalating`);
    
    // Mark authentication as failed
    if (callId) {
      sessionStore.setAuthenticated(callId, false);
    }
    
    console.log(`${"=".repeat(80)}\n`);
    
    return {
      success: false,
      authenticated: false,
      action: "ESCALATE_TO_HUMAN",
      reason: "IDENTITY_MISMATCH",
      escalate: true,
      message: "Identity not confirmed - customer needs human agent for additional verification",
    };
  }
}
