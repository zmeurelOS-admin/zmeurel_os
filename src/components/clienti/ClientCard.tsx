// src/components/clienti/ClientCard.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, User, Phone, Mail, MapPin, Coins, FileText } from 'lucide-react';
import type { Client } from '@/lib/supabase/queries/clienti';

interface ClientCardProps {
  client: Client;
  onEdit: (client: Client) => void;
  onDelete: (id: string, name: string) => void;
}

export function ClientCard({ client, onEdit, onDelete }: ClientCardProps) {
  const hasPretNegociat = client.pret_negociat_lei_kg !== null && client.pret_negociat_lei_kg > 0;

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
                {client.nume_client}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                ID: {client.id_client}
              </p>
            </div>
          </div>
          
          {/* Preț negociat badge */}
          {hasPretNegociat && (
            <Badge
              style={{
                backgroundColor: '#10b981',
                color: 'white',
              }}
            >
              Preț special
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Telefon */}
        {client.telefon && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <a 
              href={`tel:${client.telefon}`}
              className="hover:text-primary"
            >
              {client.telefon}
            </a>
          </div>
        )}

        {/* Email */}
        {client.email && (
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <a 
              href={`mailto:${client.email}`}
              className="hover:text-primary truncate"
            >
              {client.email}
            </a>
          </div>
        )}

        {/* Adresă */}
        {client.adresa && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
            <span className="text-muted-foreground">{client.adresa}</span>
          </div>
        )}

        {/* Preț negociat */}
        {hasPretNegociat && (
          <div className="flex items-center gap-2 text-sm">
            <Coins className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-green-600">
              {client.pret_negociat_lei_kg} lei/kg
            </span>
            <span className="text-xs text-muted-foreground">(preț special)</span>
          </div>
        )}

        {/* Observații */}
        {client.observatii && (
          <div className="flex items-start gap-2 text-sm">
            <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
            <span className="text-muted-foreground text-xs">
              {client.observatii}
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-3 border-t">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onEdit(client)}
          >
            <Pencil className="w-4 h-4 mr-2" />
            Editează
          </Button>
          <Button
            variant="outline"
            size="sm"
            style={{ color: '#ef4444', borderColor: '#ef4444' }}
            onClick={() => onDelete(client.id, client.nume_client)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
