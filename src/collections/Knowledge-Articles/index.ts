import { lexicalEditor } from '@payloadcms/richtext-lexical'
import type {
  CollectionBeforeValidateHook,
  CollectionConfig,
  CollectionSlug,
  Payload,
} from 'payload'

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

type ContentSource = 'richText' | 'plainText' | 'document'

const CONTENT_SOURCE_OPTIONS: Array<{ label: string; value: ContentSource }> = [
  { label: 'Rich text editor', value: 'richText' },
  { label: 'Plain text', value: 'plainText' },
  { label: 'Document with supporting file', value: 'document' },
]

const DEFAULT_CONTENT_SOURCE: ContentSource = 'richText'

const isContentSource = (value: unknown): value is ContentSource =>
  typeof value === 'string' && CONTENT_SOURCE_OPTIONS.some((option) => option.value === value)

const resolveContentSource = (value: unknown): ContentSource =>
  isContentSource(value) ? value : DEFAULT_CONTENT_SOURCE

const getSiblingContentSource = (siblingData: unknown): ContentSource => {
  if (!siblingData || typeof siblingData !== 'object') {
    return DEFAULT_CONTENT_SOURCE
  }

  const record = siblingData as { contentSource?: unknown }
  return resolveContentSource(record.contentSource)
}

const resolveRelationshipId = (value: unknown): string | undefined => {
  if (!value) {
    return undefined
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'object') {
    const record = value as { id?: unknown }

    if (typeof record.id === 'string') {
      return record.id
    }
  }

  return undefined
}

const ensureUniqueSlug = async ({
  payload,
  slug,
  currentId,
}: {
  payload: Payload
  slug: string
  currentId?: string
}): Promise<string> => {
  const baseSlug = slug
  const maxAttempts = 25

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`

    const { docs } = await payload.find({
      collection: COLLECTION_SLUG as unknown as CollectionSlug,
      where: {
        slug: {
          equals: candidate,
        },
      },
      limit: 1,
      depth: 0,
    })

    const conflict = docs[0]

    if (!conflict) {
      return candidate
    }

    if (currentId && String(conflict.id) === currentId) {
      return candidate
    }
  }

  const randomSuffix = Math.random().toString(36).slice(2, 8)
  return `${baseSlug}-${randomSuffix}`
}

const beforeValidate: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  req,
  operation,
}) => {
  const nextData = { ...(data ?? {}) } as Record<string, unknown>

  const contentSource = resolveContentSource(nextData.contentSource ?? originalDoc?.contentSource)
  nextData.contentSource = contentSource

  const rawTitle = typeof nextData.title === 'string' ? nextData.title : undefined
  const fallbackTitle = typeof originalDoc?.title === 'string' ? originalDoc.title : undefined
  const titleForSlug = rawTitle ?? fallbackTitle ?? ''

  const existingId =
    typeof nextData.id === 'string'
      ? nextData.id
      : typeof originalDoc?.id === 'string'
        ? originalDoc.id
        : undefined

  const previousSlug =
    typeof originalDoc?.slug === 'string' && originalDoc.slug.trim().length > 0 ? originalDoc.slug : undefined

  let slugCandidate = slugify(
    typeof nextData.slug === 'string' && nextData.slug.trim().length > 0 ? nextData.slug : titleForSlug,
  )

  if (slugCandidate && req.payload && (operation === 'create' || slugCandidate !== previousSlug)) {
    slugCandidate = await ensureUniqueSlug({
      payload: req.payload,
      slug: slugCandidate,
      currentId: existingId,
    })
  }

  if (slugCandidate) {
    nextData.slug = slugCandidate
  }
  else {
    delete nextData.slug
  }

  return nextData
}

const COLLECTION_SLUG = 'knowledge-articles'

const lexicalToPlainText = (value: unknown): string => {
  if (!value || typeof value !== 'object') {
    return ''
  }

  const root = value as { root?: { children?: unknown[] } }
  if (!root.root?.children) {
    return ''
  }

  const extractText = (children: unknown[]): string => {
    return children
      .map((child: any) => {
        if (child.type === 'text') {
          return child.text || ''
        }
        if (child.children) {
          return extractText(child.children)
        }
        return ''
      })
      .join('')
  }

  return extractText(root.root.children)
}



export const KnowledgeArticles: CollectionConfig = {
  slug: 'knowledge-articles',
  labels: {
    singular: 'Knowledge Article',
    plural: 'Knowledge Articles',
  },
  admin: {
    useAsTitle: 'title',
    description: 'Knowledge base content powering FAQ responses.',
    defaultColumns: ['title', 'status', 'updatedAt'],
  },
  timestamps: true,
  hooks: {
    beforeValidate: [beforeValidate],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      required: true,
      admin: {
        description: 'URL-friendly slug used to reference this article.',
        readOnly: true,
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
        { label: 'Archived', value: 'archived' },
      ],
      admin: {
        description: 'Controls whether the article is available for assistants.',
      },
    },
    {
      name: 'summary',
      type: 'textarea',
      admin: {
        description: 'Short synopsis displayed in search results.',
      },
    },
    {
      name: 'contentSource',
      type: 'select',
      defaultValue: DEFAULT_CONTENT_SOURCE,
      options: CONTENT_SOURCE_OPTIONS,
      admin: {
        description: 'Choose how to provide the main article content.',
      },
    },
    {
      name: 'content',
      type: 'richText',
      required: false,
      editor: lexicalEditor({}),
      admin: {
        description: 'Primary knowledge base content. Supports headings, lists, and links.',
        condition: (_, siblingData) => getSiblingContentSource(siblingData) === 'richText',
      },
      validate: (value: unknown, { siblingData }: { siblingData?: unknown }) => {
        const source = getSiblingContentSource(siblingData)

        if (source !== 'richText') {
          return true
        }

        const text = lexicalToPlainText(value)

        if (!text || text.trim().length === 0) {
          return 'Rich text content is required when using the editor.'
        }

        return true
      },
    },
    {
      name: 'sourceDocument',
      type: 'relationship',
      relationTo: 'media',
      admin: {
        description: 'Upload a supporting PDF or document stored in Media.',
        condition: (_, siblingData) => getSiblingContentSource(siblingData) === 'document',
      },
      validate: (value: unknown, { siblingData }: { siblingData?: unknown }) => {
        const source = getSiblingContentSource(siblingData)

        if (source !== 'document') {
          return true
        }

        return resolveRelationshipId(value) ? true : 'A supporting document is required when using document source.'
      },
    },
    {
      name: 'plainTextOverride',
      type: 'textarea',
      label: 'Plain text content',
      admin: {
        description:
          'Plain text used for embeddings. Required for plain text or document sources.',
        condition: (_, siblingData) => {
          const source = getSiblingContentSource(siblingData)
          return source === 'plainText' || source === 'document'
        },
      },
      validate: (value: unknown, { siblingData }: { siblingData?: unknown }) => {
        const source = getSiblingContentSource(siblingData)

        if (source === 'plainText' || source === 'document') {
          if (typeof value === 'string' && value.trim().length > 0) {
            return true
          }

          return 'Provide the plain text content to index for this article.'
        }

        return true
      },
    },
    {
      name: 'tags',
      type: 'array',
      label: 'Tags',
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          name: 'value',
          type: 'text',
        },
      ],
    },
  ],
}
