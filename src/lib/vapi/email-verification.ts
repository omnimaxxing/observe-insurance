/**
 * Email Verification Code System
 * Generates and validates one-time codes for email-based authentication
 */

import { kv } from "@vercel/kv";
import crypto from "crypto";

const CODE_LENGTH = 6;
const CODE_TTL = 300; // 5 minutes in seconds
const MAX_ATTEMPTS = 3; // Maximum verification attempts

interface VerificationCodeData {
  code: string;
  email: string;
  customerId: number;
  customerName: string;
  createdAt: string;
  attempts: number;
  callId: string;
}

/**
 * Generate a random 6-digit alphanumeric code
 */
export function generateVerificationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous characters (0, O, 1, I, L)
  let code = '';
  
  for (let i = 0; i < CODE_LENGTH; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    code += chars[randomIndex];
  }
  
  return code;
}

/**
 * Store verification code in Redis
 */
export async function storeVerificationCode(
  callId: string,
  email: string,
  customerId: number,
  customerName: string
): Promise<string> {
  const code = generateVerificationCode();
  
  const data: VerificationCodeData = {
    code,
    email,
    customerId,
    customerName,
    createdAt: new Date().toISOString(),
    attempts: 0,
    callId,
  };
  
  const key = `vapi:verification:${callId}`;
  await kv.setex(key, CODE_TTL, JSON.stringify(data));
  
  console.log(`✅ Verification code stored for call ${callId}: ${code} (expires in ${CODE_TTL}s)`);
  
  return code;
}

/**
 * Verify the code provided by customer
 */
export async function verifyCode(
  callId: string,
  providedCode: string
): Promise<{
  valid: boolean;
  customerId?: number;
  customerName?: string;
  email?: string;
  error?: string;
  attemptsRemaining?: number;
}> {
  const key = `vapi:verification:${callId}`;
  const rawData = await kv.get(key);
  // Vercel KV auto-parses JSON, so data might already be an object
  const data = rawData ? (typeof rawData === 'string' ? JSON.parse(rawData) : rawData) as VerificationCodeData : null;
  
  if (!data) {
    console.log(`❌ No verification code found for call ${callId} (expired or never generated)`);
    return {
      valid: false,
      error: "CODE_EXPIRED",
    };
  }
  
  // Increment attempts
  data.attempts += 1;
  
  // Normalize codes for comparison (remove spaces, uppercase)
  const normalizedProvided = providedCode.trim().toUpperCase().replace(/\s+/g, '');
  const normalizedStored = data.code.trim().toUpperCase();
  
  console.log(`🔍 Verification attempt ${data.attempts}/${MAX_ATTEMPTS} for call ${callId}`);
  console.log(`   Provided: ${normalizedProvided}, Expected: ${normalizedStored}`);
  
  if (normalizedProvided === normalizedStored) {
    // Valid code - delete from Redis
    await kv.del(key);
    console.log(`✅ Verification successful for call ${callId}`);
    
    return {
      valid: true,
      customerId: data.customerId,
      customerName: data.customerName,
      email: data.email,
    };
  }
  
  // Invalid code
  const attemptsRemaining = MAX_ATTEMPTS - data.attempts;
  
  if (attemptsRemaining <= 0) {
    // Max attempts reached - delete code
    await kv.del(key);
    console.log(`❌ Max attempts reached for call ${callId} - code invalidated`);
    
    return {
      valid: false,
      error: "MAX_ATTEMPTS_EXCEEDED",
      attemptsRemaining: 0,
    };
  }
  
  // Update attempts count in Redis
  await kv.setex(key, CODE_TTL, JSON.stringify(data));
  console.log(`❌ Invalid code for call ${callId} - ${attemptsRemaining} attempts remaining`);
  
  return {
    valid: false,
    error: "INVALID_CODE",
    attemptsRemaining,
  };
}

/**
 * Get remaining TTL for a verification code
 */
export async function getCodeTTL(callId: string): Promise<number> {
  const key = `vapi:verification:${callId}`;
  const ttl = await kv.ttl(key);
  return ttl || -1;
}

/**
 * Clear verification code (e.g., if customer wants to resend)
 */
export async function clearVerificationCode(callId: string): Promise<void> {
  const key = `vapi:verification:${callId}`;
  await kv.del(key);
  console.log(`🗑️ Verification code cleared for call ${callId}`);
}
