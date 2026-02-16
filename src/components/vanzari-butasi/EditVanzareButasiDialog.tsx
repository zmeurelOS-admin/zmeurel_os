// src/components/vanzari-butasi/EditVanzareButasiDialog.tsx
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
  VanzareButasi,
  updateVanzareButasi,
} from '@/lib/supabase/queries/vanzari-butasi';
import { getClienti } from '@/lib/supabase/queries/clienti';
import { getParcele } from '@/lib/supabase/queries/parcele';

// Schema validare
const vanzareButasiSchema = z.object({
  data: z.string().min(1, 'Data este obligatorie'),
  client_id: z.string().optional(),
  parcela_sursa_id: z.string().optional(),
  soi_butasi: z.string().min(1, 'Soiul este obligatoriu'),
  cantitate_butasi: z.string().min(1, 'Cantitatea este obligatorie'),
  pret_unitar_lei: z.string().min(1, 'Prețul este obligatoriu'),
  observatii: z.string().optional(),
});

type VanzareButasiFormData = z.infer<typeof vanzareButasiSchema>;

interface EditVanzareButasiDialogProps {
  vanzare: VanzareButasi | null;
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditVanzareButasiDialog({
  vanzare,
  tenantId,
  open,
  onOpenChange,
}: EditVanzareButasiDialogProps) {
  const queryClient = useQueryClient();

  // Fetch clienti pentru dropdown
  const { data: clienti = [] } = useQuery({
    queryKey: ['clienti', tenantId],
    queryFn: () => getClienti(tenantId),
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
  } = useForm<VanzareButasiFormData>({
    resolver: zodResolver(vanzareButasiSchema),
  });

  // Populate form când se deschide dialogul
  useEffect(() => {
    if (vanzare && open) {
      reset({
        data: vanzare.data,
        client_id: vanzare.client_id || '',
        parcela_sursa_id: vanzare.parcela_sursa_id || '',
        soi_butasi: vanzare.soi_butasi,
        cantitate_butasi: vanzare.cantitate_butasi.toString(),
        pret_unitar_lei: vanzare.pret_unitar_lei.toString(),
        observatii: vanzare.observatii || '',
      });
    }
  }, [vanzare, open, reset]);

  // Mutation pentru update
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      updateVanzareButasi(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vanzari-butasi'] });
      toast.success('Vânzare butași actualizată cu succes!');
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error updating vanzare butasi:', error);
      toast.error('Eroare la actualizarea vânzării');
    },
  });

  // Submit handler
  const onSubmit = (data: VanzareButasiFormData) => {
    if (!vanzare) return;

    updateMutation.mutate({
      id: vanzare.id,
      data: {
        data: data.data,
        client_id: data.client_id || null,
        parcela_sursa_id: data.parcela_sursa_id || null,
        soi_butasi: data.soi_butasi,
        cantitate_butasi: Number(data.cantitate_butasi),
        pret_unitar_lei: Number(data.pret_unitar_lei),
        observatii: data.observatii || undefined,
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
          <DialogTitle>
            Editează Vânzare: {vanzare.id_vanzare_butasi}
          </DialogTitle>
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

          {/* Soi Butași */}
          <div className="space-y-1">
            <Label htmlFor="soi_butasi" className="text-sm">
              Soi butași <span className="text-red-500">*</span>
            </Label>
            <Input
              id="soi_butasi"
              type="text"
              placeholder="Zmeură Polka"
              {...register('soi_butasi')}
              className={errors.soi_butasi ? 'border-red-500' : ''}
            />
            {errors.soi_butasi && (
              <p className="text-xs text-red-500">{errors.soi_butasi.message}</p>
            )}
          </div>

          {/* Cantitate și Preț */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="cantitate_butasi" className="text-sm">
                Cantitate <span className="text-red-500">*</span>
              </Label>
              <Input
                id="cantitate_butasi"
                type="number"
                min="1"
                placeholder="100"
                {...register('cantitate_butasi')}
                className={errors.cantitate_butasi ? 'border-red-500' : ''}
              />
              {errors.cantitate_butasi && (
                <p className="text-xs text-red-500">
                  {errors.cantitate_butasi.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="pret_unitar_lei" className="text-sm">
                Preț/buc (lei) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="pret_unitar_lei"
                type="number"
                step="0.01"
                placeholder="5.00"
                {...register('pret_unitar_lei')}
                className={errors.pret_unitar_lei ? 'border-red-500' : ''}
              />
              {errors.pret_unitar_lei && (
                <p className="text-xs text-red-500">
                  {errors.pret_unitar_lei.message}
                </p>
              )}
            </div>
          </div>

          {/* Client (optional) */}
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

          {/* Parcelă Sursă (optional) */}
          <div className="space-y-1">
            <Label htmlFor="parcela_sursa_id" className="text-sm">Parcelă sursă</Label>
            <select
              id="parcela_sursa_id"
              {...register('parcela_sursa_id')}
              className="flex h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              style={{ backgroundColor: 'white' }}
            >
              <option value="">Fără parcelă sursă</option>
              {parcele.map((parcela) => (
                <option key={parcela.id} value={parcela.id}>
                  {parcela.id_parcela} - {parcela.nume_parcela}
                </option>
              ))}
            </select>
          </div>

          {/* Observații */}
          <div className="space-y-1">
            <Label htmlFor="observatii" className="text-sm">Observații</Label>
            <Textarea
              id="observatii"
              rows={2}
              placeholder="Butași înrădăcinați, ambalați în ghivece"
              {...register('observatii')}
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
