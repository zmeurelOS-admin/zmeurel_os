// src/components/recoltari/EditRecoltareDialog.tsx
'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import {
  Recoltare,
  updateRecoltare,
} from '@/lib/supabase/queries/recoltari';
import { getCulegatori } from '@/lib/supabase/queries/culegatori';
import { getParcele } from '@/lib/supabase/queries/parcele';

// Schema validare
const recoltareSchema = z.object({
  data: z.string().min(1, 'Data este obligatorie'),
  culegator_id: z.string().optional(),
  parcela_id: z.string().optional(),
  nr_caserole: z.string().min(1, 'Nr. caserole este obligatoriu'),
  tara_kg: z.string().optional(),
  observatii: z.string().optional(),
});

type RecoltareFormData = z.infer<typeof recoltareSchema>;

interface EditRecoltareDialogProps {
  recoltare: Recoltare | null;
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditRecoltareDialog({
  recoltare,
  tenantId,
  open,
  onOpenChange,
}: EditRecoltareDialogProps) {
  const queryClient = useQueryClient();

  // Fetch culegători pentru dropdown
  const { data: culegatori = [] } = useQuery({
    queryKey: ['culegatori', tenantId],
    queryFn: () => getCulegatori(tenantId),
  });

  // Fetch parcele pentru dropdown
  const { data: parcele = [] } = useQuery({
    queryKey: ['parcele', tenantId],
    queryFn: () => getParcele(tenantId),
  });

  // Form setup
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RecoltareFormData>({
    resolver: zodResolver(recoltareSchema),
  });

  // Populate form când se deschide dialogul
  useEffect(() => {
    if (recoltare && open) {
      reset({
        data: recoltare.data,
        culegator_id: recoltare.culegator_id || '',
        parcela_id: recoltare.parcela_id || '',
        nr_caserole: recoltare.nr_caserole.toString(),
        tara_kg: recoltare.tara_kg.toString(),
        observatii: recoltare.observatii || '',
      });
    }
  }, [recoltare, open, reset]);

  // Mutation pentru update
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      updateRecoltare(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recoltari'] });
      toast.success('Recoltare actualizată cu succes!');
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error updating recoltare:', error);
      toast.error('Eroare la actualizarea recoltării');
    },
  });

  // Submit handler
  const onSubmit = (data: RecoltareFormData) => {
    if (!recoltare) return;

    updateMutation.mutate({
      id: recoltare.id,
      data: {
        data: data.data,
        culegator_id: data.culegator_id || null,
        parcela_id: data.parcela_id || null,
        nr_caserole: Number(data.nr_caserole),
        tara_kg: data.tara_kg ? Number(data.tara_kg) : 0,
        observatii: data.observatii || undefined,
      },
    });
  };

  if (!recoltare) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: 'white',
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: '28rem',
        }}
      >
        <DialogHeader>
          <DialogTitle>Editează Recoltare: {recoltare.id_recoltare}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Data */}
          <div>
            <Label htmlFor="data">
              Data recoltării <span className="text-red-500">*</span>
            </Label>
            <Input
              id="data"
              type="date"
              {...register('data')}
              className={errors.data ? 'border-red-500' : ''}
            />
            {errors.data && (
              <p className="text-sm text-red-500 mt-1">{errors.data.message}</p>
            )}
          </div>

          {/* Culegător */}
          <div>
            <Label htmlFor="culegator_id">Culegător (opțional)</Label>
            <select
              id="culegator_id"
              {...register('culegator_id')}
              className="flex h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              style={{ backgroundColor: 'white' }}
            >
              <option value="">Fără culegător specificat</option>
              {culegatori.map((culegator) => (
                <option key={culegator.id} value={culegator.id}>
                  {culegator.id_culegator} - {culegator.nume_prenume}
                </option>
              ))}
            </select>
          </div>

          {/* Parcelă */}
          <div>
            <Label htmlFor="parcela_id">Parcelă (opțional)</Label>
            <select
              id="parcela_id"
              {...register('parcela_id')}
              className="flex h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              style={{ backgroundColor: 'white' }}
            >
              <option value="">Fără parcelă specificată</option>
              {parcele.map((parcela) => (
                <option key={parcela.id} value={parcela.id}>
                  {parcela.id_parcela} - {parcela.nume_parcela}
                </option>
              ))}
            </select>
          </div>

          {/* Nr Caserole și Tară */}
          <div className="grid grid-cols-2 gap-4">
            {/* Nr Caserole */}
            <div>
              <Label htmlFor="nr_caserole">
                Nr. caserole <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nr_caserole"
                type="number"
                min="1"
                placeholder="ex: 100"
                {...register('nr_caserole')}
                className={errors.nr_caserole ? 'border-red-500' : ''}
              />
              {errors.nr_caserole && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.nr_caserole.message}
                </p>
              )}
            </div>

            {/* Tară */}
            <div>
              <Label htmlFor="tara_kg">Tară (kg)</Label>
              <Input
                id="tara_kg"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...register('tara_kg')}
              />
            </div>
          </div>

          {/* Observații */}
          <div>
            <Label htmlFor="observatii">Observații (opțional)</Label>
            <Textarea
              id="observatii"
              rows={3}
              placeholder="ex: Fructe de calitate superioară"
              {...register('observatii')}
            />
          </div>

          {/* Butoane */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Anulează
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="bg-[#F16B6B] hover:bg-[#E05A5A]"
            >
              {updateMutation.isPending ? 'Se salvează...' : 'Salvează'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
