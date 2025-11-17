import { getPayload } from "payload";
import payloadConfig from "@/payload.config";
import type { Customer } from "@/payload-types";
import { sessionStore } from "../session-store";

// Phone number normalization (matches Customers collection logic)
function normalizePhoneNumber(raw: string): string | null {
  if (!raw || typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Extract only digits
  const digits = trimmed.replace(/\D+/g, '');
  if (!digits) return null;

  // If original had +, preserve it
  if (trimmed.startsWith('+')) {
    return `+${digits}`;
  }

  // Handle 11-digit US numbers (1-555-123-4567)
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // Handle 10-digit US numbers (555-123-4567)
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // Default: add + to whatever digits we have
  return `+${digits}`;
}

interface VerifyCustomerParams {
  phoneNumber: string;
  callId?: string; // Vapi call ID for session management
}

export async function verifyCustomer({ phoneNumber, callId }: VerifyCustomerParams) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔧 FUNCTION: verifyCustomer`);
  console.log(`📥 Input: ${phoneNumber}`);

  // Normalize phone number
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  
  if (!normalizedPhone) {
    console.log(`❌ Invalid phone format`);
    console.log(`${"=".repeat(80)}\n`);
    return {
      success: false,
      error: "INVALID_FORMAT",
      phoneNumberProvided: phoneNumber,
      message: "Could not parse phone number format",
    };
  }

  // Validate phone number has at least 10 digits
  const digits = normalizedPhone.replace(/\D/g, "");
  if (digits.length < 10) {
    console.log(`❌ Incomplete phone number: only ${digits.length} digits`);
    console.log(`${"=".repeat(80)}\n`);
    return {
      success: false,
      error: "INCOMPLETE_NUMBER",
      phoneNumberProvided: phoneNumber,
      digitsReceived: digits.length,
      digitsRequired: 10,
      message: "Phone number is incomplete",
    };
  }

  console.log(`📞 Normalized: ${normalizedPhone}`);

  const payload = await getPayload({ config: payloadConfig });

  // Search for customer by NORMALIZED phone number
  const { docs } = (await payload.find({
    collection: "customers",
    limit: 1,
    where: {
      phone: { equals: normalizedPhone },
    },
  })) as { docs: Customer[] };

  if (docs.length === 0) {
    console.log(`❌ No customer found`);
    console.log(`${"=".repeat(80)}\n`);
    return {
      success: false,
      error: "NOT_FOUND",
      phoneNumberProvided: phoneNumber,
      phoneNumberNormalized: normalizedPhone,
      message: "No customer account found with this phone number",
    };
  }

  const customer = docs[0];
  
  // Build full name with fallbacks
  const fullName = customer.fullName 
    || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() 
    || 'the account holder';

  console.log(`✅ Customer found:`, {
    id: customer.id,
    fullName: customer.fullName,
    firstName: customer.firstName,
    lastName: customer.lastName,
    computed: fullName,
  });
  
  // Store customer data in session for later use
  if (callId) {
    sessionStore.setCustomerVerified(callId, {
      id: customer.id,
      name: fullName,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phoneNumber: normalizedPhone,
    });
  }
  
  console.log(`${"=".repeat(80)}\n`);

  return {
    success: true,
    customerFound: true,
    customerId: customer.id,
    customerName: fullName,
    firstName: customer.firstName,
    lastName: customer.lastName,
    phoneNumber: normalizedPhone,
    nextStep: "CONFIRM_IDENTITY",
    message: "Customer account located - identity confirmation required",
  };
}
