/**
 * dedupe-clienti-report.ts — FAZA 1 (dry-run, read-only)
 *
 * Găsește clienți duplicați în tabela `clienti` pentru un tenant, grupați
 * după telefonul normalizat (ultimele 9 cifre semnificative — prinde
 * variantele 0745xxxxxx / +40745xxxxxx / 0040745xxxxxx / 40745xxxxxx), și
 * raportează câte referințe (comenzi/vanzari/vanzari_butasi) are fiecare
 * înregistrare, ca să se poată alege manual recordul "principal".
 *
 * NU modifică nimic în baza de date.
 *
 * Run: npx tsx scripts/dedupe-clienti-report.ts [--tenant <uuid>]
 *
 * Output (în scripts/output/):
 *   clienti-dedupe-<timestamp>.md   — raport lizibil pentru revizuire manuală
 *   clienti-dedupe-<timestamp>.csv  — export tabelar
 *   clienti-dedupe-<timestamp>.json — input pentru Faza 2 (dedupe-clienti-merge.ts)
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { getSupabaseAdmin } from '../src/lib/supabase/admin'

const DEFAULT_TENANT_ID = '99485d6b-f186-49db-a379-bb9a12d34968'
const SIGNIFICANT_DIGITS = 9

type ClientRow = {
  id: string
  nume_client: string
  telefon: string | null
  created_at: string
  data_origin: string | null
  google_resource_name: string | null
}

type RefCounts = {
  comenzi: number
  vanzari: number
  vanzari_butasi: number
}

type ReportEntry = ClientRow & {
  refs: RefCounts
  totalRefs: number
}

type ReportGroup = {
  normalizedPhone: string
  members: ReportEntry[]
  recommendedPrincipalId: string
  caution: string | null
}

function parseTenantArg(): string {
  const args = process.argv.slice(2)
  const idx = args.indexOf('--tenant')
  if (idx !== -1 && args[idx + 1]) return args[idx + 1]
  return DEFAULT_TENANT_ID
}

/**
 * Normalizare "brută" pentru detectarea dublurilor: păstrează doar cifrele și
 * ia ultimele 9 — suficient să identifice unic un număr românesc indiferent
 * de prefixul folosit (0, +40, 0040, 40). Diferă intenționat de
 * `normalizePhone` din src/lib/utils/phone.ts (strict pe formatul
 * 07xxxxxxxx) — aici vrem să prindem cât mai multe variante malformate
 * provenite din sincronizarea Google.
 */
function canonicalizePhoneForDedupe(raw: string | null): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length < SIGNIFICANT_DIGITS) return null
  return digits.slice(-SIGNIFICANT_DIGITS)
}

function looksGeneric(nume: string): boolean {
  const lower = nume.trim().toLowerCase()
  return lower.includes('necunoscut') || /^client\b/.test(lower)
}

async function countReferences(
  admin: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  clientId: string,
): Promise<RefCounts> {
  const [comenzi, vanzari, vanzariButasi] = await Promise.all([
    admin
      .from('comenzi')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId),
    admin
      .from('vanzari')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId),
    admin
      .from('vanzari_butasi')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId),
  ])

  for (const [label, result] of [
    ['comenzi', comenzi],
    ['vanzari', vanzari],
    ['vanzari_butasi', vanzariButasi],
  ] as const) {
    if (result.error) {
      throw new Error(`Eroare la numărarea referințelor din ${label}: ${result.error.message}`)
    }
  }

  return {
    comenzi: comenzi.count ?? 0,
    vanzari: vanzari.count ?? 0,
    vanzari_butasi: vanzariButasi.count ?? 0,
  }
}

function pickPrincipal(members: ReportEntry[]): string {
  const sorted = [...members].sort((a, b) => {
    if (b.totalRefs !== a.totalRefs) return b.totalRefs - a.totalRefs
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
  return sorted[0].id
}

function toCsvValue(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value)
  return `"${raw.replace(/"/g, '""')}"`
}

function renderMarkdown(tenantId: string, groups: ReportGroup[], skippedNoPhone: number): string {
  const lines: string[] = []
  lines.push(`# Raport dedublare clienți — tenant ${tenantId}`)
  lines.push('')
  lines.push(`Generat: ${new Date().toISOString()}`)
  lines.push(`Grupuri de dubluri găsite: ${groups.length}`)
  lines.push(`Clienți fără telefon valid (excluși din grupare): ${skippedNoPhone}`)
  lines.push('')
  lines.push(
    '⚠️ Acest raport NU modifică nimic. Verifică manual fiecare grup — în special cele marcate ' +
      'cu avertisment — înainte de a rula Faza 2 (`dedupe-clienti-merge.ts`).',
  )
  lines.push('')

  for (const group of groups) {
    lines.push(`## Telefon normalizat: ${group.normalizedPhone}`)
    if (group.caution) {
      lines.push(`> ⚠️ ${group.caution}`)
    }
    lines.push('')
    lines.push(
      '| id | rol | nume_client | telefon original | created_at | data_origin | google_resource_name | comenzi | vanzari | vanzari_butasi | total refs |',
    )
    lines.push('|---|---|---|---|---|---|---|---|---|---|---|')
    for (const member of group.members) {
      const isPrincipal = member.id === group.recommendedPrincipalId
      lines.push(
        `| ${member.id} | ${isPrincipal ? '✅ principal (recomandat)' : 'orfan (candidat)'} | ${member.nume_client} | ${member.telefon ?? ''} | ${member.created_at} | ${member.data_origin ?? ''} | ${member.google_resource_name ?? ''} | ${member.refs.comenzi} | ${member.refs.vanzari} | ${member.refs.vanzari_butasi} | ${member.totalRefs} |`,
      )
    }
    lines.push('')
  }

  return lines.join('\n')
}

function renderCsv(groups: ReportGroup[]): string {
  const header = [
    'normalized_phone',
    'id',
    'is_recommended_principal',
    'nume_client',
    'telefon_original',
    'created_at',
    'data_origin',
    'google_resource_name',
    'comenzi',
    'vanzari',
    'vanzari_butasi',
    'total_refs',
    'caution',
  ]
  const rows = [header.join(',')]

  for (const group of groups) {
    for (const member of group.members) {
      rows.push(
        [
          group.normalizedPhone,
          member.id,
          member.id === group.recommendedPrincipalId ? 'yes' : 'no',
          member.nume_client,
          member.telefon ?? '',
          member.created_at,
          member.data_origin ?? '',
          member.google_resource_name ?? '',
          member.refs.comenzi,
          member.refs.vanzari,
          member.refs.vanzari_butasi,
          member.totalRefs,
          group.caution ?? '',
        ]
          .map(toCsvValue)
          .join(','),
      )
    }
  }

  return rows.join('\n')
}

async function main() {
  const tenantId = parseTenantArg()
  const admin = getSupabaseAdmin()

  console.log(`Citesc clienții tenantului ${tenantId}...`)
  const { data: clienti, error } = await admin
    .from('clienti')
    .select('id,nume_client,telefon,created_at,data_origin,google_resource_name')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Nu am putut citi clienții: ${error.message}`)
  }

  const byPhone = new Map<string, ClientRow[]>()
  let skippedNoPhone = 0

  for (const client of (clienti ?? []) as ClientRow[]) {
    const normalized = canonicalizePhoneForDedupe(client.telefon)
    if (!normalized) {
      skippedNoPhone += 1
      continue
    }
    const bucket = byPhone.get(normalized) ?? []
    bucket.push(client)
    byPhone.set(normalized, bucket)
  }

  const duplicateBuckets = Array.from(byPhone.entries()).filter(([, rows]) => rows.length > 1)
  console.log(
    `Clienți fără telefon valid (excluși din grupare): ${skippedNoPhone}. Grupuri cu potențiale dubluri: ${duplicateBuckets.length}.`,
  )

  const groups: ReportGroup[] = []

  for (const [normalizedPhone, rows] of duplicateBuckets) {
    const members: ReportEntry[] = []
    for (const row of rows) {
      const refs = await countReferences(admin, tenantId, row.id)
      const totalRefs = refs.comenzi + refs.vanzari + refs.vanzari_butasi
      members.push({ ...row, refs, totalRefs })
    }

    const distinctNames = new Set(members.map((m) => m.nume_client.trim().toLowerCase()))
    const anyGeneric = members.some((m) => looksGeneric(m.nume_client))
    const caution =
      anyGeneric && distinctNames.size > 1
        ? 'Nume generice diferite în același grup — verifică manual că e chiar același client înainte de merge (ex. „Client Necunoscut”, „Client Ipotești” pot fi persoane diferite din campanii Ads).'
        : null

    groups.push({
      normalizedPhone,
      members,
      recommendedPrincipalId: pickPrincipal(members),
      caution,
    })
  }

  const outputDir = join(process.cwd(), 'scripts', 'output')
  mkdirSync(outputDir, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const mdPath = join(outputDir, `clienti-dedupe-${timestamp}.md`)
  const csvPath = join(outputDir, `clienti-dedupe-${timestamp}.csv`)
  const jsonPath = join(outputDir, `clienti-dedupe-${timestamp}.json`)

  writeFileSync(mdPath, renderMarkdown(tenantId, groups, skippedNoPhone), 'utf8')
  writeFileSync(csvPath, renderCsv(groups), 'utf8')
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        tenantId,
        generatedAt: new Date().toISOString(),
        groups: groups.map((group) => ({
          normalizedPhone: group.normalizedPhone,
          recommendedPrincipalId: group.recommendedPrincipalId,
          caution: group.caution,
          memberIds: group.members.map((m) => m.id),
        })),
      },
      null,
      2,
    ),
    'utf8',
  )

  console.log('')
  console.log(`Raport Markdown: ${mdPath}`)
  console.log(`Raport CSV:      ${csvPath}`)
  console.log(`Input Faza 2:    ${jsonPath}`)
  console.log('')
  console.log(
    'NU s-a modificat nimic în baza de date. Verifică raportul, apoi rulează Faza 2 explicit:',
  )
  console.log(`  npx tsx scripts/dedupe-clienti-merge.ts --input ${jsonPath} --confirm`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
