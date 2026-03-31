'use client'

import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from '@/lib/ui/toast'
import * as z from 'zod'

import { hapticSuccess } from '@/lib/utils/haptic'
import { getCulegatori } from '@/lib/supabase/queries/culegatori'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { createRecoltare } from '@/lib/supabase/queries/recoltari'
import { queryKeys } from '@/lib/query-keys'

function todayInputValue(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000)
  return local.toISOString().slice(0, 10)
}

const schema = z.object({
  data: z
    .string()
    .min(1, 'Selecteaza data')
    .refine((value) => value <= todayInputValue(), {
      message: 'Data recoltării nu poate fi în viitor',
    }),
  parcela_id: z.string().min(1, 'Selecteaza parcela'),
  culegator_id: z.string().min(1, 'Selecteaza culegatorul'),
  kg_cal1: z.number().refine((v) => Number.isFinite(v) && v >= 0, 'Kg Cal 1 trebuie sa fie >= 0'),
  kg_cal2: z.number().refine((v) => Number.isFinite(v) && v >= 0, 'Kg Cal 2 trebuie sa fie >= 0'),
  observatii: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function NewRecoltarePage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: parcele = [] } = useQuery({
    queryKey: queryKeys.parcele,
    queryFn: getParcele,
  })

  const { data: culegatori = [] } = useQuery({
    queryKey: queryKeys.culegatori,
    queryFn: getCulegatori,
  })

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      data: todayInputValue(),
      kg_cal1: 0,
      kg_cal2: 0,
    },
  })

  const kgCal1 = Number(useWatch({ control, name: 'kg_cal1' }) || 0)
  const kgCal2 = Number(useWatch({ control, name: 'kg_cal2' }) || 0)
  const totalKg = kgCal1 + kgCal2
  const culegatorId = useWatch({ control, name: 'culegator_id' })
  const culegator = culegatori.find((c) => c.id === culegatorId)
  const tarif = Number(culegator?.tarif_lei_kg ?? 0)
  const hasTarif = Number.isFinite(tarif) && tarif > 0
  const dePlata = hasTarif ? totalKg * tarif : null

  const mutation = useMutation({
    mutationFn: createRecoltare,
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error)
        return
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.recoltari })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocGlobal })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocuriLocatiiRoot })
      queryClient.invalidateQueries({ queryKey: queryKeys.miscariStoc })
      queryClient.invalidateQueries({ queryKey: queryKeys.cheltuieli })
      if (result.warning) {
        toast.warning(result.warning)
      } else {
        hapticSuccess()
        toast.success('Recoltare adaugata')
      }
      router.back()
    },
    onError: (error: unknown) => {
      const message = (error as { message?: string })?.message ?? 'Eroare la salvarea recoltarii'
      toast.error(message)
    },
  })

  const onSubmit = (data: FormData) => {
    if (!hasTarif) {
      toast.error('Culegatorul nu are tarif setat in profil')
      return
    }

    mutation.mutate({
      data: data.data,
      parcela_id: data.parcela_id,
      culegator_id: data.culegator_id,
      kg_cal1: data.kg_cal1,
      kg_cal2: data.kg_cal2,
      observatii: data.observatii,
    })
  }

  return (
    <div className="min-h-screen bg-[var(--agri-bg)] text-[var(--agri-text)]">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--agri-border)] bg-[var(--agri-surface)] px-4 py-4">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--agri-surface-muted)]"
        >
          <ArrowLeft className="h-5 w-5 text-[var(--agri-text)]" />
        </button>
        <h1 className="text-xl font-bold text-[var(--agri-text)]">Adaugă Recoltare</h1>
      </div>

      <div className="overflow-y-auto px-4 pb-[calc(var(--app-nav-clearance)+6rem)] pt-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-4 rounded-2xl border border-[var(--agri-border)] bg-[var(--agri-surface)] p-5 shadow-sm">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--agri-text-muted)]">Data</label>
              <input
                type="date"
                {...register('data')}
                className="min-h-12 w-full rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface)] px-4 text-[var(--agri-text)]"
              />
              {errors.data ? <p className="mt-1 text-xs text-[var(--soft-danger-text)]">{errors.data.message}</p> : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--agri-text-muted)]">Culegator</label>
              <select
                {...register('culegator_id')}
                className="min-h-12 w-full rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface)] px-4 text-[var(--agri-text)]"
              >
                <option value="">Selectează...</option>
                {culegatori.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nume_prenume}
                  </option>
                ))}
              </select>
              {errors.culegator_id ? <p className="mt-1 text-xs text-[var(--soft-danger-text)]">{errors.culegator_id.message}</p> : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--agri-text-muted)]">Parcelă</label>
              <select
                {...register('parcela_id')}
                className="min-h-12 w-full rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface)] px-4 text-[var(--agri-text)]"
              >
                <option value="">Selectează...</option>
                {parcele.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nume_parcela || 'Parcela'}
                  </option>
                ))}
              </select>
              {errors.parcela_id ? <p className="mt-1 text-xs text-[var(--soft-danger-text)]">{errors.parcela_id.message}</p> : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--agri-text-muted)]">Kg Calitatea 1</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('kg_cal1', { valueAsNumber: true })}
                  className="min-h-12 w-full rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface)] px-4 text-[var(--agri-text)]"
                />
                {errors.kg_cal1 ? <p className="mt-1 text-xs text-[var(--soft-danger-text)]">{errors.kg_cal1.message}</p> : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--agri-text-muted)]">Kg Calitatea 2</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('kg_cal2', { valueAsNumber: true })}
                  className="min-h-12 w-full rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface)] px-4 text-[var(--agri-text)]"
                />
                {errors.kg_cal2 ? <p className="mt-1 text-xs text-[var(--soft-danger-text)]">{errors.kg_cal2.message}</p> : null}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--agri-text-muted)]">Observații</label>
              <textarea
                {...register('observatii')}
                rows={3}
                className="w-full rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface)] px-4 py-3 text-[var(--agri-text)]"
              />
            </div>

            <div className="rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--agri-text-muted)]">Tarif:</span>
                <span className="font-semibold text-[var(--agri-text)]">{hasTarif ? `${tarif.toFixed(2)} lei/kg` : '--'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--agri-text-muted)]">Total kg:</span>
                <span className="font-semibold text-[var(--agri-text)]">{totalKg.toFixed(2)} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--agri-text-muted)]">De plata:</span>
                <span className="font-semibold text-[var(--value-negative)]">{dePlata !== null ? `${dePlata.toFixed(2)} lei` : '--'}</span>
              </div>
            </div>
          </div>
        </form>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 border-t border-[var(--agri-border)] bg-[var(--agri-surface)] p-4"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <button
          onClick={handleSubmit(onSubmit)}
          disabled={mutation.isPending}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#E5484D] to-[#F87171] font-semibold text-white disabled:opacity-50"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Se salvează...
            </>
          ) : (
            'Salvează Recoltare'
          )}
        </button>
      </div>
    </div>
  )
}
