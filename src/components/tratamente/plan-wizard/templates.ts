import { getLabelPentruGrup, type StadiuCod } from '@/lib/tratamente/stadii-canonic'
import { normalizeForSearch } from '@/lib/utils/string'
import { getCurrentSezon } from '@/lib/utils/sezon'
import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'

import { ensureConsecutiveOrdine, type PlanWizardLinieDraft, type PlanWizardValues } from './types'

type TemplateCohort = 'floricane' | 'primocane'
type TemplateTipInterventie = NonNullable<PlanWizardLinieDraft['tip_interventie']>

export type PlanTemplateProduct = {
  numeComercial: string
  substantaActiva?: string
  tip?: ProdusFitosanitar['tip'] | string
  fracIrac?: string
  phiZile?: number | null
  dozaMlPerHl?: number | null
  dozaLPerHa?: number | null
  observatii?: string
}

export type PlanTemplateLine = {
  stadiu: StadiuCod
  cohort?: TemplateCohort | null
  tipInterventie: TemplateTipInterventie
  scop: string
  regulaRepetare?: 'fara_repetare' | 'interval'
  intervalRepetareZile?: number | null
  numarRepetariMax?: number | null
  observatii?: string
  produse: PlanTemplateProduct[]
}

export type PlanTemplate = {
  id: string
  title: string
  subtitle: string
  badge: string
  culturaTip: string
  descriere: string
  lines: PlanTemplateLine[]
}

const PRIMOCANE_LINES: PlanTemplateLine[] = [
  {
    stadiu: 'repaus_vegetativ',
    cohort: 'primocane',
    tipInterventie: 'igiena',
    scop: 'Igienizare plantație și reducerea rezervei de boli pe resturi vegetale.',
    produse: [{ numeComercial: 'Kocide 2000', substantaActiva: 'cupru', tip: 'fungicid', fracIrac: 'M01', dozaMlPerHl: 250 }],
  },
  {
    stadiu: 'umflare_muguri',
    cohort: 'primocane',
    tipInterventie: 'protectie',
    scop: 'Protecție de pornire în vegetație pentru lăstarii noi.',
    produse: [{ numeComercial: 'Kocide 2000', substantaActiva: 'cupru', tip: 'fungicid', fracIrac: 'M01', dozaMlPerHl: 200 }],
  },
  {
    stadiu: 'buton_verde',
    cohort: 'primocane',
    tipInterventie: 'nutritie',
    scop: 'Susținerea diferențierii inflorescențelor și a creșterii active.',
    produse: [{ numeComercial: 'Bor + zinc prefloral', substantaActiva: 'bor, zinc', tip: 'fertilizant', dozaMlPerHl: 150 }],
  },
  {
    stadiu: 'buton_verde',
    cohort: 'primocane',
    tipInterventie: 'protectie',
    scop: 'Prevenție făinare înainte de înflorit.',
    produse: [{ numeComercial: 'Topas 100 EC', substantaActiva: 'penconazol', tip: 'fungicid', fracIrac: 'G1', phiZile: 7, dozaMlPerHl: 50 }],
  },
  {
    stadiu: 'buton_roz',
    cohort: 'primocane',
    tipInterventie: 'protectie',
    scop: 'Protecție Botrytis înainte de deschiderea florilor.',
    produse: [{ numeComercial: 'Switch 62.5 WG', substantaActiva: 'ciprodinil + fludioxonil', tip: 'fungicid', fracIrac: '9 + 12', phiZile: 7, dozaMlPerHl: 80 }],
  },
  {
    stadiu: 'buton_roz',
    cohort: 'primocane',
    tipInterventie: 'protectie',
    scop: 'Control afide și insecte defoliatoare înainte de înflorit.',
    produse: [{ numeComercial: 'Karate Zeon', substantaActiva: 'lambda-cihalotrin', tip: 'insecticid', fracIrac: '3A', phiZile: 7, dozaMlPerHl: 15 }],
  },
  {
    stadiu: 'inflorit',
    cohort: 'primocane',
    tipInterventie: 'biostimulare',
    scop: 'Reducerea stresului în înflorit și uniformizarea legării.',
    produse: [{ numeComercial: 'Biostimulator înflorire', substantaActiva: 'aminoacizi, extracte vegetale', tip: 'biostimulator', dozaMlPerHl: 200 }],
  },
  {
    stadiu: 'inflorit',
    cohort: 'primocane',
    tipInterventie: 'protectie',
    scop: 'Protecție făinare cu profil preventiv în înflorit.',
    produse: [{ numeComercial: 'Thiovit Jet', substantaActiva: 'sulf', tip: 'fungicid', fracIrac: 'M02', phiZile: 5, dozaMlPerHl: 300 }],
  },
  {
    stadiu: 'scuturare_petale',
    cohort: 'primocane',
    tipInterventie: 'protectie',
    scop: 'Protecție complexă după scuturarea petalelor.',
    produse: [{ numeComercial: 'Luna Sensation', substantaActiva: 'fluopiram + trifloxistrobin', tip: 'fungicid', fracIrac: '7 + 11', phiZile: 7, dozaMlPerHl: 60 }],
  },
  {
    stadiu: 'legare_fruct',
    cohort: 'primocane',
    tipInterventie: 'nutritie',
    scop: 'Calciu și microelemente pentru fructe ferme.',
    produse: [{ numeComercial: 'Calciu foliar', substantaActiva: 'calciu', tip: 'fertilizant', dozaMlPerHl: 250 }],
  },
  {
    stadiu: 'fruct_verde',
    cohort: 'primocane',
    tipInterventie: 'protectie',
    scop: 'Control afide și musculiță albă în creșterea fructelor.',
    produse: [{ numeComercial: 'Movento 100 SC', substantaActiva: 'spirotetramat', tip: 'insecticid', fracIrac: '23', phiZile: 14, dozaMlPerHl: 75 }],
  },
  {
    stadiu: 'fruct_verde',
    cohort: 'primocane',
    tipInterventie: 'nutritie',
    scop: 'Susținere fotosinteză și umplere fruct.',
    produse: [{ numeComercial: 'Magneziu + microelemente', substantaActiva: 'magneziu, microelemente', tip: 'fertilizant', dozaMlPerHl: 250 }],
  },
  {
    stadiu: 'fruct_verde',
    cohort: 'primocane',
    tipInterventie: 'protectie',
    scop: 'Protecție Botrytis în perioada de fruct verde.',
    regulaRepetare: 'interval',
    intervalRepetareZile: 10,
    numarRepetariMax: 2,
    produse: [{ numeComercial: 'Switch 62.5 WG', substantaActiva: 'ciprodinil + fludioxonil', tip: 'fungicid', fracIrac: '9 + 12', phiZile: 7, dozaMlPerHl: 80 }],
  },
  {
    stadiu: 'parga',
    cohort: 'primocane',
    tipInterventie: 'protectie',
    scop: 'Protecție Botrytis la început de coacere.',
    produse: [{ numeComercial: 'Teldor 500 SC', substantaActiva: 'fenhexamid', tip: 'fungicid', fracIrac: '17', phiZile: 1, dozaMlPerHl: 100 }],
  },
  {
    stadiu: 'parga',
    cohort: 'primocane',
    tipInterventie: 'monitorizare',
    scop: 'Monitorizare Drosophila suzukii în apropierea coacerii.',
    produse: [{ numeComercial: 'Capcane Drosophila oțet', substantaActiva: 'atractant alimentar', tip: 'altul', dozaLPerHa: 10 }],
  },
  {
    stadiu: 'maturitate',
    cohort: 'primocane',
    tipInterventie: 'protectie',
    scop: 'Protecție cu PHI scurt în fereastra de recoltare.',
    produse: [{ numeComercial: 'Teldor 500 SC', substantaActiva: 'fenhexamid', tip: 'fungicid', fracIrac: '17', phiZile: 1, dozaMlPerHl: 100 }],
  },
  {
    stadiu: 'maturitate',
    cohort: 'primocane',
    tipInterventie: 'nutritie',
    scop: 'Fermitate și calitate fruct pentru recoltări succesive.',
    produse: [{ numeComercial: 'Calciu pre-recoltare', substantaActiva: 'calciu', tip: 'fertilizant', dozaMlPerHl: 200 }],
  },
  {
    stadiu: 'post_recoltare',
    cohort: 'primocane',
    tipInterventie: 'biostimulare',
    scop: 'Refacere aparat foliar după presiune de recoltare.',
    produse: [{ numeComercial: 'Aminoacizi refacere post-recoltare', substantaActiva: 'aminoacizi', tip: 'biostimulator', dozaMlPerHl: 250 }],
  },
  {
    stadiu: 'post_recoltare',
    cohort: 'primocane',
    tipInterventie: 'protectie',
    scop: 'Închidere sezon cu tratament preventiv pe țesuturi expuse.',
    produse: [{ numeComercial: 'Kocide 2000', substantaActiva: 'cupru', tip: 'fungicid', fracIrac: 'M01', dozaMlPerHl: 200 }],
  },
  {
    stadiu: 'post_recoltare',
    cohort: 'primocane',
    tipInterventie: 'igiena',
    scop: 'Igienizare rânduri și reducerea inoculului pentru sezonul următor.',
    produse: [{ numeComercial: 'Igienizare rânduri', substantaActiva: 'lucrări culturale', tip: 'altul', dozaLPerHa: 1 }],
  },
]

const MIXED_LINES: PlanTemplateLine[] = PRIMOCANE_LINES.map((line, index) => ({
  ...line,
  cohort: index % 2 === 0 ? 'floricane' : 'primocane',
  scop:
    index % 2 === 0
      ? `${line.scop} Adaptat pentru floricane.`
      : `${line.scop} Adaptat pentru primocane.`,
}))

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: 'zmeur-primocane',
    title: 'Zmeur primocane',
    subtitle: '20 intervenții pentru plantații remontante, de la pornire până la post-recoltare.',
    badge: '20 intervenții',
    culturaTip: 'zmeur',
    descriere: 'Template local Sprint 6 pentru zmeur primocane, fără fișiere externe.',
    lines: PRIMOCANE_LINES,
  },
  {
    id: 'zmeur-mixt-floricane-primocane',
    title: 'Zmeur mixt floricane + primocane',
    subtitle: 'Variantă de lucru pentru plantații mixte, cu declanșatoare pe cohortă.',
    badge: '20 intervenții',
    culturaTip: 'zmeur',
    descriere: 'Template local Sprint 6 pentru zmeur mixt floricane și primocane.',
    lines: MIXED_LINES,
  },
]

function findProdus(produse: ProdusFitosanitar[], numeComercial: string) {
  const lookup = normalizeForSearch(numeComercial)
  return produse.find((produs) => normalizeForSearch(produs.nume_comercial) === lookup) ?? null
}

function buildProductDraft(
  templateId: string,
  lineIndex: number,
  productIndex: number,
  templateProduct: PlanTemplateProduct,
  produse: ProdusFitosanitar[]
): PlanWizardLinieDraft['produse'][number] {
  const produs = findProdus(produse, templateProduct.numeComercial)
  const dozaMlPerHl = templateProduct.dozaMlPerHl ?? produs?.doza_max_ml_per_hl ?? produs?.doza_min_ml_per_hl ?? null
  const dozaLPerHa = templateProduct.dozaLPerHa ?? produs?.doza_max_l_per_ha ?? produs?.doza_min_l_per_ha ?? null

  return {
    id: `${templateId}-linie-${lineIndex + 1}-produs-${productIndex + 1}`,
    ordine: productIndex + 1,
    produs_id: produs?.id ?? null,
    produs_nume_manual: produs ? '' : templateProduct.numeComercial,
    produs_nume_snapshot: produs?.nume_comercial ?? templateProduct.numeComercial,
    substanta_activa_snapshot: produs?.substanta_activa ?? templateProduct.substantaActiva ?? '',
    tip_snapshot: produs?.tip ?? templateProduct.tip ?? '',
    frac_irac_snapshot: produs?.frac_irac ?? templateProduct.fracIrac ?? '',
    phi_zile_snapshot: produs?.phi_zile ?? templateProduct.phiZile ?? null,
    doza_ml_per_hl: dozaMlPerHl,
    doza_l_per_ha: dozaLPerHa,
    observatii: templateProduct.observatii ?? '',
  }
}

export function buildTemplateWizardValues(
  template: PlanTemplate,
  produse: ProdusFitosanitar[],
  options?: {
    nume?: string
    parcelaId?: string | null
    an?: number
  }
): PlanWizardValues {
  const linii = template.lines.map<PlanWizardLinieDraft>((line, index) => {
    const produseDraft = line.produse.map((produs, productIndex) =>
      buildProductDraft(template.id, index, productIndex, produs, produse)
    )
    const firstProduct = produseDraft[0]
    const firstDoseL = firstProduct?.doza_l_per_ha ?? null
    const firstDoseMl = firstProduct?.doza_ml_per_hl ?? null

    return {
      id: `${template.id}-linie-${index + 1}`,
      ordine: index + 1,
      stadiu_trigger: line.stadiu,
      cohort_trigger: line.cohort ?? null,
      tip_interventie: line.tipInterventie,
      scop: line.scop,
      regula_repetare: line.regulaRepetare ?? 'fara_repetare',
      interval_repetare_zile: line.regulaRepetare === 'interval' ? line.intervalRepetareZile ?? null : null,
      numar_repetari_max: line.regulaRepetare === 'interval' ? line.numarRepetariMax ?? null : null,
      produs_id: firstProduct?.produs_id ?? null,
      produs_nume_manual: firstProduct?.produs_nume_manual ?? '',
      dozaUnitate: typeof firstDoseL === 'number' && firstDoseL > 0 ? 'l/ha' : 'ml/hl',
      doza: typeof firstDoseL === 'number' && firstDoseL > 0 ? firstDoseL : firstDoseMl ?? 0,
      observatii: line.observatii ?? '',
      produse: produseDraft,
    }
  })

  return {
    info: {
      nume: options?.nume?.trim() || `${template.title} ${options?.an ?? getCurrentSezon()}`,
      cultura_tip: template.culturaTip,
      descriere: template.descriere,
    },
    linii: ensureConsecutiveOrdine(linii),
    revizuire: {
      an: options?.an ?? getCurrentSezon(),
      parcele_ids: options?.parcelaId ? [options.parcelaId] : [],
    },
  }
}

export function groupTemplateLinesByStage(template: PlanTemplate) {
  const groups = new Map<string, PlanTemplateLine[]>()

  for (const line of template.lines) {
    const label = getLabelPentruGrup(line.stadiu, 'rubus', { cohort: line.cohort })
    groups.set(label, [...(groups.get(label) ?? []), line])
  }

  return [...groups.entries()].map(([label, lines]) => ({ label, lines }))
}
