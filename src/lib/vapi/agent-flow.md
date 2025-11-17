# Observe Insurance Agent Flow

## Call Flow Diagram

```
                   ┌─────────────────────────┐
                   │   Inbound Call Start    │
                   └──────────┬──────────────┘
                              │
                              ▼
                   ┌─────────────────────────┐
                   │  Greeting & Welcome     │
                   │  "Thank you for calling │
                   │   Observe Insurance..." │
                   └──────────┬──────────────┘
                              │
                              ▼
                   ┌─────────────────────────┐
                   │ Request Phone Number    │
                   │ "Please provide your    │
                   │  phone number..."       │
                   └──────────┬──────────────┘
                              │
                              ▼
                   ┌─────────────────────────┐
                   │  [Tool] verifyCustomer  │
                   │   → Lookup in DB        │
                   └──────────┬──────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
          ┌──────────────┐    ┌──────────────┐
          │   Verified    │    │  Not Found   │
          └──────┬────────┘    └──────┬───────┘
                 │                    │
                 │                    ▼
                 │          ┌──────────────────┐
                 │          │ Offer Alternative│
                 │          │  - Try again     │
                 │          │  - Escalate      │
                 │          └──────────────────┘
                 │
                 ▼
     ┌────────────────────────┐
     │ "Hello [Name], how can │
     │  I help you today?"    │
     └────────┬───────────────┘
              │
              ▼
     ┌────────────────────────┐
     │   Intent Detection     │
     │   • Claim Status       │
     │   • Policy Question    │
     │   • General FAQ        │
     │   • Escalation Request │
     └────────┬───────────────┘
              │
    ┌─────────┴─────────┬──────────────┬──────────────┐
    │                   │              │              │
    ▼                   ▼              ▼              ▼
┌─────────┐      ┌──────────┐   ┌──────────┐   ┌──────────┐
│  Claim  │      │  Policy  │   │   FAQ    │   │ Escalate │
│  Status │      │ Question │   │  Search  │   │          │
└────┬────┘      └────┬─────┘   └────┬─────┘   └────┬─────┘
     │                │              │              │
     ▼                │              │              │
[getClaimStatus]      │              │              │
     │                │              │              │
     ▼                ▼              ▼              │
     │          [searchKnowledgeBase]               │
     │                │              │              │
     └────────────────┴──────────────┘              │
                      │                             │
                      ▼                             │
          ┌─────────────────────┐                   │
          │  Provide Answer     │                   │
          │  "Your claim is..." │                   │
          └─────────┬───────────┘                   │
                    │                               │
                    ▼                               │
          ┌─────────────────────┐                   │
          │ "Is there anything  │                   │
          │  else I can help?"  │                   │
          └─────────┬───────────┘                   │
                    │                               │
             ┌──────┴──────┐                        │
             │             │                        │
             ▼             ▼                        │
        ┌────────┐   ┌──────────┐                  │
        │  Yes   │   │    No    │                  │
        │(Loop)  │   │          │                  │
        └───┬────┘   └────┬─────┘                  │
            │             │                        │
            └─────────────┴────────────────────────┘
                          │
                          ▼
                ┌─────────────────────┐
                │  [Tool] endCall     │
                │  - Log summary      │
                │  - End or transfer  │
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │   Call Complete     │
                │  "Have a great day!"│
                └─────────────────────┘
```

## Tool Call Examples

### Example 1: Successful Claim Inquiry

**User**: "Hi, I'm calling about my claim."

**Agent**: "Hello! Thank you for calling Observe Insurance. Could you please provide the phone number associated with your account?"

**User**: "Yes, it's 555-123-4567"

**Agent** → Calls `verifyCustomer("555-123-4567")`

```json
{
  "verified": true,
  "customerId": "claimant_001",
  "firstName": "John",
  "lastName": "Smith"
}
```

**Agent**: "Thank you, John Smith. How can I help you today?"

**User**: "What's the status of my recent claim?"

**Agent** → Calls `getClaimStatus("claimant_001")`

```json
{
  "found": true,
  "claimNumber": "OBS-A1B2-C3D4",
  "status": "review",
  "coverageType": "property",
  "incidentDate": "2024-01-15"
}
```

**Agent**: "Your claim OBS-A1B2-C3D4 for property coverage is currently under review. The incident occurred on January 15, 2024. Is there anything else I can help you with?"

**User**: "No, that's all. Thank you."

**Agent** → Calls `endCall("completed", "Customer inquired about claim status")`

**Agent**: "Thank you for calling Observe Insurance. Have a great day!"

---

### Example 2: Policy Question (Knowledge Base)

**User**: "What's covered under flood insurance?"

**Agent** → Calls `searchKnowledgeBase("flood insurance coverage")`

```json
{
  "found": true,
  "content": "Flood insurance covers direct physical loss to your property caused by flooding, including structural damage..."
}
```

**Agent**: "Based on our documentation: Flood insurance covers direct physical loss to your property caused by flooding, including structural damage, foundation issues, and damaged electrical systems. Would you like more specific information?"

---

### Example 3: Escalation Path

**User**: "This is too complicated. I need to speak to a person."

**Agent**: "I understand. Let me transfer you to one of our specialists who can help you further."

**Agent** → Calls `endCall("escalate", "Customer requested human agent")`

**Agent**: "Transferring you to a specialist now. Please hold."

## State Management

The agent maintains conversation context through Vapi's built-in memory:

1. **Customer Verified**: Stores `customerId`, `firstName`, `lastName`
2. **Active Claim**: Remembers current claim being discussed
3. **Conversation History**: Full transcript available to LLM

## Error Handling

### Tool Fails to Return Data

```typescript
{
  "verified": false,
  "message": "I couldn't find an account with that number..."
}
```

**Agent**: "I apologize, but I couldn't find an account associated with that phone number. Could you please verify the number or provide an alternative form of identification?"

### Database Connection Issue

```typescript
{
  "error": true,
  "message": "I'm having trouble accessing our system right now..."
}
```

**Agent**: "I'm experiencing a technical issue accessing our system. Let me connect you with an agent who can help you right away."

→ Automatically calls `endCall("escalate")`

## Testing Checklist

- [ ] Phone number verification works
- [ ] Customer can inquire about claim status
- [ ] Knowledge base returns relevant articles
- [ ] Escalation to human agent works
- [ ] Call ending message plays correctly
- [ ] Multiple claims per customer handled
- [ ] Invalid phone numbers handled gracefully
- [ ] Network errors trigger escalation
- [ ] Conversation context maintained across turns
- [ ] Agent handles interruptions naturally

## Metrics to Monitor

1. **Call Duration**: Average 2-3 minutes
2. **Resolution Rate**: % of calls resolved without escalation
3. **Tool Call Success**: % of successful tool executions
4. **Customer Satisfaction**: Post-call surveys
5. **Escalation Rate**: Target <20%
