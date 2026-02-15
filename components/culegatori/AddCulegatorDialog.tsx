// src/components/culegatori/AddCulegatorDialog.tsx
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
import { Loader2 } from 'lucide-react';

// ========================================
// ZOD VALIDATION SCHEMA
// ========================================

const culegatorSchema = z.object({
  nume_prenume: z.string().min(2, 'Numele trebuie să aibă minim 2 caractere'),
  telefon: z.string().optional(),
  tip_angajare: z.string().min(1, 'Selectează tipul de angajare'),
  tarif_lei_kg: z.string().min(0, 'Tariful trebuie să fie mai mare sau egal cu 0'),
  data_angajare: z.string().optional(),
  status_activ: z.boolean().default(true),
});

type CulegatorFormData = z.infer<typeof culegatorSchema>;

// ========================================
// COMPONENT
// ========================================

interface AddCulegatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CulegatorFormData) => Promise<void>;
}

export function AddCulegatorDialog({
  open,
  onOpenChange,
  onSubmit,
}: AddCulegatorDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CulegatorFormData>({
    resolver: zodResolver(culegatorSchema),
    defaultValues: {
      nume_prenume: '',
      telefon: '',
      tip_angajare: 'Sezonier',
      tarif_lei_kg: '0',
      data_angajare: '',
      status_activ: true,
    },
  });

  const handleSubmit = async (data: CulegatorFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating culegator:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[500px]"
        style={{ backgroundColor: 'white' }}
      >
        <DialogHeader>
          <DialogTitle>Adaugă Culegător Nou</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {/* Nume Prenume */}
          <div className="space-y-2">
            <Label htmlFor="nume_prenume">
              Nume și Prenume <span className="text-red-500">*</span>
            </Label>
            <Input
              id="nume_prenume"
              {...form.register('nume_prenume')}
              placeholder="Ex: Popescu Ion"
              style={{ backgroundColor: 'white', color: 'black' }}
            />
            {form.formState.errors.nume_prenume && (
              <p className="text-sm text-red-500">
                {form.formState.errors.nume_prenume.message}
              </p>
            )}
          </div>

          {/* Telefon */}
          <div className="space-y-2">
            <Label htmlFor="telefon">Telefon</Label>
            <Input
              id="telefon"
              {...form.register('telefon')}
              placeholder="Ex: 0740123456"
              type="tel"
              style={{ backgroundColor: 'white', color: 'black' }}
            />
          </div>

          {/* Tip Angajare */}
          <div className="space-y-2">
            <Label htmlFor="tip_angajare">
              Tip Angajare <span className="text-red-500">*</span>
            </Label>
            <select
              id="tip_angajare"
              {...form.register('tip_angajare')}
              className="w-full rounded-md border border-input px-3 py-2 text-sm"
              style={{ backgroundColor: 'white', color: 'black' }}
            >
              <option value="Sezonier">Sezonier</option>
              <option value="Permanent">Permanent</option>
              <option value="Zilier">Zilier</option>
              <option value="Colaborator">Colaborator</option>
            </select>
            {form.formState.errors.tip_angajare && (
              <p className="text-sm text-red-500">
                {form.formState.errors.tip_angajare.message}
              </p>
            )}
          </div>

          {/* Tarif lei/kg */}
          <div className="space-y-2">
            <Label htmlFor="tarif_lei_kg">Tarif (lei/kg)</Label>
            <Input
              id="tarif_lei_kg"
              {...form.register('tarif_lei_kg')}
              type="number"
              step="0.01"
              min="0"
              placeholder="Ex: 2.5 (0 = salarizat fix)"
              style={{ backgroundColor: 'white', color: 'black' }}
            />
            <p className="text-xs text-muted-foreground">
              Lasă 0 pentru culegători salarizați fix (nu plătiți la kg)
            </p>
            {form.formState.errors.tarif_lei_kg && (
              <p className="text-sm text-red-500">
                {form.formState.errors.tarif_lei_kg.message}
              </p>
            )}
          </div>

          {/* Data Angajare */}
          <div className="space-y-2">
            <Label htmlFor="data_angajare">Data Angajare</Label>
            <Input
              id="data_angajare"
              {...form.register('data_angajare')}
              type="date"
              style={{ backgroundColor: 'white', color: 'black' }}
            />
          </div>

          {/* Status Activ */}
          <div className="flex items-center space-x-2">
            <input
              id="status_activ"
              type="checkbox"
              {...form.register('status_activ')}
              className="w-4 h-4"
              defaultChecked
            />
            <Label htmlFor="status_activ" className="font-normal cursor-pointer">
              Culegător activ (bifează pentru activ)
            </Label>
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
                'Salvează Culegător'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
