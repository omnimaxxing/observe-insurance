// In-memory store for active conversations
export const activeConversations = new Map<string, {
  conversationId?: string
  transcript: Array<{ timestamp: Date; speaker: 'user' | 'agent'; text: string }>
  startTime: Date
}>()
