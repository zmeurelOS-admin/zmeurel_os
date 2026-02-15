// src/app/(dashboard)/investitii/InvestitiiPageClient.tsx
'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, DollarSign, TrendingDown, Calculator } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Investitie, getInvestitii, deleteInvestitie } from '@/lib/supabase/queries/investitii';
import { InvestitieCard } from '@/components/investitii/InvestitieCard';
import { AddInvestitieDialog } from '@/components/investitii/AddInvestitieDialog';
import { EditInvestitieDialog } from '@/components/investitii/EditInvestitieDialog';
import { DeleteConfirmDialog } from '@/components/parcele/DeleteConfirmDialog';

interface Parcela {
  id: string;
  id_parcela: string;
  nume_parcela: string;
}

interface InvestitiiPageClientProps {
  initialInvestitii: Investitie[];
  parcele: Parcela[];
  tenantId: string;
}

export function InvestitiiPageClient({
  initialInvestitii,
  parcele,
  tenantId,
}: InvestitiiPageClientProps) {
  const queryClient = useQueryClient();

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [editingInvestitie, setEditingInvestitie] = useState<Investitie | null>(null);
  const [deletingInvestitie, setDeletingInvestitie] = useState<Investitie | null>(null);

  // Fetch investiții
  const { data: investitii = initialInvestitii } = useQuery({
    queryKey: ['investitii', tenantId],
    queryFn: () => getInvestitii(tenantId),
    initialData: initialInvestitii,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteInvestitie,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investitii'] });
      toast.success('Investiție ștearsă cu succes!');
      setDeletingInvestitie(null);
    },
    onError: (error) => {
      console.error('Error deleting investitie:', error);
      toast.error('Eroare la ștergerea investiției');
    },
  });

  // Mapping: ID parcelă → Nume parcelă
  const parcelaMap = useMemo(() => {
    const map: Record<string, string> = {};
    parcele.forEach((p) => {
      map[p.id] = `${p.id_parcela} - ${p.nume_parcela}`;
    });
    return map;
  }, [parcele]);

  // Luni disponibile (unice din investiții)
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    investitii.forEach((inv) => {
      const date = new Date(inv.data);
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1)
        .toString()
        .padStart(2, '0')}`;
      months.add(monthKey);
    });
    return Array.from(months).sort().reverse(); // Cele mai recente primero
  }, [investitii]);

  // Format month pentru display: "Februarie 2026"
  const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('ro-RO', { year: 'numeric', month: 'long' });
  };

  // Filtered investiții (search + month filter)
  const filteredInvestitii = useMemo(() => {
    let filtered = investitii;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (inv) =>
          inv.id_investitie.toLowerCase().includes(term) ||
          inv.categorie.toLowerCase().includes(term) ||
          inv.furnizor?.toLowerCase().includes(term) ||
          inv.descriere?.toLowerCase().includes(term)
      );
    }

    // Month filter
    if (selectedMonth !== 'all') {
      filtered = filtered.filter((inv) => {
        const date = new Date(inv.data);
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1)
          .toString()
          .padStart(2, '0')}`;
        return monthKey === selectedMonth;
      });
    }

    return filtered;
  }, [investitii, searchTerm, selectedMonth]);

  // Stats calculations
  const stats = useMemo(() => {
    const total = filteredInvestitii.length;
    const sumaTotala = filteredInvestitii.reduce((sum, inv) => sum + inv.suma_lei, 0);
    const medie = total > 0 ? sumaTotala / total : 0;

    return { total, sumaTotala, medie };
  }, [filteredInvestitii]);

  // Format sumă
  const formatSuma = (suma: number) => {
    return new Intl.NumberFormat('ro-RO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(suma);
  };

  // Handlers
  const handleEdit = (investitie: Investitie) => {
    setEditingInvestitie(investitie);
  };

  const handleDelete = (investitie: Investitie) => {
    setDeletingInvestitie(investitie);
  };

  const confirmDelete = () => {
    if (deletingInvestitie) {
      deleteMutation.mutate(deletingInvestitie.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Investiții (CAPEX)</h1>
          <p className="text-gray-600 mt-1">
            Gestionează investițiile în plantație
          </p>
        </div>
        <AddInvestitieDialog tenantId={tenantId} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Investiții */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Investiții</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {stats.total}
                </p>
              </div>
              <div 
                className="h-12 w-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: '#dbeafe' }}
              >
                <DollarSign className="h-6 w-6" style={{ color: '#2563eb' }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sumă Totală */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Sumă Totală Investită</p>
                <p className="text-3xl font-bold mt-1" style={{ color: '#dc2626' }}>
                  -{formatSuma(stats.sumaTotala)} lei
                </p>
              </div>
              <div 
                className="h-12 w-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: '#fee2e2' }}
              >
                <TrendingDown className="h-6 w-6" style={{ color: '#dc2626' }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Medie per Investiție */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Medie per Investiție</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {formatSuma(stats.medie)} lei
                </p>
              </div>
              <div 
                className="h-12 w-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: '#f3e8ff' }}
              >
                <Calculator className="h-6 w-6" style={{ color: '#9333ea' }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div>
              <Label htmlFor="search">Căutare</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  type="text"
                  placeholder="Caută după ID, categorie, furnizor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Month Filter */}
            <div>
              <Label htmlFor="month">Filtrare pe lună</Label>
              <select
                id="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="flex h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                style={{ backgroundColor: 'white' }}
              >
                <option value="all">Toate lunile</option>
                {availableMonths.map((month) => (
                  <option key={month} value={month}>
                    {formatMonth(month)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista Investiții */}
      {filteredInvestitii.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nicio investiție găsită
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || selectedMonth !== 'all'
                ? 'Încearcă să schimbi filtrele de căutare'
                : 'Adaugă prima investiție pentru a începe tracking-ul CAPEX'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInvestitii.map((investitie) => (
            <InvestitieCard
              key={investitie.id}
              investitie={investitie}
              parcelaNume={
                investitie.parcela_id ? parcelaMap[investitie.parcela_id] : undefined
              }
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <EditInvestitieDialog
        investitie={editingInvestitie}
        tenantId={tenantId}
        open={!!editingInvestitie}
        onOpenChange={(open) => !open && setEditingInvestitie(null)}
      />

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        open={!!deletingInvestitie}
        onOpenChange={(open) => !open && setDeletingInvestitie(null)}
        onConfirm={confirmDelete}
        itemName={deletingInvestitie?.id_investitie || ''}
        itemType="investiție"
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
