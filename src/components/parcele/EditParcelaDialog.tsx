'use client';

// ============================================================================
// EDIT PARCELA DIALOG
// Dialog pentru editare parcelă existentă (pre-fill cu date actuale)
// ============================================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { updateParcela } from '@/lib/supabase/queries/parcele';
import type { Parcela, NewParcela } from '@/lib/supabase/queries/parcele';
type ParcelaUpdate = Partial<Omit<NewParcela, 'tenant_id' | 'id_parcela'>>;

// ============================================================================
// PROPS
// ============================================================================

interface EditParcelaDialogProps {
  parcela: Parcela | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  soiuriDisponibile: string[];
  onSuccess?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function EditParcelaDialog({
  parcela,
  open,
  onOpenChange,
  soiuriDisponibile,
  onSuccess,
}: EditParcelaDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    nume_parcela: '',
    suprafata_m2: '',
    soi_plantat: '',
    an_plantare: '',
    nr_plante: '',
    status: 'Activ',
    observatii: '',
  });

  // Pre-fill form când se deschide dialog
  useEffect(() => {
    if (parcela) {
      setFormData({
        nume_parcela: parcela.nume_parcela,
        suprafata_m2: parcela.suprafata_m2.toString(),
        soi_plantat: parcela.soi_plantat || '',
        an_plantare: parcela.an_plantare.toString(),
        nr_plante: parcela.nr_plante?.toString() || '',
        status: parcela.status,
        observatii: parcela.observatii || '',
      });
    }
  }, [parcela]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parcela) return;

    setLoading(true);

    try {
      // Validare
      if (!formData.nume_parcela || !formData.suprafata_m2 || !formData.an_plantare) {
        toast.error('Completează câmpurile obligatorii!');
        setLoading(false);
        return;
      }

      // Prepare update data
      const updateData: ParcelaUpdate = {
        nume_parcela: formData.nume_parcela,
        suprafata_m2: parseFloat(formData.suprafata_m2),
        soi_plantat: formData.soi_plantat || null,
        an_plantare: parseInt(formData.an_plantare, 10),
        nr_plante: formData.nr_plante ? parseInt(formData.nr_plante, 10) : null,
        status: formData.status,
        observatii: formData.observatii || null,
      };

      // Update în Supabase
      await updateParcela(parcela.id, updateData);

      // Success!
      toast.success(`Parcelă ${parcela.id_parcela} actualizată! ✅`);

      // Close dialog
      onOpenChange(false);

      // Callback
      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error('Error updating parcela:', error);
      toast.error('Eroare la actualizare! Încearcă din nou.');
    } finally {
      setLoading(false);
    }
  };

  if (!parcela) return null;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl text-[#312E3F]">
            ✏️ Editează Parcelă {parcela.id_parcela}
          </DialogTitle>
          <DialogDescription>
            Modifică detaliile parcelei {parcela.nume_parcela}.
          </DialogDescription>
        </DialogHeader>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Nume Parcelă */}
          <div className="space-y-2">
            <Label htmlFor="nume_parcela" className="text-[#312E3F] font-semibold">
              Nume Parcelă *
            </Label>
            <Input
              id="nume_parcela"
              value={formData.nume_parcela}
              onChange={(e) => handleInputChange('nume_parcela', e.target.value)}
              required
              className="min-h-[48px] rounded-xl"
            />
          </div>

          {/* Suprafață */}
          <div className="space-y-2">
            <Label htmlFor="suprafata_m2" className="text-[#312E3F] font-semibold">
              Suprafață (m²) *
            </Label>
            <Input
              id="suprafata_m2"
              type="number"
              step="0.01"
              value={formData.suprafata_m2}
              onChange={(e) => handleInputChange('suprafata_m2', e.target.value)}
              required
              className="min-h-[48px] rounded-xl"
            />
          </div>

          {/* Soi Plantat */}
          <div className="space-y-2">
            <Label htmlFor="soi_plantat" className="text-[#312E3F] font-semibold">
              Soi Plantat
            </Label>
            <Select
              value={formData.soi_plantat}
              onValueChange={(value) => handleInputChange('soi_plantat', value)}
            >
              <SelectTrigger className="min-h-[48px] rounded-xl">
                <SelectValue placeholder="Selectează soi..." />
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

          {/* An Plantare */}
          <div className="space-y-2">
            <Label htmlFor="an_plantare" className="text-[#312E3F] font-semibold">
              An Plantare *
            </Label>
            <Input
              id="an_plantare"
              type="number"
              min="2000"
              max={new Date().getFullYear()}
              value={formData.an_plantare}
              onChange={(e) => handleInputChange('an_plantare', e.target.value)}
              required
              className="min-h-[48px] rounded-xl"
            />
          </div>

          {/* Nr Plante */}
          <div className="space-y-2">
            <Label htmlFor="nr_plante" className="text-[#312E3F] font-semibold">
              Număr Plante
            </Label>
            <Input
              id="nr_plante"
              type="number"
              value={formData.nr_plante}
              onChange={(e) => handleInputChange('nr_plante', e.target.value)}
              className="min-h-[48px] rounded-xl"
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status" className="text-[#312E3F] font-semibold">
              Status
            </Label>
            <Select
              value={formData.status}
              onValueChange={(value) => handleInputChange('status', value)}
            >
              <SelectTrigger className="min-h-[48px] rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Activ">Activ</SelectItem>
                <SelectItem value="Inactiv">Inactiv</SelectItem>
                <SelectItem value="În Pregătire">În Pregătire</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Observatii */}
          <div className="space-y-2">
            <Label htmlFor="observatii" className="text-[#312E3F] font-semibold">
              Observații
            </Label>
            <Input
              id="observatii"
              value={formData.observatii}
              onChange={(e) => handleInputChange('observatii', e.target.value)}
              className="min-h-[48px] rounded-xl"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1 min-h-[48px] rounded-xl"
            >
              Anulează
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#F16B6B] hover:bg-[#E85A5A] text-white min-h-[48px] rounded-xl"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Se salvează...
                </>
              ) : (
                <>
                  <Pencil className="mr-2 h-4 w-4" />
                  Salvează Modificări
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
