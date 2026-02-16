// src/components/clienti/EditClientDialog.tsx
'use client';

import { useState, useEffect } from 'react';
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
import type { Client } from '@/lib/supabase/queries/clienti';

// ========================================
// ZOD VALIDATION SCHEMA
// ========================================

const clientSchema = z.object({
  nume_client: z.string().min(2, 'Numele trebuie să aibă minim 2 caractere'),
  telefon: z.string().optional(),
  email: z.string().email('Email invalid').or(z.literal('')).optional(),
  adresa: z.string().optional(),
  pret_negociat_lei_kg: z.string().optional(),
  observatii: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientSchema>;

// ========================================
// COMPONENT
// ========================================

interface EditClientDialogProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (id: string, data: ClientFormData) => Promise<void>;
}

export function EditClientDialog({
  client,
  open,
  onOpenChange,
  onSubmit,
}: EditClientDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      nume_client: '',
      telefon: '',
      email: '',
      adresa: '',
      pret_negociat_lei_kg: '',
      observatii: '',
    },
  });

  // Populate form când se deschide dialog-ul cu un client
  useEffect(() => {
    if (client && open) {
      form.reset({
        nume_client: client.nume_client,
        telefon: client.telefon || '',
        email: client.email || '',
        adresa: client.adresa || '',
        pret_negociat_lei_kg: client.pret_negociat_lei_kg 
          ? String(client.pret_negociat_lei_kg) 
          : '',
        observatii: client.observatii || '',
      });
    }
  }, [client, open, form]);

  const handleSubmit = async (data: ClientFormData) => {
    if (!client) return;

    setIsSubmitting(true);
    try {
      await onSubmit(client.id, data);
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating client:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'white' }}
      >
        <DialogHeader>
          <DialogTitle>
            Editează Client: {client.id_client}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {/* Nume Client */}
          <div className="space-y-2">
            <Label htmlFor="nume_client">
              Nume Client <span className="text-red-500">*</span>
            </Label>
            <Input
              id="nume_client"
              {...form.register('nume_client')}
              placeholder="Ex: Restaurant La Zmeură"
              style={{ backgroundColor: 'white', color: 'black' }}
            />
            {form.formState.errors.nume_client && (
              <p className="text-sm text-red-500">
                {form.formState.errors.nume_client.message}
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

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              {...form.register('email')}
              placeholder="Ex: contact@restaurant.ro"
              type="email"
              style={{ backgroundColor: 'white', color: 'black' }}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-red-500">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          {/* Adresă */}
          <div className="space-y-2">
            <Label htmlFor="adresa">Adresă</Label>
            <Textarea
              id="adresa"
              {...form.register('adresa')}
              placeholder="Ex: Str. Principală nr. 10, Suceava"
              rows={2}
              style={{ backgroundColor: 'white', color: 'black' }}
            />
          </div>

          {/* Preț Negociat */}
          <div className="space-y-2">
            <Label htmlFor="pret_negociat_lei_kg">
              Preț Negociat (lei/kg)
            </Label>
            <Input
              id="pret_negociat_lei_kg"
              {...form.register('pret_negociat_lei_kg')}
              type="number"
              step="0.01"
              min="0"
              placeholder="Ex: 12.50 (lasă gol pentru preț standard)"
              style={{ backgroundColor: 'white', color: 'black' }}
            />
            <p className="text-xs text-muted-foreground">
              Lasă gol dacă clientul plătește prețul standard (fără negociere)
            </p>
          </div>

          {/* Observații */}
          <div className="space-y-2">
            <Label htmlFor="observatii">Observații</Label>
            <Textarea
              id="observatii"
              {...form.register('observatii')}
              placeholder="Ex: Are 15 lădițe returnabile. Preferă livrare marți."
              rows={3}
              style={{ backgroundColor: 'white', color: 'black' }}
            />
            <p className="text-xs text-muted-foreground">
              Tracking lădițe returnabile, preferințe livrare, etc.
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
                'Salvează Modificări'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
