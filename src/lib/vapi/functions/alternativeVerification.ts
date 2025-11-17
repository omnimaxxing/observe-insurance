import { getPayload } from "payload";
import payloadConfig from "@/payload.config";
import type { Customer } from "@/payload-types";
import { sessionStore } from "../session-store";

/**
 * Alternative Verification Methods
 * Used when primary phone verification fails or is denied
 */

interface AlternativeVerificationParams {
  method: "email" | "name_dob";
  email?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string; // ISO format: YYYY-MM-DD
  callId?: string;
}

/**
 * Normalize email for comparison
 * Removes ALL spaces (voice transcription often adds spaces like "jacob n palmer at")
 */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase().replace(/\s+/g, '');
}

/**
 * Normalize name for fuzzy matching
 * Removes extra spaces, converts to lowercase
 */
function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Calculate simple string similarity (0-1)
 * Uses Levenshtein distance for fuzzy matching
 */
function similarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Levenshtein distance algorithm
 */
function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) {
      costs[s2.length] = lastValue;
    }
  }
  return costs[s2.length];
}

/**
 * Verify customer by email
 */
async function verifyByEmail(email: string, callId?: string) {
  console.log(`🔍 Attempting email verification: ${email}`);
  
  const normalizedEmail = normalizeEmail(email);
  console.log(`📧 Normalized email: ${normalizedEmail}`);
  
  const payload = await getPayload({ config: payloadConfig });
  
  // Search with case-insensitive matching
  // Note: Database stores emails in lowercase via normalization hook
  const { docs } = (await payload.find({
    collection: "customers",
    limit: 1,
    where: {
      email: { equals: normalizedEmail },
    },
  })) as { docs: Customer[] };
  
  console.log(`📊 Query result: Found ${docs.length} customer(s)`);
  if (docs.length > 0) {
    console.log(`   Email in DB: ${docs[0].email}`);
  }
  
  if (docs.length === 0) {
    console.log(`❌ No customer found with email: ${email}`);
    return {
      success: false,
      error: "EMAIL_NOT_FOUND",
      emailProvided: email,
      message: "No customer account found with this email address",
    };
  }
  
  const customer = docs[0]; // Take best match
  const fullName = customer.fullName 
    || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() 
    || 'the account holder';
  
  console.log(`✅ Customer found via email:`, {
    id: customer.id,
    fullName,
    email: customer.email,
  });
  
  // Store in session
  if (callId) {
    await sessionStore.setCustomerVerified(callId, {
      id: customer.id,
      name: fullName,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phoneNumber: customer.phone || '',
    });
  }
  
  return {
    success: true,
    customerFound: true,
    customerId: customer.id,
    customerName: fullName,
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    phone: customer.phone,
    verificationMethod: "EMAIL",
    nextStep: "CONFIRM_IDENTITY",
    message: "Customer account located via email - identity confirmation required",
  };
}

/**
 * Verify customer by full name + date of birth
 */
async function verifyByNameAndDob(
  firstName: string,
  lastName: string,
  dateOfBirth: string,
  callId?: string
) {
  console.log(`🔍 Attempting name+DOB verification: ${firstName} ${lastName}, DOB: ${dateOfBirth}`);
  
  const normalizedFirstName = normalizeName(firstName);
  const normalizedLastName = normalizeName(lastName);
  const payload = await getPayload({ config: payloadConfig });
  
  // Get all customers with DOB set
  // We'll filter by date in memory to handle various date formats
  const allCustomers = (await payload.find({
    collection: "customers",
    limit: 1000, // Adjust based on your customer base size
    where: {
      dob: {
        exists: true,
      },
    },
  })) as { docs: Customer[] };
  
  console.log(`📊 Found ${allCustomers.docs.length} total customers with DOB set`);
  
  // Filter by matching DOB (compare just the date part, ignore time)
  const inputDate = dateOfBirth; // "2000-12-05"
  const customersWithMatchingDob = allCustomers.docs.filter(customer => {
    if (!customer.dob) return false;
    
    // Extract date part from stored DOB (could be string or Date object)
    const storedDob = typeof customer.dob === 'string' 
      ? customer.dob.split('T')[0] // "2000-12-05T00:00:00Z" -> "2000-12-05"
      : new Date(customer.dob).toISOString().split('T')[0];
    
    const match = storedDob === inputDate;
    if (match) {
      console.log(`   ✓ DOB match: ${customer.fullName || `${customer.firstName} ${customer.lastName}`} - ${storedDob}`);
    }
    return match;
  });
  
  console.log(`📊 Found ${customersWithMatchingDob.length} customers with matching DOB: ${dateOfBirth}`);
  
  if (customersWithMatchingDob.length === 0) {
    console.log(`❌ No customers found with DOB: ${dateOfBirth}`);
    return {
      success: false,
      error: "DOB_NOT_FOUND",
      dateOfBirth,
      message: "No customer account found with this date of birth",
    };
  }
  
  // Fuzzy match on names with HIGH threshold for security
  // Only allowing minor transcription errors (e.g., "Jon" vs "John")
  const fuzzyMatches = customersWithMatchingDob
    .map(customer => {
      const customerFirstName = normalizeName(customer.firstName || '');
      const customerLastName = normalizeName(customer.lastName || '');
      
      const firstNameSimilarity = similarity(customerFirstName, normalizedFirstName);
      const lastNameSimilarity = similarity(customerLastName, normalizedLastName);
      
      // Average similarity score
      const avgSimilarity = (firstNameSimilarity + lastNameSimilarity) / 2;
      
      return {
        customer,
        firstNameSimilarity,
        lastNameSimilarity,
        avgSimilarity,
      };
    })
    .filter(match => match.avgSimilarity >= 0.90) // 90% similarity - tight security threshold
    .sort((a, b) => b.avgSimilarity - a.avgSimilarity);
  
  if (fuzzyMatches.length === 0) {
    console.log(`❌ No fuzzy name matches found for: ${firstName} ${lastName}`);
    return {
      success: false,
      error: "NAME_NOT_FOUND",
      firstNameProvided: firstName,
      lastNameProvided: lastName,
      dateOfBirth,
      message: "No customer account found with this name and date of birth combination",
    };
  }
  
  const bestMatch = fuzzyMatches[0];
  const customer = bestMatch.customer;
  const fullName = customer.fullName 
    || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() 
    || 'the account holder';
  
  console.log(`✅ Customer found via name+DOB (${(bestMatch.avgSimilarity * 100).toFixed(1)}% match):`, {
    id: customer.id,
    fullName,
    providedName: `${firstName} ${lastName}`,
    actualName: fullName,
    similarity: bestMatch.avgSimilarity,
  });
  
  // Store in session
  if (callId) {
    await sessionStore.setCustomerVerified(callId, {
      id: customer.id,
      name: fullName,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phoneNumber: customer.phone || '',
    });
  }
  
  return {
    success: true,
    customerFound: true,
    customerId: customer.id,
    customerName: fullName,
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    phone: customer.phone,
    verificationMethod: "NAME_DOB",
    matchConfidence: bestMatch.avgSimilarity,
    nextStep: "CONFIRM_IDENTITY",
    message: `Customer account located via name and date of birth - identity confirmation required`,
  };
}

/**
 * Main alternative verification function
 */
export async function alternativeVerification(params: AlternativeVerificationParams) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔧 FUNCTION: alternativeVerification`);
  console.log(`📥 Method: ${params.method}`);
  console.log(`📥 Params:`, JSON.stringify(params, null, 2));
  
  const { method, email, firstName, lastName, dateOfBirth, callId } = params;
  
  try {
    let result;
    
    if (method === "email") {
      if (!email) {
        console.log(`❌ Email method selected but no email provided`);
        console.log(`${"=".repeat(80)}\n`);
        return {
          success: false,
          error: "MISSING_EMAIL",
          message: "Email address is required for email verification",
        };
      }
      
      result = await verifyByEmail(email, callId);
    } else if (method === "name_dob") {
      if (!firstName || !lastName || !dateOfBirth) {
        console.log(`❌ Name+DOB method selected but missing required fields`);
        console.log(`${"=".repeat(80)}\n`);
        return {
          success: false,
          error: "MISSING_NAME_DOB",
          message: "First name, last name, and date of birth are all required for this verification method",
        };
      }
      
      result = await verifyByNameAndDob(firstName, lastName, dateOfBirth, callId);
    } else {
      console.log(`❌ Invalid verification method: ${method}`);
      console.log(`${"=".repeat(80)}\n`);
      return {
        success: false,
        error: "INVALID_METHOD",
        message: "Invalid verification method specified",
      };
    }
    
    console.log(`📤 Result:`, JSON.stringify(result, null, 2));
    console.log(`${"=".repeat(80)}\n`);
    
    return result;
  } catch (error) {
    console.error(`❌ Error in alternativeVerification:`, error);
    console.log(`${"=".repeat(80)}\n`);
    
    return {
      success: false,
      error: "SYSTEM_ERROR",
      message: "An error occurred during verification",
    };
  }
}
