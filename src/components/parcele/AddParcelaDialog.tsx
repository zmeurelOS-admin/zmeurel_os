'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Loader2 } from 'lucide-react';

import { createParcela } from '@/lib/supabase/queries/parcele';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const parcelaSchema = z.object({
  nume_parcela: z.string().min(1, 'Numele parcelei este obligatoriu'),
  suprafata_m2: z.string().min(1, 'Suprafața este obligatorie'),
  soi_plantat: z.string().optional(),
  an_plantare: z.string().min(1, 'Anul plantării este obligatoriu'),
  nr_plante: z.string().optional(),
  observatii: z.string().optional(),
});

type ParcelaFormData = z.infer<typeof parcelaSchema>;

interface AddParcelaDialogProps {
  tenantId: string;
  soiuriDisponibile: string[];
  onSuccess: () => void;
}

export function AddParcelaDialog({
  tenantId,
  soiuriDisponibile,
  onSuccess,
}: AddParcelaDialogProps) {
  const [open, setOpen] = useState(false);

  // DEBUG: Afișează soiurile în console când componenta se montează
  useEffect(() => {
    console.log('🔍 [AddParcelaDialog] Soiuri disponibile:', soiuriDisponibile);
    console.log('🔍 [AddParcelaDialog] Count soiuri:', soiuriDisponibile.length);
  }, [soiuriDisponibile]);

  const form = useForm<ParcelaFormData>({
    resolver: zodResolver(parcelaSchema),
    defaultValues: {
      nume_parcela: '',
      suprafata_m2: '',
      soi_plantat: '',
      an_plantare: String(new Date().getFullYear()),
      nr_plante: '',
      observatii: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ParcelaFormData) => {
      // ID-ul se generează automat în createParcela
      return createParcela({
        tenant_id: tenantId,
        nume_parcela: data.nume_parcela,
        suprafata_m2: Number(data.suprafata_m2),
        soi_plantat: data.soi_plantat || null,
        an_plantare: Number(data.an_plantare),
        nr_plante: data.nr_plante ? Number(data.nr_plante) : null,
        status: 'Activ',
        observatii: data.observatii || null,
      });
    },
    onSuccess: () => {
      toast.success('Parcela a fost adăugată cu succes!');
      form.reset();
      setOpen(false);
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(`Eroare: ${error.message}`);
    },
  });

  const onSubmit = (data: ParcelaFormData) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="bg-[#F16B6B] hover:bg-[#ef4444] min-h-12">
          <Plus className="h-5 w-5 mr-2" />
          Adaugă Parcelă
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🌱 Adaugă Parcelă Nouă</DialogTitle>
          <DialogDescription>
            Completează detaliile parcelei. ID-ul se va genera automat (P001, P002...).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nume_parcela">Nume Parcelă *</Label>
            <Input
              id="nume_parcela"
              placeholder="ex: Parcelă Nord, Lot 1..."
              {...form.register('nume_parcela')}
            />
            {form.formState.errors.nume_parcela && (
              <p className="text-sm text-red-600">
                {form.formState.errors.nume_parcela.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="suprafata_m2">Suprafață (m²) *</Label>
            <Input
              id="suprafata_m2"
              type="number"
              placeholder="ex: 1200"
              {...form.register('suprafata_m2')}
            />
            {form.formState.errors.suprafata_m2 && (
              <p className="text-sm text-red-600">
                {form.formState.errors.suprafata_m2.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="soi_plantat">Soi Plantat</Label>
            <select
              id="soi_plantat"
              {...form.register('soi_plantat')}
              style={{
                backgroundColor: 'white',
                color: 'black',
                fontSize: '14px',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                width: '100%',
                minHeight: '40px'
              }}
            >
              <option value="" style={{ color: 'gray' }}>Selectează soi...</option>
              {soiuriDisponibile.length > 0 ? (
                soiuriDisponibile.map((soi, index) => (
                  <option
                    key={`${soi}-${index}`}
                    value={soi}
                    style={{
                      color: 'black',
                      backgroundColor: 'white',
                      padding: '8px'
                    }}
                  >
                    {soi}
                  </option>
                ))
              ) : (
                <option value="" disabled style={{ color: 'red' }}>
                  Nu există soiuri disponibile
                </option>
              )}
            </select>
            <p className="text-xs text-gray-500">
              {soiuriDisponibile.length} soiuri disponibile
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="an_plantare">An Plantare *</Label>
            <Input
              id="an_plantare"
              type="number"
              placeholder="2026"
              {...form.register('an_plantare')}
            />
            {form.formState.errors.an_plantare && (
              <p className="text-sm text-red-600">
                {form.formState.errors.an_plantare.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="nr_plante">Număr Plante</Label>
            <Input
              id="nr_plante"
              type="number"
              placeholder="ex: 800"
              {...form.register('nr_plante')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observatii">Observații</Label>
            <Textarea
              id="observatii"
              placeholder="Notiţe opţionale..."
              className="resize-none"
              {...form.register('observatii')}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={createMutation.isPending}
            >
              Anulează
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-[#F16B6B] hover:bg-[#ef4444]"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Se salvează...
                </>
              ) : (
                'Salvează Parcelă'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
