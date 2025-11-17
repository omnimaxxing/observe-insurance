import { lexicalEditor } from '@payloadcms/richtext-lexical'
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
  CollectionSlug,
  Payload,
} from 'payload'

import {
  deleteKnowledgeVectors,
  lexicalToPlainText,
  syncKnowledgeArticleVectors,
} from '../../lib/knowledge-vectors'

const SKIP_VECTOR_SYNC_FLAG = 'skipKnowledgeVectorSync'

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

    if (currentId && conflict.id === currentId) {
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

const extractChunkIds = (input: unknown): string[] => {
  if (!input || typeof input !== 'object') {
    return []
  }

  const maybeGroup = input as {
    vectorState?: {
      chunkIds?: unknown
    }
  }

  const rawChunkIds = maybeGroup.vectorState?.chunkIds

  if (!Array.isArray(rawChunkIds)) {
    return []
  }

  return rawChunkIds
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim())
}

const COLLECTION_SLUG = 'knowledge-articles'

const afterChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
}) => {
  req.context ??= {}

  if (req.context[SKIP_VECTOR_SYNC_FLAG]) {
    return doc
  }

  const vectorState = (doc.vectorState ?? {}) as {
    chunkIds?: unknown
    lastSyncedAt?: string | null
    syncError?: string | null
  }

  const existingChunkIds = extractChunkIds(doc)
  const previousChunkIds = extractChunkIds(previousDoc)

  const contentSource = resolveContentSource(doc.contentSource)

  const plainTextBody =
    typeof doc.plainTextOverride === 'string' && doc.plainTextOverride.trim().length > 0
      ? doc.plainTextOverride
      : undefined

  const primaryContent =
    contentSource === 'richText' ? lexicalToPlainText(doc.content) : plainTextBody ?? ''

  const textSourceCandidates = [
    typeof doc.title === 'string' ? doc.title : undefined,
    typeof doc.summary === 'string' ? doc.summary : undefined,
    primaryContent,
  ].filter((value): value is string => Boolean(value && value.trim().length > 0))

  const combinedText = textSourceCandidates.join('\n\n').trim()
  const metadataEntries = Object.entries({
    title: typeof doc.title === 'string' ? doc.title : undefined,
    slug: typeof doc.slug === 'string' ? doc.slug : undefined,
    status: typeof doc.status === 'string' ? doc.status : undefined,
    summary: typeof doc.summary === 'string' ? doc.summary : undefined,
    contentSource,
    sourceDocumentId: resolveRelationshipId(doc.sourceDocument),
  }).filter(([, value]) => value != null)

  const metadata = Object.fromEntries(metadataEntries)

  const nowIso = new Date().toISOString()

  let nextChunkIds = existingChunkIds
  let lastSyncedAt = vectorState.lastSyncedAt ?? null
  let syncError: string | null = null

  try {
    if (!combinedText) {
      if (previousChunkIds.length) {
        await deleteKnowledgeVectors(previousChunkIds)
      }

      nextChunkIds = []
      lastSyncedAt = nowIso
    }
    else {
      const { chunkIds } = await syncKnowledgeArticleVectors({
        articleId: doc.id,
        text: combinedText,
        metadata,
        previousChunkIds,
      })

      nextChunkIds = chunkIds
      lastSyncedAt = nowIso
    }
  }
  catch (error) {
    req.payload.logger?.error?.(
      {
        error,
        articleId: doc.id,
      },
      'Failed to synchronize knowledge article embeddings',
    )

    syncError = error instanceof Error ? error.message : 'Failed to synchronize knowledge article embeddings'
  }

  const chunkIdsChanged =
    nextChunkIds.length !== existingChunkIds.length ||
    nextChunkIds.some((value, index) => value !== existingChunkIds[index])

  if (!chunkIdsChanged && lastSyncedAt === vectorState.lastSyncedAt && syncError === vectorState.syncError) {
    return doc
  }

  req.context[SKIP_VECTOR_SYNC_FLAG] = true

  try {
    await req.payload.update({
      collection: COLLECTION_SLUG as unknown as CollectionSlug,
      id: doc.id,
      data: {
        vectorState: {
          chunkIds: nextChunkIds,
          lastSyncedAt,
          syncError,
        },
      } as any,
      depth: 0,
      overrideAccess: true,
    })
  }
  finally {
    delete req.context[SKIP_VECTOR_SYNC_FLAG]
  }

  return doc
}

const afterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const chunkIds = extractChunkIds(doc)

  if (!chunkIds.length) {
    return doc
  }

  try {
    await deleteKnowledgeVectors(chunkIds)
  }
  catch (error) {
    req.payload.logger?.error?.(
      {
        error,
        articleId: doc?.id,
      },
      'Failed to delete knowledge article vectors',
    )
  }

  return doc
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
    afterChange: [afterChange],
    afterDelete: [afterDelete],
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
    {
      name: 'vectorState',
      type: 'group',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
      fields: [
        {
          name: 'chunkIds',
          type: 'json',
          admin: {
            readOnly: true,
            description: 'Upstash vector chunk identifiers.',
          },
        },
        {
          name: 'lastSyncedAt',
          type: 'date',
          admin: {
            readOnly: true,
            description: 'Most recent successful embedding sync.',
          },
        },
        {
          name: 'syncError',
          type: 'textarea',
          admin: {
            readOnly: true,
            description: 'Latest synchronization error, if any.',
          },
        },
      ],
    },
  ],
}
