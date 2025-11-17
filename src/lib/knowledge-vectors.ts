import OpenAI from 'openai'
import { Index } from '@upstash/vector'

const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small'

let cachedOpenAI: OpenAI | null = null
let cachedKnowledgeIndex: Index | null = null

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function getEmbeddingModel(): string {
  return process.env.OPENAI_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL
}

function getOpenAIClient(): OpenAI {
  if (!cachedOpenAI) {
    const apiKey = requireEnv('OPENAI_API_KEY')
    cachedOpenAI = new OpenAI({ apiKey })
  }

  return cachedOpenAI
}

function getKnowledgeIndex(): Index {
  if (!cachedKnowledgeIndex) {
    const url = requireEnv('UPSTASH_VECTOR_KNOWLEDGE_REST_URL')
    const token = requireEnv('UPSTASH_VECTOR_KNOWLEDGE_REST_TOKEN')

    cachedKnowledgeIndex = new Index({ url, token })
  }

  return cachedKnowledgeIndex
}

export function lexicalToPlainText(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return ''
  }

  if (Array.isArray(value)) {
    return flattenLexicalNodes(value)
  }

  if ('root' in (value as Record<string, unknown>)) {
    const root = (value as { root?: { children?: unknown[] } }).root
    if (root?.children) {
      return flattenLexicalNodes(root.children)
    }
  }

  return ''
}

function flattenLexicalNodes(nodes: unknown[], depth = 0): string {
  const parts: string[] = []

  for (const node of nodes) {
    if (!node || typeof node !== 'object') {
      continue
    }

    const lexicalNode = node as {
      text?: string
      type?: string
      children?: unknown[]
    }

    if (typeof lexicalNode.text === 'string') {
      parts.push(lexicalNode.text)
    }

    if (lexicalNode.type === 'linebreak') {
      parts.push('\n')
    }

    if (lexicalNode.children?.length) {
      const childText = flattenLexicalNodes(lexicalNode.children, depth + 1)
      if (childText) {
        parts.push(childText)
      }
    }

    if (lexicalNode.type === 'paragraph' || lexicalNode.type === 'heading') {
      parts.push('\n\n')
    }
  }

  return parts
    .join(' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export function chunkText(
  text: string,
  {
    chunkSize = 1400,
    chunkOverlap = 200,
    maxChunks = 24,
  }: { chunkSize?: number; chunkOverlap?: number; maxChunks?: number } = {},
): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim()

  if (!normalized) {
    return []
  }

  if (normalized.length <= chunkSize) {
    return [normalized]
  }

  const chunks: string[] = []
  let start = 0

  while (start < normalized.length && chunks.length < maxChunks) {
    const tentativeEnd = Math.min(start + chunkSize, normalized.length)
    let end = tentativeEnd

    if (tentativeEnd < normalized.length) {
      const window = normalized.slice(start, tentativeEnd)

      const lastParagraphBreak = window.lastIndexOf('\n\n')
      if (lastParagraphBreak > chunkSize * 0.4) {
        end = start + lastParagraphBreak
      } else {
        const lastSentenceBreak = window.lastIndexOf('. ')
        if (lastSentenceBreak > chunkSize * 0.4) {
          end = start + lastSentenceBreak + 1
        }
      }
    }

    const chunk = normalized.slice(start, end).trim()
    if (chunk) {
      chunks.push(chunk)
    }

    if (end >= normalized.length) {
      break
    }

    start = Math.max(end - chunkOverlap, start + 1)
  }

  if (!chunks.length) {
    chunks.push(normalized.slice(0, chunkSize))
  }

  return chunks
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error('Cannot generate embedding for empty text')
  }

  const openai = getOpenAIClient()
  const response = await openai.embeddings.create({
    model: getEmbeddingModel(),
    input: trimmed,
  })

  const vector = response.data[0]?.embedding

  if (!vector) {
    throw new Error('OpenAI did not return an embedding vector')
  }

  return vector
}

type KnowledgeVectorMetadata = Record<string, unknown>

export async function deleteKnowledgeVectors(ids: string[]): Promise<void> {
  if (!ids.length) {
    return
  }

  const index = getKnowledgeIndex()
  await Promise.all(ids.map((id) => index.delete(id)))
}

export async function syncKnowledgeArticleVectors({
  articleId,
  text,
  metadata = {},
  previousChunkIds = [],
}: {
  articleId: string
  text: string
  metadata?: KnowledgeVectorMetadata
  previousChunkIds?: string[]
}): Promise<{ chunkIds: string[] }> {
  const chunks = chunkText(text)
  const index = getKnowledgeIndex()

  if (!chunks.length) {
    if (previousChunkIds.length) {
      await deleteKnowledgeVectors(previousChunkIds)
    }

    return { chunkIds: [] }
  }

  const chunkIds: string[] = []

  for (const [chunkIndex, chunk] of chunks.entries()) {
    const embedding = await generateEmbedding(chunk)
    const chunkId = `${articleId}#${chunkIndex}`

    await index.upsert({
      id: chunkId,
      vector: embedding,
      metadata: {
        ...metadata,
        articleId,
        chunkIndex,
        text: chunk,
      },
    })

    chunkIds.push(chunkId)
  }

  const obsoleteIds = previousChunkIds.filter((id) => !chunkIds.includes(id))
  if (obsoleteIds.length) {
    await deleteKnowledgeVectors(obsoleteIds)
  }

  return { chunkIds }
}
