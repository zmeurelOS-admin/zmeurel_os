// src/components/recoltari/RecoltareCard.tsx
'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Calendar, User, Package, DollarSign } from 'lucide-react';
import { Recoltare } from '@/lib/supabase/queries/recoltari';

interface RecoltareCardProps {
  recoltare: Recoltare;
  culegatorNume?: string;
  culegatorTarif?: number; // Tarif lei/kg din tabela culegatori
  parcelaNume?: string;
  onEdit: (recoltare: Recoltare) => void;
  onDelete: (recoltare: Recoltare) => void;
}

export function RecoltareCard({
  recoltare,
  culegatorNume,
  culegatorTarif,
  parcelaNume,
  onEdit,
  onDelete,
}: RecoltareCardProps) {
  // Format date pentru display: DD.MM.YYYY
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Format numere
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ro-RO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  // Calcule automate
  const cantitateBrutaKg = recoltare.nr_caserole * 0.5; // 1 caserola = 0.5 kg
  const cantitateNetaKg = cantitateBrutaKg - recoltare.tara_kg;
  const valoareMuncaLei = culegatorTarif ? cantitateNetaKg * culegatorTarif : 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* ID recoltare */}
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold text-lg text-gray-900">
                {recoltare.id_recoltare}
              </span>
            </div>

            {/* Data */}
            <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-1">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(recoltare.data)}</span>
            </div>

            {/* Culegător */}
            {recoltare.culegator_id && culegatorNume && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-1">
                <User className="h-4 w-4" />
                <span>{culegatorNume}</span>
              </div>
            )}

            {/* Parcelă */}
            {recoltare.parcela_id && parcelaNume && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <Package className="h-4 w-4" />
                <span>{parcelaNume}</span>
              </div>
            )}
          </div>

          {/* Acțiuni */}
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(recoltare)}
              className="h-8 w-8"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(recoltare)}
              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Cantități */}
        <div className="grid grid-cols-3 gap-2 mb-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">Caserole</div>
            <div className="text-lg font-bold text-gray-900">
              {recoltare.nr_caserole}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">Brut (kg)</div>
            <div className="text-lg font-bold text-blue-600">
              {formatNumber(cantitateBrutaKg)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">Net (kg)</div>
            <div className="text-lg font-bold text-blue-700">
              {formatNumber(cantitateNetaKg)}
            </div>
          </div>
        </div>

        {/* Tară (dacă există) */}
        {recoltare.tara_kg > 0 && (
          <div className="text-sm mb-2 text-gray-600">
            Tară: {formatNumber(recoltare.tara_kg)} kg
          </div>
        )}

        {/* Valoare Muncă (dacă există tarif) */}
        {culegatorTarif && culegatorTarif > 0 && (
          <div className="flex items-center gap-2 mb-3 p-3 bg-red-50 rounded-lg border border-red-100">
            <DollarSign className="h-5 w-5 text-red-600" />
            <div className="flex-1">
              <div className="text-xs text-gray-600 mb-0.5">
                Valoare muncă ({formatNumber(culegatorTarif)} lei/kg)
              </div>
              <div className="text-2xl font-bold text-red-600">
                -{formatNumber(valoareMuncaLei)} lei
              </div>
            </div>
          </div>
        )}

        {/* Culegător cu tarif 0 (Salarizat fix) */}
        {culegatorTarif === 0 && (
          <div className="text-sm text-gray-600 mb-2">
            Culegător salarizat fix (fără tarif/kg)
          </div>
        )}

        {/* Observații */}
        {recoltare.observatii && (
          <div className="text-sm text-gray-600 border-t pt-2 mt-2">
            {recoltare.observatii}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
