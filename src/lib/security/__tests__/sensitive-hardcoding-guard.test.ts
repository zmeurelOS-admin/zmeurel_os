import { describe, expect, it } from 'vitest'

import { scanFileContent } from '../../../../scripts/sensitive-hardcoding-guard.mjs'

describe('sensitive hardcoding guard', () => {
  it('permite configurarea prin env pentru user ids protejați', () => {
    const findings = scanFileContent({
      filePath: 'src/lib/auth/protected-account.ts',
      content: `const raw = process.env.ACCOUNT_DELETE_PROTECTED_USER_IDS\nreturn parseUserIdAllowlist(raw)`,
    })

    expect(findings).toEqual([])
  })

  it('blochează comparațiile directe pe email hardcodat', () => {
    const findings = scanFileContent({
      filePath: 'supabase/migrations/20260411001_bad_policy.sql',
      content: `create policy test on demo using (user_email = 'person@gmail.com');`,
    })

    expect(findings.map((item) => item.rule)).toContain('hardcoded-email-check')
  })

  it('ignoră emailurile fake de test', () => {
    const findings = scanFileContent({
      filePath: 'src/app/api/demo/route.ts',
      content: `const fallbackEmail = 'owner@example.test'`,
    })

    expect(findings).toEqual([])
  })

  it('blochează allowlisturile inline fragile', () => {
    const findings = scanFileContent({
      filePath: 'src/lib/auth/admin.ts',
      content: `const protectedUserIds = ['550e8400-e29b-41d4-a716-446655440000']`,
    })

    expect(findings.map((item) => item.rule)).toContain('inline-id-allowlist')
  })

  it('blochează secretele literale evidente', () => {
    const findings = scanFileContent({
      filePath: '.github/workflows/deploy.yml',
      content: `RESEND_API_KEY: sk-1234567890abcdefghijklmnop`,
    })

    expect(findings.map((item) => item.rule)).toContain('literal-env-secret')
  })

  it('blochează folosirea service role key în cod client', () => {
    const findings = scanFileContent({
      filePath: 'src/components/admin/SecretsPanel.tsx',
      content: `'use client'\nconst key = process.env.SUPABASE_SERVICE_ROLE_KEY`,
    })

    expect(findings.map((item) => item.rule)).toContain('server-secret-in-client')
  })

  it('blochează numele publice de env care sugerează secrete', () => {
    const findings = scanFileContent({
      filePath: 'src/components/config.ts',
      content: `const secret = process.env.NEXT_PUBLIC_INTERNAL_SECRET`,
    })

    expect(findings.map((item) => item.rule)).toContain('public-secret-env-name')
  })
})
