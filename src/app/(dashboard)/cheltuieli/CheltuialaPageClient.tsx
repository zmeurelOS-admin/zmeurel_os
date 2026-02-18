// src/app/(dashboard)/cheltuieli/CheltuialaPageClient.tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Plus, Wallet, Search, TrendingDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { CheltuialaCard } from '@/components/cheltuieli/CheltuialaCard';
import { AddCheltuialaDialog } from '@/components/cheltuieli/AddCheltuialaDialog';
import { EditCheltuialaDialog } from '@/components/cheltuieli/EditCheltuialaDialog';
import { DeleteConfirmDialog } from '@/components/parcele/DeleteConfirmDialog';
import {
  getCheltuieli,
  createCheltuiala,
  updateCheltuiala,
  deleteCheltuiala,
  type Cheltuiala,
} from '@/lib/supabase/queries/cheltuieli';

interface CheltuialaPageClientProps {
  initialCheltuieli: Cheltuiala[];
  tenantId: string;
}

export function CheltuialaPageClient({
  initialCheltuieli,
  tenantId,
}: CheltuialaPageClientProps) {
  const queryClient = useQueryClient();

  // ========================================
  // STATE
  // ========================================
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingCheltuiala, setEditingCheltuiala] = useState<Cheltuiala | null>(null);
  const [deletingCheltuiala, setDeletingCheltuiala] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all'); // 'all' sau 'YYYY-MM'

  // ========================================
  // REACT QUERY
  // ========================================

  // Fetch cheltuieli
  const { data: cheltuieli = initialCheltuieli, isLoading } = useQuery({
    queryKey: ['cheltuieli', tenantId],
    queryFn: () => getCheltuieli(tenantId),
    initialData: initialCheltuieli,
  });

  // Create cheltuială
  const createMutation = useMutation({
    mutationFn: (data: any) =>
      createCheltuiala({
        tenant_id: tenantId,
        data: data.data,
        categorie: data.categorie,
        suma_lei: Number(data.suma_lei),
        furnizor: data.furnizor || null,
        descriere: data.descriere || null,
        document_url: undefined, // Pentru mai târziu
      }),
    onSuccess: (newCheltuiala) => {
      queryClient.invalidateQueries({ queryKey: ['cheltuieli', tenantId] });
      toast.success(`Cheltuială de ${newCheltuiala.suma_lei} lei adăugată!`);
      setAddDialogOpen(false);
    },
    onError: (error: any) => {
      console.error('Error creating cheltuiala:', error);
      toast.error(`Eroare la adăugare: ${error.message}`);
    },
  });

  // Update cheltuială
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      updateCheltuiala(id, {
        data: data.data,
        categorie: data.categorie,
        suma_lei: Number(data.suma_lei),
        furnizor: data.furnizor || null,
        descriere: data.descriere || null,
      }),
    onSuccess: (updatedCheltuiala) => {
      queryClient.invalidateQueries({ queryKey: ['cheltuieli', tenantId] });
      toast.success(`Cheltuială ${updatedCheltuiala.id_cheltuiala} actualizată!`);
      setEditingCheltuiala(null);
    },
    onError: (error: any) => {
      console.error('Error updating cheltuiala:', error);
      toast.error(`Eroare la actualizare: ${error.message}`);
    },
  });

  // Delete cheltuială
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCheltuiala(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cheltuieli', tenantId] });
      toast.success('Cheltuială ștearsă cu succes!');
      setDeletingCheltuiala(null);
    },
    onError: (error: any) => {
      console.error('Error deleting cheltuiala:', error);
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
    setDeletingCheltuiala({ id, name });
  };

  const handleConfirmDelete = () => {
    if (deletingCheltuiala) {
      deleteMutation.mutate(deletingCheltuiala.id);
    }
  };

  // ========================================
  // FILTERING & STATS
  // ========================================

  // Filter by search
  let filteredCheltuieli = cheltuieli.filter((cheltuiala) => {
    const query = searchQuery.toLowerCase();
    return (
      cheltuiala.categorie?.toLowerCase().includes(query) ||
      cheltuiala.id_cheltuiala.toLowerCase().includes(query) ||
      cheltuiala.furnizor?.toLowerCase().includes(query) ||
      cheltuiala.descriere?.toLowerCase().includes(query)
    );
  });

  // Filter by month
  if (selectedMonth !== 'all') {
    filteredCheltuieli = filteredCheltuieli.filter((cheltuiala) => {
      const cheltuialaMonth = cheltuiala.data.substring(0, 7); // "YYYY-MM"
      return cheltuialaMonth === selectedMonth;
    });
  }

  // Calculate stats
  const totalCheltuieli = filteredCheltuieli.reduce(
    (sum, c) => sum + c.suma_lei,
    0
  );

  // Get unique months pentru dropdown
  const uniqueMonths = Array.from(
    new Set(cheltuieli.map((c) => c.data.substring(0, 7)))
  ).sort((a, b) => b.localeCompare(a)); // Descending

  // ========================================
  // RENDER
  // ========================================

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Wallet className="w-8 h-8 text-primary" />
            Cheltuieli Diverse
          </h1>
          <p className="text-muted-foreground mt-1">
            Tracking cheltuieli operaționale (OPEX)
          </p>
        </div>
        <Button
          onClick={() => setAddDialogOpen(true)}
          size="lg"
          style={{ backgroundColor: '#F16B6B', color: 'white' }}
        >
          <Plus className="w-5 h-5 mr-2" />
          Adaugă Cheltuială
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <p className="text-sm text-muted-foreground">Total Cheltuieli</p>
          <p className="text-2xl font-bold">{cheltuieli.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <p className="text-sm text-muted-foreground">Sumă Totală</p>
          <p className="text-2xl font-bold text-red-600">
            {totalCheltuieli.toFixed(2)} lei
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <p className="text-sm text-muted-foreground">Medie / Cheltuială</p>
          <p className="text-2xl font-bold text-gray-600">
            {cheltuieli.length > 0
              ? (totalCheltuieli / filteredCheltuieli.length).toFixed(2)
              : '0.00'}{' '}
            lei
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Caută după categorie, furnizor, descriere..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            style={{ backgroundColor: 'white' }}
          />
        </div>

        {/* Month filter */}
        <div>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full rounded-md border border-input px-3 py-2 text-sm"
            style={{ backgroundColor: 'white', color: 'black' }}
          >
            <option value="all">Toate lunile</option>
            {uniqueMonths.map((month) => (
              <option key={month} value={month}>
                {new Date(month + '-01').toLocaleDateString('ro-RO', {
                  month: 'long',
                  year: 'numeric',
                })}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Se încarcă cheltuielile...</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && cheltuieli.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border">
          <TrendingDown className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            Nicio cheltuială adăugată
          </h3>
          <p className="text-muted-foreground mb-6">
            Adaugă prima cheltuială pentru a începe tracking-ul
          </p>
          <Button
            onClick={() => setAddDialogOpen(true)}
            style={{ backgroundColor: '#F16B6B', color: 'white' }}
          >
            <Plus className="w-5 h-5 mr-2" />
            Adaugă Prima Cheltuială
          </Button>
        </div>
      )}

      {/* Cheltuieli list */}
      {!isLoading && filteredCheltuieli.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCheltuieli.map((cheltuiala) => (
            <CheltuialaCard
              key={cheltuiala.id}
              cheltuiala={cheltuiala}
              onEdit={setEditingCheltuiala}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* No search results */}
      {!isLoading &&
        cheltuieli.length > 0 &&
        filteredCheltuieli.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border">
            <Search className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Niciun rezultat găsit
            </h3>
            <p className="text-muted-foreground">
              Încearcă un alt termen de căutare sau altă lună
            </p>
          </div>
        )}

      {/* Dialogs */}
      <AddCheltuialaDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={handleAdd}
      />

      <EditCheltuialaDialog
        cheltuiala={editingCheltuiala}
        open={!!editingCheltuiala}
        onOpenChange={(open) => !open && setEditingCheltuiala(null)}
        onSubmit={handleEdit}
      />

      <DeleteConfirmDialog
        open={!!deletingCheltuiala}
        onOpenChange={(open) => !open && setDeletingCheltuiala(null)}
        onConfirm={handleConfirmDelete}
        itemName={deletingCheltuiala?.name || ''}
        itemType="cheltuială"
      />
    </div>
  );
}
