'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
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
  suprafata_m2: z.string().min(1, 'Suprafata este obligatorie'),
  soi_plantat: z.string().optional(),
  an_plantare: z.string().min(1, 'Anul plantarii este obligatoriu'),
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
      const supabase = createClient();

      // Preia user din sesiune
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Utilizator neautentificat');

      // Preia tenant direct cu user.id
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('owner_user_id', user.id)
        .single();

      if (tenantError || !tenant) throw new Error('Tenant negasit: ' + tenantError?.message);

      console.log('Tenant ID gasit:', tenant.id);

      // Genereaza urmatorul ID parcela
      const { data: parceleExistente } = await supabase
        .from('parcele')
        .select('id_parcela')
        .eq('tenant_id', tenant.id);

      let nextId = 'P001';
      if (parceleExistente && parceleExistente.length > 0) {
        const maxNum = parceleExistente.reduce((max, p) => {
          const num = parseInt(p.id_parcela.replace('P', ''), 10);
          return num > max ? num : max;
        }, 0);
        nextId = `P${String(maxNum + 1).padStart(3, '0')}`;
      }

      console.log('Next ID:', nextId);

      // Insert
      const { data: result, error: insertError } = await supabase
        .from('parcele')
        .insert({
          tenant_id: tenant.id,
          id_parcela: nextId,
          nume_parcela: data.nume_parcela,
          suprafata_m2: Number(data.suprafata_m2),
          soi_plantat: data.soi_plantat || null,
          an_plantare: Number(data.an_plantare),
          nr_plante: data.nr_plante ? Number(data.nr_plante) : null,
          status: 'Activ',
          gps_lat: null,
          gps_lng: null,
          observatii: data.observatii || null,
        })
        .select()
        .single();

      if (insertError) throw new Error(`Eroare insert: ${insertError.message}`);
      return result;
    },
    onSuccess: () => {
      toast.success('Parcela a fost adaugata cu succes!');
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
          Adauga Parcela
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adauga Parcela Noua</DialogTitle>
          <DialogDescription>
            Completeaza detaliile parcelei. ID-ul se va genera automat (P001, P002...).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nume_parcela">Nume Parcela *</Label>
            <Input
              id="nume_parcela"
              placeholder="ex: Parcela Nord, Lot 1..."
              {...form.register('nume_parcela')}
            />
            {form.formState.errors.nume_parcela && (
              <p className="text-sm text-red-600">
                {form.formState.errors.nume_parcela.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="suprafata_m2">Suprafata (m2) *</Label>
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
                minHeight: '40px',
              }}
            >
              <option value="">Selecteaza soi...</option>
              {soiuriDisponibile.map((soi, index) => (
                <option key={`${soi}-${index}`} value={soi}>
                  {soi}
                </option>
              ))}
            </select>
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
            <Label htmlFor="nr_plante">Numar Plante</Label>
            <Input
              id="nr_plante"
              type="number"
              placeholder="ex: 800"
              {...form.register('nr_plante')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observatii">Observatii</Label>
            <Textarea
              id="observatii"
              placeholder="Notite optionale..."
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
              Anuleaza
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-[#F16B6B] hover:bg-[#ef4444]"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Se salveaza...
                </>
              ) : (
                'Salveaza Parcela'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
