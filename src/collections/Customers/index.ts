import crypto from 'node:crypto'

import type {
  CollectionBeforeValidateHook,
  CollectionConfig,
  CollectionSlug,
  FieldHook,
  PayloadRequest,
} from 'payload'

type HookArgs = Parameters<FieldHook>[0]

const POLICY_NUMBER_PREFIX = 'POL-'
const POLICY_SEGMENT_LENGTH = 4
const POLICY_SEPARATOR = '-'
const POLICY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const buildRandomSegment = (length: number) =>
  Array.from({ length }, () => POLICY_ALPHABET[crypto.randomInt(0, POLICY_ALPHABET.length)]).join('')

const buildPolicyNumber = () =>
  `${POLICY_NUMBER_PREFIX}${buildRandomSegment(POLICY_SEGMENT_LENGTH)}${POLICY_SEPARATOR}${buildRandomSegment(POLICY_SEGMENT_LENGTH)}`

const CUSTOMERS_SLUG = 'customers' as CollectionSlug

const generateUniquePolicyNumber = async (req: PayloadRequest) => {
  const maxAttempts = 6

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = buildPolicyNumber()

    if (!req.payload) {
      return candidate
    }

    try {
      const existing = await req.payload.find({
        collection: CUSTOMERS_SLUG,
        where: {
          policyNumber: {
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
      req.payload.logger?.warn?.({ error }, 'Unable to verify policy number uniqueness')
      return candidate
    }
  }

  throw new Error('Failed to generate a unique policy number after several attempts')
}

const normalizePhoneNumber = (raw: unknown): string | undefined => {
  if (typeof raw !== 'string') {
    return undefined
  }

  const trimmed = raw.trim()

  if (!trimmed) {
    return undefined
  }

  const digits = trimmed.replace(/\D+/g, '')

  if (!digits) {
    return undefined
  }

  if (trimmed.startsWith('+')) {
    return `+${digits}`
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }

  if (digits.length === 10) {
    return `+${digits}`
  }

  return `+${digits}`
}

// type-cast hook args because Payload's hook context is loosely typed
const normalizePhoneHook: FieldHook = ({ value }: HookArgs) =>
  normalizePhoneNumber(value) ?? undefined

const normalizeEmailHook: FieldHook = ({ value }: HookArgs) => {
  if (typeof value !== 'string') {
    return undefined
  }
  
  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }
  
  // Normalize to lowercase for case-insensitive matching
  return trimmed.toLowerCase()
}

const deriveFullNameHook: FieldHook = ({ siblingData, originalDoc, value }: HookArgs) => {
  const firstName =
    (typeof siblingData?.firstName === 'string' && siblingData.firstName.trim())
      ? siblingData.firstName
      : typeof originalDoc?.firstName === 'string'
        ? originalDoc.firstName
        : ''

  const lastName =
    (typeof siblingData?.lastName === 'string' && siblingData.lastName.trim())
      ? siblingData.lastName
      : typeof originalDoc?.lastName === 'string'
        ? originalDoc.lastName
        : ''

  if (!firstName && !lastName) {
    return value
  }

  return [firstName, lastName].filter(Boolean).join(' ')
}

const beforeValidate: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  req,
}) => {
  const nextData = { ...(data ?? {}) } as Record<string, unknown>
  const hasExistingPolicy = typeof originalDoc?.policyNumber === 'string' && originalDoc.policyNumber.trim().length > 0
  const hasIncomingPolicy = typeof nextData.policyNumber === 'string' && nextData.policyNumber.trim().length > 0

  if (!hasIncomingPolicy && !hasExistingPolicy) {
    try {
      nextData.policyNumber = await generateUniquePolicyNumber(req)
    }
    catch (error) {
      req.payload?.logger?.error?.({ error }, 'Unable to generate policy number')
    }
  }

  return nextData
}

export const Customers: CollectionConfig = {
  slug: 'customers',
  admin: {
    useAsTitle: 'fullName',
    description: 'Customers of the insurance company',
  },
    labels: {
    singular  : 'Customer',
    plural: 'Customers',
  },

  timestamps: true,
  hooks: {
    beforeValidate: [beforeValidate],
  },
  fields: [
    {
      name: 'fullName',
      type: 'text',
      admin: {
        readOnly: true,
      },
      label: 'Full Name',
      hooks: {
        beforeChange: [deriveFullNameHook],
      },
    },
    {
        type: 'row',
        fields: [
            {
                name: 'firstName',
                type: 'text',
                required: true,
                label: 'First Name',
            },
            {
                name: 'lastName',
                type: 'text',
                required: true,
                label: 'Last Name',
            },
        ]
    },

    {
        name: 'dob',
        type: 'date',
        label: 'Date of Birth',
        required: false,
        admin: {
            description: 'Date of birth of the customer',
            
        }
    },
    {
        name: 'email',
        type: 'text',
        label: 'Email',
        required: true,
        unique: true,
        admin: {
            description: 'Email of the customer',
        },
        hooks: {
          beforeValidate: [normalizeEmailHook],
        },
    },
    {
        name: 'phone',
        type: 'text',
        label: 'Phone number of the customer',
        required: false,
        unique: true,
        admin: {
            description: 'E.164 format preferred',
        },
        hooks: {
          beforeValidate: [normalizePhoneHook],
        },
    },
    {
        name: 'address',
        type: 'group',
        label: 'Mailing Address',
        required: false,
        admin: {
            description: 'Mailing address of the customer. For MVP, we assume all customers live in the US.',
        },
        fields: [
            {
                name: 'line1',
                type: 'text',
                required: true,
                label: 'Line 1',
            },
            {
                name: 'line2',
                type: 'text',
                required: false,
                label: 'Line 2',
            },
            {
                name: 'city',
                type: 'text',
                required: true,
                label: 'City',
            },
            {
                name: 'state',
                type: 'text',
                required: true,
                label: 'State',
            },
            {
                name: 'postalCode',
                type: 'text',
                required: true,
                label: 'Postal Code',
            },
        ]
    },
    {
        name: 'policyNumber',
        type: 'text',
        label: 'Policy Number',
        required: false,
        admin: {
            description: 'Policy number of the customer',
            readOnly: true,
        }
    },  
  ],
}
