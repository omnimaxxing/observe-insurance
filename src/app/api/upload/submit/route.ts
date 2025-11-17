import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import payloadConfig from '@/payload.config';
import { validateUploadToken, markTokenAsUsed } from '@/lib/vapi/upload-tokens';

/**
 * Handle file upload submission
 * POST /api/upload/submit
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const token = formData.get('token') as string;
    const files = formData.getAll('files') as File[];

    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 400 }
      );
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Validate token
    const tokenData = await validateUploadToken(token);

    if (!tokenData) {
      return NextResponse.json(
        { error: 'Invalid or expired upload link' },
        { status: 401 }
      );
    }

    console.log(`\n${"=".repeat(80)}`);
    console.log(`📤 DOCUMENT UPLOAD`);
    console.log(`${"=".repeat(80)}`);
    console.log(`Claim: ${tokenData.claimNumber}`);
    console.log(`Customer: ${tokenData.customerName}`);
    console.log(`Files: ${files.length}`);

    const payload = await getPayload({ config: payloadConfig });

    // Get the current claim
    const claim = await payload.findByID({
      collection: 'claims',
      id: tokenData.claimId,
    });

    if (!claim) {
      console.log(`❌ Claim not found: ${tokenData.claimId}`);
      console.log(`${"=".repeat(80)}\n`);
      return NextResponse.json(
        { error: 'Claim not found' },
        { status: 404 }
      );
    }

    // Upload each file to media collection and get IDs
    const uploadedFiles = [];

    for (const file of files) {
      try {
        console.log(`  📄 Uploading: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

        // Convert File to Buffer for Payload
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Create media document with file
        const mediaDoc = await payload.create({
          collection: 'media',
          data: {
            label: `${tokenData.claimNumber} - ${file.name}`,
          },
          file: {
            data: buffer,
            mimetype: file.type,
            name: file.name,
            size: file.size,
          },
        });

        uploadedFiles.push({
          id: mediaDoc.id,
          filename: file.name,
          size: file.size,
        });

        console.log(`  ✅ Uploaded: ${file.name} (ID: ${mediaDoc.id})`);
      } catch (error) {
        console.error(`  ❌ Failed to upload ${file.name}:`, error);
        // Continue with other files even if one fails
      }
    }

    if (uploadedFiles.length === 0) {
      console.log(`❌ No files were successfully uploaded`);
      console.log(`${"=".repeat(80)}\n`);
      return NextResponse.json(
        { error: 'Failed to upload files' },
        { status: 500 }
      );
    }

    // Get existing attachments
    const existingAttachments = Array.isArray(claim.attachments) ? claim.attachments : [];

    // Add new attachments to claim
    const newAttachments = uploadedFiles.map((file) => ({
      file: file.id,
      description: `Uploaded via customer portal on ${new Date().toLocaleDateString()}`,
    }));

    const updatedAttachments = [...existingAttachments, ...newAttachments];

    // Update claim with new attachments
    await payload.update({
      collection: 'claims',
      id: tokenData.claimId,
      data: {
        attachments: updatedAttachments,
      },
    });

    // Add a case note about the upload
    const existingNotes = Array.isArray(claim.caseNotes) ? claim.caseNotes : [];
    const newNote = {
      title: 'Customer Documentation Uploaded',
      body: `Customer uploaded ${uploadedFiles.length} document(s) via secure portal: ${uploadedFiles.map(f => f.filename).join(', ')}`,
      source: 'customer' as const,
      createdAt: new Date().toISOString(),
    };

    await payload.update({
      collection: 'claims',
      id: tokenData.claimId,
      data: {
        caseNotes: [...existingNotes, newNote],
      },
    });

    // Mark token as used (optional - remove if you want to allow multiple uploads)
    // markTokenAsUsed(token);

    console.log(`✅ Successfully attached ${uploadedFiles.length} files to claim ${tokenData.claimNumber}`);
    console.log(`${"=".repeat(80)}\n`);

    return NextResponse.json({
      success: true,
      filesUploaded: uploadedFiles.length,
      claimNumber: tokenData.claimNumber,
    });
  } catch (error) {
    console.error('Upload submission error:', error);
    return NextResponse.json(
      {
        error: 'Upload failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
