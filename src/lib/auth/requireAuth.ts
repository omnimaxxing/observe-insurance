import { NextResponse } from 'next/server'
import { verifySession } from './sessionManager'

/**
 * Authentication guard for protected tool endpoints
 * Verifies that the conversation has an active authenticated session in Redis
 */
export async function requireAuth(conversationId: string | undefined, customerId: number | undefined) {
  // Check if conversationId provided
  if (!conversationId) {
    return {
      authenticated: false,
      error: 'Missing conversation ID',
      response: NextResponse.json(
        {
          success: false,
          error: 'authentication_required',
          message: 'I need to verify your identity first before I can access that information. Please provide your phone number, email, or name and date of birth.',
        },
        { status: 401 }
      ),
    }
  }

  // Verify session exists and is valid
  const session = await verifySession(conversationId)
  
  if (!session) {
    return {
      authenticated: false,
      error: 'No valid session',
      response: NextResponse.json(
        {
          success: false,
          error: 'authentication_required',
          message: 'Your session has expired or you are not authenticated. Please verify your identity first.',
        },
        { status: 401 }
      ),
    }
  }

  // Verify customerId matches session
  if (customerId && customerId !== session.customerId) {
    console.error(`⚠️ Customer ID mismatch: requested ${customerId}, session has ${session.customerId}`)
    return {
      authenticated: false,
      error: 'Customer ID mismatch',
      response: NextResponse.json(
        {
          success: false,
          error: 'authentication_mismatch',
          message: 'There was an authentication error. Please verify your identity again.',
        },
        { status: 403 }
      ),
    }
  }

  // All checks passed
  return {
    authenticated: true,
    session,
    error: null,
    response: null,
  }
}
