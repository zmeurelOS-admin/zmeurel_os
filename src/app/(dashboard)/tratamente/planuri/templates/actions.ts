'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import {
  upsertPlanTratamentCuLinii,
  type PlanTratamentLiniePayload,
} from '@/lib/supabase/queries/tratamente'
import type { MetodaAplicare } from '@/types/tratamente-metode'

export type TemplatePreview = {
  id: string
  cod: string
  nume: string
  cultura_tip: string
  cohort: 'floricane' | 'primocane' | null
  descriere: string | null
  durata_sezon_estimata: string | null
  nr_interventii: number
}

export type TemplateLiniePreview = {
  id: string
  ordine: number
  stadiu_trigger: string
  cohort_trigger: 'floricane' | 'primocane' | null
  tip_interventie: PlanTratamentLiniePayload['tip_interventie']
  metoda_aplicare: MetodaAplicare | null
  scop: string
  regula_repetare: 'fara_repetare' | 'interval'
  interval_repetare_zile: number | null
  numar_repetari_max: number | null
  fereastra_start_offset_zile: number | null
  fereastra_end_offset_zile: number | null
  produs_sugerat_nume: string | null
  produs_sugerat_substanta: string | null
  produs_sugerat_doza_text: string | null
  observatii: string | null
}

type TemplateRow = TemplatePreview & {
  ordine: number
  activ: boolean
}

type TemplateLinieRow = TemplateLiniePreview & {
  template_id: string
}

type UntypedSupabase = {
  from: (table: string) => {
    select: (columns: string) => UntypedQuery
    insert?: (payload: unknown) => UntypedQuery
  }
}

type UntypedQuery = {
  eq: (column: string, value: unknown) => UntypedQuery
  order: (column: string, options?: { ascending?: boolean }) => UntypedQuery
  maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>
  single: () => Promise<{ data: unknown; error: { message: string } | null }>
  then: <TResult1 = { data: unknown; error: { message: string } | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) => Promise<TResult1 | TResult2>
}

const cloneSchema = z.object({
  templateId: z.string().uuid('Template-ul selectat nu este valid.'),
  numePlan: z.string().trim().min(1, 'Numele planului este obligatoriu.').max(120, 'Numele planului poate avea cel mult 120 de caractere.'),
  parcelaId: z.string().uuid('Parcela selectată nu este validă.').optional().or(z.literal('')),
  an: z.number().int().min(2020).max(2100),
})

const templateIdSchema = z.string().uuid('Template-ul selectat nu este valid.')

function getUntypedClient(client: Awaited<ReturnType<typeof createClient>>) {
  return client as unknown as UntypedSupabase
}

function normalizeCohort(value: unknown): 'floricane' | 'primocane' | null {
  return value === 'floricane' || value === 'primocane' ? value : null
}

function normalizeRegula(value: unknown): 'fara_repetare' | 'interval' {
  return value === 'interval' ? 'interval' : 'fara_repetare'
}

function normalizeMetoda(value: unknown): MetodaAplicare | null {
  return value === 'foliar' ||
    value === 'fertirigare' ||
    value === 'fertilizare_baza' ||
    value === 'granulat_sol' ||
    value === 'capcana_pus' ||
    value === 'capcana_verificat' ||
    value === 'altul'
    ? value
    : null
}

function mapTemplate(row: TemplateRow): TemplatePreview {
  return {
    id: row.id,
    cod: row.cod,
    nume: row.nume,
    cultura_tip: row.cultura_tip,
    cohort: normalizeCohort(row.cohort),
    descriere: row.descriere,
    durata_sezon_estimata: row.durata_sezon_estimata,
    nr_interventii: row.nr_interventii,
  }
}

function mapTemplateLinie(row: TemplateLinieRow): TemplateLiniePreview {
  return {
    id: row.id,
    ordine: row.ordine,
    stadiu_trigger: row.stadiu_trigger,
    cohort_trigger: normalizeCohort(row.cohort_trigger),
    tip_interventie: row.tip_interventie,
    metoda_aplicare: normalizeMetoda(row.metoda_aplicare),
    scop: row.scop,
    regula_repetare: normalizeRegula(row.regula_repetare),
    interval_repetare_zile: row.interval_repetare_zile,
    numar_repetari_max: row.numar_repetari_max,
    fereastra_start_offset_zile: row.fereastra_start_offset_zile,
    fereastra_end_offset_zile: row.fereastra_end_offset_zile,
    produs_sugerat_nume: row.produs_sugerat_nume,
    produs_sugerat_substanta: row.produs_sugerat_substanta,
    produs_sugerat_doza_text: row.produs_sugerat_doza_text,
    observatii: row.observatii,
  }
}

function linieTemplateToPayload(linie: TemplateLiniePreview): PlanTratamentLiniePayload {
  const productName = linie.produs_sugerat_nume?.trim() || null
  const doseText = linie.produs_sugerat_doza_text?.trim() || null
  const observatii = [linie.observatii, doseText ? `Doză recomandată template: ${doseText}` : null]
    .filter((value): value is string => Boolean(value?.trim()))
    .join('\n')

  return {
    ordine: linie.ordine,
    stadiu_trigger: linie.stadiu_trigger,
    cohort_trigger: linie.cohort_trigger,
    tip_interventie: linie.tip_interventie,
    metoda_aplicare: linie.metoda_aplicare,
    scop: linie.scop,
    regula_repetare: linie.regula_repetare,
    interval_repetare_zile: linie.regula_repetare === 'interval' ? linie.interval_repetare_zile : null,
    numar_repetari_max: linie.regula_repetare === 'interval' ? linie.numar_repetari_max : null,
    fereastra_start_offset_zile: linie.fereastra_start_offset_zile,
    fereastra_end_offset_zile: linie.fereastra_end_offset_zile,
    produs_id: null,
    produs_nume_manual: productName,
    observatii: observatii || null,
    produse: productName
      ? [
          {
            ordine: 1,
            produs_id: null,
            produs_nume_manual: productName,
            produs_nume_snapshot: productName,
            substanta_activa_snapshot: linie.produs_sugerat_substanta,
            cantitate_text: doseText,
            observatii: doseText ? `Doză recomandată template: ${doseText}` : null,
          },
        ]
      : [],
  }
}

export async function listTemplatesActive(): Promise<TemplatePreview[]> {
  const supabase = getUntypedClient(await createClient())
  const { data, error } = await supabase
    .from('planuri_template')
    .select('id,cod,nume,cultura_tip,cohort,descriere,durata_sezon_estimata,nr_interventii,activ,ordine')
    .eq('activ', true)
    .order('ordine', { ascending: true })
    .order('nume', { ascending: true })

  if (error) throw new Error(error.message)
  return ((data ?? []) as TemplateRow[]).map(mapTemplate)
}

export async function getTemplateCuLinii(templateId: string): Promise<{
  template: TemplatePreview
  linii: TemplateLiniePreview[]
}> {
  const parsed = templateIdSchema.safeParse(templateId)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Template invalid.')
  }

  const supabase = getUntypedClient(await createClient())
  const { data: templateData, error: templateError } = await supabase
    .from('planuri_template')
    .select('id,cod,nume,cultura_tip,cohort,descriere,durata_sezon_estimata,nr_interventii,activ,ordine')
    .eq('id', parsed.data)
    .eq('activ', true)
    .maybeSingle()

  if (templateError) throw new Error(templateError.message)
  if (!templateData) throw new Error('Template-ul selectat nu a fost găsit.')

  const { data: liniiData, error: liniiError } = await supabase
    .from('planuri_template_linii')
    .select('id,template_id,ordine,stadiu_trigger,cohort_trigger,tip_interventie,metoda_aplicare,scop,regula_repetare,interval_repetare_zile,numar_repetari_max,fereastra_start_offset_zile,fereastra_end_offset_zile,produs_sugerat_nume,produs_sugerat_substanta,produs_sugerat_doza_text,observatii')
    .eq('template_id', parsed.data)
    .order('ordine', { ascending: true })

  if (liniiError) throw new Error(liniiError.message)

  return {
    template: mapTemplate(templateData as TemplateRow),
    linii: ((liniiData ?? []) as TemplateLinieRow[]).map(mapTemplateLinie),
  }
}

export async function clonezaTemplateInPlanNou(input: {
  templateId: string
  numePlan: string
  parcelaId?: string
  an: number
}): Promise<{ planId: string }> {
  const parsed = cloneSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Nu am putut clona template-ul.')
  }

  const { template, linii } = await getTemplateCuLinii(parsed.data.templateId)
  const plan = await upsertPlanTratamentCuLinii(
    {
      id: null,
      nume: parsed.data.numePlan,
      cultura_tip: template.cultura_tip,
      descriere: template.descriere,
      activ: true,
      arhivat: false,
    },
    linii.map(linieTemplateToPayload),
    parsed.data.parcelaId ? [parsed.data.parcelaId] : [],
    parsed.data.an
  )

  revalidatePath('/tratamente/planuri')
  revalidatePath(`/tratamente/planuri/${plan.id}`)
  revalidatePath(`/tratamente/planuri/${plan.id}/editor`)

  return { planId: plan.id }
}
