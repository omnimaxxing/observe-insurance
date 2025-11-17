import { verifyCode } from '../email-verification';
import { sessionStore } from '../session-store';

interface VerifyEmailCodeParams {
  code: string;
  callId?: string;
}

export async function verifyEmailCode({ code, callId }: VerifyEmailCodeParams) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔧 FUNCTION: verifyEmailCode`);
  console.log(`📥 Input:`, { code: code.substring(0, 2) + '****', callId });

  if (!callId) {
    console.log(`❌ No callId provided`);
    console.log(`${"=".repeat(80)}\n`);
    return {
      success: false,
      verified: false,
      error: "MISSING_CALL_ID",
      message: "Call ID is required for verification",
    };
  }

  if (!code) {
    console.log(`❌ No code provided`);
    console.log(`${"=".repeat(80)}\n`);
    return {
      success: false,
      verified: false,
      error: "MISSING_CODE",
      message: "Verification code is required",
    };
  }

  try {
    // Verify the code
    const result = await verifyCode(callId, code);

    if (result.valid && result.customerId && result.customerName) {
      // Code is valid - mark customer as verified in session
      await sessionStore.setCustomerVerified(callId, {
        id: result.customerId,
        name: result.customerName,
        firstName: result.customerName.split(' ')[0] || '',
        lastName: result.customerName.split(' ').slice(1).join(' ') || '',
        phoneNumber: '', // Not available from email verification
      });

      console.log(`✅ Email verification successful for call ${callId}`);
      console.log(`${"=".repeat(80)}\n`);

      return {
        success: true,
        verified: true,
        customerId: result.customerId,
        customerName: result.customerName,
        email: result.email,
        nextStep: "CONFIRM_IDENTITY",
        message: `Email verification successful! I've confirmed your identity via the code sent to ${result.email}. Am I speaking with ${result.customerName}?`,
      };
    }

    // Code is invalid
    if (result.error === "CODE_EXPIRED") {
      console.log(`❌ Code expired for call ${callId}`);
      console.log(`${"=".repeat(80)}\n`);

      return {
        success: false,
        verified: false,
        error: "CODE_EXPIRED",
        message: "The verification code has expired. Would you like me to send a new code?",
      };
    }

    if (result.error === "MAX_ATTEMPTS_EXCEEDED") {
      console.log(`❌ Max attempts exceeded for call ${callId}`);
      console.log(`${"=".repeat(80)}\n`);

      return {
        success: false,
        verified: false,
        error: "MAX_ATTEMPTS_EXCEEDED",
        escalate: true,
        message: "Too many incorrect attempts. For your security, I need to transfer you to a representative who can help verify your identity.",
      };
    }

    // Invalid code with attempts remaining
    console.log(`❌ Invalid code for call ${callId} - ${result.attemptsRemaining} attempts remaining`);
    console.log(`${"=".repeat(80)}\n`);

    return {
      success: false,
      verified: false,
      error: "INVALID_CODE",
      attemptsRemaining: result.attemptsRemaining,
      message: `That code doesn't match. You have ${result.attemptsRemaining} attempt${result.attemptsRemaining === 1 ? '' : 's'} remaining. Could you please try again?`,
    };
  } catch (error) {
    console.error(`❌ Error in verifyEmailCode:`, error);
    console.log(`${"=".repeat(80)}\n`);

    return {
      success: false,
      verified: false,
      error: "SYSTEM_ERROR",
      message: "An error occurred during verification",
    };
  }
}
