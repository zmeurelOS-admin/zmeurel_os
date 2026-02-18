// src/components/investitii/InvestitieCard.tsx
'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Calendar, DollarSign, Package } from 'lucide-react';
import { Investitie, BADGE_COLORS } from '@/lib/supabase/queries/investitii';

interface InvestitieCardProps {
  investitie: Investitie;
  parcelaNume?: string; // Nume parcelă pentru display (optional)
  onEdit: (investitie: Investitie) => void;
  onDelete: (investitie: Investitie) => void;
}

export function InvestitieCard({
  investitie,
  parcelaNume,
  onEdit,
  onDelete,
}: InvestitieCardProps) {
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

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* ID investiție + Categorie */}
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold text-lg text-gray-900">
                {investitie.id_investitie}
              </span>
              <span
                className={`px-2 py-1 rounded-md text-xs font-medium ${
                  BADGE_COLORS[investitie.categorie || "Altele"] || 'bg-gray-100 text-gray-800'
                }`}
              >
                {investitie.categorie || "Altele"}
              </span>
            </div>

            {/* Data */}
            <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-1">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(investitie.data)}</span>
            </div>

            {/* Parcelă (dacă există) */}
            {investitie.parcela_id && parcelaNume && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <Package className="h-4 w-4" />
                <span>Parcelă: {parcelaNume}</span>
              </div>
            )}
          </div>

          {/* Acțiuni */}
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(investitie)}
              className="h-8 w-8"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(investitie)}
              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Sumă (highlight roșu - expense) */}
        <div className="flex items-center gap-2 mb-3 p-3 bg-red-50 rounded-lg border border-red-100">
          <DollarSign className="h-5 w-5 text-red-600" />
          <div className="flex-1">
            <div className="text-xs text-gray-600 mb-0.5">Sumă investită</div>
            <div className="text-2xl font-bold text-red-600">
              -{formatSuma(investitie.suma_lei)} lei
            </div>
          </div>
        </div>

        {/* Furnizor */}
        {investitie.furnizor && (
          <div className="text-sm mb-2">
            <span className="text-gray-600">Furnizor:</span>{' '}
            <span className="font-medium text-gray-900">{investitie.furnizor}</span>
          </div>
        )}

        {/* Descriere */}
        {investitie.descriere && (
          <div className="text-sm text-gray-600 border-t pt-2 mt-2">
            {investitie.descriere}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
