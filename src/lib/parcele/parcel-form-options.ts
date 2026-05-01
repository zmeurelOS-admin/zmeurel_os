import type { ParcelaScop, StatusOperational } from '@/lib/parcele/dashboard-relevance'
import { normalizeUnitateTip, type UnitateTip } from '@/lib/parcele/unitate'

export interface EmojiOption {
  value: string
  label: string
  emoji: string
}

export const MANUAL_CULTURE_OPTION_VALUE = '__manual_culture__'
export const MANUAL_CULTURE_OPTION: EmojiOption = {
  value: MANUAL_CULTURE_OPTION_VALUE,
  label: 'Altă cultură / adaugă manual',
  emoji: '✍️',
}

export const MANUAL_VARIETY_OPTION_VALUE = '__manual_variety__'
export const MANUAL_VARIETY_OPTION: EmojiOption = {
  value: MANUAL_VARIETY_OPTION_VALUE,
  label: 'Alt soi / adaugă manual',
  emoji: '✍️',
}

const PARCEL_UNITATE_OPTIONS: Record<UnitateTip, EmojiOption> = {
  camp: { value: 'camp', label: 'Câmp', emoji: '🌱' },
  solar: { value: 'solar', label: 'Solar', emoji: '🏡' },
  livada: { value: 'livada', label: 'Livadă', emoji: '🌳' },
  cultura_mare: { value: 'cultura_mare', label: 'Cultură mare', emoji: '🌾' },
}

const PARCEL_SCOP_OPTIONS: Record<ParcelaScop, EmojiOption> = {
  comercial: { value: 'comercial', label: 'Producție comercială', emoji: '🛒' },
  personal: { value: 'personal', label: 'Uz personal', emoji: '🏠' },
  experimental: { value: 'experimental', label: 'Experimental', emoji: '🧪' },
  inactiv: { value: 'inactiv', label: 'Inactiv', emoji: '⏸️' },
}

const PARCEL_STATUS_OPERATIONAL_OPTIONS: Record<StatusOperational, EmojiOption> = {
  activ: { value: 'activ', label: 'Activ', emoji: '🟢' },
  in_pauza: { value: 'in_pauza', label: 'În pauză', emoji: '⏸️' },
  neproductiv: { value: 'neproductiv', label: 'Neproductiv', emoji: '⚪' },
  infiintare: { value: 'infiintare', label: 'În înființare', emoji: '🛠️' },
  arhivat: { value: 'arhivat', label: 'Arhivat', emoji: '📦' },
}

const PARCEL_STATUS_OPTIONS: EmojiOption[] = [
  { value: 'Activ', label: 'Activ', emoji: '🟢' },
  { value: 'Inactiv', label: 'Inactiv', emoji: '⚪' },
  { value: 'In Pregatire', label: 'În pregătire', emoji: '🛠️' },
]

const CULTURA_OPTIONS_BY_TIP: Record<Exclude<UnitateTip, 'solar'>, EmojiOption[]> = {
  camp: [
    { value: 'Zmeură', label: 'Zmeură', emoji: '🍓' },
    { value: 'Afin', label: 'Afin', emoji: '🫐' },
    { value: 'Mur', label: 'Mur', emoji: '🍇' },
    { value: 'Căpșun', label: 'Căpșun', emoji: '🍓' },
    { value: 'Coacăz', label: 'Coacăz', emoji: '🔴' },
    { value: 'Agriș', label: 'Agriș', emoji: '🟢' },
    { value: 'Goji', label: 'Goji', emoji: '🟠' },
  ],
  livada: [
    { value: 'Măr', label: 'Măr', emoji: '🍎' },
    { value: 'Păr', label: 'Păr', emoji: '🍐' },
    { value: 'Prun', label: 'Prun', emoji: '🟣' },
    { value: 'Cireș', label: 'Cireș', emoji: '🍒' },
    { value: 'Vișin', label: 'Vișin', emoji: '🍒' },
    { value: 'Cais', label: 'Cais', emoji: '🍑' },
    { value: 'Piersic', label: 'Piersic', emoji: '🍑' },
    { value: 'Nuc', label: 'Nuc', emoji: '🌰' },
    { value: 'Alun', label: 'Alun', emoji: '🌰' },
  ],
  cultura_mare: [
    { value: 'Grâu', label: 'Grâu', emoji: '🌾' },
    { value: 'Porumb', label: 'Porumb', emoji: '🌽' },
    { value: 'Floarea-soarelui', label: 'Floarea-soarelui', emoji: '🌻' },
    { value: 'Rapiță', label: 'Rapiță', emoji: '🌼' },
    { value: 'Orz', label: 'Orz', emoji: '🌾' },
    { value: 'Ovăz', label: 'Ovăz', emoji: '🌾' },
    { value: 'Soia', label: 'Soia', emoji: '🫘' },
    { value: 'Cartof', label: 'Cartof', emoji: '🥔' },
    { value: 'Sfeclă', label: 'Sfeclă', emoji: '🫜' },
  ],
}

function createVarietyOptions(emoji: string, values: string[]): EmojiOption[] {
  return values.map((value) => ({ value, label: value, emoji }))
}

const SOI_OPTIONS_BY_CULTURA: Record<string, EmojiOption[]> = {
  zmeura: createVarietyOptions('🍓', ['Delniwa', 'Maravilla', 'Enrosadira', 'Polka', 'Polana', 'Glen Ample', 'Tulameen', 'Heritage']),
  afin: createVarietyOptions('🫐', ['Duke', 'Bluecrop', 'Legacy', 'Chandler', 'Elliot', 'Draper', 'Patriot']),
  mur: createVarietyOptions('🍇', ['Loch Ness', 'Chester', 'Thornfree', 'Triple Crown', 'Navaho', 'Black Satin']),
  capsun: createVarietyOptions('🍓', ['Albion', 'Clery', 'Elsanta', 'Asia', 'Sonata', 'San Andreas']),
  coacaz: createVarietyOptions('🔴', ['Rovada', 'Jonkheer van Tets', 'Titania', 'Ben Lomond']),
  agris: createVarietyOptions('🟢', ['Invicta', 'Hinnonmaki Red', 'Captivator']),
  goji: createVarietyOptions('🟠', ['Ningxia', 'Big Lifeberry']),
  mar: createVarietyOptions('🍎', ['Golden Delicious', 'Idared', 'Florina', 'Gala', 'Fuji', 'Jonathan', 'Granny Smith']),
  par: createVarietyOptions('🍐', ['Williams', 'Conference', 'Abate Fetel', 'Cure', 'Untoasă Bosc']),
  prun: createVarietyOptions('🟣', ['Stanley', 'Tuleu gras', 'Anna Spath', 'President', 'Record']),
  cires: createVarietyOptions('🍒', ['Kordia', 'Regina', 'Van', 'Stella', 'Ferrovia']),
  visin: createVarietyOptions('🍒', ['Oblacinska', 'Schattenmorelle', 'Nana']),
  cais: createVarietyOptions('🍑', ['Bergeron', 'Cegledi', 'Goldrich', 'Sulmona']),
  piersic: createVarietyOptions('🍑', ['Redhaven', 'Springcrest', 'Cardinal', 'Collins']),
  nuc: createVarietyOptions('🌰', ['Chandler', 'Lara', 'Fernor', 'Franquette']),
  alun: createVarietyOptions('🌰', ['Tonda Gentile', 'Barcelona', 'Cosford']),
  grau: createVarietyOptions('🌾', ['Glosa', 'Miranda', 'Izvor', 'Pitar', 'Dropia']),
  porumb: createVarietyOptions('🌽', ['Pioneer', 'Dekalb', 'KWS', 'Limagrain', 'RAGT']),
  'floarea-soarelui': createVarietyOptions('🌻', ['Pioneer', 'Syngenta', 'LG', 'KWS']),
  rapita: createVarietyOptions('🌼', ['DK Exstorm', 'PT303', 'LG Architect', 'KWS Umberto']),
  orz: createVarietyOptions('🌾', ['Cardinal', 'Artemis', 'Sandra']),
  ovaz: createVarietyOptions('🌾', ['Mureșana', 'Someșan']),
  soia: createVarietyOptions('🫘', ['Felix', 'Onix', 'PR92B63']),
  cartof: createVarietyOptions('🥔', ['Agria', 'Riviera', 'Desiree', 'Red Scarlett', 'Bellarosa']),
  sfecla: createVarietyOptions('🫜', ['KWS', 'Strube', 'SESVanderHave']),
}

const CULTURA_ALIASES = new Map<string, string>([
  ['zmeura', 'Zmeură'],
  ['zmeură', 'Zmeură'],
  ['afin', 'Afin'],
  ['afine', 'Afin'],
  ['mur', 'Mur'],
  ['mure', 'Mur'],
  ['capsun', 'Căpșun'],
  ['capsuni', 'Căpșun'],
  ['căpșun', 'Căpșun'],
  ['căpșuni', 'Căpșun'],
  ['coacaz', 'Coacăz'],
  ['coacaze', 'Coacăz'],
  ['coacăz', 'Coacăz'],
  ['coacăze', 'Coacăz'],
  ['agris', 'Agriș'],
  ['agrise', 'Agriș'],
  ['agriș', 'Agriș'],
  ['agrișe', 'Agriș'],
  ['mar', 'Măr'],
  ['măr', 'Măr'],
  ['par', 'Păr'],
  ['păr', 'Păr'],
  ['prun', 'Prun'],
  ['cires', 'Cireș'],
  ['cireș', 'Cireș'],
  ['visin', 'Vișin'],
  ['vișin', 'Vișin'],
  ['cais', 'Cais'],
  ['piersic', 'Piersic'],
  ['nuc', 'Nuc'],
  ['alun', 'Alun'],
  ['grau', 'Grâu'],
  ['grâu', 'Grâu'],
  ['porumb', 'Porumb'],
  ['floarea soarelui', 'Floarea-soarelui'],
  ['floarea-soarelui', 'Floarea-soarelui'],
  ['rapita', 'Rapiță'],
  ['rapiță', 'Rapiță'],
  ['orz', 'Orz'],
  ['ovaz', 'Ovăz'],
  ['ovăz', 'Ovăz'],
  ['soia', 'Soia'],
  ['cartof', 'Cartof'],
  ['sfecla', 'Sfeclă'],
  ['sfeclă', 'Sfeclă'],
  ['goji', 'Goji'],
])

function normalizeLabel(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function getCultureCatalogKey(value: string | null | undefined): string {
  return normalizeLabel(canonicalCulture(value))
}

function canonicalCulture(value: string | null | undefined): string {
  const normalized = normalizeLabel(value)
  return CULTURA_ALIASES.get(normalized) ?? (value ?? '').trim()
}

function inferCultureFromVariety(variety: string | null | undefined): string {
  const normalizedVariety = normalizeLabel(variety)
  if (!normalizedVariety) return ''

  for (const [cultureKey, options] of Object.entries(SOI_OPTIONS_BY_CULTURA)) {
    if (options.some((option) => normalizeLabel(option.value) === normalizedVariety)) {
      return canonicalCulture(cultureKey)
    }
  }

  return ''
}

export const SOLAR_CULTURA_MESSAGE = 'Pentru solarii, culturile se adaugă ulterior din detaliile parcelei.'

export function formatEmojiOptionLabel(option: EmojiOption): string {
  return `${option.emoji} ${option.label}`
}

export function getParcelUnitateOptions(): EmojiOption[] {
  return Object.values(PARCEL_UNITATE_OPTIONS)
}

export function getParcelScopOptions(): EmojiOption[] {
  return Object.values(PARCEL_SCOP_OPTIONS)
}

export function getParcelStatusOperationalOptions(): EmojiOption[] {
  return Object.values(PARCEL_STATUS_OPERATIONAL_OPTIONS)
}

export function getParcelStatusOptions(): EmojiOption[] {
  return PARCEL_STATUS_OPTIONS
}

export function getCulturiOptionsForTip(tipUnitate: string | null | undefined, currentValue?: string | null): EmojiOption[] {
  void currentValue
  const tip = normalizeUnitateTip(tipUnitate)
  if (tip === 'solar') return []
  return [...CULTURA_OPTIONS_BY_TIP[tip], MANUAL_CULTURE_OPTION]
}

export function isKnownCultureForTip(tipUnitate: string | null | undefined, cultura: string | null | undefined): boolean {
  const current = (cultura ?? '').trim()
  if (!current) return false
  const tip = normalizeUnitateTip(tipUnitate)
  if (tip === 'solar') return false
  return CULTURA_OPTIONS_BY_TIP[tip].some((option) => normalizeLabel(option.value) === getCultureCatalogKey(current))
}

export function getCultureSelectValue(tipUnitate: string | null | undefined, cultura: string | null | undefined): string {
  const current = (cultura ?? '').trim()
  if (!current) return '__none'
  return isKnownCultureForTip(tipUnitate, current) ? canonicalCulture(current) : MANUAL_CULTURE_OPTION_VALUE
}

export function getSoiOptionsForCultura(cultura: string | null | undefined, currentValue?: string | null): EmojiOption[] {
  void currentValue
  const normalizedCulture = getCultureCatalogKey(cultura)
  const options = SOI_OPTIONS_BY_CULTURA[normalizedCulture] ?? []
  return [...options, MANUAL_VARIETY_OPTION]
}

export function isKnownVarietyForCulture(cultura: string | null | undefined, soi: string | null | undefined): boolean {
  const current = (soi ?? '').trim()
  if (!current) return false
  const options = SOI_OPTIONS_BY_CULTURA[getCultureCatalogKey(cultura)] ?? []
  return options.some((option) => normalizeLabel(option.value) === normalizeLabel(current))
}

export function getSoiSelectValue(cultura: string | null | undefined, soi: string | null | undefined): string {
  const current = (soi ?? '').trim()
  if (!current) return '__none'
  return isKnownVarietyForCulture(cultura, current) ? current : MANUAL_VARIETY_OPTION_VALUE
}

export function getOptionDisplayLabel(
  options: EmojiOption[],
  value: string | null | undefined,
  fallbackEmoji = '🌿'
): string {
  const current = (value ?? '').trim()
  if (!current) return '—'
  const option = options.find((item) => normalizeLabel(item.value) === normalizeLabel(current))
  return option ? formatEmojiOptionLabel(option) : `${fallbackEmoji} ${current}`
}

export function serializeParcelLegacyCropLabel(cultura: string | null | undefined, soi: string | null | undefined): string {
  const normalizedCulture = canonicalCulture(cultura)
  const normalizedVariety = (soi ?? '').trim()
  if (normalizedCulture && normalizedVariety) return `${normalizedCulture} - ${normalizedVariety}`
  return normalizedVariety || normalizedCulture
}

export function parseParcelCropValues(input: {
  cultura?: string | null
  soi?: string | null
  soi_plantat?: string | null
  tip_fruct?: string | null
}): { cultura: string; soi: string; soi_plantat: string } {
  let cultura = canonicalCulture(input.cultura)
  let soi = (input.soi ?? '').trim()
  const tipFruct = canonicalCulture(input.tip_fruct)
  const legacy = (input.soi_plantat ?? '').trim()

  if (!cultura && tipFruct) {
    cultura = tipFruct
  }

  if (legacy) {
    const separatorIndex = legacy.indexOf(' - ')
    if (separatorIndex > 0) {
      const parsedCulture = canonicalCulture(legacy.slice(0, separatorIndex))
      const parsedVariety = legacy.slice(separatorIndex + 3).trim()
      if (!cultura && parsedCulture) cultura = parsedCulture
      if (!soi && parsedVariety) soi = parsedVariety
    } else {
      if (!cultura) {
        const inferredCulture = canonicalCulture(legacy)
        const inferredFromVariety = inferCultureFromVariety(legacy)
        if (CULTURA_ALIASES.has(normalizeLabel(inferredCulture))) {
          cultura = inferredCulture
        } else if (inferredFromVariety) {
          cultura = inferredFromVariety
          soi = soi || legacy
        } else {
          soi = soi || legacy
        }
      } else if (!soi && normalizeLabel(legacy) !== normalizeLabel(cultura)) {
        soi = legacy
      }
    }
  }

  return {
    cultura,
    soi,
    soi_plantat: legacy || serializeParcelLegacyCropLabel(cultura, soi),
  }
}
