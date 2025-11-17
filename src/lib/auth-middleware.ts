import { NextRequest } from 'next/server';
import { getPayload } from 'payload';
import payloadConfig from '@/payload.config';

export async function authenticateRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid authorization header', status: 401 };
  }

  const apiKey = authHeader.replace('Bearer ', '');

  try {
    const payload = await getPayload({ config: payloadConfig });

    // Find user by API key
    const users = await payload.find({
      collection: 'users',
      where: {
        apiKey: { equals: apiKey },
      },
      limit: 1,
    });

    if (users.docs.length === 0) {
      return { error: 'Invalid API key', status: 401 };
    }

    const user = users.docs[0];

    // Check if user has ai-agent role
    if (user.role !== 'ai-agent') {
      return { error: 'Unauthorized: AI agent role required', status: 403 };
    }

    return { user, payload };
  } catch (error) {
    console.error('Authentication error:', error);
    return { error: 'Authentication failed', status: 500 };
  }
}
