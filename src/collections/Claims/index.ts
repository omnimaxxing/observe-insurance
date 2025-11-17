import crypto from 'node:crypto'

import { groq } from '@ai-sdk/groq'
import { generateText } from 'ai'
import type {
  CollectionAfterChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
  CollectionSlug,
  PayloadRequest,
} from 'payload'

const CLAIM_NUMBER_PREFIX = 'OBS-'
const CLAIM_SEGMENT_LENGTH = 4
const CLAIM_NUMBER_SEPARATOR = '-'
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const CLAIMS_SLUG = 'claims' as CollectionSlug
const CUSTOMERS_SLUG = 'customers' as CollectionSlug
const MEDIA_SLUG = 'media' as CollectionSlug
const SKIP_SUMMARY_FLAG = 'skipClaimSummaryRegeneration'
const SUMMARY_NOTE_TITLE = 'Automated Summary'
const SUMMARY_NOTE_SOURCE = 'system'

const buildRandomSegment = (length: number) =>
  Array.from({ length }, () => ALPHABET[crypto.randomInt(0, ALPHABET.length)]).join('')

const buildClaimNumber = () =>
  `${CLAIM_NUMBER_PREFIX}${buildRandomSegment(CLAIM_SEGMENT_LENGTH)}${CLAIM_NUMBER_SEPARATOR}${buildRandomSegment(CLAIM_SEGMENT_LENGTH)}`

const generateUniqueClaimNumber = async (req: PayloadRequest) => {
  const maxAttempts = 6

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = buildClaimNumber()

    if (!req.payload) {
      return candidate
    }

    try {
      const existing = await req.payload.find({
        collection: CLAIMS_SLUG,
        where: {
          claimNumber: {
            equals: candidate,
          },
        },
        limit: 1,
        depth: 0,
      })

      if (existing.docs.length === 0) {
        return candidate
      }
    }
    catch (error) {
      req.payload.logger?.warn?.(
        { error },
        'Unable to verify claim number uniqueness',
      )
      return candidate
    }
  }

  throw new Error('Failed to generate a unique claim number after several attempts')
}

const resolveRelationshipId = (value: unknown) => {
  if (!value) {
    return undefined
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>

    if (typeof record.id === 'string') {
      return record.id
    }
  }

  return undefined
}

const generateClaimDescription = async ({
  req,
  data,
  customer,
}: {
  req: PayloadRequest
  data: Record<string, unknown>
  customer?: Record<string, unknown>
}) => {
  if (!process.env.GROQ_API_KEY) {
    req.payload?.logger?.warn?.(
      'GROQ_API_KEY is not configured; skipping automated claim description generation',
    )
    return undefined
  }

  const preparedPayload = {
    claimNumber: data.claimNumber,
    status: data.status,
    coverageType: data.coverageType,
    incidentDate: data.incidentDate,
    amount: data.amount,
    lossLocation: data.lossLocation,
    additionalDetails: data.additionalDetails,
    customer: customer
      ? {
          id: customer.id,
          name: customer.fullName ?? customer.firstName ?? customer.lastName,
          email: customer.email,
          phone: customer.phone,
          policyNumber: customer.policyNumber,
        }
      : undefined,
  }

  try {
    const { text } = await generateText({
      model: groq('meta-llama/llama-4-maverick-17b-128e-instruct'),
      system:
        'You are an insurance operations assistant for Observe Insurance. Produce a concise 2-3 sentence case summary suitable for internal claim files. Write plain text only.',
      prompt: `Summarize this claim information:
${JSON.stringify(preparedPayload, null, 2)}`,
    })

    return text.trim() || undefined
  }
  catch (error) {
    req.payload?.logger?.error?.(
      { error },
      'Failed to generate claim description with Groq',
    )
    return undefined
  }
}

type CaseNote = {
  title?: string
  body?: string
  source?: string
  createdAt?: string
  [key: string]: unknown
}

type CustomerDocument = Record<string, unknown>

const ensureCaseNoteTimestamps = (notes: unknown[]): CaseNote[] => {
  const now = new Date().toISOString()

  return notes.map((note) => {
    if (!note || typeof note !== 'object') {
      return {
        title: 'Untitled Note',
        body: typeof note === 'string' ? note : '',
        source: 'system',
        createdAt: now,
      }
    }

    const record = note as CaseNote

    return {
      ...record,
      createdAt:
        typeof record.createdAt === 'string' && record.createdAt.trim().length > 0
          ? record.createdAt
          : now,
    }
  })
}

const beforeValidate: CollectionBeforeValidateHook = async (args) => {
  const { data, originalDoc, req, operation } = args
  const nextData = { ...(data ?? {}) } as Record<string, unknown>

  if (operation === 'create' && !nextData.claimNumber) {
    try {
      nextData.claimNumber = await generateUniqueClaimNumber(req)
    }
    catch (error) {
      req.payload?.logger?.error?.({ error }, 'Unable to generate claim number')
    }
  }

  const customerId = resolveRelationshipId(
    nextData.customer ?? originalDoc?.customer,
  )

  let customerRecord: CustomerDocument | undefined

  if (customerId && req.payload) {
    try {
      const customerLookup = (await req.payload.findByID({
        collection: CUSTOMERS_SLUG,
        id: customerId,
      })) as unknown

      if (customerLookup && typeof customerLookup === 'object') {
        customerRecord = customerLookup as CustomerDocument
      }
    }
    catch (error) {
      req.payload.logger?.warn?.({ error }, 'Unable to look up customer for claim description')
    }
  }

  let caseNotes: CaseNote[] | undefined

  if (Array.isArray(nextData.caseNotes)) {
    caseNotes = ensureCaseNoteTimestamps(nextData.caseNotes as unknown[])
  }

  if (caseNotes) {
    nextData.caseNotes = caseNotes
  }

  return nextData
}

const isEqual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

const shouldRegenerateSummary = (doc: Record<string, unknown>, previousDoc?: Record<string, unknown>) => {
  if (!previousDoc) {
    return true
  }

  if (typeof doc.description !== 'string' || doc.description.trim().length === 0) {
    return true
  }

  const trackedFields: Array<keyof typeof doc> = [
    'status',
    'coverageType',
    'incidentDate',
    'amount',
    'additionalDetails',
  ]

  if (trackedFields.some((field) => !isEqual(doc[field], previousDoc[field]))) {
    return true
  }

  if (!isEqual(doc.lossLocation, previousDoc.lossLocation)) {
    return true
  }

  if (!isEqual(doc.caseNotes, previousDoc.caseNotes)) {
    return true
  }

  const nextCustomer = resolveRelationshipId(doc.customer)
  const previousCustomer = resolveRelationshipId(previousDoc.customer)

  if (nextCustomer !== previousCustomer) {
    return true
  }

  return false
}

const prepareSummaryCaseNotes = (existing: unknown[] | undefined, summary: string): CaseNote[] => {
  const notes = (Array.isArray(existing) ? existing : []).map((note) =>
    note && typeof note === 'object' ? { ...(note as Record<string, unknown>) } : note,
  )

  let summaryInserted = false

  const updated = notes.map((note) => {
    if (!note || typeof note !== 'object') {
      return note
    }

    const record = note as Record<string, unknown>

    if (
      record.source === SUMMARY_NOTE_SOURCE &&
      record.title === SUMMARY_NOTE_TITLE
    ) {
      summaryInserted = true
      return {
        ...record,
        body: summary,
      }
    }

    return record
  })

  if (!summaryInserted) {
    updated.unshift({
      title: SUMMARY_NOTE_TITLE,
      body: summary,
      source: SUMMARY_NOTE_SOURCE,
    })
  }

  return ensureCaseNoteTimestamps(updated)
}

const scheduleSummaryRegeneration = ({
  doc,
  req,
}: {
  doc: Record<string, unknown>
  req: PayloadRequest
}) => {
  if (!req.payload) {
    return
  }

  void (async () => {
    try {
      const customerId = resolveRelationshipId(doc.customer)
      let customerRecord: CustomerDocument | undefined

      if (customerId) {
        try {
          const lookup = (await req.payload!.findByID({
            collection: CUSTOMERS_SLUG,
            id: customerId,
          })) as unknown

          if (lookup && typeof lookup === 'object') {
            customerRecord = lookup as CustomerDocument
          }
        }
        catch (error) {
          req.payload?.logger?.warn?.(
            { error, claimId: doc.id },
            'Unable to look up customer while regenerating claim summary',
          )
        }
      }

      const summary = await generateClaimDescription({
        req,
        data: doc,
        customer: customerRecord,
      })

      if (!summary) {
        return
      }

      const caseNotes = prepareSummaryCaseNotes(doc.caseNotes as unknown[] | undefined, summary)

      req.context ??= {}
      req.context[SKIP_SUMMARY_FLAG] = true

      try {
        await req.payload.update({
          collection: CLAIMS_SLUG,
          id: doc.id as string,
          data: {
            description: summary,
            caseNotes,
          } as Record<string, unknown>,
          depth: 0,
          overrideAccess: true,
        })
      }
      finally {
        delete req.context[SKIP_SUMMARY_FLAG]
      }
    }
    catch (error) {
      req.payload?.logger?.error?.(
        { error, claimId: doc.id },
        'Failed to regenerate claim summary',
      )
    }
  })()
}

const afterChange: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  req.context ??= {}

  if (req.context[SKIP_SUMMARY_FLAG]) {
    return doc
  }

  const nextDoc = (doc ?? {}) as Record<string, unknown>
  const priorDoc = previousDoc ? (previousDoc as Record<string, unknown>) : undefined

  if (!shouldRegenerateSummary(nextDoc, priorDoc)) {
    return doc
  }

  scheduleSummaryRegeneration({ doc: nextDoc, req })

  return doc
}

export const Claims: CollectionConfig = {
  slug: 'claims',
  labels: {
    singular: 'Claim',
    plural: 'Claims',
  },
  admin: {
    useAsTitle: 'claimNumber',
    description: 'Track insurance claims for Observe Insurance customers.',
    defaultColumns: ['claimNumber', 'status', 'incidentDate', 'amount'],
  },
  timestamps: true,
  hooks: {
    beforeValidate: [beforeValidate],
    afterChange: [afterChange],
  },
  fields: [
    {
      name: 'claimNumber',
      type: 'text',
      required: true,
      unique: true,
      label: 'Claim Number',
      admin: {
        readOnly: true,
        description: 'Automatically generated OBS reference number.',
      },
    },
    {
      name: 'customer',
      type: 'relationship',
      required: true,
      relationTo: CUSTOMERS_SLUG,
      label: 'Customer',
      admin: {
        description: 'Customer associated with this claim.',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      label: 'Status',
      defaultValue: 'pending',
      admin: {
        description: 'Lifecycle status of the claim.',
        position: 'sidebar',
      },
      options: [
        { label: 'Pending Intake', value: 'pending' },
        { label: 'Needs Documentation', value: 'documentation' },
        { label: 'Under Review', value: 'review' },
        { label: 'Approved', value: 'approved' },
        { label: 'Denied', value: 'denied' },
        { label: 'Completed', value: 'completed' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'incidentDate',
          type: 'date',
          label: 'Incident Date',
          admin: {
            description: 'Date of loss or incident if known.',
          },
        },
        {
          name: 'amount',
          type: 'number',
          label: 'Estimated Amount (USD)',
          admin: {
            description: 'Estimated claim amount in USD.',
          },
        },
      ],
    },
    {
      name: 'coverageType',
      type: 'select',
      label: 'Coverage Type',
      options: [
        { label: 'Property', value: 'property' },
        { label: 'Liability', value: 'liability' },
        { label: 'Flood', value: 'flood' },
        { label: 'Fire', value: 'fire' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'lossLocation',
      type: 'group',
      label: 'Loss Location',
      admin: {
        description: 'Location details for the incident.',
      },
      fields: [
        {
          name: 'addressLine1',
          type: 'text',
          label: 'Address Line 1',
        },
        {
          name: 'addressLine2',
          type: 'text',
          label: 'Address Line 2',
        },
        {
          name: 'city',
          type: 'text',
          label: 'City',
        },
        {
          name: 'state',
          type: 'text',
          label: 'State',
        },
        {
          name: 'postalCode',
          type: 'text',
          label: 'Postal Code',
        },
      ],
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Claim Description',
      admin: {
        description: 'Automatically generated summary kept in sync with claim details.',
        readOnly: true,
      },
    },
    {
      name: 'additionalDetails',
      type: 'textarea',
      label: 'Additional Details',
      admin: {
        description: 'Free-form notes captured during intake.',
      },
    },
    {
      name: 'attachments',
      type: 'array',
      label: 'Supporting Documents',
      admin: {
        description: 'Files and evidence uploaded for the claim.',
        initCollapsed: true,
      },
      fields: [
        {
          name: 'file',
          type: 'upload',
          relationTo: MEDIA_SLUG,
          required: true,
          label: 'File',
        },
        {
          name: 'description',
          type: 'text',
          label: 'Description',
        },
      ],
    },
    {
      name: 'caseNotes',
      type: 'array',
      label: 'Case Notes',
      admin: {
        description: 'Chronological notes about claim handling.',
        initCollapsed: true,
      },
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
          label: 'Title',
        },
        {
          name: 'body',
          type: 'textarea',
          required: true,
          label: 'Details',
        },
        {
          name: 'source',
          type: 'select',
          required: true,
          defaultValue: 'agent',
          options: [
            { label: 'Agent Entered', value: 'agent' },
            { label: 'System Generated', value: 'system' },
            { label: 'Customer Provided', value: 'customer' },
          ],
        },
        {
          name: 'createdAt',
          type: 'date',
          label: 'Created At',
          admin: {
            readOnly: true,
          },
        },
      ],
    },
  ],
}
