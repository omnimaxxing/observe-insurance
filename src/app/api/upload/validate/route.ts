import { NextRequest, NextResponse } from 'next/server';
import { validateUploadToken, getTokenInfo } from '@/lib/vapi/upload-tokens';

/**
 * Validate an upload token
 * GET /api/upload/validate?token=xxx
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        {
          valid: false,
          error: 'No token provided',
        },
        { status: 400 }
      );
    }

    const tokenData = await validateUploadToken(token);

    if (!tokenData) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Invalid or expired upload link',
        },
        { status: 401 }
      );
    }

    // Return minimal info for display
    return NextResponse.json({
      valid: true,
      claimNumber: tokenData.claimNumber,
      customerName: tokenData.customerName,
      expiresAt: tokenData.expiresAt,
    });
  } catch (error) {
    console.error('Token validation error:', error);
    return NextResponse.json(
      {
        valid: false,
        error: 'Validation failed',
      },
      { status: 500 }
    );
  }
}
