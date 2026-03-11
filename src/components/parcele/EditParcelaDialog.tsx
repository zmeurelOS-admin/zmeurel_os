'use client';

import { useEffect, useState } from 'react';
import { toast } from '@/lib/ui/toast';

import { AppDialog } from '@/components/app/AppDialog';
import { DialogFormActions } from '@/components/ui/dialog-form-actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateParcela } from '@/lib/supabase/queries/parcele';
import type { Parcela } from '@/lib/supabase/queries/parcele';
import { hapticError, hapticSuccess } from '@/lib/utils/haptic';
import { formatM2ToHa } from '@/lib/utils/area';

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
        suprafata_m2: parseFloat(formData.suprafata_m2),
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
          <Label htmlFor="nume_parcela">Nume teren</Label>
          <Input id="nume_parcela" value={formData.nume_parcela} onChange={(e) => handleInputChange('nume_parcela', e.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="suprafata_m2">Suprafață (m2)</Label>
          <Input id="suprafata_m2" type="number" step="0.01" value={formData.suprafata_m2} onChange={(e) => handleInputChange('suprafata_m2', e.target.value)} required />
          <p className="text-xs text-muted-foreground">?? {formatM2ToHa(formData.suprafata_m2)}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="soi_plantat">Soi Plantat</Label>
          <Select value={formData.soi_plantat} onValueChange={(value) => handleInputChange('soi_plantat', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Selectează soi" />
            </SelectTrigger>
            <SelectContent>
              {soiuriDisponibile.map((soi) => (
                <SelectItem key={soi} value={soi}>
                  {soi}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="an_plantare">An Plantare</Label>
          <Input id="an_plantare" type="number" min="2000" max={new Date().getFullYear()} value={formData.an_plantare} onChange={(e) => handleInputChange('an_plantare', e.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="nr_plante">Numar Plante</Label>
          <Input id="nr_plante" type="number" value={formData.nr_plante} onChange={(e) => handleInputChange('nr_plante', e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Activ">Activ</SelectItem>
              <SelectItem value="Inactiv">Inactiv</SelectItem>
              <SelectItem value="In Pregatire">In Pregatire</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="observatii">Observații</Label>
          <Input id="observatii" value={formData.observatii} onChange={(e) => handleInputChange('observatii', e.target.value)} />
        </div>
      </form>
    </AppDialog>
  );
}

