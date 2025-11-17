import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
  },
  labels: {
    singular  : 'Claim Documentation',
    plural: 'Claims Documentation',
  },
  admin: {
    description: 'Evidence, forms, photos, PDFs',
   
  },
  fields: [
    {
      name: 'label',
      type: 'text',
      required: false,
    },
  ],
  upload: {
     mimeTypes: ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  }
}
