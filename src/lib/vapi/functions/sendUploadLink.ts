import { Resend } from 'resend';
import { getPayload } from 'payload';
import payloadConfig from '@/payload.config';
import type { Claim, Customer } from '@/payload-types';
import { sessionStore } from '../session-store';
import { createUploadToken } from '../upload-tokens';

interface SendUploadLinkParams {
  claimNumber: string;
  customerId?: number; // For ElevenLabs integration - customer ID passed directly
  callId?: string; // Vapi call ID for session management (legacy)
}

export async function sendUploadLink({
  claimNumber,
  customerId,
  callId,
}: SendUploadLinkParams) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔧 FUNCTION: sendUploadLink`);
  console.log(`📥 Input:`, { claimNumber, customerId, callId });

  // Get customerId from parameter or session (parameter takes priority for ElevenLabs)
  let finalCustomerId = customerId;
  if (!finalCustomerId && callId) {
    finalCustomerId = await sessionStore.getCustomerId(callId);
  }

  if (!finalCustomerId) {
    console.log(`❌ No authenticated customer found`);
    console.log(`${"=".repeat(80)}\n`);
    return {
      success: false,
      error: "NOT_AUTHENTICATED",
      message: "Customer must be authenticated before sending upload link",
    };
  }

  console.log(`👤 Customer ID: ${finalCustomerId}`);

  // Validate Resend API key
  if (!process.env.RESEND_API_KEY) {
    console.log(`❌ RESEND_API_KEY not configured`);
    console.log(`${"=".repeat(80)}\n`);
    return {
      success: false,
      error: "EMAIL_NOT_CONFIGURED",
      message: "Email service is not available at this time. Please contact support.",
    };
  }

  const payload = await getPayload({ config: payloadConfig });

  try {
    // Find the claim - use 'customer.id' for relationship queries in Postgres
    const { docs: claims } = await payload.find({
      collection: 'claims',
      where: {
        and: [
          { 'customer.id': { equals: finalCustomerId } },
          { claimNumber: { equals: claimNumber } },
        ],
      },
      limit: 1,
    }) as { docs: Claim[] };

    if (claims.length === 0) {
      console.log(`❌ Claim not found: ${claimNumber}`);
      console.log(`${"=".repeat(80)}\n`);
      return {
        success: false,
        error: "CLAIM_NOT_FOUND",
        message: `I couldn't find claim ${claimNumber} on your account`,
      };
    }

    const claim = claims[0];

    // Get customer details
    const customer = await payload.findByID({
      collection: 'customers',
      id: finalCustomerId,
    }) as Customer;

    if (!customer.email) {
      console.log(`❌ Customer has no email on file`);
      console.log(`${"=".repeat(80)}\n`);
      return {
        success: false,
        error: "NO_EMAIL",
        message: "I don't have an email address on file for you. Please contact support to update your contact information.",
      };
    }

    // Generate secure upload token
    const token = await createUploadToken(
      claim.id.toString(),
      claim.claimNumber,
      customer.id.toString(),
      customer.fullName || `${customer.firstName} ${customer.lastName}`,
      customer.email,
    );

    // Construct upload URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const uploadUrl = `${baseUrl}/upload/${token}`;

    console.log(`🔗 Generated upload link: ${uploadUrl}`);

    // Send email via Resend
    const resend = new Resend(process.env.RESEND_API_KEY);
    const customerName = customer.fullName || customer.firstName || 'Valued Customer';

    const emailResult = await resend.emails.send({
      from: 'Observe Insurance <documents@observe-insurance.com>',
      to: customer.email,
      subject: `Upload Documents for Claim ${claim.claimNumber}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Upload Documents</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Observe Insurance</h1>
            </div>
            
            <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e1e8ed; border-top: none; border-radius: 0 0 10px 10px;">
              <h2 style="color: #333; margin-top: 0;">Hello ${customerName},</h2>
              
              <p style="font-size: 16px; color: #666;">Thank you for contacting us about your claim. We've created a secure upload portal for you to submit your documentation.</p>
              
              <div style="background: #f7f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 30px 0;">
                <p style="margin: 0; font-size: 14px; color: #666;"><strong>Claim Number:</strong> ${claim.claimNumber}</p>
                <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;"><strong>Coverage Type:</strong> ${claim.coverageType || 'N/A'}</p>
              </div>
              
              <p style="font-size: 16px; color: #666;">Click the button below to upload your documents:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${uploadUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                  Upload Documents
                </a>
              </div>
              
              <p style="font-size: 14px; color: #999; margin: 20px 0;">
                <strong>Important:</strong> This link will expire in 24 hours for security purposes.
              </p>
              
              <p style="font-size: 14px; color: #999;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="font-size: 12px; color: #667eea; word-break: break-all; background: #f7f9fa; padding: 10px; border-radius: 4px;">
                ${uploadUrl}
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

Thank you for contacting us about your claim. We've created a secure upload portal for you to submit your documentation.

Claim Number: ${claim.claimNumber}
Coverage Type: ${claim.coverageType || 'N/A'}

Upload your documents here:
${uploadUrl}

Important: This link will expire in 24 hours for security purposes.

If you have any questions, please don't hesitate to contact us.

© ${new Date().getFullYear()} Observe Insurance. All rights reserved.
      `.trim(),
    });

    if (emailResult.error) {
      console.error(`❌ Email send failed:`, emailResult.error);
      console.log(`${"=".repeat(80)}\n`);
      return {
        success: false,
        error: "EMAIL_SEND_FAILED",
        message: "I encountered an error sending the upload link. Please try again or contact support.",
      };
    }

    console.log(`✅ Upload link sent successfully! Email ID: ${emailResult.data?.id}`);
    console.log(`${"=".repeat(80)}\n`);

    return {
      success: true,
      linkSent: true,
      email: customer.email,
      claimNumber: claim.claimNumber,
      expiresInHours: 24,
      message: `Perfect! I've sent a secure upload link to ${customer.email}. The link will be valid for 24 hours. You can use it to upload photos, PDFs, or any other documentation for your claim.`,
    };
  } catch (error) {
    console.error(`❌ Error in sendUploadLink:`, error);
    console.log(`${"=".repeat(80)}\n`);

    return {
      success: false,
      error: "SYSTEM_ERROR",
      message: "An error occurred while generating the upload link. Please try again.",
    };
  }
}
