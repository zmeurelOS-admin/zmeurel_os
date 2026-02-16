// src/components/vanzari/VanzareCard.tsx
'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Calendar, User, DollarSign, Package } from 'lucide-react';
import { Vanzare } from '@/lib/supabase/queries/vanzari';

interface VanzareCardProps {
  vanzare: Vanzare;
  clientNume?: string;
  onEdit: (vanzare: Vanzare) => void;
  onDelete: (vanzare: Vanzare) => void;
}

export function VanzareCard({
  vanzare,
  clientNume,
  onEdit,
  onDelete,
}: VanzareCardProps) {
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
  const valoareTotala = vanzare.cantitate_kg * vanzare.pret_lei_kg;

  // Culori badge status plată
  const getBadgeColor = (status: string) => {
    switch (status) {
      case 'Plătit':
        return 'bg-green-100 text-green-800';
      case 'Restanță':
        return 'bg-red-100 text-red-800';
      case 'Avans':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* ID vânzare + Status plată */}
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold text-lg text-gray-900">
                {vanzare.id_vanzare}
              </span>
              <span className={`px-2 py-1 rounded-md text-xs font-medium ${getBadgeColor(vanzare.status_plata)}`}>
                {vanzare.status_plata}
              </span>
            </div>

            {/* Data */}
            <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-1">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(vanzare.data)}</span>
            </div>

            {/* Client (dacă există) */}
            {vanzare.client_id && clientNume && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <User className="h-4 w-4" />
                <span>Client: {clientNume}</span>
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
              {formatSuma(vanzare.cantitate_kg)} kg
            </span>
          </div>
          <div className="text-sm">
            <span className="text-gray-600">Preț/kg:</span>{' '}
            <span className="font-medium text-gray-900">
              {formatSuma(vanzare.pret_lei_kg)} lei
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

        {/* Observații lădițe */}
        {vanzare.observatii_ladite && (
          <div className="flex items-start gap-2 text-sm text-gray-600 border-t pt-2 mt-2">
            <Package className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-medium">Lădițe:</span> {vanzare.observatii_ladite}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
