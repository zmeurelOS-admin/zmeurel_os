'use client'

import { useMemo, useState, type ReactNode } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react'

import { SearchField } from '@/components/ui/SearchField'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

type ResponsiveColumnMeta<TData> = {
  searchable?: boolean
  searchValue?: (row: TData) => unknown
  headerClassName?: string
  cellClassName?: string
  sticky?: 'left' | 'right'
}

interface ResponsiveDataViewProps<TData, TMobileData = TData> {
  columns: ColumnDef<TData, unknown>[]
  data: TData[]
  renderCard: (item: TMobileData, index: number) => ReactNode
  actions?: ReactNode
  getRowId?: (item: TData, index: number) => string
  mobileData?: TMobileData[]
  getMobileRowId?: (item: TMobileData, index: number) => string
  searchPlaceholder?: string
  emptyMessage?: string
  mobileContainerClassName?: string
  desktopContainerClassName?: string
  onDesktopRowClick?: (item: TData) => void
  isDesktopRowSelected?: (item: TData) => boolean
}

function normalizeSearchValue(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function getColumnMeta<TData>(columnDef: ColumnDef<TData, unknown>): ResponsiveColumnMeta<TData> {
  return ((columnDef as { meta?: ResponsiveColumnMeta<TData> }).meta ?? {}) as ResponsiveColumnMeta<TData>
}

function flattenColumns<TData>(columns: ColumnDef<TData, unknown>[]): ColumnDef<TData, unknown>[] {
  return columns.flatMap((column) => {
    const childColumns = (column as { columns?: ColumnDef<TData, unknown>[] }).columns
    return childColumns?.length ? flattenColumns(childColumns) : [column]
  })
}

function getAccessorValue<TData>(columnDef: ColumnDef<TData, unknown>, row: TData): unknown {
  const columnWithAccessor = columnDef as {
    accessorKey?: string
    accessorFn?: (originalRow: TData, index: number) => unknown
  }

  if (typeof columnWithAccessor.accessorFn === 'function') {
    return columnWithAccessor.accessorFn(row, 0)
  }

  if (typeof columnWithAccessor.accessorKey === 'string' && columnWithAccessor.accessorKey.length > 0) {
    return columnWithAccessor.accessorKey
      .split('.')
      .reduce<unknown>((current, key) => {
        if (current == null || typeof current !== 'object') return undefined
        return (current as Record<string, unknown>)[key]
      }, row)
  }

  return undefined
}

function stringifySearchValue(value: unknown): string {
  if (value == null) return ''
  if (Array.isArray(value)) return value.map(stringifySearchValue).filter(Boolean).join(' ')
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toISOString()
  return ''
}

function resolveMobileKey<TData>(item: TData, index: number, getRowId?: (item: TData, index: number) => string): string {
  if (getRowId) return getRowId(item, index)
  if (item && typeof item === 'object' && 'id' in (item as Record<string, unknown>)) {
    const value = (item as Record<string, unknown>).id
    if (typeof value === 'string' || typeof value === 'number') return String(value)
  }
  return `row-${index}`
}

export function ResponsiveDataView<TData, TMobileData = TData>({
  columns,
  data,
  renderCard,
  actions,
  getRowId,
  mobileData,
  getMobileRowId,
  searchPlaceholder = 'Caută în tabel...',
  emptyMessage = 'Nu am găsit rezultate.',
  mobileContainerClassName,
  desktopContainerClassName,
  onDesktopRowClick,
  isDesktopRowSelected,
}: ResponsiveDataViewProps<TData, TMobileData>) {
  const [desktopSearch, setDesktopSearch] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const mobileRows = mobileData ?? ((data as unknown) as TMobileData[])

  const searchableColumns = useMemo(() => flattenColumns(columns), [columns])
  const normalizedQuery = normalizeSearchValue(desktopSearch.trim())

  const filteredData = useMemo(() => {
    if (!normalizedQuery) return data

    return data.filter((row) =>
      searchableColumns.some((column) => {
        const meta = getColumnMeta(column)
        if (meta.searchable === false) return false

        const rawValue =
          typeof meta.searchValue === 'function'
            ? meta.searchValue(row)
            : getAccessorValue(column, row)

        const text = normalizeSearchValue(stringifySearchValue(rawValue))
        return text.includes(normalizedQuery)
      })
    )
  }, [data, normalizedQuery, searchableColumns])

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: getRowId ? (originalRow, index) => getRowId(originalRow, index) : undefined,
  })

  return (
    <>
      <div className={cn('md:hidden', mobileContainerClassName)}>
        {mobileRows.map((item, index) => (
          <div key={resolveMobileKey(item, index, getMobileRowId)}>
            {renderCard(item, index)}
          </div>
        ))}
      </div>

      <div className={cn('hidden md:block', desktopContainerClassName)}>
        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SearchField
            containerClassName="w-full max-w-md"
            placeholder={searchPlaceholder}
            value={desktopSearch}
            onChange={(event) => setDesktopSearch(event.target.value)}
            aria-label={searchPlaceholder}
          />
          {actions ? <div className="flex items-center justify-end gap-2">{actions}</div> : null}
        </div>

        <div className="overflow-hidden rounded-2xl border border-[var(--agri-border)] bg-[var(--agri-surface)] shadow-sm">
          <Table>
            <TableHeader className="bg-[var(--agri-surface-muted)]">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => {
                    const meta = getColumnMeta(header.column.columnDef)
                    const stickyClassName =
                      meta.sticky === 'right'
                        ? 'sticky right-0 z-20 border-l border-[var(--agri-border)] bg-[var(--agri-surface-muted)]'
                        : meta.sticky === 'left'
                          ? 'sticky left-0 z-20 border-r border-[var(--agri-border)] bg-[var(--agri-surface-muted)]'
                          : ''
                    const canSort = header.column.getCanSort()
                    const sortDirection = header.column.getIsSorted()

                    return (
                      <TableHead
                        key={header.id}
                        className={cn(
                          'h-12 px-4 text-xs font-semibold uppercase tracking-wide text-[var(--agri-text-muted)]',
                          stickyClassName,
                          meta.headerClassName,
                        )}
                      >
                        {header.isPlaceholder ? null : canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="flex w-full items-center gap-2 text-left"
                          >
                            <span className="truncate">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </span>
                            {sortDirection === 'asc' ? (
                              <ChevronUp className="h-4 w-4 shrink-0" />
                            ) : sortDirection === 'desc' ? (
                              <ChevronDown className="h-4 w-4 shrink-0" />
                            ) : (
                              <ArrowUpDown className="h-4 w-4 shrink-0 opacity-60" />
                            )}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody>
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => {
                  const isSelected = isDesktopRowSelected?.(row.original) ?? false

                  return (
                    <TableRow
                      key={row.id}
                      className={cn(
                        'border-[var(--agri-border)]',
                        onDesktopRowClick ? 'cursor-pointer' : '',
                        isSelected ? 'bg-[var(--soft-info-bg)] hover:bg-[var(--soft-info-bg)]' : '',
                      )}
                      onClick={onDesktopRowClick ? () => onDesktopRowClick(row.original) : undefined}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const meta = getColumnMeta(cell.column.columnDef)
                        const stickyClassName =
                          meta.sticky === 'right'
                            ? 'sticky right-0 z-10 border-l border-[var(--agri-border)] bg-[var(--agri-surface)]'
                            : meta.sticky === 'left'
                              ? 'sticky left-0 z-10 border-r border-[var(--agri-border)] bg-[var(--agri-surface)]'
                              : ''

                        return (
                          <TableCell
                            key={cell.id}
                            className={cn(
                              'px-4 py-3 text-sm text-[var(--agri-text)]',
                              stickyClassName,
                              meta.cellClassName,
                            )}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={table.getAllLeafColumns().length || 1}
                    className="px-4 py-8 text-center text-sm text-[var(--agri-text-muted)]"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  )
}
