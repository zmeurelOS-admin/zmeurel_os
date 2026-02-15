// src/components/activitati-agricole/EditActivitateAgricolaDialog.tsx
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
  ActivitateAgricola,
  updateActivitateAgricola,
  TIPURI_ACTIVITATI,
} from '@/lib/supabase/queries/activitati-agricole';
import { getParcele } from '@/lib/supabase/queries/parcele';

// Schema validare
const activitateSchema = z.object({
  data_aplicare: z.string().min(1, 'Data este obligatorie'),
  parcela_id: z.string().optional(),
  tip_activitate: z.string().min(1, 'Tipul este obligatoriu'),
  produs_utilizat: z.string().optional(),
  doza: z.string().optional(),
  timp_pauza_zile: z.string().optional(),
  operator: z.string().optional(),
  observatii: z.string().optional(),
});

type ActivitateFormData = z.infer<typeof activitateSchema>;

interface EditActivitateAgricolaDialogProps {
  activitate: ActivitateAgricola | null;
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditActivitateAgricolaDialog({
  activitate,
  tenantId,
  open,
  onOpenChange,
}: EditActivitateAgricolaDialogProps) {
  const queryClient = useQueryClient();

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
  } = useForm<ActivitateFormData>({
    resolver: zodResolver(activitateSchema),
  });

  // Populate form când se deschide dialogul
  useEffect(() => {
    if (activitate && open) {
      reset({
        data_aplicare: activitate.data_aplicare.split('T')[0],
        parcela_id: activitate.parcela_id || '',
        tip_activitate: activitate.tip_activitate,
        produs_utilizat: activitate.produs_utilizat || '',
        doza: activitate.doza || '',
        timp_pauza_zile: activitate.timp_pauza_zile.toString(),
        operator: activitate.operator || '',
        observatii: activitate.observatii || '',
      });
    }
  }, [activitate, open, reset]);

  // Mutation pentru update
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      updateActivitateAgricola(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activitati-agricole'] });
      toast.success('Activitate actualizată cu succes!');
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error updating activitate agricola:', error);
      toast.error('Eroare la actualizarea activității');
    },
  });

  // Submit handler
  const onSubmit = (data: ActivitateFormData) => {
    if (!activitate) return;

    updateMutation.mutate({
      id: activitate.id,
      data: {
        data_aplicare: data.data_aplicare,
        parcela_id: data.parcela_id || null,
        tip_activitate: data.tip_activitate,
        produs_utilizat: data.produs_utilizat || undefined,
        doza: data.doza || undefined,
        timp_pauza_zile: data.timp_pauza_zile ? Number(data.timp_pauza_zile) : 0,
        operator: data.operator || undefined,
        observatii: data.observatii || undefined,
      },
    });
  };

  if (!activitate) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>Editează Activitate: {activitate.id_activitate}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pb-4">
          {/* Data Aplicare */}
          <div>
            <Label htmlFor="data_aplicare">
              Data aplicării <span className="text-red-500">*</span>
            </Label>
            <Input
              id="data_aplicare"
              type="date"
              {...register('data_aplicare')}
              className={errors.data_aplicare ? 'border-red-500' : ''}
            />
            {errors.data_aplicare && (
              <p className="text-sm text-red-500 mt-1">{errors.data_aplicare.message}</p>
            )}
          </div>

          {/* Tip Activitate */}
          <div>
            <Label htmlFor="tip_activitate">
              Tip activitate <span className="text-red-500">*</span>
            </Label>
            <select
              id="tip_activitate"
              {...register('tip_activitate')}
              className={`flex h-10 w-full rounded-md border px-3 py-2 text-sm bg-white ${
                errors.tip_activitate ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Selectează tipul...</option>
              {TIPURI_ACTIVITATI.map((tip) => (
                <option key={tip} value={tip}>
                  {tip}
                </option>
              ))}
            </select>
            {errors.tip_activitate && (
              <p className="text-sm text-red-500 mt-1">{errors.tip_activitate.message}</p>
            )}
          </div>

          {/* Parcelă (optional) */}
          <div>
            <Label htmlFor="parcela_id">Parcelă (opțional)</Label>
            <select
              id="parcela_id"
              {...register('parcela_id')}
              className="flex h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">Fără parcelă specificată</option>
              {parcele.map((parcela) => (
                <option key={parcela.id} value={parcela.id}>
                  {parcela.id_parcela} - {parcela.nume_parcela}
                </option>
              ))}
            </select>
          </div>

          {/* Produs Utilizat */}
          <div>
            <Label htmlFor="produs_utilizat">Produs utilizat (opțional)</Label>
            <Input
              id="produs_utilizat"
              type="text"
              placeholder="ex: Actellic 50 EC"
              {...register('produs_utilizat')}
            />
          </div>

          {/* Doză */}
          <div>
            <Label htmlFor="doza">Doză (opțional)</Label>
            <Input
              id="doza"
              type="text"
              placeholder="ex: 200 ml/100L apă"
              {...register('doza')}
            />
          </div>

          {/* Timp Pauză */}
          <div>
            <Label htmlFor="timp_pauza_zile">Timp pauză (zile)</Label>
            <Input
              id="timp_pauza_zile"
              type="number"
              min="0"
              placeholder="0"
              {...register('timp_pauza_zile')}
            />
          </div>

          {/* Operator */}
          <div>
            <Label htmlFor="operator">Operator (opțional)</Label>
            <Input
              id="operator"
              type="text"
              placeholder="ex: Ion Popescu"
              {...register('operator')}
            />
          </div>

          {/* Observații */}
          <div>
            <Label htmlFor="observatii">Observații (opțional)</Label>
            <Textarea
              id="observatii"
              rows={2}
              placeholder="ex: Tratament preventiv, vreme însorită"
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
