// src/components/activitati-agricole/ActivitateAgricolaCard.tsx
'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Calendar, Package, AlertCircle, CheckCircle } from 'lucide-react';
import { ActivitateAgricola, calculatePauseStatus } from '@/lib/supabase/queries/activitati-agricole';

interface ActivitateAgricolaCardProps {
  activitate: ActivitateAgricola;
  parcelaNume?: string;
  onEdit: (activitate: ActivitateAgricola) => void;
  onDelete: (activitate: ActivitateAgricola) => void;
}

export function ActivitateAgricolaCard({
  activitate,
  parcelaNume,
  onEdit,
  onDelete,
}: ActivitateAgricolaCardProps) {
  // Format date pentru display: DD.MM.YYYY
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Calcul status pauză
  const { dataRecoltarePermisa, status } = calculatePauseStatus(
    activitate.data_aplicare,
    activitate.timp_pauza_zile
  );

  // Culori badge tip activitate
  const getBadgeColor = (tip: string) => {
    if (tip.includes('Fungicid')) return 'bg-purple-100 text-purple-800';
    if (tip.includes('Insecticid')) return 'bg-red-100 text-red-800';
    if (tip.includes('Erbicid')) return 'bg-orange-100 text-orange-800';
    if (tip.includes('Fertilizare')) return 'bg-green-100 text-green-800';
    if (tip.includes('Irigare')) return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* ID activitate + Tip */}
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold text-lg text-gray-900">
                {activitate.id_activitate}
              </span>
              <span className={`px-2 py-1 rounded-md text-xs font-medium ${getBadgeColor(activitate.tip_activitate || '')}`}>
                {activitate.tip_activitate || 'Altele'}
              </span>
            </div>

            {/* Data aplicare */}
            <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-1">
              <Calendar className="h-4 w-4" />
              <span>Aplicat: {formatDate(activitate.data_aplicare)}</span>
            </div>

            {/* Parcelă (dacă există) */}
            {activitate.parcela_id && parcelaNume && (
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
              onClick={() => onEdit(activitate)}
              className="h-8 w-8"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(activitate)}
              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Produs și Doză */}
        {activitate.produs_utilizat && (
          <div className="text-sm mb-2">
            <span className="text-gray-600">Produs:</span>{' '}
            <span className="font-medium text-gray-900">{activitate.produs_utilizat}</span>
            {activitate.doza && ` (${activitate.doza})`}
          </div>
        )}

        {/* Operator */}
        {activitate.operator && (
          <div className="text-sm mb-3 text-gray-600">
            Operator: {activitate.operator}
          </div>
        )}

        {/* Status Pauză (CRITICAL pentru legislație) */}
        {activitate.timp_pauza_zile > 0 && (
          <div className={`p-3 rounded-lg border mb-3 ${
            status === 'OK' 
              ? 'bg-green-50 border-green-200' 
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {status === 'OK' ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              )}
              <div className="flex-1">
                <div className={`text-sm font-medium ${
                  status === 'OK' ? 'text-green-800' : 'text-yellow-800'
                }`}>
                  Status: {status}
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-600">
              <div>Timp pauză: {activitate.timp_pauza_zile} zile</div>
              <div>Recoltare permisă de la: {formatDate(dataRecoltarePermisa)}</div>
            </div>
          </div>
        )}

        {/* Observații */}
        {activitate.observatii && (
          <div className="text-sm text-gray-600 border-t pt-2 mt-2">
            {activitate.observatii}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
