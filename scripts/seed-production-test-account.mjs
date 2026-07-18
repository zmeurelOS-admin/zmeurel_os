import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Usage:
//   npm run seed:prod-test-account
//   node scripts/seed-production-test-account.mjs --verify-only
// The script stores TEST_ACCOUNT_* in .env.local and never prints the password.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const envPath = path.join(repoRoot, '.env.local')

const LIVE_PROJECT_REF = 'ilybohhdeplwcrbpblqw'
const TEST_FARM_NAME = 'Ferma Test - NU sunt date reale'
const TEST_DATA_ORIGIN = 'prod_visual_test'
const DEFAULT_TEST_EMAIL = 'zmeurel-prod-visual-test@example.test'
const VERIFY_ONLY = process.argv.includes('--verify-only')

dotenv.config({ path: envPath, quiet: true })

function readLocalEnv() {
  const text = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
  return {
    text,
    parsed: dotenv.parse(text),
  }
}

function serializeEnvValue(value) {
  return String(value).replace(/\r?\n/g, '')
}

function writeLocalEnvValues(values) {
  let text = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
  if (text && !text.endsWith('\n')) text += '\n'

  for (const [key, rawValue] of Object.entries(values)) {
    const value = serializeEnvValue(rawValue)
    const line = `${key}=${value}`
    const pattern = new RegExp(`^${key}=.*$`, 'm')
    if (pattern.test(text)) {
      text = text.replace(pattern, line)
    } else {
      text += `${line}\n`
    }
    process.env[key] = value
  }

  fs.writeFileSync(envPath, text, 'utf8')
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

function requireLiveProject() {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  if (!url.includes(LIVE_PROJECT_REF)) {
    throw new Error(
      `Refuz rularea: NEXT_PUBLIC_SUPABASE_URL nu pointeaza la proiectul live ${LIVE_PROJECT_REF}.`
    )
  }
}

function createServiceClient() {
  return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

function createAnonClient() {
  return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

function stableUuid(key) {
  const bytes = crypto.createHash('sha256').update(key).digest().subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function formatBucharestDate(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${byType.year}-${byType.month}-${byType.day}`
}

function compactDate(date) {
  return date.replaceAll('-', '')
}

function generatePassword() {
  const day = compactDate(formatBucharestDate())
  const suffix = crypto.randomInt(1000, 9999)
  return `ZmeurelTest!${day}${suffix}`
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function retry(label, fn, attempts = 8) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const value = await fn()
      if (value) return value
    } catch (error) {
      lastError = error
    }
    await wait(350 * attempt)
  }
  if (lastError) throw lastError
  throw new Error(`${label}: conditia asteptata nu s-a indeplinit.`)
}

async function findAuthUserByEmail(admin, email) {
  const needle = email.trim().toLowerCase()
  let page = 1
  const perPage = 1000

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`auth.admin.listUsers: ${error.message}`)
    const hit = data.users.find((user) => user.email?.toLowerCase() === needle)
    if (hit) return hit
    if (data.users.length < perPage) return null
    page += 1
  }
}

async function ensureAuthUser(admin, email, password) {
  const existing = await findAuthUserByEmail(admin, email)
  if (existing) return existing

  if (VERIFY_ONLY) {
    throw new Error('Contul de test nu exista, iar --verify-only nu poate crea date.')
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      farm_name: TEST_FARM_NAME,
      full_name: 'Cont vizual test productie',
      zmeurel_test_account: true,
    },
  })

  if (error || !data.user) {
    throw new Error(`auth.admin.createUser: ${error?.message ?? 'nu a returnat user'}`)
  }

  return data.user
}

async function getTenantForUser(admin, userId) {
  const { data, error } = await admin
    .from('tenants')
    .select('id,nume_ferma,owner_user_id,plan')
    .eq('owner_user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`tenants select: ${error.message}`)
  const tenants = data ?? []
  return tenants.find((tenant) => tenant.nume_ferma === TEST_FARM_NAME) ?? tenants[0] ?? null
}

async function getProfile(admin, userId) {
  const { data, error } = await admin
    .from('profiles')
    .select('id,tenant_id,is_superadmin')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(`profiles select: ${error.message}`)
  return data
}

async function ensureAuthBackfill(admin, user) {
  const tenant = await retry('tenant creat de triggerul auth', () => getTenantForUser(admin, user.id))
  const profile = await retry('profil legat de tenant', async () => {
    const row = await getProfile(admin, user.id)
    return row?.tenant_id ? row : null
  })

  if (profile.tenant_id !== tenant.id) {
    throw new Error(
      `Profilul contului de test pointeaza la ${profile.tenant_id}, dar tenantul gasit este ${tenant.id}. Refuz fara UPDATE.`
    )
  }

  if (profile.is_superadmin) {
    throw new Error('Contul de test este superadmin. Refuz, pentru ca verificarea RLS nu ar mai fi relevanta.')
  }

  return { tenant, profile }
}

async function insertIfMissing(admin, table, id, payload) {
  const { data: existing, error: selectError } = await admin
    .from(table)
    .select('id,tenant_id')
    .eq('id', id)
    .maybeSingle()

  if (selectError) throw new Error(`${table} select ${id}: ${selectError.message}`)
  if (existing) {
    if ('tenant_id' in existing && existing.tenant_id !== payload.tenant_id) {
      throw new Error(`${table} ${id} exista pe alt tenant (${existing.tenant_id}). Refuz inserarea.`)
    }
    return { inserted: false, id }
  }

  if (VERIFY_ONLY) return { inserted: false, id }

  const { error: insertError } = await admin.from(table).insert({ id, ...payload })
  if (insertError) throw new Error(`${table} insert ${id}: ${insertError.message}`)
  return { inserted: true, id }
}

async function seedData(admin, userId, tenantId) {
  const today = formatBucharestDate()
  const yesterday = formatBucharestDate(-1)
  const threeDaysAgo = formatBucharestDate(-3)
  const tomorrow = formatBucharestDate(1)
  const todayKey = compactDate(today)
  const seedId = stableUuid('zmeurel:prod_visual_test:seed')

  const parcele = [
    {
      id: stableUuid('zmeurel:prod_visual_test:parcela:a'),
      id_parcela: 'TEST-PAR-A',
      nume_parcela: 'Parcela Test A',
      suprafata_m2: 1200,
      nr_plante: 850,
      soi_plantat: 'Polka test',
      observatii: 'Date fake pentru verificare vizuala productie',
    },
    {
      id: stableUuid('zmeurel:prod_visual_test:parcela:b'),
      id_parcela: 'TEST-PAR-B',
      nume_parcela: 'Parcela Test B',
      suprafata_m2: 900,
      nr_plante: 620,
      soi_plantat: 'Mapema test',
      observatii: 'Date fake pentru verificare vizuala productie',
    },
    {
      id: stableUuid('zmeurel:prod_visual_test:parcela:c'),
      id_parcela: 'TEST-PAR-C',
      nume_parcela: 'Solar Test C',
      suprafata_m2: 420,
      nr_plante: 310,
      soi_plantat: 'Maravilla test',
      observatii: 'Date fake pentru verificare vizuala productie',
    },
  ]

  const culegatori = [
    {
      id: stableUuid('zmeurel:prod_visual_test:culegator:maria'),
      id_culegator: 'TEST-CUL-01',
      nume_prenume: 'Maria Test',
      telefon: '0700000101',
      tarif_lei_kg: 6.5,
    },
    {
      id: stableUuid('zmeurel:prod_visual_test:culegator:ion'),
      id_culegator: 'TEST-CUL-02',
      nume_prenume: 'Ion Test',
      telefon: '0700000102',
      tarif_lei_kg: 7,
    },
    {
      id: stableUuid('zmeurel:prod_visual_test:culegator:elena'),
      id_culegator: 'TEST-CUL-03',
      nume_prenume: 'Elena Test',
      telefon: '0700000103',
      tarif_lei_kg: 6,
    },
  ]

  const clienti = [
    {
      id: stableUuid('zmeurel:prod_visual_test:client:ana'),
      id_client: 'TEST-CLI-01',
      nume_client: 'Ana Client Test',
      telefon: '0700000000',
      adresa: 'Strada Test 1',
      pret_negociat_lei_kg: 28,
    },
    {
      id: stableUuid('zmeurel:prod_visual_test:client:bistro'),
      id_client: 'TEST-CLI-02',
      nume_client: 'Bistro Test SRL',
      telefon: '0700000001',
      adresa: 'Piata Test 2',
      pret_negociat_lei_kg: 30,
    },
  ]

  const recoltari = [
    {
      id: stableUuid(`zmeurel:prod_visual_test:recoltare:${todayKey}:a`),
      id_recoltare: `TEST-REC-${todayKey}-01`,
      data: today,
      parcela_id: parcele[0].id,
      culegator_id: culegatori[0].id,
      kg_cal1: 5.5,
      kg_cal2: 1.2,
      pret_lei_pe_kg_snapshot: 6.5,
    },
    {
      id: stableUuid(`zmeurel:prod_visual_test:recoltare:${todayKey}:b`),
      id_recoltare: `TEST-REC-${todayKey}-02`,
      data: today,
      parcela_id: parcele[1].id,
      culegator_id: culegatori[1].id,
      kg_cal1: 3,
      kg_cal2: 0.8,
      pret_lei_pe_kg_snapshot: 7,
    },
    {
      id: stableUuid(`zmeurel:prod_visual_test:recoltare:${todayKey}:c`),
      id_recoltare: `TEST-REC-${todayKey}-03`,
      data: today,
      parcela_id: parcele[2].id,
      culegator_id: culegatori[2].id,
      kg_cal1: 2,
      kg_cal2: 1,
      pret_lei_pe_kg_snapshot: 6,
    },
    {
      id: stableUuid(`zmeurel:prod_visual_test:recoltare:${compactDate(yesterday)}:a`),
      id_recoltare: `TEST-REC-${compactDate(yesterday)}-01`,
      data: yesterday,
      parcela_id: parcele[0].id,
      culegator_id: culegatori[0].id,
      kg_cal1: 2.5,
      kg_cal2: 0.5,
      pret_lei_pe_kg_snapshot: 6.5,
    },
    {
      id: stableUuid(`zmeurel:prod_visual_test:recoltare:${compactDate(threeDaysAgo)}:a`),
      id_recoltare: `TEST-REC-${compactDate(threeDaysAgo)}-01`,
      data: threeDaysAgo,
      parcela_id: parcele[1].id,
      culegator_id: culegatori[1].id,
      kg_cal1: 1.5,
      kg_cal2: 1,
      pret_lei_pe_kg_snapshot: 7,
    },
  ].map((row) => ({
    ...row,
    cantitate_kg: Number((row.kg_cal1 + row.kg_cal2).toFixed(2)),
    valoare_munca_lei: Number(((row.kg_cal1 + row.kg_cal2) * row.pret_lei_pe_kg_snapshot).toFixed(2)),
  }))

  const comenzi = [
    {
      id: stableUuid(`zmeurel:prod_visual_test:comanda:${todayKey}:in_livrare:1`),
      client_id: clienti[0].id,
      client_nume_manual: 'Ana Client Test',
      telefon: '0700000000',
      locatie_livrare: 'Suceava - adresa test',
      data_comanda: today,
      data_livrare: today,
      cantitate_kg: 5,
      pret_per_kg: 28,
      status: 'in_livrare',
      observatii: 'Consuma stocul de azi - comanda test in livrare 1',
    },
    {
      id: stableUuid(`zmeurel:prod_visual_test:comanda:${todayKey}:in_livrare:2`),
      client_id: clienti[1].id,
      client_nume_manual: 'Bistro Test SRL',
      telefon: '0700000001',
      locatie_livrare: 'Radauti - adresa test',
      data_comanda: today,
      data_livrare: today,
      cantitate_kg: 4,
      pret_per_kg: 30,
      status: 'in_livrare',
      observatii: 'Consuma stocul de azi - comanda test in livrare 2',
    },
    {
      id: stableUuid(`zmeurel:prod_visual_test:comanda:${todayKey}:programata`),
      client_id: clienti[0].id,
      client_nume_manual: 'Ana Client Test',
      telefon: '0700000000',
      locatie_livrare: 'Suceava - programata azi test',
      data_comanda: today,
      data_livrare: today,
      cantitate_kg: 3.5,
      pret_per_kg: 28,
      status: 'programata',
      observatii: 'Programata pentru azi - verifica Disponibil azi',
    },
    {
      id: stableUuid(`zmeurel:prod_visual_test:comanda:${todayKey}:livrata`),
      client_id: clienti[1].id,
      client_nume_manual: 'Bistro Test SRL',
      telefon: '0700000001',
      locatie_livrare: 'Suceava - livrata test',
      data_comanda: today,
      data_livrare: today,
      cantitate_kg: 4.5,
      pret_per_kg: 30,
      status: 'livrata',
      observatii: 'Livrata test pentru disponibil scazut',
    },
    {
      id: stableUuid(`zmeurel:prod_visual_test:comanda:${todayKey}:insuficient`),
      client_id: clienti[0].id,
      client_nume_manual: 'Ana Client Test',
      telefon: '0700000000',
      locatie_livrare: 'Suceava - caz insuficient test',
      data_comanda: today,
      data_livrare: today,
      cantitate_kg: 5,
      pret_per_kg: 28,
      status: 'confirmata',
      observatii: 'Caz test: cantitatea depaseste disponibilul curent',
    },
    {
      id: stableUuid(`zmeurel:prod_visual_test:comanda:${compactDate(tomorrow)}:programata`),
      client_id: clienti[1].id,
      client_nume_manual: 'Bistro Test SRL',
      telefon: '0700000001',
      locatie_livrare: 'Falticeni - viitor test',
      data_comanda: today,
      data_livrare: tomorrow,
      cantitate_kg: 6,
      pret_per_kg: 30,
      status: 'programata',
      observatii: 'Comanda viitoare pentru Necesar rest',
    },
  ]

  const inserted = {}
  for (const parcela of parcele) {
    const result = await insertIfMissing(admin, 'parcele', parcela.id, {
      tenant_id: tenantId,
      id_parcela: parcela.id_parcela,
      nume_parcela: parcela.nume_parcela,
      suprafata_m2: parcela.suprafata_m2,
      tip_fruct: 'Zmeura',
      soi_plantat: parcela.soi_plantat,
      an_plantare: 2024,
      nr_plante: parcela.nr_plante,
      status: 'Activ',
      tip_unitate: parcela.nume_parcela.startsWith('Solar') ? 'solar' : 'camp',
      cultura: 'Zmeura',
      soi: parcela.soi_plantat,
      observatii: parcela.observatii,
      created_by: userId,
      updated_by: userId,
      data_origin: TEST_DATA_ORIGIN,
      demo_seed_id: seedId,
    })
    inserted.parcele = (inserted.parcele ?? 0) + Number(result.inserted)
  }

  for (const culegator of culegatori) {
    const result = await insertIfMissing(admin, 'culegatori', culegator.id, {
      tenant_id: tenantId,
      id_culegator: culegator.id_culegator,
      nume_prenume: culegator.nume_prenume,
      telefon: culegator.telefon,
      tip_angajare: 'zilier',
      tarif_lei_kg: culegator.tarif_lei_kg,
      data_angajare: threeDaysAgo,
      status_activ: true,
      observatii: 'Culegator fictiv pentru verificare vizuala productie',
      data_origin: TEST_DATA_ORIGIN,
      demo_seed_id: seedId,
    })
    inserted.culegatori = (inserted.culegatori ?? 0) + Number(result.inserted)
  }

  for (const client of clienti) {
    const result = await insertIfMissing(admin, 'clienti', client.id, {
      tenant_id: tenantId,
      id_client: client.id_client,
      nume_client: client.nume_client,
      telefon: client.telefon,
      adresa: client.adresa,
      pret_negociat_lei_kg: client.pret_negociat_lei_kg,
      observatii: 'Client fictiv pentru verificare vizuala productie',
      created_by: userId,
      updated_by: userId,
      data_origin: TEST_DATA_ORIGIN,
      demo_seed_id: seedId,
    })
    inserted.clienti = (inserted.clienti ?? 0) + Number(result.inserted)
  }

  for (const recoltare of recoltari) {
    const result = await insertIfMissing(admin, 'recoltari', recoltare.id, {
      tenant_id: tenantId,
      id_recoltare: recoltare.id_recoltare,
      data: recoltare.data,
      parcela_id: recoltare.parcela_id,
      culegator_id: recoltare.culegator_id,
      kg_cal1: recoltare.kg_cal1,
      kg_cal2: recoltare.kg_cal2,
      cantitate_kg: recoltare.cantitate_kg,
      pret_lei_pe_kg_snapshot: recoltare.pret_lei_pe_kg_snapshot,
      valoare_munca_lei: recoltare.valoare_munca_lei,
      observatii: 'Recoltare fictiva pentru dashboard si lista /recoltari',
      created_by: userId,
      updated_by: userId,
      data_origin: TEST_DATA_ORIGIN,
      demo_seed_id: seedId,
    })
    inserted.recoltari = (inserted.recoltari ?? 0) + Number(result.inserted)
  }

  for (const comanda of comenzi) {
    const result = await insertIfMissing(admin, 'comenzi', comanda.id, {
      tenant_id: tenantId,
      client_id: comanda.client_id,
      client_nume_manual: comanda.client_nume_manual,
      telefon: comanda.telefon,
      locatie_livrare: comanda.locatie_livrare,
      data_comanda: comanda.data_comanda,
      data_livrare: comanda.data_livrare,
      cantitate_kg: comanda.cantitate_kg,
      pret_per_kg: comanda.pret_per_kg,
      total: Number((comanda.cantitate_kg * comanda.pret_per_kg).toFixed(2)),
      status: comanda.status,
      order_kind: 'manual',
      observatii: comanda.observatii,
      created_by: userId,
      updated_by: userId,
      data_origin: TEST_DATA_ORIGIN,
      demo_seed_id: seedId,
    })
    inserted.comenzi = (inserted.comenzi ?? 0) + Number(result.inserted)
  }

  return { inserted, today }
}

async function countTableRows(client, table) {
  const { count, error } = await client.from(table).select('id', { count: 'exact', head: true })
  if (error) throw new Error(`${table} count: ${error.message}`)
  return count ?? 0
}

async function assertOnlyTenantRowsVisible(client, table, tenantId) {
  const { data, error } = await client.from(table).select('id,tenant_id')
  if (error) throw new Error(`${table} RLS select: ${error.message}`)
  const rows = data ?? []
  const leaked = rows.filter((row) => row.tenant_id !== tenantId)
  if (leaked.length > 0) {
    throw new Error(`${table}: RLS leakage, ${leaked.length} rand(uri) vizibile din alt tenant.`)
  }
  return rows.length
}

async function verifyIsolationAndStock(email, password, tenantId, userId) {
  const client = createAnonClient()
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw new Error(`Login cont test: ${signInError.message}`)

  const { data: tenants, error: tenantError } = await client
    .from('tenants')
    .select('id,owner_user_id,nume_ferma')
  if (tenantError) throw new Error(`tenants RLS select: ${tenantError.message}`)

  const leakedTenants = (tenants ?? []).filter((tenant) => tenant.id !== tenantId)
  if (leakedTenants.length > 0) {
    throw new Error(`tenants: RLS leakage, ${leakedTenants.length} tenant(i) non-test vizibili.`)
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id,tenant_id,is_superadmin')
    .eq('id', userId)
    .maybeSingle()
  if (profileError) throw new Error(`profiles RLS select: ${profileError.message}`)
  if (!profile || profile.tenant_id !== tenantId || profile.is_superadmin) {
    throw new Error('Profilul vizibil pentru contul test nu este legat corect sau are privilegii neasteptate.')
  }

  const visibleCounts = {}
  for (const table of ['parcele', 'culegatori', 'clienti', 'recoltari', 'comenzi', 'vanzari', 'ajustari_stoc']) {
    visibleCounts[table] = await assertOnlyTenantRowsVisible(client, table, tenantId)
  }

  const today = formatBucharestDate()
  const { count: inDeliveryToday, error: inDeliveryError } = await client
    .from('comenzi')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'in_livrare')
    .eq('data_livrare', today)
  if (inDeliveryError) throw new Error(`comenzi in_livrare count: ${inDeliveryError.message}`)
  if ((inDeliveryToday ?? 0) < 2) {
    throw new Error('Datasetul test nu are cel putin 2 comenzi in_livrare pentru ziua curenta.')
  }

  const { data: stockRows, error: stockError } = await client.rpc('get_sellable_cal1_stock_summary', {
    p_tenant_id: tenantId,
  })
  if (stockError) throw new Error(`get_sellable_cal1_stock_summary: ${stockError.message}`)

  const stock = Array.isArray(stockRows) ? stockRows[0] : stockRows
  const available = Number(stock?.disponibil_cal1_kg ?? 0)
  if (!(available < 5)) {
    throw new Error(`Datasetul test nu produce caz de stoc insuficient pentru comanda de 5 kg. Disponibil: ${available}`)
  }

  await client.auth.signOut()
  return {
    visibleCounts,
    inDeliveryToday: inDeliveryToday ?? 0,
    disponibilCal1Kg: available,
  }
}

async function main() {
  const localEnv = readLocalEnv().parsed
  const testEmail = process.env.TEST_ACCOUNT_EMAIL || localEnv.TEST_ACCOUNT_EMAIL || DEFAULT_TEST_EMAIL
  const testPassword = process.env.TEST_ACCOUNT_PASSWORD || localEnv.TEST_ACCOUNT_PASSWORD || generatePassword()

  writeLocalEnvValues({
    TEST_ACCOUNT_EMAIL: testEmail,
    TEST_ACCOUNT_PASSWORD: testPassword,
  })

  requireLiveProject()

  const admin = createServiceClient()
  const user = await ensureAuthUser(admin, testEmail, testPassword)
  const { tenant } = await ensureAuthBackfill(admin, user)

  writeLocalEnvValues({
    TEST_ACCOUNT_EMAIL: testEmail,
    TEST_ACCOUNT_PASSWORD: testPassword,
    TEST_ACCOUNT_TENANT_ID: tenant.id,
  })

  const seedResult = await seedData(admin, user.id, tenant.id)
  const verification = await verifyIsolationAndStock(testEmail, testPassword, tenant.id, user.id)
  const totalRows = {}
  for (const table of ['parcele', 'culegatori', 'clienti', 'recoltari', 'comenzi']) {
    const { count, error } = await admin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id)
    if (error) throw new Error(`${table} admin count: ${error.message}`)
    totalRows[table] = count ?? 0
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        projectRef: LIVE_PROJECT_REF,
        tenantId: tenant.id,
        tenantName: tenant.nume_ferma,
        today: seedResult.today,
        insertedRows: seedResult.inserted,
        tenantRows: totalRows,
        rlsVisibleRows: verification.visibleCounts,
        inDeliveryToday: verification.inDeliveryToday,
        disponibilCal1Kg: verification.disponibilCal1Kg,
        credentialsStoredIn: '.env.local',
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
