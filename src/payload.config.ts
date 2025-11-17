
import { vercelPostgresAdapter } from '@payloadcms/db-vercel-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import { searchPlugin } from '@payloadcms/plugin-search'
import { Claims } from '@/collections/Claims'
import { Conversations } from '@/collections/Conversations'
import { Customers } from '@/collections/Customers'
import { Media } from '@/collections/Media'
import { KnowledgeArticles } from '@/collections/Knowledge-Articles'
import { Users } from '@/collections/Users'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Customers, Claims, Conversations, KnowledgeArticles, Media],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: vercelPostgresAdapter({
    pool: {
      connectionString: process.env.POSTGRES_URL || '',
    },
  }),
  sharp,
  plugins: [
     vercelBlobStorage({
      enabled: true, // Optional, defaults to true
      // Specify which collections should use Vercel Blob
      collections: {
        media: true,
        
      },
      // Token provided by Vercel once Blob storage is added to your Vercel project
      token: process.env.BLOB_READ_WRITE_TOKEN,
    }),
    searchPlugin({
      collections: ['knowledge-articles'],
      defaultPriorities: {
        'knowledge-articles': 10,
      },
      searchOverrides: {
        slug: 'search',
        fields: ({ defaultFields }) => [
          ...defaultFields,
          {
            name: 'excerpt',
            type: 'textarea',
            admin: {
              description: 'Short excerpt for search results',
            },
          },
          {
            name: 'content',
            type: 'textarea',
            admin: {
              description: 'Full searchable content',
            },
          },
        ],
      },
      beforeSync: ({ originalDoc, searchDoc }) => {
        // Extract searchable content from the knowledge article
        const excerpt = originalDoc?.summary || ''
        const content = originalDoc?.plainTextOverride || originalDoc?.summary || ''
        
        return {
          ...searchDoc,
          excerpt,
          content,
        }
      },
      syncDrafts: false, // Don't sync draft articles
      deleteDrafts: true, // Remove drafts from search
    }),
    // storage-adapter-placeholder
  ],
})
