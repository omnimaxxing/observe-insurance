import { Resend } from 'resend';
import { storeVerificationCode } from '../email-verification';

interface SendVerificationCodeParams {
  email: string;
  customerId: number;
  customerName: string;
  callId?: string;
}

export async function sendVerificationCode({
  email,
  customerId,
  customerName,
  callId,
}: SendVerificationCodeParams) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔧 FUNCTION: sendVerificationCode`);
  console.log(`📥 Input:`, { email, customerId, customerName, callId });
  
  // Lazy-load Resend client to avoid module evaluation errors
  if (!process.env.RESEND_API_KEY) {
    console.log(`❌ RESEND_API_KEY not configured`);
    console.log(`${"=".repeat(80)}\n`);
    return {
      success: false,
      error: "EMAIL_NOT_CONFIGURED",
      message: "Email verification is not available at this time. Please try another verification method.",
    };
  }
  
  const resend = new Resend(process.env.RESEND_API_KEY);

  if (!callId) {
    console.log(`❌ No callId provided`);
    console.log(`${"=".repeat(80)}\n`);
    return {
      success: false,
      error: "MISSING_CALL_ID",
      message: "Call ID is required for verification",
    };
  }

  if (!email) {
    console.log(`❌ No email provided`);
    console.log(`${"=".repeat(80)}\n`);
    return {
      success: false,
      error: "MISSING_EMAIL",
      message: "Email address is required",
    };
  }

  try {
    // Generate and store verification code
    const code = await storeVerificationCode(callId, email, customerId, customerName);

    // Format code with spacing for readability (e.g., "AB3 H9K")
    const formattedCode = code.match(/.{1,3}/g)?.join(' ') || code;

    console.log(`📧 Sending verification code to: ${email}`);
    console.log(`🔑 Code: ${code} (formatted: ${formattedCode})`);

    // Send email via Resend
    const emailResult = await resend.emails.send({
      from: 'Observe Insurance <verify@observeinsurance.com>',
      to: email,
      subject: 'Your Verification Code - Observe Insurance',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verification Code</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Observe Insurance</h1>
            </div>
            
            <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e1e8ed; border-top: none; border-radius: 0 0 10px 10px;">
              <h2 style="color: #333; margin-top: 0;">Hello ${customerName},</h2>
              
              <p style="font-size: 16px; color: #666;">We received a request to verify your identity during a phone call with our customer service.</p>
              
              <p style="font-size: 16px; color: #666;">Your verification code is:</p>
              
              <div style="background: #f7f9fa; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
                <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #667eea; font-family: 'Courier New', monospace;">
                  ${formattedCode}
                </div>
              </div>
              
              <p style="font-size: 14px; color: #999; margin: 20px 0;">
                <strong>Important:</strong> This code will expire in 5 minutes and can be used only once.
              </p>
              
              <p style="font-size: 14px; color: #999;">
                If you didn't request this code, please disregard this email or contact our support team immediately.
              </p>
              
              <hr style="border: none; border-top: 1px solid #e1e8ed; margin: 30px 0;">
              
              <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
                © ${new Date().getFullYear()} Observe Insurance. All rights reserved.
              </p>
            </div>
          </body>
        </html>
      `,
      text: `
Hello ${customerName},

We received a request to verify your identity during a phone call with our customer service.

Your verification code is: ${formattedCode}

This code will expire in 5 minutes and can be used only once.

If you didn't request this code, please disregard this email or contact our support team.

© ${new Date().getFullYear()} Observe Insurance. All rights reserved.
      `.trim(),
    });

    if (emailResult.error) {
      console.error(`❌ Email send failed:`, emailResult.error);
      console.log(`${"=".repeat(80)}\n`);
      return {
        success: false,
        error: "EMAIL_SEND_FAILED",
        message: "Failed to send verification email",
        details: emailResult.error,
      };
    }

    console.log(`✅ Email sent successfully! Email ID: ${emailResult.data?.id}`);
    console.log(`${"=".repeat(80)}\n`);

    return {
      success: true,
      codeSent: true,
      email,
      expiresInSeconds: 300,
      message: `A 6-character verification code has been sent to ${email}. Please check your email and read the code to me when you're ready.`,
    };
  } catch (error) {
    console.error(`❌ Error in sendVerificationCode:`, error);
    console.log(`${"=".repeat(80)}\n`);

    return {
      success: false,
      error: "SYSTEM_ERROR",
      message: "An error occurred while sending the verification code",
    };
  }
}
