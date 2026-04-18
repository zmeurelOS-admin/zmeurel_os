'use client'

import type { ComponentProps } from 'react'
import { useMemo, useState, useTransition } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  FileSpreadsheet,
  Loader2,
  PlusCircle,
  Search,
  SkipForward,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

import { listProduseFitosanitareAction } from '@/app/(dashboard)/tratamente/produse-fitosanitare/actions'
import {
  saveImportedPlansAction,
  type DraftProdusImport,
  type ParseResult,
  type ParsedLine,
  type PlanSaveInput,
  type ProdusMatch,
} from '@/app/(dashboard)/tratamente/planuri/import/actions'
import { AppCard } from '@/components/ui/app-card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { queryKeys } from '@/lib/query-keys'
import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'
import {
  CULTURA_LABELS,
  CULTURI_ACCEPTATE,
  STADIU_LABELS,
  STADII_VALIDE,
} from '@/lib/tratamente/import/template-spec'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

type LineAction =
  | 'use_exact'
  | 'use_suggestion'
  | 'use_library'
  | 'create_new'
  | 'free_text'
  | 'skip'

interface ReviewLineState extends ParsedLine {
  actiune: LineAction | null
  produs_id: string | null
  produs_nume_manual: string | null
  produs_de_creat?: DraftProdusImport
  selectedSuggestionIndex: number | null
}

interface ReviewPlanState {
  foaie_nume: string
  nume: string
  cultura_tip: string
  descriere: string
  parse_errors: Array<{ row: number; message: string }>
  linii: ReviewLineState[]
}

interface ProductEditorState {
  planIndex: number
  lineIndex: number
  draft: DraftProdusImport
}

const PRODUCT_TIP_OPTIONS = [
  'fungicid',
  'insecticid',
  'erbicid',
  'acaricid',
  'foliar',
  'ingrasamant',
  'bioregulator',
  'altul',
] as const

function toNullableText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toNullableNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function formatDose(line: Pick<ReviewLineState, 'doza_ml_per_hl' | 'doza_l_per_ha'>) {
  if (typeof line.doza_ml_per_hl === 'number') {
    return `${line.doza_ml_per_hl} ml/hl`
  }
  if (typeof line.doza_l_per_ha === 'number') {
    return `${line.doza_l_per_ha} l/ha`
  }
  return 'Doză lipsă'
}

function countDoseValues(line: Pick<ReviewLineState, 'doza_ml_per_hl' | 'doza_l_per_ha'>) {
  return Number(line.doza_ml_per_hl != null) + Number(line.doza_l_per_ha != null)
}

function buildDefaultDraftProdus(
  line: ReviewLineState,
  culturaTip: string
): DraftProdusImport {
  return {
    nume_comercial: line.produs_input.trim() || 'Produs nou',
    substanta_activa: '',
    tip: 'fungicid',
    phi_zile: null,
    doza_min_ml_per_hl: null,
    doza_max_ml_per_hl: null,
    doza_min_l_per_ha: null,
    doza_max_l_per_ha: null,
    omologat_culturi: culturaTip ? [culturaTip] : [],
  }
}

function buildInitialPlans(parseResult: ParseResult): ReviewPlanState[] {
  return parseResult.planuri.map((plan) => ({
    foaie_nume: plan.foaie_nume,
    nume: plan.plan_metadata.nume_sugerat,
    cultura_tip: plan.plan_metadata.cultura_tip_detectat ?? '',
    descriere: plan.plan_metadata.descriere ?? '',
    parse_errors: plan.errors,
    linii: plan.linii.map((line) => {
      if (line.produs_match.tip === 'exact') {
        return {
          ...line,
          actiune: 'use_exact' as const,
          produs_id: line.produs_match.produs_id,
          produs_nume_manual: null,
          selectedSuggestionIndex: null,
        }
      }

      return {
        ...line,
        actiune: null,
        produs_id: null,
        produs_nume_manual: null,
        selectedSuggestionIndex: null,
      }
    }),
  }))
}

function resolveSuggestionLabel(match: ProdusMatch, index: number) {
  if (match.tip !== 'fuzzy') return null
  const suggestion = match.sugestii[index]
  if (!suggestion) return null
  return `Folosește „${suggestion.produs_nume}” (${suggestion.scor}%)`
}

function getLineBlockingIssues(line: ReviewLineState): string[] {
  const issues: string[] = []

  if (!Number.isInteger(line.ordine) || line.ordine < 1) {
    issues.push('Ordinea este invalidă.')
  }
  if (!line.stadiu_trigger.trim()) {
    issues.push('Stadiul trebuie selectat.')
  }
  const doseCount = countDoseValues(line)
  const hasNegativeDose =
    (typeof line.doza_ml_per_hl === 'number' && line.doza_ml_per_hl < 0) ||
    (typeof line.doza_l_per_ha === 'number' && line.doza_l_per_ha < 0)

  if (hasNegativeDose) {
    issues.push('Doza nu poate fi negativă.')
  }
  if (doseCount !== 1) {
    issues.push('Completează exact una dintre doze: ml/hl sau l/ha.')
  }

  if (line.actiune === 'skip') {
    return issues
  }

  if (!line.actiune) {
    issues.push('Alege cum se rezolvă produsul pentru această linie.')
    return issues
  }

  if (
    (line.actiune === 'use_exact' ||
      line.actiune === 'use_suggestion' ||
      line.actiune === 'use_library') &&
    !line.produs_id
  ) {
    issues.push('Produsul din bibliotecă nu este selectat.')
  }

  if (line.actiune === 'free_text' && !toNullableText(line.produs_nume_manual)) {
    issues.push('Textul liber pentru produs este gol.')
  }

  if (line.actiune === 'create_new') {
    const draft = line.produs_de_creat
    if (!draft) {
      issues.push('Produsul nou nu este configurat.')
    } else {
      if (!toNullableText(draft.nume_comercial)) {
        issues.push('Produsul nou are nevoie de nume comercial.')
      }
      if (!toNullableText(draft.substanta_activa)) {
        issues.push('Produsul nou are nevoie de substanță activă.')
      }
      if (!toNullableText(draft.tip)) {
        issues.push('Produsul nou are nevoie de tip.')
      }
      if (!draft.omologat_culturi || draft.omologat_culturi.length === 0) {
        issues.push('Produsul nou trebuie să aibă cel puțin o cultură omologată.')
      }
    }
  }

  return issues
}

function getMatchBadge(
  line: ReviewLineState,
  produseById: Map<string, ProdusFitosanitar>
): { text: string; variant: ComponentProps<typeof Badge>['variant'] } {
  if (line.actiune === 'skip') {
    return { text: 'Skip', variant: 'secondary' }
  }

  if (line.actiune === 'free_text') {
    return {
      text: `Text liber — ${line.produs_nume_manual ?? line.produs_input}`,
      variant: 'info',
    }
  }

  if (line.actiune === 'create_new' && line.produs_de_creat) {
    return {
      text: `Produs nou — ${line.produs_de_creat.nume_comercial}`,
      variant: 'info',
    }
  }

  if (
    (line.actiune === 'use_exact' ||
      line.actiune === 'use_suggestion' ||
      line.actiune === 'use_library') &&
    line.produs_id
  ) {
    const produs = produseById.get(line.produs_id)
    if (line.actiune === 'use_suggestion') {
      const score =
        line.produs_match.tip === 'fuzzy' && line.selectedSuggestionIndex != null
          ? line.produs_match.sugestii[line.selectedSuggestionIndex]?.scor
          : null

      return {
        text: `Sugestie — ${produs?.nume_comercial ?? 'Produs'}${
          score ? ` (${score}%)` : ''
        }`,
        variant: 'warning',
      }
    }

    if (line.actiune === 'use_library') {
      return {
        text: `Bibliotecă — ${produs?.nume_comercial ?? 'Produs selectat'}`,
        variant: 'default',
      }
    }

    return {
      text: `Exact — ${produs?.nume_comercial ?? 'Produs detectat'}`,
      variant: 'default',
    }
  }

  if (line.produs_match.tip === 'fuzzy') {
    const top = line.produs_match.sugestii[0]
    return {
      text: `Sugestie — ${top?.produs_nume ?? 'Produs'}${
        top?.scor ? ` (${top.scor}%)` : ''
      }`,
      variant: 'warning',
    }
  }

  return { text: 'Necunoscut', variant: 'destructive' }
}

function ProductLibraryPopover({
  open,
  onOpenChange,
  produse,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  produse: ProdusFitosanitar[]
  onSelect: (produs: ProdusFitosanitar) => void
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Search className="h-4 w-4" />
          Selectează din bibliotecă
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,360px)] p-0">
        <PopoverHeader className="border-b px-4 py-3">
          <PopoverTitle>Alege produsul potrivit</PopoverTitle>
        </PopoverHeader>
        <Command>
          <CommandInput placeholder="Caută după nume sau substanță activă…" />
          <CommandList>
            <CommandEmpty>Nu am găsit produse care să se potrivească.</CommandEmpty>
            <CommandGroup heading="Bibliotecă produse">
              {produse.map((produs) => (
                <CommandItem
                  key={produs.id}
                  value={`${produs.nume_comercial} ${produs.substanta_activa ?? ''}`}
                  onSelect={() => onSelect(produs)}
                  className="items-start py-3"
                >
                  <Database className="mt-0.5 h-4 w-4" />
                  <div className="min-w-0 space-y-1">
                    <p className="line-clamp-1 font-medium text-[var(--text-primary)]">
                      {produs.nume_comercial}
                    </p>
                    <p className="line-clamp-2 text-xs text-[var(--text-secondary)]">
                      {produs.substanta_activa || 'Substanță activă nespecificată'}
                    </p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function ProductEditorContent({
  draft,
  onChange,
  culturaTip,
  onCancel,
  onSave,
}: {
  draft: DraftProdusImport
  onChange: (draft: DraftProdusImport) => void
  culturaTip: string
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="produs-nume-comercial">Nume comercial</Label>
          <Input
            id="produs-nume-comercial"
            value={draft.nume_comercial}
            onChange={(event) =>
              onChange({ ...draft, nume_comercial: event.target.value })
            }
            placeholder="Ex: Mospilan 20 SG"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="produs-substanta-activa">Substanță activă</Label>
          <Input
            id="produs-substanta-activa"
            value={draft.substanta_activa}
            onChange={(event) =>
              onChange({ ...draft, substanta_activa: event.target.value })
            }
            placeholder="Ex: acetamiprid"
          />
        </div>

        <div className="space-y-2">
          <Label>Tip</Label>
          <Select
            value={draft.tip}
            onValueChange={(value) => onChange({ ...draft, tip: value as DraftProdusImport['tip'] })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selectează tipul" />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_TIP_OPTIONS.map((tip) => (
                <SelectItem key={tip} value={tip}>
                  {tip}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="produs-phi">PHI (zile)</Label>
          <Input
            id="produs-phi"
            type="number"
            min={0}
            value={draft.phi_zile ?? ''}
            onChange={(event) =>
              onChange({ ...draft, phi_zile: toNullableNumber(event.target.value) })
            }
            placeholder="Opțional"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="produs-doza-min-ml">Doză min ml/hl</Label>
          <Input
            id="produs-doza-min-ml"
            type="number"
            min={0}
            step="0.01"
            value={draft.doza_min_ml_per_hl ?? ''}
            onChange={(event) =>
              onChange({
                ...draft,
                doza_min_ml_per_hl: toNullableNumber(event.target.value),
              })
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="produs-doza-max-ml">Doză max ml/hl</Label>
          <Input
            id="produs-doza-max-ml"
            type="number"
            min={0}
            step="0.01"
            value={draft.doza_max_ml_per_hl ?? ''}
            onChange={(event) =>
              onChange({
                ...draft,
                doza_max_ml_per_hl: toNullableNumber(event.target.value),
              })
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="produs-doza-min-l">Doză min l/ha</Label>
          <Input
            id="produs-doza-min-l"
            type="number"
            min={0}
            step="0.01"
            value={draft.doza_min_l_per_ha ?? ''}
            onChange={(event) =>
              onChange({
                ...draft,
                doza_min_l_per_ha: toNullableNumber(event.target.value),
              })
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="produs-doza-max-l">Doză max l/ha</Label>
          <Input
            id="produs-doza-max-l"
            type="number"
            min={0}
            step="0.01"
            value={draft.doza_max_l_per_ha ?? ''}
            onChange={(event) =>
              onChange({
                ...draft,
                doza_max_l_per_ha: toNullableNumber(event.target.value),
              })
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Culturi omologate</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {CULTURI_ACCEPTATE.map((cultura) => {
            const checked = draft.omologat_culturi?.includes(cultura) ?? false
            return (
              <label
                key={cultura}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border px-3 py-2 text-sm',
                  checked
                    ? 'border-[var(--agri-primary)] bg-[color:color-mix(in_srgb,var(--agri-primary)_8%,var(--surface-card))]'
                    : 'border-[var(--border-default)] bg-[var(--surface-card)]'
                )}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--agri-primary)]"
                  checked={checked}
                  onChange={(event) => {
                    const current = new Set(draft.omologat_culturi ?? [])
                    if (event.target.checked) {
                      current.add(cultura)
                    } else {
                      current.delete(cultura)
                    }
                    onChange({ ...draft, omologat_culturi: [...current] })
                  }}
                />
                <span>
                  {CULTURA_LABELS[cultura]}
                  {culturaTip === cultura ? ' • cultura planului' : ''}
                </span>
              </label>
            )
          })}
        </div>
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="outline" onClick={onCancel}>
          Anulează
        </Button>
        <Button type="button" onClick={onSave}>
          Salvează produsul pentru review
        </Button>
      </DialogFooter>
    </div>
  )
}

export function ReviewStep({
  parseResult,
  onReset,
}: {
  parseResult: ParseResult
  onReset: () => void
}) {
  const router = useRouter()
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const currentYear = new Date().getFullYear()
  const [anPlan, setAnPlan] = useState(currentYear)
  const [planuriEditate, setPlanuriEditate] = useState<ReviewPlanState[]>(
    () => buildInitialPlans(parseResult)
  )
  const [libraryTarget, setLibraryTarget] = useState<{
    planIndex: number
    lineIndex: number
  } | null>(null)
  const [productEditor, setProductEditor] = useState<ProductEditorState | null>(
    null
  )
  const [expandedPlans, setExpandedPlans] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(parseResult.planuri.map((plan) => [plan.foaie_nume, true]))
  )
  const [isSaving, startSaving] = useTransition()

  const { data: produseBiblioteca = [], isLoading: produseLoading } = useQuery({
    queryKey: queryKeys.produseFitosanitare,
    queryFn: listProduseFitosanitareAction,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  const produseById = useMemo(
    () => new Map(produseBiblioteca.map((produs) => [produs.id, produs])),
    [produseBiblioteca]
  )

  const planSummaries = useMemo(() => {
    return planuriEditate.map((plan) => {
      const unresolvedLineIssues = plan.linii.reduce(
        (acc, line) => acc + getLineBlockingIssues(line).length,
        0
      )
      const metadataIssues =
        Number(plan.nume.trim().length === 0) +
        Number(plan.cultura_tip.trim().length === 0)
      const warningCount = plan.linii.reduce(
        (acc, line) => acc + line.warnings.length,
        0
      )

      return {
        lineCount: plan.linii.length,
        errorCount: unresolvedLineIssues + metadataIssues + plan.parse_errors.length,
        warningCount,
      }
    })
  }, [planuriEditate])

  const hasBlockingIssues = useMemo(
    () => planSummaries.some((summary) => summary.errorCount > 0),
    [planSummaries]
  )

  const hasGlobalErrors = parseResult.global_errors.length > 0

  function updateLine(
    planIndex: number,
    lineIndex: number,
    updater: (line: ReviewLineState) => ReviewLineState
  ) {
    setPlanuriEditate((current) =>
      current.map((plan, currentPlanIndex) => {
        if (currentPlanIndex !== planIndex) return plan
        return {
          ...plan,
          linii: plan.linii.map((line, currentLineIndex) =>
            currentLineIndex === lineIndex ? updater(line) : line
          ),
        }
      })
    )
  }

  function updatePlan(
    planIndex: number,
    updater: (plan: ReviewPlanState) => ReviewPlanState
  ) {
    setPlanuriEditate((current) =>
      current.map((plan, index) => (index === planIndex ? updater(plan) : plan))
    )
  }

  function setLineAction(
    planIndex: number,
    lineIndex: number,
    value: string
  ) {
    const line = planuriEditate[planIndex]?.linii[lineIndex]
    if (!line) return

    if (value.startsWith('suggestion:')) {
      const suggestionIndex = Number(value.split(':')[1] ?? '-1')
      if (
        line.produs_match.tip !== 'fuzzy' ||
        !line.produs_match.sugestii[suggestionIndex]
      ) {
        return
      }
      const suggestion = line.produs_match.sugestii[suggestionIndex]
      updateLine(planIndex, lineIndex, (currentLine) => ({
        ...currentLine,
        actiune: 'use_suggestion',
        produs_id: suggestion.produs_id,
        produs_nume_manual: null,
        produs_de_creat: undefined,
        selectedSuggestionIndex: suggestionIndex,
      }))
      return
    }

    if (value === 'library') {
      setLibraryTarget({ planIndex, lineIndex })
      return
    }

    if (value === 'create_new') {
      const plan = planuriEditate[planIndex]
      setProductEditor({
        planIndex,
        lineIndex,
        draft:
          line.produs_de_creat ??
          buildDefaultDraftProdus(line, plan?.cultura_tip ?? ''),
      })
      return
    }

    if (value === 'free_text') {
      updateLine(planIndex, lineIndex, (currentLine) => ({
        ...currentLine,
        actiune: 'free_text',
        produs_id: null,
        produs_nume_manual: currentLine.produs_input.trim() || null,
        produs_de_creat: undefined,
        selectedSuggestionIndex: null,
      }))
      return
    }

    if (value === 'skip') {
      updateLine(planIndex, lineIndex, (currentLine) => ({
        ...currentLine,
        actiune: 'skip',
        produs_id: null,
        produs_nume_manual: null,
        produs_de_creat: undefined,
        selectedSuggestionIndex: null,
      }))
    }
  }

  function applyAllFuzzySuggestions() {
    setPlanuriEditate((current) =>
      current.map((plan) => ({
        ...plan,
        linii: plan.linii.map((line) => {
          if (
            line.actiune ||
            line.produs_match.tip !== 'fuzzy' ||
            line.produs_match.sugestii.length === 0
          ) {
            return line
          }

          const firstSuggestion = line.produs_match.sugestii[0]
          return {
            ...line,
            actiune: 'use_suggestion',
            produs_id: firstSuggestion.produs_id,
            produs_nume_manual: null,
            selectedSuggestionIndex: 0,
          }
        }),
      }))
    )
  }

  function handleLibrarySelection(produs: ProdusFitosanitar) {
    if (!libraryTarget) return
    updateLine(libraryTarget.planIndex, libraryTarget.lineIndex, (line) => ({
      ...line,
      actiune: 'use_library',
      produs_id: produs.id,
      produs_nume_manual: null,
      produs_de_creat: undefined,
      selectedSuggestionIndex: null,
    }))
    setLibraryTarget(null)
  }

  function handleSaveDraftProduct() {
    if (!productEditor) return

    updateLine(productEditor.planIndex, productEditor.lineIndex, (line) => ({
      ...line,
      actiune: 'create_new',
      produs_id: null,
      produs_nume_manual: null,
      produs_de_creat: {
        ...productEditor.draft,
        nume_comercial: productEditor.draft.nume_comercial.trim(),
        substanta_activa: productEditor.draft.substanta_activa.trim(),
        frac_irac: toNullableText(productEditor.draft.frac_irac ?? ''),
      },
      selectedSuggestionIndex: null,
    }))
    setProductEditor(null)
  }

  function buildSavePayload(): PlanSaveInput[] {
    return planuriEditate
      .map((plan) => ({
        plan_metadata: {
          nume: plan.nume.trim(),
          cultura_tip: plan.cultura_tip.trim(),
          descriere: toNullableText(plan.descriere),
        },
        linii: plan.linii
          .filter((line) => line.actiune !== 'skip')
          .map((line) => ({
            ordine: line.ordine,
            stadiu_trigger: line.stadiu_trigger,
            produs_id:
              line.actiune === 'use_exact' ||
              line.actiune === 'use_suggestion' ||
              line.actiune === 'use_library'
                ? line.produs_id
                : null,
            produs_nume_manual:
              line.actiune === 'free_text'
                ? toNullableText(line.produs_nume_manual)
                : null,
            doza_ml_per_hl: line.doza_ml_per_hl,
            doza_l_per_ha: line.doza_l_per_ha,
            observatii: toNullableText(line.observatii),
            produs_de_creat:
              line.actiune === 'create_new' ? line.produs_de_creat : undefined,
          })),
      }))
      .filter((plan) => plan.linii.length > 0)
  }

  function handleSave() {
    if (hasBlockingIssues) {
      toast.error('Rezolvă erorile rămase înainte de salvare.')
      return
    }

    const payload = buildSavePayload()
    if (payload.length === 0) {
      toast.error('Nu mai există linii de importat după skip-urile alese.')
      return
    }

    startSaving(async () => {
      try {
        const result = await saveImportedPlansAction(payload, anPlan)

        const params = new URLSearchParams()
        params.set('imported', String(result.success))
        params.set('failed', String(result.failed.length))
        if (result.failed.length > 0) {
          params.set(
            'failedPlans',
            result.failed.map((item) => item.plan_nume).join('||')
          )
        }

        router.push(`/tratamente/planuri?${params.toString()}`)
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Nu am putut salva planurile importate.'
        )
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-2 z-20">
        <AppCard className="space-y-4 rounded-[24px] border border-[var(--border-default)]/60 p-4 backdrop-blur-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg [font-weight:700] text-[var(--text-primary)]">
                2. Review și salvare
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Verifică produsele detectate, rezolvă ambiguitățile și salvează
                planurile prin RPC-ul existent.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <div className="min-w-[180px] space-y-1">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                  An plan
                </span>
                <Select
                  value={String(anPlan)}
                  onValueChange={(value) => setAnPlan(Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Alege anul" />
                  </SelectTrigger>
                  <SelectContent>
                    {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={applyAllFuzzySuggestions}
              >
                <CheckCircle2 className="h-4 w-4" />
                Aplică toate sugestiile fuzzy automat
              </Button>
              <Button type="button" variant="outline" onClick={onReset}>
                <FileSpreadsheet className="h-4 w-4" />
                Încarcă alt fișier
              </Button>
              <Button
                type="button"
                className="bg-[var(--agri-primary)] text-white"
                disabled={hasBlockingIssues || isSaving || produseLoading}
                onClick={handleSave}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Se salvează...
                  </>
                ) : (
                  'Salvează planurile'
                )}
              </Button>
            </div>
          </div>
        </AppCard>
      </div>

      {hasGlobalErrors ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Au apărut erori la interpretarea fișierului</AlertTitle>
          <AlertDescription>
            {parseResult.global_errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}

      {produseLoading ? (
        <AppCard className="p-5">
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Se încarcă biblioteca de produse pentru căutare și review...
          </div>
        </AppCard>
      ) : null}

      {planuriEditate.map((plan, planIndex) => {
        const summary = planSummaries[planIndex]
        const isOpen = expandedPlans[plan.foaie_nume] ?? true

        return (
          <Collapsible
            key={plan.foaie_nume}
            open={isOpen}
            onOpenChange={(open) =>
              setExpandedPlans((current) => ({
                ...current,
                [plan.foaie_nume]: open,
              }))
            }
          >
            <AppCard className="overflow-hidden rounded-[24px] p-0">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-4 border-b border-[var(--border-default)]/60 px-4 py-4 text-left"
                >
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                        Foaie Excel: {plan.foaie_nume}
                      </p>
                      <h3 className="text-lg [font-weight:700] text-[var(--text-primary)]">
                        {plan.nume || 'Plan fără nume'}
                      </h3>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{summary.lineCount} linii</Badge>
                      <Badge
                        variant={summary.errorCount > 0 ? 'destructive' : 'default'}
                      >
                        {summary.errorCount} erori
                      </Badge>
                      <Badge
                        variant={summary.warningCount > 0 ? 'warning' : 'secondary'}
                      >
                        {summary.warningCount} warnings
                      </Badge>
                    </div>
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--surface-card-muted)]">
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="space-y-4 p-4">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_220px]">
                    <div className="space-y-2">
                      <Label htmlFor={`plan-name-${planIndex}`}>Nume plan</Label>
                      <Input
                        id={`plan-name-${planIndex}`}
                        value={plan.nume}
                        onChange={(event) =>
                          updatePlan(planIndex, (currentPlan) => ({
                            ...currentPlan,
                            nume: event.target.value,
                          }))
                        }
                        placeholder="Ex: Zmeur 2026"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Cultură</Label>
                      <Select
                        value={plan.cultura_tip || '__none'}
                        onValueChange={(value) =>
                          updatePlan(planIndex, (currentPlan) => ({
                            ...currentPlan,
                            cultura_tip: value === '__none' ? '' : value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selectează cultura" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">Selectează cultura</SelectItem>
                          {CULTURI_ACCEPTATE.map((cultura) => (
                            <SelectItem key={cultura} value={cultura}>
                              {CULTURA_LABELS[cultura]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 lg:col-span-2">
                      <Label htmlFor={`plan-desc-${planIndex}`}>Descriere</Label>
                      <Textarea
                        id={`plan-desc-${planIndex}`}
                        rows={3}
                        value={plan.descriere}
                        onChange={(event) =>
                          updatePlan(planIndex, (currentPlan) => ({
                            ...currentPlan,
                            descriere: event.target.value,
                          }))
                        }
                        placeholder="Descriere opțională"
                      />
                    </div>
                  </div>

                  {plan.nume.trim().length === 0 || plan.cultura_tip.trim().length === 0 ? (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Metadate incomplete pentru plan</AlertTitle>
                      <AlertDescription>
                        {plan.nume.trim().length === 0 ? (
                          <p>Numele planului este obligatoriu.</p>
                        ) : null}
                        {plan.cultura_tip.trim().length === 0 ? (
                          <p>Selectează cultura înainte de salvare.</p>
                        ) : null}
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {plan.parse_errors.length > 0 ? (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Foaia are erori de structură</AlertTitle>
                      <AlertDescription>
                        {plan.parse_errors.map((error) => (
                          <p key={`${error.row}-${error.message}`}>
                            Rândul {error.row}: {error.message}
                          </p>
                        ))}
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {isDesktop ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ordine</TableHead>
                          <TableHead>Stadiu</TableHead>
                          <TableHead>Produs input</TableHead>
                          <TableHead>Match</TableHead>
                          <TableHead>Acțiune</TableHead>
                          <TableHead>Doză</TableHead>
                          <TableHead>Observații</TableHead>
                          <TableHead>Warnings</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {plan.linii.map((line, lineIndex) => {
                          const badge = getMatchBadge(line, produseById)
                          const issues = getLineBlockingIssues(line)
                          const libraryOpen =
                            libraryTarget?.planIndex === planIndex &&
                            libraryTarget?.lineIndex === lineIndex

                          return (
                            <TableRow key={`${plan.foaie_nume}-${lineIndex}`}>
                              <TableCell>{line.ordine || '—'}</TableCell>
                              <TableCell className="align-top">
                                {line.stadiu_trigger ? (
                                  <Badge variant="default">
                                    {STADIU_LABELS[line.stadiu_trigger as keyof typeof STADIU_LABELS] ??
                                      line.stadiu_trigger}
                                  </Badge>
                                ) : (
                                  <div className="space-y-2">
                                    <Select
                                      value={line.stadiu_trigger || '__none'}
                                      onValueChange={(value) =>
                                        updateLine(planIndex, lineIndex, (currentLine) => ({
                                          ...currentLine,
                                          stadiu_trigger:
                                            value === '__none' ? '' : value,
                                        }))
                                      }
                                    >
                                      <SelectTrigger className="min-w-[180px]">
                                        <SelectValue placeholder="Alege stadiul" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__none">
                                          Alege stadiul
                                        </SelectItem>
                                        {STADII_VALIDE.map((stadiu) => (
                                          <SelectItem key={stadiu} value={stadiu}>
                                            {STADIU_LABELS[stadiu]}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <p className="text-xs text-[var(--soft-danger-text)]">
                                      Stadiu invalid în fișier: „{line.stadiu_input_raw || 'gol'}”
                                    </p>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="align-top">
                                <div className="space-y-2">
                                  <Badge variant="outline">
                                    {line.produs_input || 'Fără produs în fișier'}
                                  </Badge>
                                  {line.actiune === 'create_new' ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        setProductEditor({
                                          planIndex,
                                          lineIndex,
                                          draft:
                                            line.produs_de_creat ??
                                            buildDefaultDraftProdus(
                                              line,
                                              plan.cultura_tip
                                            ),
                                        })
                                      }
                                    >
                                      <PlusCircle className="h-4 w-4" />
                                      Editează produsul nou
                                    </Button>
                                  ) : null}
                                </div>
                              </TableCell>
                              <TableCell className="align-top">
                                <Badge variant={badge.variant}>{badge.text}</Badge>
                              </TableCell>
                              <TableCell className="align-top">
                                <div className="space-y-2">
                                  {line.produs_match.tip === 'exact' ? (
                                    <Select value="use_exact" disabled>
                                      <SelectTrigger className="min-w-[240px]">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="use_exact">
                                          Folosește „{line.produs_match.produs_nume}”
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Select
                                      value={
                                        line.actiune === 'use_suggestion' &&
                                        line.selectedSuggestionIndex != null
                                          ? `suggestion:${line.selectedSuggestionIndex}`
                                          : line.actiune === 'use_library'
                                            ? 'use_library'
                                            : line.actiune === 'create_new'
                                              ? 'configured_create_new'
                                              : line.actiune === 'free_text'
                                                ? 'free_text'
                                                : line.actiune === 'skip'
                                                  ? 'skip'
                                                  : 'pending'
                                      }
                                      onValueChange={(value) =>
                                        setLineAction(planIndex, lineIndex, value)
                                      }
                                    >
                                      <SelectTrigger className="min-w-[260px]">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="pending">
                                          Alege acțiunea pentru această linie
                                        </SelectItem>
                                        {line.produs_match.tip === 'fuzzy'
                                          ? line.produs_match.sugestii.map(
                                              (_suggestion, suggestionIndex) => (
                                                <SelectItem
                                                  key={suggestionIndex}
                                                  value={`suggestion:${suggestionIndex}`}
                                                >
                                                  {resolveSuggestionLabel(
                                                    line.produs_match,
                                                    suggestionIndex
                                                  )}
                                                </SelectItem>
                                              )
                                            )
                                          : null}
                                        {line.actiune === 'use_library' &&
                                        line.produs_id ? (
                                          <SelectItem value="use_library">
                                            Produs din bibliotecă: {' '}
                                            {produseById.get(line.produs_id)?.nume_comercial ??
                                              'Selectat'}
                                          </SelectItem>
                                        ) : null}
                                        <SelectItem value="library">
                                          Selectează din bibliotecă…
                                        </SelectItem>
                                        {line.actiune === 'create_new' &&
                                        line.produs_de_creat ? (
                                          <SelectItem value="configured_create_new">
                                            Produs nou: {line.produs_de_creat.nume_comercial}
                                          </SelectItem>
                                        ) : null}
                                        <SelectItem value="create_new">
                                          Creează produs nou…
                                        </SelectItem>
                                        <SelectItem
                                          value="free_text"
                                          disabled={!line.produs_input.trim()}
                                        >
                                          Salvează ca text liber („
                                          {line.produs_input || 'fără text'}”)
                                        </SelectItem>
                                        <SelectItem value="skip">
                                          Skip această linie
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  )}

                                  <ProductLibraryPopover
                                    open={libraryOpen}
                                    onOpenChange={(open) =>
                                      setLibraryTarget(
                                        open
                                          ? { planIndex, lineIndex }
                                          : null
                                      )
                                    }
                                    produse={produseBiblioteca}
                                    onSelect={handleLibrarySelection}
                                  />

                                  {issues.length > 0 ? (
                                    <div className="space-y-1 text-xs text-[var(--soft-danger-text)]">
                                      {issues.map((issue) => (
                                        <p key={issue}>{issue}</p>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              </TableCell>
                              <TableCell>{formatDose(line)}</TableCell>
                              <TableCell className="max-w-[220px] whitespace-normal">
                                {line.observatii?.trim() || '—'}
                              </TableCell>
                              <TableCell className="max-w-[220px] whitespace-normal">
                                {line.warnings.length > 0 ? (
                                  <div className="space-y-2">
                                    {line.warnings.map((warning) => (
                                      <div
                                        key={warning}
                                        className="flex items-start gap-2 text-xs text-[var(--warning-text)]"
                                        title={warning}
                                      >
                                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                        <span>{warning}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  '—'
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="space-y-3">
                      {plan.linii.map((line, lineIndex) => {
                        const badge = getMatchBadge(line, produseById)
                        const issues = getLineBlockingIssues(line)
                        const libraryOpen =
                          libraryTarget?.planIndex === planIndex &&
                          libraryTarget?.lineIndex === lineIndex

                        return (
                          <AppCard
                            key={`${plan.foaie_nume}-${lineIndex}`}
                            className="space-y-3 rounded-[22px] border border-[var(--border-default)]/60 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                                  Linia {lineIndex + 1}
                                </p>
                                <h4 className="text-base [font-weight:700] text-[var(--text-primary)]">
                                  Ordine {line.ordine || '—'}
                                </h4>
                              </div>
                              <Badge variant={badge.variant}>{badge.text}</Badge>
                            </div>

                            <div className="grid gap-3">
                              <div className="space-y-1">
                                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                                  Stadiu
                                </span>
                                {line.stadiu_trigger ? (
                                  <Badge variant="default">
                                    {STADIU_LABELS[line.stadiu_trigger as keyof typeof STADIU_LABELS] ??
                                      line.stadiu_trigger}
                                  </Badge>
                                ) : (
                                  <Select
                                    value={line.stadiu_trigger || '__none'}
                                    onValueChange={(value) =>
                                      updateLine(planIndex, lineIndex, (currentLine) => ({
                                        ...currentLine,
                                        stadiu_trigger: value === '__none' ? '' : value,
                                      }))
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Alege stadiul" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__none">Alege stadiul</SelectItem>
                                      {STADII_VALIDE.map((stadiu) => (
                                        <SelectItem key={stadiu} value={stadiu}>
                                          {STADIU_LABELS[stadiu]}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>

                              <div className="space-y-1">
                                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                                  Produs din fișier
                                </span>
                                <Badge variant="outline">
                                  {line.produs_input || 'Fără produs în fișier'}
                                </Badge>
                              </div>

                              <div className="space-y-1">
                                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                                  Acțiune
                                </span>
                                {line.produs_match.tip === 'exact' ? (
                                  <Select value="use_exact" disabled>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="use_exact">
                                        Folosește „{line.produs_match.produs_nume}”
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Select
                                    value={
                                      line.actiune === 'use_suggestion' &&
                                      line.selectedSuggestionIndex != null
                                        ? `suggestion:${line.selectedSuggestionIndex}`
                                        : line.actiune === 'use_library'
                                          ? 'use_library'
                                          : line.actiune === 'create_new'
                                            ? 'configured_create_new'
                                            : line.actiune === 'free_text'
                                              ? 'free_text'
                                              : line.actiune === 'skip'
                                                ? 'skip'
                                                : 'pending'
                                    }
                                    onValueChange={(value) =>
                                      setLineAction(planIndex, lineIndex, value)
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="pending">
                                        Alege acțiunea pentru această linie
                                      </SelectItem>
                                      {line.produs_match.tip === 'fuzzy'
                                        ? line.produs_match.sugestii.map(
                                            (_suggestion, suggestionIndex) => (
                                              <SelectItem
                                                key={suggestionIndex}
                                                value={`suggestion:${suggestionIndex}`}
                                              >
                                                {resolveSuggestionLabel(
                                                  line.produs_match,
                                                  suggestionIndex
                                                )}
                                              </SelectItem>
                                            )
                                          )
                                        : null}
                                      {line.actiune === 'use_library' && line.produs_id ? (
                                        <SelectItem value="use_library">
                                          Produs din bibliotecă: {' '}
                                          {produseById.get(line.produs_id)?.nume_comercial ??
                                            'Selectat'}
                                        </SelectItem>
                                      ) : null}
                                      <SelectItem value="library">
                                        Selectează din bibliotecă…
                                      </SelectItem>
                                      {line.actiune === 'create_new' &&
                                      line.produs_de_creat ? (
                                        <SelectItem value="configured_create_new">
                                          Produs nou: {line.produs_de_creat.nume_comercial}
                                        </SelectItem>
                                      ) : null}
                                      <SelectItem value="create_new">
                                        Creează produs nou…
                                      </SelectItem>
                                      <SelectItem
                                        value="free_text"
                                        disabled={!line.produs_input.trim()}
                                      >
                                        Salvează ca text liber („
                                        {line.produs_input || 'fără text'}”)
                                      </SelectItem>
                                      <SelectItem value="skip">
                                        Skip această linie
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <ProductLibraryPopover
                                  open={libraryOpen}
                                  onOpenChange={(open) =>
                                    setLibraryTarget(
                                      open ? { planIndex, lineIndex } : null
                                    )
                                  }
                                  produse={produseBiblioteca}
                                  onSelect={handleLibrarySelection}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setProductEditor({
                                      planIndex,
                                      lineIndex,
                                      draft:
                                        line.produs_de_creat ??
                                        buildDefaultDraftProdus(
                                          line,
                                          plan.cultura_tip
                                        ),
                                    })
                                  }
                                >
                                  <PlusCircle className="h-4 w-4" />
                                  Creează produs nou
                                </Button>
                              </div>

                              <div className="grid gap-2 sm:grid-cols-2">
                                <div>
                                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                                    Doză
                                  </span>
                                  <p className="mt-1 text-sm text-[var(--text-primary)]">
                                    {formatDose(line)}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                                    Observații
                                  </span>
                                  <p className="mt-1 text-sm text-[var(--text-primary)]">
                                    {line.observatii?.trim() || '—'}
                                  </p>
                                </div>
                              </div>

                              {line.warnings.length > 0 ? (
                                <div className="space-y-2 rounded-[18px] border border-[var(--warning-border)] bg-[var(--warning-bg)]/60 p-3">
                                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--warning-text)]">
                                    <AlertTriangle className="h-4 w-4" />
                                    Warning-uri
                                  </div>
                                  <div className="space-y-1 text-sm text-[var(--warning-text)]">
                                    {line.warnings.map((warning) => (
                                      <p key={warning}>{warning}</p>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              {issues.length > 0 ? (
                                <div className="space-y-2 rounded-[18px] border border-[var(--danger-border)] bg-[var(--danger-bg)]/60 p-3">
                                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--danger-text)]">
                                    <AlertTriangle className="h-4 w-4" />
                                    Erori de rezolvat
                                  </div>
                                  <div className="space-y-1 text-sm text-[var(--danger-text)]">
                                    {issues.map((issue) => (
                                      <p key={issue}>{issue}</p>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </AppCard>
                        )
                      })}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </AppCard>
          </Collapsible>
        )
      })}

      {productEditor ? (
        isDesktop ? (
          <Dialog
            open
            onOpenChange={(open) => {
              if (!open) setProductEditor(null)
            }}
          >
            <DialogContent className="max-w-[720px]">
              <DialogHeader>
                <DialogTitle>Creează produs nou pentru import</DialogTitle>
                <DialogDescription>
                  Produsul va fi creat abia la salvarea finală a planurilor.
                </DialogDescription>
              </DialogHeader>
              <ProductEditorContent
                draft={productEditor.draft}
                culturaTip={planuriEditate[productEditor.planIndex]?.cultura_tip ?? ''}
                onChange={(draft) => setProductEditor((current) => (current ? { ...current, draft } : null))}
                onCancel={() => setProductEditor(null)}
                onSave={handleSaveDraftProduct}
              />
            </DialogContent>
          </Dialog>
        ) : (
          <Sheet
            open
            onOpenChange={(open) => {
              if (!open) setProductEditor(null)
            }}
          >
            <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Creează produs nou pentru import</SheetTitle>
                <SheetDescription>
                  Produsul va fi creat abia la salvarea finală a planurilor.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4">
                <ProductEditorContent
                  draft={productEditor.draft}
                  culturaTip={planuriEditate[productEditor.planIndex]?.cultura_tip ?? ''}
                  onChange={(draft) =>
                    setProductEditor((current) => (current ? { ...current, draft } : null))
                  }
                  onCancel={() => setProductEditor(null)}
                  onSave={handleSaveDraftProduct}
                />
              </div>
              <SheetFooter className="sr-only" />
            </SheetContent>
          </Sheet>
        )
      ) : null}

      {!hasBlockingIssues && !hasGlobalErrors ? (
        <div className="flex items-center gap-2 text-sm text-[var(--success-text)]">
          <CheckCircle2 className="h-4 w-4" />
          Toate planurile sunt gata de salvare.
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-[var(--warning-text)]">
          <SkipForward className="h-4 w-4" />
          Salvează rămâne dezactivat până când rezolvi erorile sau alegi skip
          pentru liniile pe care nu vrei să le imporți.
        </div>
      )}
    </div>
  )
}
