// src/app/(dashboard)/recoltari/RecoltariPageClient.tsx
'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Package, TrendingDown, Calculator } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  Recoltare,
  getRecoltari,
  deleteRecoltare,
} from '@/lib/supabase/queries/recoltari';
import { RecoltareCard } from '@/components/recoltari/RecoltareCard';
import { AddRecoltareDialog } from '@/components/recoltari/AddRecoltareDialog';
import { EditRecoltareDialog } from '@/components/recoltari/EditRecoltareDialog';
import { DeleteConfirmDialog } from '@/components/parcele/DeleteConfirmDialog';

interface Culegator {
  id: string;
  id_culegator: string;
  nume_prenume: string;
  tarif_lei_kg: number;
}

interface Parcela {
  id: string;
  id_parcela: string;
  nume_parcela: string;
}

interface RecoltariPageClientProps {
  initialRecoltari: Recoltare[];
  culegatori: Culegator[];
  parcele: Parcela[];
  tenantId: string;
}

export function RecoltariPageClient({
  initialRecoltari,
  culegatori,
  parcele,
  tenantId,
}: RecoltariPageClientProps) {
  const queryClient = useQueryClient();

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [editingRecoltare, setEditingRecoltare] = useState<Recoltare | null>(null);
  const [deletingRecoltare, setDeletingRecoltare] = useState<Recoltare | null>(null);

  // Fetch recoltări
  const { data: recoltari = initialRecoltari } = useQuery({
    queryKey: ['recoltari', tenantId],
    queryFn: () => getRecoltari(tenantId),
    initialData: initialRecoltari,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteRecoltare,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recoltari'] });
      toast.success('Recoltare ștearsă cu succes!');
      setDeletingRecoltare(null);
    },
    onError: (error) => {
      console.error('Error deleting recoltare:', error);
      toast.error('Eroare la ștergerea recoltării');
    },
  });

  // Mapping: ID culegător → Nume + Tarif
  const culegatorMap = useMemo(() => {
    const map: Record<string, { nume: string; tarif: number }> = {};
    culegatori.forEach((c) => {
      map[c.id] = {
        nume: `${c.id_culegator} - ${c.nume_prenume}`,
        tarif: c.tarif_lei_kg,
      };
    });
    return map;
  }, [culegatori]);

  // Mapping: ID parcelă → Nume parcelă
  const parcelaMap = useMemo(() => {
    const map: Record<string, string> = {};
    parcele.forEach((p) => {
      map[p.id] = `${p.id_parcela} - ${p.nume_parcela}`;
    });
    return map;
  }, [parcele]);

  // Luni disponibile (unice din recoltări)
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    recoltari.forEach((r) => {
      const date = new Date(r.data);
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1)
        .toString()
        .padStart(2, '0')}`;
      months.add(monthKey);
    });
    return Array.from(months).sort().reverse();
  }, [recoltari]);

  // Format month pentru display: "Februarie 2026"
  const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('ro-RO', { year: 'numeric', month: 'long' });
  };

  // Filtered recoltări (search + month filter)
  const filteredRecoltari = useMemo(() => {
    let filtered = recoltari;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.id_recoltare.toLowerCase().includes(term) ||
          (r.culegator_id && culegatorMap[r.culegator_id]?.nume.toLowerCase().includes(term)) ||
          (r.parcela_id && parcelaMap[r.parcela_id]?.toLowerCase().includes(term)) ||
          r.observatii?.toLowerCase().includes(term)
      );
    }

    // Month filter
    if (selectedMonth !== 'all') {
      filtered = filtered.filter((r) => {
        const date = new Date(r.data);
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1)
          .toString()
          .padStart(2, '0')}`;
        return monthKey === selectedMonth;
      });
    }

    return filtered;
  }, [recoltari, searchTerm, selectedMonth, culegatorMap, parcelaMap]);

  // Stats calculations
  const stats = useMemo(() => {
    const total = filteredRecoltari.length;
    
    let totalKgNeta = 0;
    let totalValoareMunca = 0;

    filteredRecoltari.forEach((r) => {
      const brutaKg = r.nr_caserole * 0.5;
      const netaKg = brutaKg - r.tara_kg;
      totalKgNeta += netaKg;

      if (r.culegator_id && culegatorMap[r.culegator_id]) {
        const tarif = culegatorMap[r.culegator_id].tarif;
        totalValoareMunca += netaKg * tarif;
      }
    });

    const medieKg = total > 0 ? totalKgNeta / total : 0;

    return { total, totalKgNeta, totalValoareMunca, medieKg };
  }, [filteredRecoltari, culegatorMap]);

  // Format numere
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ro-RO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  // Handlers
  const handleEdit = (recoltare: Recoltare) => {
    setEditingRecoltare(recoltare);
  };

  const handleDelete = (recoltare: Recoltare) => {
    setDeletingRecoltare(recoltare);
  };

  const confirmDelete = () => {
    if (deletingRecoltare) {
      deleteMutation.mutate(deletingRecoltare.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recoltări</h1>
          <p className="text-gray-600 mt-1">
            Gestionează producția zilnică de fructe
          </p>
        </div>
        <AddRecoltareDialog tenantId={tenantId} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Recoltări */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Recoltări</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {stats.total}
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Kg Netă */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Kg (Netă)</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">
                  {formatNumber(stats.totalKgNeta)} kg
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Valoare Muncă */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Valoare Muncă Totală</p>
                <p className="text-3xl font-bold text-red-600 mt-1">
                  -{formatNumber(stats.totalValoareMunca)} lei
                </p>
              </div>
              <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Medie Kg/Recoltare */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Medie Kg/Recoltare</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {formatNumber(stats.medieKg)} kg
                </p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Calculator className="h-6 w-6 text-purple-600" />
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
                  placeholder="Caută după ID, culegător, parcelă..."
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

      {/* Lista Recoltări */}
      {filteredRecoltari.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nicio recoltare găsită
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || selectedMonth !== 'all'
                ? 'Încearcă să schimbi filtrele de căutare'
                : 'Adaugă prima recoltare pentru a începe tracking-ul producției'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecoltari.map((recoltare) => (
            <RecoltareCard
              key={recoltare.id}
              recoltare={recoltare}
              culegatorNume={
                recoltare.culegator_id
                  ? culegatorMap[recoltare.culegator_id]?.nume
                  : undefined
              }
              culegatorTarif={
                recoltare.culegator_id
                  ? culegatorMap[recoltare.culegator_id]?.tarif
                  : undefined
              }
              parcelaNume={
                recoltare.parcela_id ? parcelaMap[recoltare.parcela_id] : undefined
              }
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <EditRecoltareDialog
        recoltare={editingRecoltare}
        tenantId={tenantId}
        open={!!editingRecoltare}
        onOpenChange={(open) => !open && setEditingRecoltare(null)}
      />

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        open={!!deletingRecoltare}
        onOpenChange={(open) => !open && setDeletingRecoltare(null)}
        onConfirm={confirmDelete}
        itemName={deletingRecoltare?.id_recoltare || ''}
        itemType="recoltare"
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
