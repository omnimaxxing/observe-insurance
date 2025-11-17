/**
 * Redis-Based Session Manager for ElevenLabs Conversations
 * Tracks authenticated customers per conversation to prevent unauthorized access
 * Uses Upstash Redis KV for persistence across serverless instances
 */

import { kv } from '@vercel/kv'

interface SessionData {
  customerId: number
  customerName: string
  customerEmail: string
  authenticatedAt: string // ISO string for JSON serialization
  verificationMethod: 'phone' | 'email' | 'name_dob'
  conversationId: string
}

// Session expires after 30 minutes of inactivity
const SESSION_TIMEOUT_SECONDS = 30 * 60 // 30 minutes

// Redis key prefix
const SESSION_KEY_PREFIX = 'session:'

/**
 * Create or update authentication session in Redis
 */
export async function createSession(conversationId: string, data: Omit<SessionData, 'authenticatedAt' | 'conversationId'>) {
  const session: SessionData = {
    ...data,
    conversationId,
    authenticatedAt: new Date().toISOString(),
  }
  
  const key = `${SESSION_KEY_PREFIX}${conversationId}`
  
  // Store in Redis with TTL
  await kv.setex(key, SESSION_TIMEOUT_SECONDS, JSON.stringify(session))
  
  console.log(`🔐 Session created for conversation ${conversationId}:`, {
    customerId: data.customerId,
    customerName: data.customerName,
    method: data.verificationMethod,
  })
  
  return session
}

/**
 * Verify if conversation has valid authenticated session in Redis
 */
export async function verifySession(conversationId: string): Promise<SessionData | null> {
  const key = `${SESSION_KEY_PREFIX}${conversationId}`
  const data = await kv.get(key)
  
  if (!data) {
    console.warn(`⚠️ No session found for conversation ${conversationId}`)
    return null
  }
  
  try {
    // Vercel KV auto-parses JSON, so data might already be an object
    const session: SessionData = typeof data === 'string' ? JSON.parse(data) : data as SessionData
    return session
  } catch (error) {
    console.error(`❌ Failed to parse session data for ${conversationId}:`, error)
    return null
  }
}

/**
 * Get customer ID from authenticated session
 */
export async function getAuthenticatedCustomerId(conversationId: string): Promise<number | null> {
  const session = await verifySession(conversationId)
  return session?.customerId || null
}

/**
 * Check if conversation is authenticated
 */
export async function isAuthenticated(conversationId: string): Promise<boolean> {
  const session = await verifySession(conversationId)
  return session !== null
}

/**
 * Clear session from Redis (on call end or logout)
 */
export async function clearSession(conversationId: string) {
  const key = `${SESSION_KEY_PREFIX}${conversationId}`
  const deleted = await kv.del(key)
  if (deleted) {
    console.log(`🔓 Session cleared for conversation ${conversationId}`)
  }
  return deleted > 0
}

/**
 * Clean up expired sessions (Redis TTL handles this automatically)
 * This function is kept for compatibility but does nothing
 */
export async function cleanupExpiredSessions() {
  // Redis automatically expires keys based on TTL
  console.log('🧹 Redis handles session cleanup automatically via TTL')
  return 0
}

/**
 * Get session stats (for monitoring)
 * Note: Redis doesn't easily support listing all keys, so this returns limited info
 */
export async function getSessionStats() {
  // In production, you'd use Redis SCAN command to list keys
  // For now, return basic info
  return {
    message: 'Session stats require Redis SCAN - implement if needed',
    ttl: SESSION_TIMEOUT_SECONDS,
  }
}

// No need for auto-cleanup - Redis TTL handles it
