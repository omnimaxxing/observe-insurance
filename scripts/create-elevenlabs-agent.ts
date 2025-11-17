import { getPayload } from 'payload';
import payloadConfig from '@/payload.config';

async function createElevenLabsAgent() {
  const payload = await getPayload({ config: payloadConfig });

  try {
    // Check if ElevenLabs agent already exists
    const existingAgents = await payload.find({
      collection: 'users',
      where: {
        role: { equals: 'ai-agent' },
      },
      limit: 1,
    });

    if (existingAgents.docs.length > 0) {
      console.log('ElevenLabs AI Agent already exists:', existingAgents.docs[0]);
      console.log('API Key:', existingAgents.docs[0].apiKey);
      return existingAgents.docs[0];
    }

    // Create new ElevenLabs agent
    const agent = await payload.create({
      collection: 'users',
      data: {
        email: 'elevenlabs-agent@observe-insurance.com',
        displayName: 'ElevenLabs AI Agent',
        role: 'ai-agent',
      },
    });

    console.log('Created ElevenLabs AI Agent:', agent);
    console.log('API Key:', agent.apiKey);

    return agent;
  } catch (error) {
    console.error('Error creating ElevenLabs agent:', error);
    throw error;
  }
}

// Run the script
createElevenLabsAgent()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
