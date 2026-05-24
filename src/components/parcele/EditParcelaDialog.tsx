'use client';

import { useEffect, useState } from 'react';
import { toast } from '@/lib/ui/toast';

import { AppDialog } from '@/components/app/AppDialog';
import { DialogFormActions } from '@/components/ui/dialog-form-actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppSelect } from '@/components/ui/app-select';
import { emojiOptionsToAppSelect } from '@/lib/ui/app-select-utils';
import { getParcelScopOptions, getParcelStatusOperationalOptions, getParcelStatusOptions } from '@/lib/parcele/parcel-form-options';
import { updateParcela } from '@/lib/supabase/queries/parcele';
import type { Parcela } from '@/lib/supabase/queries/parcele';
import { hapticError, hapticSuccess } from '@/lib/utils/haptic';
import { formatM2ToHa, parseLocalizedNumber } from '@/lib/utils/area';
import { ParcelUsageFields, applyScopDefaults } from '@/components/parcele/ParcelUsageFields';
import {
  coerceParcelaScopFromDb,
  coerceStatusOperationalFromDb,
  type ParcelaScop,
  type StatusOperational,
} from '@/lib/parcele/dashboard-relevance';

type ParcelaUpdate = Partial<Omit<Parcela, 'id' | 'tenant_id' | 'id_parcela' | 'created_at' | 'updated_at'>>;

interface EditParcelaDialogProps {
  parcela: Parcela | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  soiuriDisponibile: string[];
  onSuccess?: () => void;
}

export function EditParcelaDialog({
  parcela,
  open,
  onOpenChange,
  soiuriDisponibile,
  onSuccess,
}: EditParcelaDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nume_parcela: '',
    rol: 'comercial' as ParcelaScop,
    apare_in_dashboard: true,
    contribuie_la_productie: true,
    status_operational: 'activ' as StatusOperational,
    suprafata_m2: '',
    soi_plantat: '',
    an_plantare: '',
    nr_plante: '',
    status: 'Activ',
    observatii: '',
  });

  useEffect(() => {
    if (!parcela) return;
    setFormData({
      nume_parcela: parcela.nume_parcela,
      rol: coerceParcelaScopFromDb(parcela.rol),
      apare_in_dashboard: parcela.apare_in_dashboard ?? true,
      contribuie_la_productie: parcela.contribuie_la_productie ?? true,
      status_operational: coerceStatusOperationalFromDb(parcela.status_operational),
      suprafata_m2: parcela.suprafata_m2.toString(),
      soi_plantat: parcela.soi_plantat || '',
      an_plantare: parcela.an_plantare.toString(),
      nr_plante: parcela.nr_plante?.toString() || '',
      status: parcela.status ?? 'Activ',
      observatii: parcela.observatii || '',
    });
  }, [parcela]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parcela || loading) return;

    setLoading(true);
    try {
      if (!formData.nume_parcela || !formData.suprafata_m2 || !formData.an_plantare) {
        hapticError();
        toast.error('Completeaza campurile obligatorii');
        return;
      }

      const updateData: ParcelaUpdate = {
        nume_parcela: formData.nume_parcela,
        rol: formData.rol,
        apare_in_dashboard: formData.apare_in_dashboard,
        contribuie_la_productie: formData.contribuie_la_productie,
        status_operational: formData.status_operational,
        suprafata_m2: parseLocalizedNumber(formData.suprafata_m2),
        soi_plantat: formData.soi_plantat || null,
        an_plantare: parseInt(formData.an_plantare, 10),
        nr_plante: formData.nr_plante ? parseInt(formData.nr_plante, 10) : null,
        status: formData.status,
        observatii: formData.observatii || null,
      };

      await updateParcela(parcela.id, updateData);
      hapticSuccess();
      toast.success(`Terenul ${parcela.nume_parcela} a fost actualizat`);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error updating parcela:', error);
      hapticError();
      toast.error('Eroare la actualizare');
    } finally {
      setLoading(false);
    }
  };

  if (!parcela) return null;

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Editează teren ${parcela.nume_parcela}`}
      description={`Modifica detaliile pentru terenul ${parcela.nume_parcela}.`}
      contentClassName="sm:max-w-4xl"
      footer={
        <DialogFormActions
          onCancel={() => onOpenChange(false)}
          onSave={() => {
            const formElement = document.getElementById('edit-parcela-form') as HTMLFormElement | null;
            formElement?.requestSubmit();
          }}
          saving={loading}
          cancelLabel="Anulează"
          saveLabel="Salvează"
        />
      }
    >
      <form id="edit-parcela-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nume_parcela">Nume teren *</Label>
          <Input id="nume_parcela" value={formData.nume_parcela} onChange={(e) => handleInputChange('nume_parcela', e.target.value)} required />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <AppSelect
              id="edit-parcela-scop"
              label="Scop"
              value={formData.rol}
              onChange={(value) => {
                const next = value as ParcelaScop
                const defs = applyScopDefaults(next)
                setFormData((prev) => ({
                  ...prev,
                  rol: next,
                  apare_in_dashboard: defs.apare_in_dashboard,
                  contribuie_la_productie: defs.contribuie_la_productie,
                }))
              }}
              options={emojiOptionsToAppSelect(getParcelScopOptions())}
            />
          </div>

          <div className="space-y-2">
            <AppSelect
              id="edit-parcela-status-operational"
              label="Situație operațională"
              value={formData.status_operational}
              onChange={(value) =>
                setFormData((prev) => ({ ...prev, status_operational: value as StatusOperational }))
              }
              options={emojiOptionsToAppSelect(getParcelStatusOperationalOptions())}
            />
          </div>
        </div>

        <ParcelUsageFields
          scop={formData.rol}
          apareInDashboard={formData.apare_in_dashboard}
          contribuieLaProductie={formData.contribuie_la_productie}
          disableCommercialToggles
          onApareChange={(v) => setFormData((prev) => ({ ...prev, apare_in_dashboard: v }))}
          onContribuieChange={(v) => setFormData((prev) => ({ ...prev, contribuie_la_productie: v }))}
        />

        <div className="space-y-2">
          <Label htmlFor="suprafata_m2">Suprafață (m2) *</Label>
          <Input id="suprafata_m2" type="number" step="0.01" value={formData.suprafata_m2} onChange={(e) => handleInputChange('suprafata_m2', e.target.value)} required />
          <p className="text-xs text-muted-foreground">≈ {formatM2ToHa(formData.suprafata_m2)}</p>
        </div>

        <div className="space-y-2">
          <AppSelect
            id="edit-parcela-soi"
            label="Soi Plantat"
            placeholder="Selectează soi"
            value={formData.soi_plantat}
            onChange={(value) => handleInputChange('soi_plantat', value)}
            options={soiuriDisponibile.map((soi) => ({ value: soi, label: soi, emoji: '🌿' }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="an_plantare">An Plantare *</Label>
          <Input id="an_plantare" type="number" min="2000" max={new Date().getFullYear()} value={formData.an_plantare} onChange={(e) => handleInputChange('an_plantare', e.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="nr_plante">Numar Plante</Label>
          <Input id="nr_plante" type="number" value={formData.nr_plante} onChange={(e) => handleInputChange('nr_plante', e.target.value)} />
        </div>

        <div className="space-y-2">
          <AppSelect
            id="edit-parcela-status"
            label="Status *"
            value={formData.status}
            onChange={(value) => handleInputChange('status', value)}
            options={emojiOptionsToAppSelect(getParcelStatusOptions())}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="observatii">Observații</Label>
          <Input id="observatii" value={formData.observatii} onChange={(e) => handleInputChange('observatii', e.target.value)} />
        </div>
      </form>
    </AppDialog>
  );
}

