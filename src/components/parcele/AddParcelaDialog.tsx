'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from '@/lib/ui/toast';
import { Plus } from 'lucide-react';

import { AppDialog } from '@/components/app/AppDialog';
import { Button } from '@/components/ui/button';
import { DialogFormActions } from '@/components/ui/dialog-form-actions';
import { generateBusinessId } from '@/lib/supabase/business-ids';
import { getSupabase } from '@/lib/supabase/client';
import { createParcela } from '@/lib/supabase/queries/parcele';
import { hapticError, hapticSuccess } from '@/lib/utils/haptic';
import { parseLocalizedNumber } from '@/lib/utils/area';
import { ParcelaForm, type ParcelaFormData } from './ParcelaForm';
import { queryKeys } from '@/lib/query-keys'

const MAX_SUPRAFATA_M2 = 100_000_000;
const CURRENT_YEAR = new Date().getFullYear();

const parcelaSchema = z.object({
  nume_parcela: z.string().min(1, 'Numele parcelei este obligatoriu'),
  rol: z.string(),
  suprafata_m2: z
    .string()
    .min(1, 'Suprafata este obligatorie')
    .refine((value) => Number.isFinite(parseLocalizedNumber(value)) && parseLocalizedNumber(value) > 0, {
      message: 'Suprafata trebuie să fie pozitivă',
    })
    .refine((value) => parseLocalizedNumber(value) < MAX_SUPRAFATA_M2, {
      message: 'Suprafata introdusă pare nerealist de mare',
    }),
  latitudine: z
    .string()
    .trim()
    .refine((value) => !value || Number.isFinite(Number(value.replace(',', '.'))), {
      message: 'Latitudinea trebuie să fie un număr valid',
    }),
  longitudine: z
    .string()
    .trim()
    .refine((value) => !value || Number.isFinite(Number(value.replace(',', '.'))), {
      message: 'Longitudinea trebuie să fie un număr valid',
    }),
  soi_plantat: z.string(),
  an_plantare: z
    .string()
    .min(1, 'Anul plantarii este obligatoriu')
    .refine((value) => Number.isInteger(Number(value)) && Number(value) >= 1900 && Number(value) <= CURRENT_YEAR + 1, {
      message: 'Anul plantării nu este valid',
    }),
  nr_plante: z
    .string()
    .refine((value) => !value || (Number.isFinite(Number(value)) && Number(value) >= 0), {
      message: 'Numărul de plante trebuie să fie pozitiv sau zero',
    }),
  status: z.string(),
  observatii: z.string(),
});

interface AddParcelaDialogProps {
  soiuriDisponibile: string[];
  onSuccess: () => void;
}

export function AddParcelaDialog({ soiuriDisponibile, onSuccess }: AddParcelaDialogProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const toDecimalOrNull = (value?: string) => {
    if (!value) return null
    const parsed = Number(value.replace(',', '.').trim())
    return Number.isFinite(parsed) ? parsed : null
  }

  const form = useForm<ParcelaFormData>({
    resolver: zodResolver(parcelaSchema),
    defaultValues: {
      nume_parcela: '',
      rol: 'comercial',
      suprafata_m2: '',
      latitudine: '',
      longitudine: '',
      soi_plantat: '',
      an_plantare: String(new Date().getFullYear()),
      nr_plante: '',
      status: 'Activ',
      observatii: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ParcelaFormData) => {
      const supabase = getSupabase();
      const idParcela = await generateBusinessId(supabase, 'PAR');
      return createParcela({
        id_parcela: idParcela,
        nume_parcela: data.nume_parcela.trim(),
        rol: data.rol,
        suprafata_m2: parseLocalizedNumber(data.suprafata_m2),
        latitudine: toDecimalOrNull(data.latitudine) ?? undefined,
        longitudine: toDecimalOrNull(data.longitudine) ?? undefined,
        soi_plantat: data.soi_plantat.trim() || undefined,
        an_plantare: Number(data.an_plantare),
        nr_plante: data.nr_plante ? Number(data.nr_plante) : undefined,
        status: data.status,
        observatii: data.observatii.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.parcele });
      hapticSuccess();
      toast.success('Teren adaugat cu succes');
      form.reset();
      setOpen(false);
      onSuccess();
    },
    onError: (error: Error) => {
      hapticError();
      toast.error(`Eroare: ${error.message}`);
    },
  });

  const onSubmit = (data: ParcelaFormData) => {
    createMutation.mutate(data);
  };

  return (
    <>
      <Button size="lg" className="h-14 w-full rounded-2xl shadow-sm" onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-5 w-5" />
        Adaugă teren
      </Button>

      <AppDialog
        open={open}
        onOpenChange={setOpen}
        title="Adaugă teren nou"
        description="Completeaza detaliile terenului."
        footer={
          <DialogFormActions
            onCancel={() => setOpen(false)}
            onSave={form.handleSubmit(onSubmit)}
            saving={createMutation.isPending}
            cancelLabel="Anulează"
            saveLabel="Salvează teren"
          />
        }
      >
        <form id="add-parcela-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <ParcelaForm form={form} soiuriDisponibile={soiuriDisponibile} />
        </form>
      </AppDialog>
    </>
  );
}
