// src/components/cheltuieli/CheltuialaCard.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Calendar, Coins, ShoppingCart, FileText, Tag } from 'lucide-react';
import type { Cheltuiala } from '@/lib/supabase/queries/cheltuieli';

interface CheltuialaCardProps {
  cheltuiala: Cheltuiala;
  onEdit: (cheltuiala: Cheltuiala) => void;
  onDelete: (id: string, name: string) => void;
}

export function CheltuialaCard({ cheltuiala, onEdit, onDelete }: CheltuialaCardProps) {
  // Format data
  const dataFormatted = new Date(cheltuiala.data).toLocaleDateString('ro-RO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  // Determine badge color pentru categorie
  const getCategorieColor = (categorie: string) => {
    const colorMap: Record<string, string> = {
      'Electricitate': 'bg-yellow-100 text-yellow-800',
      'Motorină Transport': 'bg-red-100 text-red-800',
      'Ambalaje': 'bg-blue-100 text-blue-800',
      'Fertilizare': 'bg-green-100 text-green-800',
      'Pesticide': 'bg-orange-100 text-orange-800',
      'Cules': 'bg-purple-100 text-purple-800',
      'Material Săditor': 'bg-pink-100 text-pink-800',
    };
    return colorMap[categorie] || 'bg-gray-100 text-gray-800';
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-lg font-semibold">
                {cheltuiala.suma_lei} lei
              </CardTitle>
              <Badge className={getCategorieColor(cheltuiala.categorie)}>
                {cheltuiala.categorie}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              ID: {cheltuiala.id_cheltuiala}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Data */}
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span>{dataFormatted}</span>
        </div>

        {/* Furnizor */}
        {cheltuiala.furnizor && (
          <div className="flex items-center gap-2 text-sm">
            <ShoppingCart className="w-4 h-4 text-muted-foreground" />
            <span>{cheltuiala.furnizor}</span>
          </div>
        )}

        {/* Descriere */}
        {cheltuiala.descriere && (
          <div className="flex items-start gap-2 text-sm">
            <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
            <span className="text-muted-foreground text-xs line-clamp-2">
              {cheltuiala.descriere}
            </span>
          </div>
        )}

        {/* Sumă highlight */}
        <div className="flex items-center gap-2 text-sm pt-2 border-t">
          <Coins className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-lg" style={{ color: '#ef4444' }}>
            -{cheltuiala.suma_lei} lei
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-3 border-t">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onEdit(cheltuiala)}
          >
            <Pencil className="w-4 h-4 mr-2" />
            Editează
          </Button>
          <Button
            variant="outline"
            size="sm"
            style={{ color: '#ef4444', borderColor: '#ef4444' }}
            onClick={() => onDelete(cheltuiala.id, `${cheltuiala.categorie} - ${cheltuiala.suma_lei} lei`)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
