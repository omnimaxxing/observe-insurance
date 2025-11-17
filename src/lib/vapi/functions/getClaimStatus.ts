import { getPayload } from "payload";
import payloadConfig from "@/payload.config";
import type { Claim } from "@/payload-types";
import { sessionStore } from "../session-store";

interface GetClaimStatusParams {
  claimNumber?: string;
  callId?: string; // Vapi call ID for session management
}

export async function getClaimStatus({ claimNumber, callId }: GetClaimStatusParams) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔧 FUNCTION: getClaimStatus`);
  console.log(`📥 Input:`, { claimNumber, callId });
  
  // Get customerId from session instead of requiring it as parameter
  const customerId = callId ? await sessionStore.getCustomerId(callId) : undefined;
  
  if (!customerId) {
    console.log(`❌ No authenticated customer in session`);
    console.log(`${"=".repeat(80)}\n`);
    return {
      success: false,
      error: "NOT_AUTHENTICATED",
      message: "Customer must be authenticated before checking claim status",
    };
  }
  
  console.log(`👤 Customer ID from session: ${customerId}`);

  const payload = await getPayload({ config: payloadConfig });

  const query: any = {
    collection: "claims",
    where: {
      customer: { equals: customerId },
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
        { customer: { equals: customerId } },
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
      customerId,
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
    
    // Format claims for AI to describe
    const claimsData = docs.map(claim => {
      // Get most recent case note
      const mostRecentNote = claim.caseNotes && claim.caseNotes.length > 0
        ? claim.caseNotes[claim.caseNotes.length - 1]
        : null;
      
      return {
        claimNumber: claim.claimNumber,
        status: claim.status,
        description: claim.description,
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
        mostRecentNote: mostRecentNote ? {
          title: mostRecentNote.title,
          body: mostRecentNote.body,
          date: mostRecentNote.createdAt,
        } : null,
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
      instruction: "Describe each claim briefly (status, description/coverage type) and ask which one they're asking about",
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
