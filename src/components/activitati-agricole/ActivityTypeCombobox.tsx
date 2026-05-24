'use client'

import type { ReactNode } from 'react'

import { AppSelect } from '@/components/ui/app-select'
import { isTipActivitateDeprecata } from '@/lib/activitati/activity-options'
import type { ActivityOption } from '@/lib/activitati/activity-options'

interface ActivityTypeComboboxProps {
  id: string
  label: string
  placeholder?: string
  options: ActivityOption[]
  value: string
  error?: string
  onChange: (value: string) => void
  showSearchThreshold?: number
  triggerClassName?: string
  menuClassName?: string
  listClassName?: string
  getOptionLeadingIcon?: (option: ActivityOption) => ReactNode
  getOptionDisplayLabel?: (option: ActivityOption) => string
}

export function ActivityTypeCombobox({
  id,
  label,
  placeholder = 'Tip operațiune',
  options,
  value,
  error,
  onChange,
  showSearchThreshold = 6,
  triggerClassName,
  menuClassName,
  listClassName,
  getOptionLeadingIcon,
  getOptionDisplayLabel,
}: ActivityTypeComboboxProps) {
  return (
    <AppSelect
      id={id}
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      error={error}
      options={options}
      showSearchThreshold={showSearchThreshold}
      searchPlaceholder="Caută sau scrie o activitate..."
      emptyMessage="Nicio activitate găsită"
      triggerClassName={triggerClassName}
      menuClassName={menuClassName}
      listClassName={listClassName}
      getOptionLeadingIcon={getOptionLeadingIcon}
      getOptionDisplayLabel={getOptionDisplayLabel}
      allowCustomSearchValue
      onValidateCustomSearchValue={(inputValue) =>
        isTipActivitateDeprecata(inputValue)
          ? 'Acest tip se înregistrează în modulul Protecție & Nutriție.'
          : null
      }
    />
  )
}
