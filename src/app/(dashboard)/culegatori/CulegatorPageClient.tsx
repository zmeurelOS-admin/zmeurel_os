// src/app/(dashboard)/culegatori/CulegatorPageClient.tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Plus, Users, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { CulegatorCard } from '@/components/culegatori/CulegatorCard';
import { AddCulegatorDialog } from '@/components/culegatori/AddCulegatorDialog';
import { EditCulegatorDialog } from '@/components/culegatori/EditCulegatorDialog';
import { DeleteConfirmDialog } from '@/components/parcele/DeleteConfirmDialog';
import {
  getCulegatori,
  createCulegator,
  updateCulegator,
  deleteCulegator,
  type Culegator,
} from '@/lib/supabase/queries/culegatori';

interface CulegatorPageClientProps {
  initialCulegatori: Culegator[];
  tenantId: string;
}

export function CulegatorPageClient({
  initialCulegatori,
  tenantId,
}: CulegatorPageClientProps) {
  const queryClient = useQueryClient();

  // ========================================
  // STATE
  // ========================================
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingCulegator, setEditingCulegator] = useState<Culegator | null>(null);
  const [deletingCulegator, setDeletingCulegator] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ========================================
  // REACT QUERY
  // ========================================

  // Fetch culegători
  const { data: culegatori = initialCulegatori, isLoading } = useQuery({
    queryKey: ['culegatori', tenantId],
    queryFn: () => getCulegatori(tenantId),
    initialData: initialCulegatori,
  });

  // Create culegător
  const createMutation = useMutation({
    mutationFn: (data: any) =>
      createCulegator({
        tenant_id: tenantId,
        nume_prenume: data.nume_prenume,
        telefon: data.telefon || null,
        tip_angajare: data.tip_angajare,
        tarif_lei_kg: Number(data.tarif_lei_kg),
        data_angajare: data.data_angajare || null,
        status_activ: data.status_activ,
      }),
    onSuccess: (newCulegator) => {
      queryClient.invalidateQueries({ queryKey: ['culegatori', tenantId] });
      toast.success(`Culegător "${newCulegator.nume_prenume}" adăugat cu succes!`);
      setAddDialogOpen(false);
    },
    onError: (error: any) => {
      console.error('Error creating culegator:', error);
      toast.error(`Eroare la adăugare: ${error.message}`);
    },
  });

  // Update culegător
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      updateCulegator(id, {
        nume_prenume: data.nume_prenume,
        telefon: data.telefon || null,
        tip_angajare: data.tip_angajare,
        tarif_lei_kg: Number(data.tarif_lei_kg),
        data_angajare: data.data_angajare || null,
        status_activ: data.status_activ,
      }),
    onSuccess: (updatedCulegator) => {
      queryClient.invalidateQueries({ queryKey: ['culegatori', tenantId] });
      toast.success(`Culegător "${updatedCulegator.nume_prenume}" actualizat!`);
      setEditingCulegator(null);
    },
    onError: (error: any) => {
      console.error('Error updating culegator:', error);
      toast.error(`Eroare la actualizare: ${error.message}`);
    },
  });

  // Delete culegător
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCulegator(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['culegatori', tenantId] });
      toast.success('Culegător șters cu succes!');
      setDeletingCulegator(null);
    },
    onError: (error: any) => {
      console.error('Error deleting culegator:', error);
      toast.error(`Eroare la ștergere: ${error.message}`);
    },
  });

  // ========================================
  // HANDLERS
  // ========================================

  const handleAdd = async (data: any) => {
    await createMutation.mutateAsync(data);
  };

  const handleEdit = async (id: string, data: any) => {
    await updateMutation.mutateAsync({ id, data });
  };

  const handleDelete = (id: string, name: string) => {
    setDeletingCulegator({ id, name });
  };

  const handleConfirmDelete = () => {
    if (deletingCulegator) {
      deleteMutation.mutate(deletingCulegator.id);
    }
  };

  // ========================================
  // SEARCH/FILTER
  // ========================================

  const filteredCulegatori = culegatori.filter((culegator) => {
    const query = searchQuery.toLowerCase();
    return (
      culegator.nume_prenume.toLowerCase().includes(query) ||
      culegator.id_culegator.toLowerCase().includes(query) ||
      culegator.telefon?.toLowerCase().includes(query) ||
      culegator.tip_angajare.toLowerCase().includes(query)
    );
  });

  // Separate active vs inactive
  const activeCulegatori = filteredCulegatori.filter((c) => c.status_activ);
  const inactiveCulegatori = filteredCulegatori.filter((c) => !c.status_activ);

  // ========================================
  // RENDER
  // ========================================

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="w-8 h-8 text-primary" />
            Culegători
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestionează echipa ta de culegători
          </p>
        </div>
        <Button
          onClick={() => setAddDialogOpen(true)}
          size="lg"
          style={{ backgroundColor: '#F16B6B', color: 'white' }}
        >
          <Plus className="w-5 h-5 mr-2" />
          Adaugă Culegător
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <p className="text-sm text-muted-foreground">Total Culegători</p>
          <p className="text-2xl font-bold">{culegatori.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <p className="text-sm text-muted-foreground">Activi</p>
          <p className="text-2xl font-bold text-green-600">{activeCulegatori.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <p className="text-sm text-muted-foreground">Inactivi</p>
          <p className="text-2xl font-bold text-gray-600">{inactiveCulegatori.length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Caută după nume, telefon, ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          style={{ backgroundColor: 'white' }}
        />
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Se încarcă culegătorii...</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && culegatori.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border">
          <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Niciun culegător adăugat</h3>
          <p className="text-muted-foreground mb-6">
            Adaugă primul culegător pentru a începe
          </p>
          <Button
            onClick={() => setAddDialogOpen(true)}
            style={{ backgroundColor: '#F16B6B', color: 'white' }}
          >
            <Plus className="w-5 h-5 mr-2" />
            Adaugă Primul Culegător
          </Button>
        </div>
      )}

      {/* Culegători Activi */}
      {!isLoading && activeCulegatori.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            Culegători Activi ({activeCulegatori.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeCulegatori.map((culegator) => (
              <CulegatorCard
                key={culegator.id}
                culegator={culegator}
                onEdit={setEditingCulegator}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Culegători Inactivi */}
      {!isLoading && inactiveCulegatori.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
            Culegători Inactivi ({inactiveCulegatori.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inactiveCulegatori.map((culegator) => (
              <CulegatorCard
                key={culegator.id}
                culegator={culegator}
                onEdit={setEditingCulegator}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* No search results */}
      {!isLoading &&
        culegatori.length > 0 &&
        filteredCulegatori.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border">
            <Search className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Niciun rezultat găsit
            </h3>
            <p className="text-muted-foreground">
              Încearcă un alt termen de căutare
            </p>
          </div>
        )}

      {/* Dialogs */}
      <AddCulegatorDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={handleAdd}
      />

      <EditCulegatorDialog
        culegator={editingCulegator}
        open={!!editingCulegator}
        onOpenChange={(open) => !open && setEditingCulegator(null)}
        onSubmit={handleEdit}
      />

      <DeleteConfirmDialog
        open={!!deletingCulegator}
        onOpenChange={(open) => !open && setDeletingCulegator(null)}
        onConfirm={handleConfirmDelete}
        itemName={deletingCulegator?.name || ''}
        itemType="culegător"
      />
    </div>
  );
}
