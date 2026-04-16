/* @vitest-environment node */

import { randomBytes } from 'node:crypto'

import { afterEach, describe, expect, it } from 'vitest'

import {
  decodeTokenSecret,
  encryptTokenSecret,
  GOOGLE_TOKEN_ENCRYPTION_ENV,
  TokenEncryptionConfigError,
  TokenEncryptionPayloadError,
} from '@/lib/integrations/token-secret-crypto'

const originalKey = process.env[GOOGLE_TOKEN_ENCRYPTION_ENV]

function setRandomEncryptionKey() {
  process.env[GOOGLE_TOKEN_ENCRYPTION_ENV] = randomBytes(32).toString('base64')
}

afterEach(() => {
  if (originalKey === undefined) {
    delete process.env[GOOGLE_TOKEN_ENCRYPTION_ENV]
    return
  }
  process.env[GOOGLE_TOKEN_ENCRYPTION_ENV] = originalKey
})

describe('token-secret-crypto', () => {
  it('criptează și decriptează tokenul în format versionat', () => {
    setRandomEncryptionKey()

    const encrypted = encryptTokenSecret('tok_test_123')
    expect(encrypted.startsWith('enc:v1.')).toBe(true)
    expect(encrypted).not.toContain('tok_test_123')

    const decoded = decodeTokenSecret(encrypted)
    expect(decoded.format).toBe('encrypted')
    expect(decoded.value).toBe('tok_test_123')
  })

  it('păstrează compatibilitatea pentru token legacy plaintext', () => {
    delete process.env[GOOGLE_TOKEN_ENCRYPTION_ENV]

    const decoded = decodeTokenSecret('legacy_refresh_token_plain')
    expect(decoded.format).toBe('legacy')
    expect(decoded.value).toBe('legacy_refresh_token_plain')
  })

  it('aruncă eroare controlată când cheia lipsește la encrypt', () => {
    delete process.env[GOOGLE_TOKEN_ENCRYPTION_ENV]

    expect(() => encryptTokenSecret('token')).toThrow(TokenEncryptionConfigError)
  })

  it('aruncă eroare controlată când payload-ul criptat e invalid', () => {
    setRandomEncryptionKey()

    expect(() => decodeTokenSecret('enc:v1.invalid')).toThrow(TokenEncryptionPayloadError)
  })
})
