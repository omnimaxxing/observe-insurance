interface EndCallParams {
  reason?: string;
  summary?: string;
  transferToAgent?: boolean; // If true, transfer to human agent
}

// Tier 2 escalation phone number
const ESCALATION_PHONE_NUMBER = "+13142304536"; // 314-230-4536

export async function endCall({ 
  reason = "completed", 
  summary,
  transferToAgent = false,
}: EndCallParams) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔧 FUNCTION: endCall`);
  console.log(`📥 Input:`, { reason, summary, transferToAgent });

  console.log(`📝 Call ending - Reason: ${reason}`);
  if (summary) {
    console.log(`📋 Summary: ${summary}`);
  }

  // Handle transfer to human agent
  if (transferToAgent || reason === "escalate") {
    console.log(`📞 Transferring call to tier 2 support: ${ESCALATION_PHONE_NUMBER}`);
    console.log(`${"=".repeat(80)}\n`);

    return {
      success: true,
      action: "TRANSFER_CALL",
      reason,
      summary: summary || null,
      transferToHuman: true,
      transferDestination: ESCALATION_PHONE_NUMBER,
      message: "Let me transfer you to one of our representatives who can help you with this. Please hold while I connect you.",
    };
  }

  // Normal call end (no transfer)
  console.log(`✅ Call completed`);
  console.log(`${"=".repeat(80)}\n`);

  return {
    success: true,
    action: "END_CALL",
    reason,
    summary: summary || null,
    transferToHuman: false,
    message: "Thank you for calling Observe Insurance. Have a great day!",
  };
}
