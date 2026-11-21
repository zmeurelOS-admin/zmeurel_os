'use client'

import { Segments, kitText } from '@/components/kit'
import { ECHIPA_ORDINE_MODULE, NIVEL_ETICHETA, type CiornaDrepturi, type NivelModul } from '@/lib/echipa/drepturi'
import { FARM_MEMBER_MODULE_LABELS, type FarmMemberModule } from '@/lib/farm-members/access'
import { cn } from '@/lib/utils'

const NIVELURI: ReadonlyArray<{ value: NivelModul; label: string }> = (['nu', 'read', 'write'] as const).map((value) => ({
  value,
  label: NIVEL_ETICHETA[value],
}))

/** Ajutorul de sub module unde regula nu e evidentă. */
const AJUTOR: Partial<Record<FarmMemberModule, string>> = {
  tratamente: 'Stropiri și fertirigare, cu pauza dinainte de cules.',
  livrari: 'Traseul zilei și încasările la livrare.',
}

export interface DrepturiEditorProps {
  value: CiornaDrepturi
  onChange: (value: CiornaDrepturi) => void
  disabled?: boolean
}

/** „Ce poate face?”: fiecare modul cu Nu / Citește / Scrie. */
export function DrepturiEditor({ value, onChange, disabled = false }: DrepturiEditorProps) {
  return (
    <ul className={cn('space-y-2', disabled && 'pointer-events-none opacity-60')} aria-busy={disabled || undefined}>
      {ECHIPA_ORDINE_MODULE.map((module) => {
        const eticheta = FARM_MEMBER_MODULE_LABELS[module]
        return (
          <li
            key={module}
            className="flex flex-col gap-2 rounded-box border border-border bg-surface px-3.5 py-3 sm:flex-row sm:items-center sm:gap-4"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={cn('font-bold text-fg', kitText.base)}>{eticheta}</span>
              {AJUTOR[module] ? <span className={cn('text-fg-muted', kitText.helper)}>{AJUTOR[module]}</span> : null}
            </span>
            <Segments
              aria-label={`${eticheta}: ce poate face`}
              options={NIVELURI}
              value={value[module]}
              onValueChange={(nivel) => onChange({ ...value, [module]: nivel })}
              className="w-full sm:w-[264px] sm:shrink-0"
            />
          </li>
        )
      })}
    </ul>
  )
}
