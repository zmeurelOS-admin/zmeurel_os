// src/components/vanzari-butasi/AddVanzareButasiDialog.tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { createVanzareButasi } from '@/lib/supabase/queries/vanzari-butasi';
import { getClienti } from '@/lib/supabase/queries/clienti';
import { getParcele } from '@/lib/supabase/queries/parcele';

// Schema validare cu Zod
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

interface AddVanzareButasiDialogProps {
  tenantId: string;
}

export function AddVanzareButasiDialog({ tenantId }: AddVanzareButasiDialogProps) {
  const [open, setOpen] = useState(false);
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
    defaultValues: {
      data: new Date().toISOString().split('T')[0], // Data azi
      client_id: '',
      parcela_sursa_id: '',
      soi_butasi: '',
      cantitate_butasi: '',
      pret_unitar_lei: '',
      observatii: '',
    },
  });

  // Mutation pentru creare
  const createMutation = useMutation({
    mutationFn: createVanzareButasi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vanzari-butasi'] });
      toast.success('Vânzare butași adăugată cu succes!');
      reset();
      setOpen(false);
    },
    onError: (error) => {
      console.error('Error creating vanzare butasi:', error);
      toast.error('Eroare la adăugarea vânzării');
    },
  });

  // Submit handler
  const onSubmit = (data: VanzareButasiFormData) => {
    createMutation.mutate({
      tenant_id: tenantId,
      data: data.data,
      client_id: data.client_id || null,
      parcela_sursa_id: data.parcela_sursa_id || null,
      soi_butasi: data.soi_butasi,
      cantitate_butasi: Number(data.cantitate_butasi),
      pret_unitar_lei: Number(data.pret_unitar_lei),
      observatii: data.observatii || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#F16B6B] hover:bg-[#E05A5A]">
          <Plus className="h-4 w-4 mr-2" />
          Adaugă Vânzare Butași
        </Button>
      </DialogTrigger>

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
          <DialogTitle>Adaugă Vânzare Butași Nouă</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Data */}
          <div>
            <Label htmlFor="data">
              Data vânzării <span className="text-red-500">*</span>
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

          {/* Soi Butași */}
          <div>
            <Label htmlFor="soi_butasi">
              Soi butași <span className="text-red-500">*</span>
            </Label>
            <Input
              id="soi_butasi"
              type="text"
              placeholder="ex: Zmeură Polka"
              {...register('soi_butasi')}
              className={errors.soi_butasi ? 'border-red-500' : ''}
            />
            {errors.soi_butasi && (
              <p className="text-sm text-red-500 mt-1">{errors.soi_butasi.message}</p>
            )}
          </div>

          {/* Cantitate și Preț */}
          <div className="grid grid-cols-2 gap-4">
            {/* Cantitate */}
            <div>
              <Label htmlFor="cantitate_butasi">
                Cantitate <span className="text-red-500">*</span>
              </Label>
              <Input
                id="cantitate_butasi"
                type="number"
                min="1"
                placeholder="ex: 100"
                {...register('cantitate_butasi')}
                className={errors.cantitate_butasi ? 'border-red-500' : ''}
              />
              {errors.cantitate_butasi && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.cantitate_butasi.message}
                </p>
              )}
            </div>

            {/* Preț Unitar */}
            <div>
              <Label htmlFor="pret_unitar_lei">
                Preț/buc (lei) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="pret_unitar_lei"
                type="number"
                step="0.01"
                placeholder="ex: 5.00"
                {...register('pret_unitar_lei')}
                className={errors.pret_unitar_lei ? 'border-red-500' : ''}
              />
              {errors.pret_unitar_lei && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.pret_unitar_lei.message}
                </p>
              )}
            </div>
          </div>

          {/* Client (optional) */}
          <div>
            <Label htmlFor="client_id">Client (opțional)</Label>
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
          <div>
            <Label htmlFor="parcela_sursa_id">Parcelă sursă (opțional)</Label>
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
          <div>
            <Label htmlFor="observatii">Observații (opțional)</Label>
            <Textarea
              id="observatii"
              rows={3}
              placeholder="ex: Butași înrădăcinați, ambalați în ghivece 1L"
              {...register('observatii')}
            />
          </div>

          {/* Butoane */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              Anulează
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-[#F16B6B] hover:bg-[#E05A5A]"
            >
              {createMutation.isPending ? 'Se salvează...' : 'Salvează'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
