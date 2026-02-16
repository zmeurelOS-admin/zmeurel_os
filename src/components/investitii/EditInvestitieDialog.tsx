// src/components/investitii/EditInvestitieDialog.tsx
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
  Investitie,
  updateInvestitie,
  CATEGORII_INVESTITII,
} from '@/lib/supabase/queries/investitii';
import { getParcele } from '@/lib/supabase/queries/parcele';

// Schema validare
const investitieSchema = z.object({
  data: z.string().min(1, 'Data este obligatorie'),
  parcela_id: z.string().optional(),
  categorie: z.string().min(1, 'Categoria este obligatorie'),
  furnizor: z.string().optional(),
  descriere: z.string().optional(),
  suma_lei: z.string().min(1, 'Suma este obligatorie'),
});

type InvestitieFormData = z.infer<typeof investitieSchema>;

interface EditInvestitieDialogProps {
  investitie: Investitie | null;
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditInvestitieDialog({
  investitie,
  tenantId,
  open,
  onOpenChange,
}: EditInvestitieDialogProps) {
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
  } = useForm<InvestitieFormData>({
    resolver: zodResolver(investitieSchema),
  });

  // Populate form când se deschide dialogul
  useEffect(() => {
    if (investitie && open) {
      reset({
        data: investitie.data,
        parcela_id: investitie.parcela_id || '',
        categorie: investitie.categorie,
        furnizor: investitie.furnizor || '',
        descriere: investitie.descriere || '',
        suma_lei: investitie.suma_lei.toString(),
      });
    }
  }, [investitie, open, reset]);

  // Mutation pentru update
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      updateInvestitie(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investitii'] });
      toast.success('Investiție actualizată cu succes!');
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error updating investitie:', error);
      toast.error('Eroare la actualizarea investiției');
    },
  });

  // Submit handler
  const onSubmit = (data: InvestitieFormData) => {
    if (!investitie) return;

    updateMutation.mutate({
      id: investitie.id,
      data: {
        data: data.data,
        parcela_id: data.parcela_id || null,
        categorie: data.categorie,
        furnizor: data.furnizor || undefined,
        descriere: data.descriere || undefined,
        suma_lei: Number(data.suma_lei),
      },
    });
  };

  if (!investitie) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md max-h-[75vh] overflow-y-auto"
        style={{ backgroundColor: 'white' }}
      >
        <DialogHeader>
          <DialogTitle>
            Editează Investiție: {investitie.id_investitie}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {/* Data */}
          <div className="space-y-1">
            <Label htmlFor="data" className="text-sm">
              Data investiției <span className="text-red-500">*</span>
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

          {/* Categorie */}
          <div className="space-y-1">
            <Label htmlFor="categorie" className="text-sm">
              Categorie investiție <span className="text-red-500">*</span>
            </Label>
            <select
              id="categorie"
              {...register('categorie')}
              className={`flex h-10 w-full rounded-md border px-3 py-2 text-sm ${
                errors.categorie ? 'border-red-500' : 'border-gray-300'
              }`}
              style={{ backgroundColor: 'white' }}
            >
              <option value="">Selectează categoria...</option>
              {CATEGORII_INVESTITII.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {errors.categorie && (
              <p className="text-xs text-red-500">{errors.categorie.message}</p>
            )}
          </div>

          {/* Parcelă (optional) */}
          <div className="space-y-1">
            <Label htmlFor="parcela_id" className="text-sm">Parcelă</Label>
            <select
              id="parcela_id"
              {...register('parcela_id')}
              className="flex h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              style={{ backgroundColor: 'white' }}
            >
              <option value="">Fără legătură cu parcelă</option>
              {parcele.map((parcela) => (
                <option key={parcela.id} value={parcela.id}>
                  {parcela.id_parcela} - {parcela.nume_parcela}
                </option>
              ))}
            </select>
          </div>

          {/* Sumă */}
          <div className="space-y-1">
            <Label htmlFor="suma_lei" className="text-sm">
              Sumă investită (lei) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="suma_lei"
              type="number"
              step="0.01"
              placeholder="5000.00"
              {...register('suma_lei')}
              className={errors.suma_lei ? 'border-red-500' : ''}
            />
            {errors.suma_lei && (
              <p className="text-xs text-red-500">{errors.suma_lei.message}</p>
            )}
          </div>

          {/* Furnizor */}
          <div className="space-y-1">
            <Label htmlFor="furnizor" className="text-sm">Furnizor</Label>
            <Input
              id="furnizor"
              type="text"
              placeholder="SC Agro Plant SRL"
              {...register('furnizor')}
            />
          </div>

          {/* Descriere */}
          <div className="space-y-1">
            <Label htmlFor="descriere" className="text-sm">Descriere</Label>
            <Textarea
              id="descriere"
              rows={2}
              placeholder="Butași zmeură Polka - 500 buc"
              {...register('descriere')}
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
