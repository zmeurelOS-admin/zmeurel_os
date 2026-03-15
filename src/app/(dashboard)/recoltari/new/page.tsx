'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from '@/lib/ui/toast'
import * as z from 'zod'

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
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      data: todayInputValue(),
      kg_cal1: 0,
      kg_cal2: 0,
    },
  })

  const kgCal1 = Number(watch('kg_cal1') || 0)
  const kgCal2 = Number(watch('kg_cal2') || 0)
  const totalKg = kgCal1 + kgCal2
  const culegatorId = watch('culegator_id')
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
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-4">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5 text-gray-700" />
        </button>
        <h1 className="text-xl font-bold text-[#312E3F]">Adaugă Recoltare</h1>
      </div>

      <div className="overflow-y-auto px-4 pb-28 pt-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Data</label>
              <input type="date" {...register('data')} className="min-h-12 w-full rounded-xl border border-gray-200 px-4" />
              {errors.data ? <p className="mt-1 text-xs text-red-500">{errors.data.message}</p> : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Culegator</label>
              <select {...register('culegator_id')} className="min-h-12 w-full rounded-xl border border-gray-200 px-4">
                <option value="">Selectează...</option>
                {culegatori.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nume_prenume}
                  </option>
                ))}
              </select>
              {errors.culegator_id ? <p className="mt-1 text-xs text-red-500">{errors.culegator_id.message}</p> : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Parcelă</label>
              <select {...register('parcela_id')} className="min-h-12 w-full rounded-xl border border-gray-200 px-4">
                <option value="">Selectează...</option>
                {parcele.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nume_parcela || 'Parcela'}
                  </option>
                ))}
              </select>
              {errors.parcela_id ? <p className="mt-1 text-xs text-red-500">{errors.parcela_id.message}</p> : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Kg Calitatea 1</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('kg_cal1', { valueAsNumber: true })}
                  className="min-h-12 w-full rounded-xl border border-gray-200 px-4"
                />
                {errors.kg_cal1 ? <p className="mt-1 text-xs text-red-500">{errors.kg_cal1.message}</p> : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Kg Calitatea 2</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('kg_cal2', { valueAsNumber: true })}
                  className="min-h-12 w-full rounded-xl border border-gray-200 px-4"
                />
                {errors.kg_cal2 ? <p className="mt-1 text-xs text-red-500">{errors.kg_cal2.message}</p> : null}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Observații</label>
              <textarea {...register('observatii')} rows={3} className="w-full rounded-xl border border-gray-200 px-4 py-3" />
            </div>

            <div className="rounded-xl bg-gray-50 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Tarif:</span>
                <span className="font-semibold text-[#312E3F]">{hasTarif ? `${tarif.toFixed(2)} lei/kg` : '--'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total kg:</span>
                <span className="font-semibold text-[#312E3F]">{totalKg.toFixed(2)} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">De plata:</span>
                <span className="font-semibold text-[#E5484D]">{dePlata !== null ? `${dePlata.toFixed(2)} lei` : '--'}</span>
              </div>
            </div>
          </div>
        </form>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white p-4">
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
