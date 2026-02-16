// src/components/vanzari-butasi/VanzareButasiCard.tsx
'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Calendar, DollarSign, User, Package } from 'lucide-react';
import { VanzareButasi } from '@/lib/supabase/queries/vanzari-butasi';

interface VanzareButasiCardProps {
  vanzare: VanzareButasi;
  clientNume?: string; // Nume client pentru display (optional)
  parcelaNume?: string; // Nume parcelă pentru display (optional)
  onEdit: (vanzare: VanzareButasi) => void;
  onDelete: (vanzare: VanzareButasi) => void;
}

export function VanzareButasiCard({
  vanzare,
  clientNume,
  parcelaNume,
  onEdit,
  onDelete,
}: VanzareButasiCardProps) {
  // Format date pentru display: DD.MM.YYYY
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Format sumă cu separator mii și 2 zecimale
  const formatSuma = (suma: number) => {
    return new Intl.NumberFormat('ro-RO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(suma);
  };

  // Calcul valoare totală
  const valoareTotala = vanzare.cantitate_butasi * vanzare.pret_unitar_lei;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* ID vânzare + Soi */}
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold text-lg text-gray-900">
                {vanzare.id_vanzare_butasi}
              </span>
              <span className="px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
                {vanzare.soi_butasi}
              </span>
            </div>

            {/* Data */}
            <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-1">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(vanzare.data)}</span>
            </div>

            {/* Client (dacă există) */}
            {vanzare.client_id && clientNume && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-1">
                <User className="h-4 w-4" />
                <span>Client: {clientNume}</span>
              </div>
            )}

            {/* Parcelă sursă (dacă există) */}
            {vanzare.parcela_sursa_id && parcelaNume && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <Package className="h-4 w-4" />
                <span>Sursă: {parcelaNume}</span>
              </div>
            )}
          </div>

          {/* Acțiuni */}
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(vanzare)}
              className="h-8 w-8"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(vanzare)}
              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Cantitate și Preț */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="text-sm">
            <span className="text-gray-600">Cantitate:</span>{' '}
            <span className="font-medium text-gray-900">
              {vanzare.cantitate_butasi} butași
            </span>
          </div>
          <div className="text-sm">
            <span className="text-gray-600">Preț/buc:</span>{' '}
            <span className="font-medium text-gray-900">
              {formatSuma(vanzare.pret_unitar_lei)} lei
            </span>
          </div>
        </div>

        {/* Valoare Totală (highlight verde - income) */}
        <div className="flex items-center gap-2 mb-3 p-3 bg-green-50 rounded-lg border border-green-100">
          <DollarSign className="h-5 w-5 text-green-600" />
          <div className="flex-1">
            <div className="text-xs text-gray-600 mb-0.5">Valoare totală</div>
            <div className="text-2xl font-bold text-green-600">
              +{formatSuma(valoareTotala)} lei
            </div>
          </div>
        </div>

        {/* Observații */}
        {vanzare.observatii && (
          <div className="text-sm text-gray-600 border-t pt-2 mt-2">
            {vanzare.observatii}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
