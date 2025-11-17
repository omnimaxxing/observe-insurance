import crypto from 'crypto';
import { Redis } from '@upstash/redis';

/**
 * Upload Token Storage
 * Stores secure tokens for document upload links using Upstash Redis
 * Each token maps to a claim and customer, expires after 24 hours
 */

interface UploadToken {
  token: string;
  claimId: string;
  claimNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  createdAt: string; // ISO string for Redis serialization
  expiresAt: string; // ISO string for Redis serialization
  used: boolean;
}

// Redis client (same as session store)
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// TTL for upload tokens: 24 hours in seconds
const UPLOAD_TOKEN_TTL = 24 * 60 * 60;

/**
 * Generate Redis key for upload token
 */
function getTokenKey(token: string): string {
  return `vapi:upload:${token}`;
}

/**
 * Generate a secure random token
 */
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create and store an upload token
 * @param claimId - Claim ID from database
 * @param claimNumber - Human-readable claim number
 * @param customerId - Customer ID
 * @param customerName - Customer full name
 * @param customerEmail - Customer email
 * @returns The generated token
 */
export async function createUploadToken(
  claimId: string,
  claimNumber: string,
  customerId: string,
  customerName: string,
  customerEmail: string,
): Promise<string> {
  const token = generateSecureToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

  const tokenData: UploadToken = {
    token,
    claimId,
    claimNumber,
    customerId,
    customerName,
    customerEmail,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    used: false,
  };

  // Store in Redis with automatic TTL expiration
  await redis.setex(getTokenKey(token), UPLOAD_TOKEN_TTL, tokenData);
  
  console.log(`🔑 Upload token created for claim ${claimNumber} (expires in 24h)`);

  return token;
}

/**
 * Validate and retrieve an upload token
 * @param token - The token to validate
 * @returns Token data if valid, null otherwise
 */
export async function validateUploadToken(token: string): Promise<UploadToken | null> {
  const tokenData = await redis.get<UploadToken>(getTokenKey(token));

  if (!tokenData) {
    return null;
  }

  // Redis TTL handles expiration automatically, but double-check
  if (new Date() > new Date(tokenData.expiresAt)) {
    await redis.del(getTokenKey(token));
    return null;
  }

  // Check if already used
  if (tokenData.used) {
    return null;
  }

  return tokenData;
}

/**
 * Mark a token as used (optional - allows single-use tokens)
 * @param token - The token to mark as used
 */
export async function markTokenAsUsed(token: string): Promise<void> {
  const tokenData = await redis.get<UploadToken>(getTokenKey(token));
  if (tokenData) {
    tokenData.used = true;
    // Update in Redis, keeping the remaining TTL
    const ttl = await redis.ttl(getTokenKey(token));
    if (ttl > 0) {
      await redis.setex(getTokenKey(token), ttl, tokenData);
    }
  }
}

/**
 * Clean up expired tokens from storage
 * Note: Redis TTL handles this automatically, no manual cleanup needed
 */
function cleanupExpiredTokens(): void {
  // Redis automatically expires keys based on TTL
  console.log('🧹 Redis TTL handles token expiration automatically');
}

/**
 * Get token info (for debugging/logging)
 */
export async function getTokenInfo(token: string): Promise<Partial<UploadToken> | null> {
  const tokenData = await redis.get<UploadToken>(getTokenKey(token));
  if (!tokenData) {
    return null;
  }

  return {
    claimNumber: tokenData.claimNumber,
    customerName: tokenData.customerName,
    createdAt: tokenData.createdAt,
    expiresAt: tokenData.expiresAt,
    used: tokenData.used,
  };
}
