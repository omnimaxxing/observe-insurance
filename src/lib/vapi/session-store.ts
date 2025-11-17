/**
 * Vapi Call Session Store
 * 
 * Maintains state for active calls including authentication status,
 * customer data, and call metadata. Uses Upstash Redis for persistence
 * across serverless function invocations.
 */

import { Redis } from "@upstash/redis";

interface CallSession {
  callId: string;
  phoneNumber: string;
  createdAt: string; // Store as ISO string for Redis serialization
  
  // Authentication state
  isAuthenticated: boolean;
  authenticationStep: "PENDING" | "PHONE_VERIFIED" | "IDENTITY_CONFIRMED";
  
  // Customer data (set after verifyCustomer succeeds)
  customer?: {
    id: number;
    name: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
  };
  
  // Metadata
  lastActivity: string; // Store as ISO string for Redis serialization
  conversationHistory?: Array<{
    timestamp: string;
    action: string;
    data: any;
  }>;
}

class SessionStore {
  private redis: Redis;
  private readonly SESSION_TTL = 3600; // 1 hour in seconds
  
  constructor() {
    this.redis = new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    });
  }
  
  private getKey(callId: string): string {
    return `vapi:session:${callId}`;
  }
  
  /**
   * Initialize a new call session
   */
  async initSession(callId: string, phoneNumber: string): Promise<CallSession> {
    const now = new Date().toISOString();
    const session: CallSession = {
      callId,
      phoneNumber,
      createdAt: now,
      isAuthenticated: false,
      authenticationStep: "PENDING",
      lastActivity: now,
      conversationHistory: [],
    };
    
    await this.redis.setex(this.getKey(callId), this.SESSION_TTL, session);
    console.log(`📝 Session initialized for call ${callId}`);
    
    return session;
  }
  
  /**
   * Get existing session or create new one
   */
  async getOrCreateSession(callId: string, phoneNumber?: string): Promise<CallSession | null> {
    let session = await this.getSession(callId);
    
    if (!session && phoneNumber) {
      session = await this.initSession(callId, phoneNumber);
    }
    
    if (session) {
      session.lastActivity = new Date().toISOString();
      await this.redis.setex(this.getKey(callId), this.SESSION_TTL, session);
    }
    
    return session;
  }
  
  /**
   * Update session with customer data after verification
   */
  async setCustomerVerified(callId: string, customerData: {
    id: number;
    name: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
  }): Promise<void> {
    const session = await this.getSession(callId);
    if (!session) return;
    
    session.customer = customerData;
    session.authenticationStep = "PHONE_VERIFIED";
    session.lastActivity = new Date().toISOString();
    
    await this.logAction(callId, "CUSTOMER_VERIFIED", customerData, session);
    await this.redis.setex(this.getKey(callId), this.SESSION_TTL, session);
    console.log(`✅ Customer verified for call ${callId}: ${customerData.name}`);
  }
  
  /**
   * Mark customer as fully authenticated
   */
  async setAuthenticated(callId: string, authenticated: boolean): Promise<void> {
    const session = await this.getSession(callId);
    if (!session) return;
    
    session.isAuthenticated = authenticated;
    session.authenticationStep = authenticated ? "IDENTITY_CONFIRMED" : "PHONE_VERIFIED";
    session.lastActivity = new Date().toISOString();
    
    await this.logAction(callId, authenticated ? "AUTHENTICATED" : "AUTH_FAILED", { authenticated }, session);
    await this.redis.setex(this.getKey(callId), this.SESSION_TTL, session);
    console.log(`${authenticated ? '✅' : '❌'} Authentication ${authenticated ? 'confirmed' : 'failed'} for call ${callId}`);
  }
  
  /**
   * Get current session
   */
  async getSession(callId: string): Promise<CallSession | null> {
    const data = await this.redis.get<CallSession>(this.getKey(callId));
    return data;
  }
  
  /**
   * Check if customer is authenticated
   */
  async isAuthenticated(callId: string): Promise<boolean> {
    const session = await this.getSession(callId);
    return session?.isAuthenticated ?? false;
  }
  
  /**
   * Get customer ID for authenticated session
   */
  async getCustomerId(callId: string): Promise<number | undefined> {
    const session = await this.getSession(callId);
    return session?.customer?.id;
  }
  
  /**
   * Log an action to the session history
   */
  private async logAction(callId: string, action: string, data: any, session: CallSession): Promise<void> {
    if (!session.conversationHistory) {
      session.conversationHistory = [];
    }
    
    session.conversationHistory.push({
      timestamp: new Date().toISOString(),
      action,
      data,
    });
  }
  
  /**
   * End a session (called when call ends)
   */
  async endSession(callId: string): Promise<void> {
    const session = await this.getSession(callId);
    if (session) {
      const duration = Date.now() - new Date(session.createdAt).getTime();
      console.log(`📞 Session ended for call ${callId} (duration: ${duration}ms)`);
      await this.redis.del(this.getKey(callId));
    }
  }
  
  /**
   * Redis automatically handles TTL, no manual cleanup needed
   */
  private async cleanupExpiredSessions(): Promise<void> {
    // Redis TTL handles expiration automatically
    console.log('🧹 Redis TTL handles session expiration automatically');
  }
  
  /**
   * Get session stats (Note: expensive operation in Redis, use sparingly)
   */
  async getStats(): Promise<{ info: string }> {
    // Note: Counting keys in Redis is expensive, only use for debugging
    return {
      info: 'Session stats not available in Redis (use Redis CLI for diagnostics)',
    };
  }
  
  /**
   * Cleanup on shutdown (no-op for Redis)
   */
  destroy(): void {
    // Redis connections are managed by Upstash, no cleanup needed
    console.log('📡 Redis session store shutdown');
  }
}

// Singleton instance
export const sessionStore = new SessionStore();
