// src/components/culegatori/CulegatorCard.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, User, Phone, Briefcase, Coins, Calendar } from 'lucide-react';
import type { Culegator } from '@/lib/supabase/queries/culegatori';

interface CulegatorCardProps {
  culegator: Culegator;
  onEdit: (culegator: Culegator) => void;
  onDelete: (id: string, name: string) => void;
}

export function CulegatorCard({ culegator, onEdit, onDelete }: CulegatorCardProps) {
  // Format data angajare dacă există
  const dataAngajareFormatted = culegator.data_angajare
    ? new Date(culegator.data_angajare).toLocaleDateString('ro-RO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : 'N/A';

  // Determine badge color pentru tip angajare
  const getTipAngajareColor = (tip: string) => {
    switch (tip) {
      case 'Permanent':
        return 'bg-green-100 text-green-800';
      case 'Sezonier':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">
                {culegator.nume_prenume}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                ID: {culegator.id_culegator}
              </p>
            </div>
          </div>
          
          {/* Status badge */}
          <Badge
            variant={culegator.status_activ ? 'default' : 'secondary'}
            style={{
              backgroundColor: culegator.status_activ ? '#10b981' : '#6b7280',
              color: 'white',
            }}
          >
            {culegator.status_activ ? 'Activ' : 'Inactiv'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Telefon */}
        {culegator.telefon && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <span>{culegator.telefon}</span>
          </div>
        )}

        {/* Tip angajare */}
        <div className="flex items-center gap-2 text-sm">
          <Briefcase className="w-4 h-4 text-muted-foreground" />
          <Badge className={getTipAngajareColor(culegator.tip_angajare)}>
            {culegator.tip_angajare}
          </Badge>
        </div>

        {/* Tarif */}
        <div className="flex items-center gap-2 text-sm">
          <Coins className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold">
            {culegator.tarif_lei_kg === 0 ? (
              <span className="text-muted-foreground">Salarizat fix</span>
            ) : (
              <span>{culegator.tarif_lei_kg} lei/kg</span>
            )}
          </span>
        </div>

        {/* Data angajare */}
        {culegator.data_angajare && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span>Angajat: {dataAngajareFormatted}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-3 border-t">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onEdit(culegator)}
          >
            <Pencil className="w-4 h-4 mr-2" />
            Editează
          </Button>
          <Button
            variant="outline"
            size="sm"
            style={{ color: '#ef4444', borderColor: '#ef4444' }}
            onClick={() => onDelete(culegator.id, culegator.nume_prenume)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
