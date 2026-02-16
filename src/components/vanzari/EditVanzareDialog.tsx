// src/components/vanzari/EditVanzareDialog.tsx
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
  Vanzare,
  updateVanzare,
  STATUS_PLATA,
} from '@/lib/supabase/queries/vanzari';
import { getClienti } from '@/lib/supabase/queries/clienti';

// Schema validare
const vanzareSchema = z.object({
  data: z.string().min(1, 'Data este obligatorie'),
  client_id: z.string().optional(),
  cantitate_kg: z.string().min(1, 'Cantitatea este obligatorie'),
  pret_lei_kg: z.string().min(1, 'Prețul este obligatoriu'),
  status_plata: z.string().optional(),
  observatii_ladite: z.string().optional(),
});

type VanzareFormData = z.infer<typeof vanzareSchema>;

interface EditVanzareDialogProps {
  vanzare: Vanzare | null;
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditVanzareDialog({
  vanzare,
  tenantId,
  open,
  onOpenChange,
}: EditVanzareDialogProps) {
  const queryClient = useQueryClient();

  // Fetch clienti pentru dropdown
  const { data: clienti = [] } = useQuery({
    queryKey: ['clienti', tenantId],
    queryFn: () => getClienti(tenantId),
  });

  // Form setup
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VanzareFormData>({
    resolver: zodResolver(vanzareSchema),
  });

  // Populate form când se deschide dialogul
  useEffect(() => {
    if (vanzare && open) {
      reset({
        data: vanzare.data,
        client_id: vanzare.client_id || '',
        cantitate_kg: vanzare.cantitate_kg.toString(),
        pret_lei_kg: vanzare.pret_lei_kg.toString(),
        status_plata: vanzare.status_plata,
        observatii_ladite: vanzare.observatii_ladite || '',
      });
    }
  }, [vanzare, open, reset]);

  // Mutation pentru update
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      updateVanzare(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vanzari'] });
      toast.success('Vânzare actualizată cu succes!');
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error updating vanzare:', error);
      toast.error('Eroare la actualizarea vânzării');
    },
  });

  // Submit handler
  const onSubmit = (data: VanzareFormData) => {
    if (!vanzare) return;

    updateMutation.mutate({
      id: vanzare.id,
      data: {
        data: data.data,
        client_id: data.client_id || null,
        cantitate_kg: Number(data.cantitate_kg),
        pret_lei_kg: Number(data.pret_lei_kg),
        status_plata: data.status_plata,
        observatii_ladite: data.observatii_ladite || undefined,
      },
    });
  };

  if (!vanzare) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md max-h-[75vh] overflow-y-auto"
        style={{ backgroundColor: 'white' }}
      >
        <DialogHeader>
          <DialogTitle>Editează Vânzare: {vanzare.id_vanzare}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {/* Data */}
          <div className="space-y-1">
            <Label htmlFor="data" className="text-sm">
              Data vânzării <span className="text-red-500">*</span>
            </Label>
            <Input
              id="data"
              type="date"
              {...register('data')}
              className={errors.data ? 'border-red-500' : ''}
            />
            {errors.data && (
              <p className="text-xs text-red-500">{errors.data.message}</p>
            )}
          </div>

          {/* Client */}
          <div className="space-y-1">
            <Label htmlFor="client_id" className="text-sm">Client</Label>
            <select
              id="client_id"
              {...register('client_id')}
              className="flex h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              style={{ backgroundColor: 'white' }}
            >
              <option value="">Fără client specificat</option>
              {clienti.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.id_client} - {client.nume_client}
                </option>
              ))}
            </select>
          </div>

          {/* Cantitate și Preț */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="cantitate_kg" className="text-sm">
                Cantitate (kg) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="cantitate_kg"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="50.00"
                {...register('cantitate_kg')}
                className={errors.cantitate_kg ? 'border-red-500' : ''}
              />
              {errors.cantitate_kg && (
                <p className="text-xs text-red-500">
                  {errors.cantitate_kg.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="pret_lei_kg" className="text-sm">
                Preț lei/kg <span className="text-red-500">*</span>
              </Label>
              <Input
                id="pret_lei_kg"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="25.00"
                {...register('pret_lei_kg')}
                className={errors.pret_lei_kg ? 'border-red-500' : ''}
              />
              {errors.pret_lei_kg && (
                <p className="text-xs text-red-500">
                  {errors.pret_lei_kg.message}
                </p>
              )}
            </div>
          </div>

          {/* Status Plată */}
          <div className="space-y-1">
            <Label htmlFor="status_plata" className="text-sm">Status plată</Label>
            <select
              id="status_plata"
              {...register('status_plata')}
              className="flex h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              style={{ backgroundColor: 'white' }}
            >
              {STATUS_PLATA.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          {/* Observații Lădițe */}
          <div className="space-y-1">
            <Label htmlFor="observatii_ladite" className="text-sm">Observații lădițe</Label>
            <Textarea
              id="observatii_ladite"
              rows={2}
              placeholder="Lăsat 15 lădițe, returnat 10"
              {...register('observatii_ladite')}
            />
          </div>

          {/* Butoane */}
          <div className="flex justify-end gap-3 pt-2">
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
