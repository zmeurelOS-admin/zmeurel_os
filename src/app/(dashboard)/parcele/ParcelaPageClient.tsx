'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

import { getParcele, deleteParcela } from '@/lib/supabase/queries/parcele';
import { Input } from '@/components/ui/input';
import { ParcelaCard } from '@/components/parcele/ParcelaCard';
import { AddParcelaDialog } from '@/components/parcele/AddParcelaDialog';
import { EditParcelaDialog } from '@/components/parcele/EditParcelaDialog';
import { DeleteConfirmDialog } from '@/components/parcele/DeleteConfirmDialog';

interface Parcela {
  id: string;
  tenant_id: string;
  id_parcela: string;
  nume_parcela: string;
  suprafata_m2: number;
  soi_plantat: string | null;
  an_plantare: number;
  nr_plante: number | null;
  status: string;
  gps_lat: number | null;
  gps_lng: number | null;
  observatii: string | null;
  created_at: string;
  updated_at: string;
}

interface ParcelaPageClientProps {
  tenantId: string;
  initialParcele: Parcela[];
  soiuriDisponibile: string[];
}

export default function ParcelaPageClient({
  tenantId,
  initialParcele,
  soiuriDisponibile,
}: ParcelaPageClientProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingParcela, setEditingParcela] = useState<Parcela | null>(null);
  const [deletingParcela, setDeletingParcela] = useState<{ id: string; name: string } | null>(null);

  // Query pentru parcele
  const { data: parcele = initialParcele, isLoading } = useQuery({
    queryKey: ['parcele', tenantId],
    queryFn: () => getParcele(tenantId),
    initialData: initialParcele,
  });

  // Mutation pentru ștergere
  const deleteMutation = useMutation({
    mutationFn: (parcelaId: string) => deleteParcela(parcelaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parcele', tenantId] });
      toast.success('Parcela a fost ștearsă cu succes!');
      setDeletingParcela(null);
    },
    onError: (error: Error) => {
      toast.error(`Eroare la ștergere: ${error.message}`);
    },
  });

  // Handler pentru deschidere dialog ștergere
  const handleDeleteClick = (parcela: Parcela) => {
    setDeletingParcela({
      id: parcela.id,
      name: parcela.nume_parcela,
    });
  };

  // Handler pentru confirmare ștergere
  const handleConfirmDelete = () => {
    if (deletingParcela) {
      deleteMutation.mutate(deletingParcela.id);
    }
  };

  // Handler pentru success la adăugare
  const handleAddSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['parcele', tenantId] });
  };

  // Handler pentru success la editare
  const handleEditSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['parcele', tenantId] });
    setEditingParcela(null);
  };

  // Filtrare parcele după search
  const filteredParcele = parcele.filter((parcela) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      parcela.id_parcela.toLowerCase().includes(searchLower) ||
      parcela.nume_parcela.toLowerCase().includes(searchLower) ||
      (parcela.soi_plantat && parcela.soi_plantat.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">🌱 Parcele</h1>
            <p className="text-gray-600 mt-1">
              {parcele.length} {parcele.length === 1 ? 'parcelă' : 'parcele'}
            </p>
          </div>

          <AddParcelaDialog
            tenantId={tenantId}
            soiuriDisponibile={soiuriDisponibile}
            onSuccess={handleAddSuccess}
          />
        </div>

        {/* Search */}
        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <Input
            type="text"
            placeholder="Caută după ID, nume sau soi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredParcele.length === 0 && !searchTerm && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500 text-lg mb-4">Nicio parcelă adăugată încă</p>
            <p className="text-gray-400 text-sm">
              Începe prin a adăuga prima ta parcelă folosind butonul de mai sus
            </p>
          </div>
        )}

        {/* No Search Results */}
        {!isLoading && filteredParcele.length === 0 && searchTerm && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500 text-lg mb-2">
              Niciun rezultat pentru &quot;{searchTerm}&quot;
            </p>
            <p className="text-gray-400 text-sm">
              Încearcă să cauți după alt termen
            </p>
          </div>
        )}

        {/* Parcele Grid */}
        {!isLoading && filteredParcele.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredParcele.map((parcela) => (
              <ParcelaCard
                key={parcela.id}
                parcela={parcela}
                onEdit={() => setEditingParcela(parcela)}
                onDelete={() => handleDeleteClick(parcela)}
              />
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        {editingParcela && (
          <EditParcelaDialog
            parcela={editingParcela}
            soiuriDisponibile={soiuriDisponibile}
            open={!!editingParcela}
            onOpenChange={(open) => !open && setEditingParcela(null)}
            onSuccess={handleEditSuccess}
          />
        )}

        {/* Delete Confirm Dialog */}
        <DeleteConfirmDialog
          open={!!deletingParcela}
          onOpenChange={(open) => !open && setDeletingParcela(null)}
          onConfirm={handleConfirmDelete}
          parcelaName={deletingParcela?.name || ''}
        />
      </div>
    </div>
  );
}
