# Document Upload System

## Overview

The document upload system allows customers to securely upload files (photos, PDFs, documents) to their insurance claims via a time-limited, tokenized upload portal.

## How It Works

### 1. Customer Request Flow

1. Customer calls and asks: "How do I upload documents for my claim?"
2. AI agent identifies the claim (asks which one if multiple exist)
3. AI calls `sendUploadLink` function with the claim number
4. System generates a secure token and emails a unique upload link to customer
5. Customer receives email with link valid for 24 hours

### 2. Upload Portal Flow

1. Customer clicks link in email → `/upload/{token}`
2. System validates token (checks expiration, claim association)
3. Customer sees upload interface with claim details
4. Customer selects files (images, PDFs, Word docs)
5. Customer clicks "Upload Documents"
6. Files are uploaded to Payload Media collection
7. Files are automatically attached to the claim
8. Case note is added documenting the upload

## Architecture

### Components Created

#### 1. Token Storage (`src/lib/vapi/upload-tokens.ts`)
- In-memory token storage (consider Redis for production)
- Generates secure random tokens
- Validates tokens and checks expiration
- Maps tokens to claims and customers

#### 2. VAPI Function (`src/lib/vapi/functions/sendUploadLink.ts`)
- Verifies customer authentication
- Looks up claim and customer details
- Generates upload token
- Sends branded email via Resend with upload link

#### 3. Upload Page (`src/app/(frontend)/upload/[token]/page.tsx`)
- Dynamic route for unique upload links
- Validates token on page load
- Drag-and-drop file upload interface
- Shows claim information for context
- Displays upload progress and success states

#### 4. API Endpoints

**Validate Token** (`src/app/api/upload/validate/route.ts`)
- GET `/api/upload/validate?token=xxx`
- Returns token validity and claim info

**Submit Upload** (`src/app/api/upload/submit/route.ts`)
- POST `/api/upload/submit`
- Accepts multipart form data with files
- Uploads to Payload Media collection
- Attaches files to claim
- Adds case note

## Security Features

- **Time-limited tokens**: 24-hour expiration
- **Secure random generation**: 32-byte cryptographic tokens
- **Single-use option**: Can mark tokens as used (currently disabled for multiple uploads)
- **Customer verification**: Tokens tied to specific customer and claim
- **Email verification**: Link sent only to customer's email on file

## Configuration

### Environment Variables Required

```env
RESEND_API_KEY=re_xxxxx
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
BLOB_READ_WRITE_TOKEN=vercel_blob_xxxxx
```

### Email Configuration

Emails sent from: `documents@observe-insurance.com`

Update sender domain in:
- `src/lib/vapi/functions/sendUploadLink.ts` (line 106)

## Usage Example

### AI Agent Conversation

```
Customer: "How do I upload photos of the damage?"

Agent: "I can send you a secure upload link. Which claim would you like to upload documents for?"

Customer: "The fire damage claim"

Agent: [calls sendUploadLink with claim number]

Agent: "Perfect! I've sent a secure upload link to your email at john@example.com. 
The link will be valid for 24 hours. You can use it to upload photos, PDFs, 
or any other documentation for your claim."
```

### Customer Experience

1. Receives email with branded upload link
2. Clicks link → sees upload portal
3. Drags/drops files or clicks to browse
4. Sees file list with sizes
5. Clicks "Upload Documents"
6. Sees success confirmation
7. Files are immediately available to claims adjusters in Payload CMS

## File Handling

### Accepted File Types
- Images: `image/*`
- PDFs: `application/pdf`
- Word: `.doc`, `.docx`

### Storage
- Files stored in Vercel Blob Storage (configured in `payload.config.ts`)
- Media documents created in Payload CMS
- Files linked to claims via `attachments` array field

### Metadata
- Each upload gets a label: `{claimNumber} - {filename}`
- Attachment description: "Uploaded via customer portal on {date}"
- Case note added: "Customer uploaded X document(s) via secure portal"

## Production Considerations

### Token Storage
Current implementation uses in-memory Map. For production:
- Use Redis for distributed token storage
- Implement token cleanup job
- Consider database storage for audit trail

### File Size Limits
- Configure max file size in upload endpoint
- Add client-side validation
- Consider chunked uploads for large files

### Rate Limiting
- Add rate limiting to upload endpoints
- Prevent abuse of token generation
- Monitor email sending quotas

### Monitoring
- Log all upload attempts
- Track token usage patterns
- Alert on failed uploads
- Monitor storage usage

## Testing

### Manual Test Flow

1. Start dev server: `pnpm dev`
2. Call VAPI webhook with authenticated session
3. Trigger `sendUploadLink` function
4. Check email for upload link
5. Visit link and upload test files
6. Verify files appear in Payload CMS under claim

### Token Validation Test

```bash
# Generate token (via function call)
# Then validate:
curl http://localhost:3000/api/upload/validate?token=YOUR_TOKEN
```

## Troubleshooting

### "Invalid or expired upload link"
- Token may have expired (24hr limit)
- Token may have been used (if single-use enabled)
- Check token storage (in-memory resets on server restart)

### "No email on file"
- Customer record missing email address
- Update customer in Payload CMS

### Upload fails
- Check file size limits
- Verify Blob storage configuration
- Check Payload Media collection permissions
- Review server logs for errors

## Future Enhancements

- [ ] SMS upload links (in addition to email)
- [ ] Upload progress bar
- [ ] File preview before upload
- [ ] Virus scanning integration
- [ ] OCR for uploaded documents
- [ ] Automatic document categorization
- [ ] Mobile app deep linking
- [ ] Multi-language support
