import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export const GOOGLE_TOKEN_ENCRYPTION_ENV = 'GOOGLE_TOKENS_ENCRYPTION_KEY'
const TOKEN_ENCRYPTION_VERSION = 'enc:v1'
const TOKEN_ENCRYPTION_ALGORITHM = 'aes-256-gcm'
const IV_LENGTH_BYTES = 12
const AUTH_TAG_LENGTH_BYTES = 16

export type DecodedTokenSecret =
  | { format: 'empty'; value: null }
  | { format: 'legacy'; value: string }
  | { format: 'encrypted'; value: string }

export class TokenEncryptionConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TokenEncryptionConfigError'
  }
}

export class TokenEncryptionPayloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TokenEncryptionPayloadError'
  }
}

function toBase64Url(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function fromBase64Url(value: string): Buffer {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`
  return Buffer.from(padded, 'base64')
}

function resolveEncryptionKey(): Buffer {
  const raw = process.env[GOOGLE_TOKEN_ENCRYPTION_ENV]?.trim()
  if (!raw) {
    throw new TokenEncryptionConfigError(
      `Lipsește variabila ${GOOGLE_TOKEN_ENCRYPTION_ENV} pentru criptarea tokenurilor Google.`,
    )
  }

  const base64Candidate = raw.startsWith('base64:') ? raw.slice('base64:'.length) : raw
  const base64Key = Buffer.from(base64Candidate, 'base64')
  if (base64Key.length === 32) {
    return base64Key
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex')
  }

  throw new TokenEncryptionConfigError(
    `${GOOGLE_TOKEN_ENCRYPTION_ENV} invalidă. Folosește o cheie de 32 bytes în format base64 (sau hex de 64 caractere).`,
  )
}

export function isEncryptedTokenSecret(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(`${TOKEN_ENCRYPTION_VERSION}.`)
}

export function encryptTokenSecret(plainValue: string): string {
  if (!plainValue) return plainValue

  const key = resolveEncryptionKey()
  const iv = randomBytes(IV_LENGTH_BYTES)
  const cipher = createCipheriv(TOKEN_ENCRYPTION_ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plainValue, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${TOKEN_ENCRYPTION_VERSION}.${toBase64Url(iv)}.${toBase64Url(authTag)}.${toBase64Url(encrypted)}`
}

export function decryptTokenSecret(encryptedValue: string): string {
  if (!isEncryptedTokenSecret(encryptedValue)) {
    throw new TokenEncryptionPayloadError('Format token criptat necunoscut.')
  }

  const key = resolveEncryptionKey()
  const [, ivPart, tagPart, payloadPart, extra] = encryptedValue.split('.')
  if (!ivPart || !tagPart || !payloadPart || extra) {
    throw new TokenEncryptionPayloadError('Payload token criptat invalid.')
  }

  try {
    const iv = fromBase64Url(ivPart)
    const authTag = fromBase64Url(tagPart)
    const payload = fromBase64Url(payloadPart)

    if (iv.length !== IV_LENGTH_BYTES || authTag.length !== AUTH_TAG_LENGTH_BYTES) {
      throw new TokenEncryptionPayloadError('Payload token criptat invalid.')
    }

    const decipher = createDecipheriv(TOKEN_ENCRYPTION_ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    const decrypted = Buffer.concat([decipher.update(payload), decipher.final()])
    return decrypted.toString('utf8')
  } catch (error) {
    if (error instanceof TokenEncryptionPayloadError) {
      throw error
    }
    throw new TokenEncryptionPayloadError('Nu am putut decripta tokenul Google.')
  }
}

export function decodeTokenSecret(value: string | null | undefined): DecodedTokenSecret {
  if (!value) {
    return { format: 'empty', value: null }
  }

  if (isEncryptedTokenSecret(value)) {
    return {
      format: 'encrypted',
      value: decryptTokenSecret(value),
    }
  }

  return { format: 'legacy', value }
}
