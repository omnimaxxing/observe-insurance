import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: {
     useAPIKey: true, 
  },
  fields: [
    // Email added by default
    // Add more fields as needed
    { name: 'displayName',
      type: 'text',
      required: false,
    },
    { name: 'role',
      type: 'select',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'AI Agent', value: 'ai-agent' },
        { label: 'Human Agent', value: 'human-agent' },
      ],
      admin: {
        description: 'Access role of the user',
      },
      required: true,
    },
  ],
}
