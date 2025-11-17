import { getPayload } from "payload";
import payloadConfig from "@/payload.config";
import type { Claim } from "@/payload-types";
import { sessionStore } from "../session-store";

interface GetClaimStatusParams {
  claimNumber?: string;
  customerId?: number; // For ElevenLabs integration - customer ID passed directly
  callId?: string; // Vapi call ID for session management (legacy)
}

export async function getClaimStatus({ claimNumber, customerId, callId }: GetClaimStatusParams) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔧 FUNCTION: getClaimStatus`);
  console.log(`📥 Input:`, { claimNumber, customerId, callId });
  
  // Get customerId from parameter or session (parameter takes priority for ElevenLabs)
  let finalCustomerId = customerId;
  if (!finalCustomerId && callId) {
    finalCustomerId = await sessionStore.getCustomerId(callId);
  }
  
  if (!finalCustomerId) {
    console.log(`❌ No authenticated customer found`);
    console.log(`${"=".repeat(80)}\n`);
    return {
      success: false,
      error: "NOT_AUTHENTICATED",
      message: "Customer must be authenticated before checking claim status",
    };
  }
  
  console.log(`👤 Customer ID: ${finalCustomerId}`);

  const payload = await getPayload({ config: payloadConfig });

  const query: any = {
    collection: "claims",
    where: {
      customer: { equals: finalCustomerId },
    },
    // Select only needed fields for performance and clarity
    select: {
      claimNumber: true,
      status: true,
      coverageType: true,
      incidentDate: true,
      amount: true,
      description: true,
      caseNotes: true, // Get notes to find most recent
    },
  };

  if (claimNumber) {
    query.where = {
      and: [
        { customer: { equals: finalCustomerId } },
        { claimNumber: { equals: claimNumber } },
      ],
    };
  }

  const { docs } = (await payload.find(query)) as { docs: Claim[] };

  // CASE 1: No claims found
  if (docs.length === 0) {
    console.log(`❌ No claims found`);
    console.log(`${"=".repeat(80)}\n`);
    
    return {
      success: false,
      error: "NO_CLAIMS_FOUND",
      claimNumberSearched: claimNumber,
      customerId: finalCustomerId,
      totalClaims: 0,
      suggestion: "escalate",
      message: claimNumber 
        ? `No claim found with number ${claimNumber} for this customer`
        : "No claims found for this customer",
    };
  }

  // CASE 2: Multiple claims found (customer didn't provide claim number)
  if (docs.length > 1 && !claimNumber) {
    console.log(`📋 Multiple claims found: ${docs.length}`);
    
    // Format claims with MINIMAL info for conversational listing
    // Agent should just mention: coverage type, month/year, and status
    const claimsData = docs.map(claim => {
      return {
        claimNumber: claim.claimNumber, // Keep for reference but don't read aloud
        coverageType: claim.coverageType, // e.g., "Fire Damage", "Tornado Damage"
        description: claim.description, // Brief description for context
        incidentMonth: claim.incidentDate 
          ? new Date(claim.incidentDate).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long'
            })
          : null, // e.g., "October 2025"
      };
    });
    
    console.log(`✅ Claims summary prepared`);
    console.log(`${"=".repeat(80)}\n`);
    
    return {
      success: true,
      multipleClaims: true,
      totalClaims: docs.length,
      claims: claimsData,
      message: "Multiple claims found - customer needs to specify which one",
      instruction: "List each claim VERY BRIEFLY using natural language. Example: 'I see one for fire damage from October that's pending, and another for tornado damage from November under review.' Then ask which one they're calling about. DO NOT read claim numbers, amounts, or full descriptions.",
    };
  }

  // CASE 3: Single claim found (either by claim number or only one exists)
  const claim = docs[0];
  
  // Get most recent case note for additional context
  const mostRecentNote = claim.caseNotes && claim.caseNotes.length > 0
    ? claim.caseNotes[claim.caseNotes.length - 1]
    : null;
  
  console.log(`✅ Claim found:`, {
    claimNumber: claim.claimNumber,
    status: claim.status,
    coverageType: claim.coverageType,
    hasRecentNote: !!mostRecentNote,
  });
  console.log(`${"=".repeat(80)}\n`);

  return {
    success: true,
    claimFound: true,
    claimNumber: claim.claimNumber,
    status: claim.status,
    coverageType: claim.coverageType,
    incidentDate: claim.incidentDate,
    incidentDateFormatted: claim.incidentDate 
      ? new Date(claim.incidentDate).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })
      : null,
    amount: claim.amount,
    amountFormatted: claim.amount ? `$${claim.amount.toLocaleString()}` : null,
    description: claim.description,
    mostRecentNote: mostRecentNote ? {
      title: mostRecentNote.title,
      body: mostRecentNote.body,
      date: mostRecentNote.createdAt,
      dateFormatted: mostRecentNote.createdAt 
        ? new Date(mostRecentNote.createdAt).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })
        : null,
    } : null,
    message: "Claim details retrieved successfully",
    contextualHint: mostRecentNote 
      ? `Latest update (${mostRecentNote.title}): ${mostRecentNote.body}`
      : null,
  };
}
