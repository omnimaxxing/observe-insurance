import type { CollectionConfig } from 'payload'

export const Conversations: CollectionConfig = {
  slug: 'conversations',
  labels: {
    singular: 'Conversation',
    plural: 'Conversations',
  },
  admin: {
    useAsTitle: 'conversationId',
    description: 'Call recordings and transcripts from ElevenLabs Conversational AI',
    defaultColumns: ['conversationId', 'customerName', 'duration', 'status', 'createdAt'],
  },
  timestamps: true,
  fields: [
    {
      name: 'conversationId',
      type: 'text',
      required: true,
      unique: true,
      label: 'Conversation ID',
      admin: {
        description: 'ElevenLabs conversation ID',
        readOnly: true,
      },
    },
    {
      name: 'agentId',
      type: 'text',
      required: true,
      label: 'Agent ID',
      admin: {
        description: 'ElevenLabs agent ID',
        readOnly: true,
      },
    },
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      label: 'Customer',
      admin: {
        description: 'Linked customer if identified during call',
      },
    },
    {
      name: 'customerName',
      type: 'text',
      label: 'Customer Name',
      admin: {
        description: 'Customer name from conversation (if not linked to customer record)',
      },
    },
    {
      name: 'customerPhone',
      type: 'text',
      label: 'Customer Phone',
      admin: {
        description: 'Phone number from Vonage',
      },
    },
    {
      name: 'callUuid',
      type: 'text',
      label: 'Call UUID',
      admin: {
        description: 'Vonage call UUID',
      },
    },
    {
      name: 'conversationUuid',
      type: 'text',
      label: 'Conversation UUID',
      admin: {
        description: 'Vonage conversation UUID',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'in_progress',
      label: 'Status',
      options: [
        { label: 'In Progress', value: 'in_progress' },
        { label: 'Completed', value: 'completed' },
        { label: 'Failed', value: 'failed' },
        { label: 'Disconnected', value: 'disconnected' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'duration',
      type: 'number',
      label: 'Duration (seconds)',
      admin: {
        description: 'Call duration in seconds',
        position: 'sidebar',
      },
    },
    {
      name: 'startTime',
      type: 'date',
      label: 'Start Time',
      admin: {
        date: {
          displayFormat: 'MMM dd yyyy, h:mm a',
        },
      },
    },
    {
      name: 'endTime',
      type: 'date',
      label: 'End Time',
      admin: {
        date: {
          displayFormat: 'MMM dd yyyy, h:mm a',
        },
      },
    },
    {
      name: 'transcript',
      type: 'array',
      label: 'Transcript',
      admin: {
        description: 'Full conversation transcript',
        initCollapsed: false,
      },
      fields: [
        {
          name: 'timestamp',
          type: 'date',
          label: 'Timestamp',
          admin: {
            date: {
              displayFormat: 'h:mm:ss a',
            },
          },
        },
        {
          name: 'speaker',
          type: 'select',
          required: true,
          options: [
            { label: 'User', value: 'user' },
            { label: 'Agent', value: 'agent' },
          ],
        },
        {
          name: 'text',
          type: 'textarea',
          required: true,
          label: 'Text',
        },
      ],
    },
    {
      name: 'summary',
      type: 'textarea',
      label: 'Conversation Summary',
      admin: {
        description: 'AI-generated summary of the conversation',
      },
    },
    {
      name: 'toolsCalled',
      type: 'array',
      label: 'Tools Called',
      admin: {
        description: 'List of tools/functions called during conversation',
        initCollapsed: true,
      },
      fields: [
        {
          name: 'toolName',
          type: 'text',
          required: true,
          label: 'Tool Name',
        },
        {
          name: 'timestamp',
          type: 'date',
          label: 'Timestamp',
        },
        {
          name: 'parameters',
          type: 'json',
          label: 'Parameters',
        },
        {
          name: 'result',
          type: 'json',
          label: 'Result',
        },
      ],
    },
    {
      name: 'metadata',
      type: 'group',
      label: 'Metadata',
      admin: {
        description: 'Additional conversation metadata',
      },
      fields: [
        {
          name: 'authenticated',
          type: 'checkbox',
          label: 'Customer Authenticated',
          defaultValue: false,
        },
        {
          name: 'verificationMethod',
          type: 'select',
          label: 'Verification Method',
          options: [
            { label: 'Phone', value: 'phone' },
            { label: 'Email', value: 'email' },
            { label: 'Name + DOB', value: 'name_dob' },
            { label: 'None', value: 'none' },
          ],
        },
        {
          name: 'claimsDiscussed',
          type: 'array',
          label: 'Claims Discussed',
          admin: {
            description: 'Claim numbers mentioned in conversation',
          },
          fields: [
            {
              name: 'claimNumber',
              type: 'text',
              label: 'Claim Number',
            },
          ],
        },
        {
          name: 'intent',
          type: 'select',
          label: 'Call Intent',
          options: [
            { label: 'Claim Status', value: 'claim_status' },
            { label: 'File Claim', value: 'file_claim' },
            { label: 'Upload Documents', value: 'upload_documents' },
            { label: 'General Inquiry', value: 'general_inquiry' },
            { label: 'Other', value: 'other' },
          ],
        },
        {
          name: 'sentiment',
          type: 'select',
          label: 'Customer Sentiment',
          options: [
            { label: 'Positive', value: 'positive' },
            { label: 'Neutral', value: 'neutral' },
            { label: 'Negative', value: 'negative' },
          ],
        },
      ],
    },
    {
      name: 'analytics',
      type: 'group',
      label: 'Analytics',
      admin: {
        description: 'Call analytics and metrics',
      },
      fields: [
        {
          name: 'totalMessages',
          type: 'number',
          label: 'Total Messages',
        },
        {
          name: 'userMessages',
          type: 'number',
          label: 'User Messages',
        },
        {
          name: 'agentMessages',
          type: 'number',
          label: 'Agent Messages',
        },
        {
          name: 'averageResponseTime',
          type: 'number',
          label: 'Avg Response Time (ms)',
        },
        {
          name: 'interruptionCount',
          type: 'number',
          label: 'Interruptions',
        },
      ],
    },
    {
      name: 'rawData',
      type: 'json',
      label: 'Raw Data',
      admin: {
        description: 'Raw webhook payload from ElevenLabs',
        readOnly: true,
      },
    },
  ],
}
