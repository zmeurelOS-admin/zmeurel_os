// src/components/cheltuieli/AddCheltuialaDialog.tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

// ========================================
// CATEGORII CHELTUIELI (din nomenclatoare)
// ========================================

const CATEGORII_CHELTUIELI = [
  'Electricitate',
  'Motorină Transport',
  'Ambalaje',
  'Etichete',
  'Reparații Utilaje',
  'Scule',
  'Fertilizare',
  'Pesticide',
  'Întreținere Curentă',
  'Cules',
  'Material Săditor',
  'Sistem Susținere',
  'Sistem Irigatie',
  'Altele',
];

// ========================================
// ZOD VALIDATION SCHEMA
// ========================================

const cheltuialaSchema = z.object({
  data: z.string().min(1, 'Data este obligatorie'),
  categorie: z.string().min(1, 'Selectează categoria'),
  suma_lei: z.string().min(1, 'Suma este obligatorie'),
  furnizor: z.string().optional(),
  descriere: z.string().optional(),
});

type CheltuialaFormData = z.infer<typeof cheltuialaSchema>;

// ========================================
// COMPONENT
// ========================================

interface AddCheltuialaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CheltuialaFormData) => Promise<void>;
}

export function AddCheltuialaDialog({
  open,
  onOpenChange,
  onSubmit,
}: AddCheltuialaDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CheltuialaFormData>({
    resolver: zodResolver(cheltuialaSchema),
    defaultValues: {
      data: new Date().toISOString().split('T')[0], // Data de azi
      categorie: '',
      suma_lei: '',
      furnizor: '',
      descriere: '',
    },
  });

  const handleSubmit = async (data: CheltuialaFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      form.reset({
        data: new Date().toISOString().split('T')[0],
        categorie: '',
        suma_lei: '',
        furnizor: '',
        descriere: '',
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating cheltuiala:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'white' }}
      >
        <DialogHeader>
          <DialogTitle>Adaugă Cheltuială Nouă</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {/* Data */}
          <div className="space-y-2">
            <Label htmlFor="data">
              Data <span className="text-red-500">*</span>
            </Label>
            <Input
              id="data"
              {...form.register('data')}
              type="date"
              style={{ backgroundColor: 'white', color: 'black' }}
            />
            {form.formState.errors.data && (
              <p className="text-sm text-red-500">
                {form.formState.errors.data.message}
              </p>
            )}
          </div>

          {/* Categorie */}
          <div className="space-y-2">
            <Label htmlFor="categorie">
              Categorie <span className="text-red-500">*</span>
            </Label>
            <select
              id="categorie"
              {...form.register('categorie')}
              className="w-full rounded-md border border-input px-3 py-2 text-sm"
              style={{ backgroundColor: 'white', color: 'black' }}
            >
              <option value="">Selectează categoria...</option>
              {CATEGORII_CHELTUIELI.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {form.formState.errors.categorie && (
              <p className="text-sm text-red-500">
                {form.formState.errors.categorie.message}
              </p>
            )}
          </div>

          {/* Sumă */}
          <div className="space-y-2">
            <Label htmlFor="suma_lei">
              Sumă (lei) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="suma_lei"
              {...form.register('suma_lei')}
              type="number"
              step="0.01"
              min="0"
              placeholder="Ex: 150.50"
              style={{ backgroundColor: 'white', color: 'black' }}
            />
            {form.formState.errors.suma_lei && (
              <p className="text-sm text-red-500">
                {form.formState.errors.suma_lei.message}
              </p>
            )}
          </div>

          {/* Furnizor */}
          <div className="space-y-2">
            <Label htmlFor="furnizor">Furnizor / Magazin</Label>
            <Input
              id="furnizor"
              {...form.register('furnizor')}
              placeholder="Ex: Lidl, Dedeman, Petrom"
              style={{ backgroundColor: 'white', color: 'black' }}
            />
          </div>

          {/* Descriere */}
          <div className="space-y-2">
            <Label htmlFor="descriere">Descriere</Label>
            <Textarea
              id="descriere"
              {...form.register('descriere')}
              placeholder="Ex: Electricitate casă + pompă. Factura nr. 12345"
              rows={3}
              style={{ backgroundColor: 'white', color: 'black' }}
            />
            <p className="text-xs text-muted-foreground">
              Detalii suplimentare despre cheltuială (număr factură, etc.)
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Anulează
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              style={{ backgroundColor: '#F16B6B', color: 'white' }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Se salvează...
                </>
              ) : (
                'Salvează Cheltuială'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
