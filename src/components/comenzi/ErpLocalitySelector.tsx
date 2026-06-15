'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  LOCALITIES,
  type LocalityConfig,
  type VillageConfig,
} from '@/lib/shop/delivery-zones'

const ERP_ZONE_BORDER: Record<string, string> = {
  zona1: '#B8D89C',
  zona2: '#B5D4F4',
  zona3: '#FAC775',
  zona4: '#D1D5DB',
}

function normalizeLocation(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('ro-RO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function buildDeliveryLocation(
  locality: LocalityConfig | null,
  village: VillageConfig | null,
  street: string,
): string {
  const localityName = village?.name ?? (locality?.villages ? '' : locality?.name ?? '')
  return [localityName, street.trim()].filter(Boolean).join(', ')
}

export function deriveDeliverySelection(location: string): {
  mode: 'livrare' | 'ridicare'
  locality: LocalityConfig | null
  village: VillageConfig | null
  street: string
} {
  const trimmed = location.trim()
  if (normalizeLocation(trimmed).includes('ridicare')) {
    return { mode: 'ridicare', locality: null, village: null, street: '' }
  }

  const [locationName = '', ...streetParts] = trimmed.split(',').map((part) => part.trim())
  for (const locality of LOCALITIES) {
    const village = locality.villages?.find(
      (candidate) => normalizeLocation(candidate.name) === normalizeLocation(locationName),
    )
    if (village) {
      return {
        mode: 'livrare',
        locality,
        village,
        street: streetParts.join(', '),
      }
    }
    if (normalizeLocation(locality.name) === normalizeLocation(locationName)) {
      return {
        mode: 'livrare',
        locality,
        village: null,
        street: streetParts.join(', '),
      }
    }
  }

  return {
    mode: 'livrare',
    locality: null,
    village: null,
    street: trimmed,
  }
}

function ErpLocalityChip({
  label,
  zone,
  active,
  blocked,
  onClick,
}: {
  label: string
  zone: string
  active: boolean
  blocked?: boolean
  onClick?: () => void
}) {
  const borderColor = blocked ? '#D1D5DB' : (ERP_ZONE_BORDER[zone] ?? '#D1D5DB')

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        blocked
          ? 'flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium text-[var(--text-tertiary)]'
          : 'rounded-full border px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] transition active:scale-[0.97]'
      }
      style={
        active
          ? { background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' }
          : { borderColor, cursor: blocked ? 'not-allowed' : undefined }
      }
      title={blocked ? 'Livrare indisponibilă' : undefined}
    >
      {blocked ? '✕ ' : null}
      {label}
    </button>
  )
}

export function ErpLocalitySelector({
  selectedLocality,
  selectedVillage,
  street,
  onSelectLocality,
  onSelectVillage,
  onBlockedVillage,
  onStreetChange,
  blockedMessage,
}: {
  selectedLocality: LocalityConfig | null
  selectedVillage: VillageConfig | null
  street: string
  onSelectLocality: (locality: LocalityConfig) => void
  onSelectVillage: (village: VillageConfig | null) => void
  onBlockedVillage: (village: VillageConfig) => void
  onStreetChange: (street: string) => void
  blockedMessage: string
}) {
  return (
    <div className="space-y-2">
      <Label>Localitate livrare</Label>
      <div className="flex flex-wrap gap-1.5">
        {LOCALITIES.map((locality) => (
          <ErpLocalityChip
            key={locality.name}
            label={locality.name}
            zone={locality.zone}
            active={selectedLocality?.name === locality.name && !selectedVillage}
            onClick={() => onSelectLocality(locality)}
          />
        ))}
      </div>

      {selectedLocality?.villages ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedLocality.villages.map((village) => (
            <ErpLocalityChip
              key={village.name}
              label={village.name}
              zone={village.zone}
              active={selectedVillage?.name === village.name}
              blocked={village.blocked}
              onClick={
                village.blocked
                  ? () => onBlockedVillage(village)
                  : () => onSelectVillage(village)
              }
            />
          ))}
        </div>
      ) : null}

      {blockedMessage ? (
        <p className="rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-xs font-medium text-[var(--status-warning-text)]">
          {blockedMessage}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label>Stradă, număr</Label>
        <Input
          className="agri-control h-11 md:h-10"
          placeholder="Str. ..., nr. ..."
          value={street}
          onChange={(event) => onStreetChange(event.target.value)}
        />
      </div>
    </div>
  )
}
