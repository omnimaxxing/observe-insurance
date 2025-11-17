import { VapiClient } from "@vapi-ai/server-sdk";

const vapi = new VapiClient({ token: process.env.VAPI_API_KEY! });

const systemPrompt = `You are an AI receptionist for a barbershop. Verify the customer, then offer booking, rescheduling, or cancellation. Use scheduling tools when needed. Keep replies under 30 words.`;

const assistant = await vapi.assistants.create({
  name: "Insurance ssistant",
  firstMessage: "Welcome to Observe Insurance! May I please have the phone number associated with your account?",
  model: {
    provider: "openai",
    model: "gpt-4o",
    messages: [{ role: "system", content: systemPrompt }],
    // toolIds: [ "CHECK_AVAILABILITY_ID", "BOOK_ID", "RESCHEDULE_ID", "CANCEL_ID" ]
  }
});
