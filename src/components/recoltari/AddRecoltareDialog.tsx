// src/components/recoltari/AddRecoltareDialog.tsx
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

import { createRecoltare } from '@/lib/supabase/queries/recoltari';
import { getCulegatori } from '@/lib/supabase/queries/culegatori';
import { getParcele } from '@/lib/supabase/queries/parcele';

// Schema validare cu Zod
const recoltareSchema = z.object({
  data: z.string().min(1, 'Data este obligatorie'),
  culegator_id: z.string().optional(),
  parcela_id: z.string().optional(),
  nr_caserole: z.string().min(1, 'Nr. caserole este obligatoriu'),
  tara_kg: z.string().optional(),
  observatii: z.string().optional(),
});

type RecoltareFormData = z.infer<typeof recoltareSchema>;

interface AddRecoltareDialogProps {
  tenantId: string;
}

export function AddRecoltareDialog({ tenantId }: AddRecoltareDialogProps) {
  const [open, setOpen] = useState(false);
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
    defaultValues: {
      data: new Date().toISOString().split('T')[0],
      culegator_id: '',
      parcela_id: '',
      nr_caserole: '',
      tara_kg: '0',
      observatii: '',
    },
  });

  // Mutation pentru creare
  const createMutation = useMutation({
    mutationFn: createRecoltare,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recoltari'] });
      toast.success('Recoltare adăugată cu succes!');
      reset();
      setOpen(false);
    },
    onError: (error) => {
      console.error('Error creating recoltare:', error);
      toast.error('Eroare la adăugarea recoltării');
    },
  });

  // Submit handler
  const onSubmit = (data: RecoltareFormData) => {
    createMutation.mutate({
      tenant_id: tenantId,
      data: data.data,
      culegator_id: data.culegator_id || null,
      parcela_id: data.parcela_id || null,
      nr_caserole: Number(data.nr_caserole),
      tara_kg: data.tara_kg ? Number(data.tara_kg) : 0,
      observatii: data.observatii || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#F16B6B] hover:bg-[#E05A5A]">
          <Plus className="h-4 w-4 mr-2" />
          Adaugă Recoltare
        </Button>
      </DialogTrigger>

      <DialogContent
        className="max-w-md max-h-[75vh] overflow-y-auto"
        style={{ backgroundColor: 'white' }}
      >
        <DialogHeader>
          <DialogTitle>Adaugă Recoltare Nouă</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {/* Data */}
          <div className="space-y-1">
            <Label htmlFor="data" className="text-sm">
              Data recoltării <span className="text-red-500">*</span>
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

          {/* Culegător */}
          <div className="space-y-1">
            <Label htmlFor="culegator_id" className="text-sm">Culegător</Label>
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
          <div className="space-y-1">
            <Label htmlFor="parcela_id" className="text-sm">Parcelă</Label>
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

          {/* Nr Caserole și Tara */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="nr_caserole" className="text-sm">
                Nr. caserole <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nr_caserole"
                type="number"
                min="1"
                placeholder="100"
                {...register('nr_caserole')}
                className={errors.nr_caserole ? 'border-red-500' : ''}
              />
              {errors.nr_caserole && (
                <p className="text-xs text-red-500">
                  {errors.nr_caserole.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="tara_kg" className="text-sm">Tara (kg)</Label>
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

          {/* Info helper */}
          <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
            💡 1 caserola = 0.5 kg
          </div>

          {/* Observații */}
          <div className="space-y-1">
            <Label htmlFor="observatii" className="text-sm">Observații</Label>
            <Textarea
              id="observatii"
              rows={2}
              placeholder="Calitate superioară"
              {...register('observatii')}
            />
          </div>

          {/* Butoane */}
          <div className="flex justify-end gap-3 pt-2">
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
