// src/app/(dashboard)/vanzari/VanzariPageClient.tsx
'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, DollarSign, TrendingUp, Calculator } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  Vanzare,
  getVanzari,
  deleteVanzare,
} from '@/lib/supabase/queries/vanzari';
import { VanzareCard } from '@/components/vanzari/VanzareCard';
import { AddVanzareDialog } from '@/components/vanzari/AddVanzareDialog';
import { EditVanzareDialog } from '@/components/vanzari/EditVanzareDialog';
import { DeleteConfirmDialog } from '@/components/parcele/DeleteConfirmDialog';

interface Client {
  id: string;
  id_client: string;
  nume_client: string;
}

interface VanzariPageClientProps {
  initialVanzari: Vanzare[];
  clienti: Client[];
  tenantId: string;
}

export function VanzariPageClient({
  initialVanzari,
  clienti,
  tenantId,
}: VanzariPageClientProps) {
  const queryClient = useQueryClient();

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [editingVanzare, setEditingVanzare] = useState<Vanzare | null>(null);
  const [deletingVanzare, setDeletingVanzare] = useState<Vanzare | null>(null);

  // Fetch vânzări
  const { data: vanzari = initialVanzari } = useQuery({
    queryKey: ['vanzari', tenantId],
    queryFn: () => getVanzari(tenantId),
    initialData: initialVanzari,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteVanzare,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vanzari'] });
      toast.success('Vânzare ștearsă cu succes!');
      setDeletingVanzare(null);
    },
    onError: (error) => {
      console.error('Error deleting vanzare:', error);
      toast.error('Eroare la ștergerea vânzării');
    },
  });

  // Mapping: ID client → Nume client
  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    clienti.forEach((c) => {
      map[c.id] = `${c.id_client} - ${c.nume_client}`;
    });
    return map;
  }, [clienti]);

  // Luni disponibile (unice din vânzări)
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    vanzari.forEach((v) => {
      const date = new Date(v.data);
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1)
        .toString()
        .padStart(2, '0')}`;
      months.add(monthKey);
    });
    return Array.from(months).sort().reverse();
  }, [vanzari]);

  // Format month pentru display: "Februarie 2026"
  const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('ro-RO', { year: 'numeric', month: 'long' });
  };

  // Filtered vânzări (search + month filter)
  const filteredVanzari = useMemo(() => {
    let filtered = vanzari;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (v) =>
          v.id_vanzare.toLowerCase().includes(term) ||
          (v.client_id && clientMap[v.client_id]?.toLowerCase().includes(term)) ||
          v.status_plata.toLowerCase().includes(term) ||
          v.observatii_ladite?.toLowerCase().includes(term)
      );
    }

    // Month filter
    if (selectedMonth !== 'all') {
      filtered = filtered.filter((v) => {
        const date = new Date(v.data);
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1)
          .toString()
          .padStart(2, '0')}`;
        return monthKey === selectedMonth;
      });
    }

    return filtered;
  }, [vanzari, searchTerm, selectedMonth, clientMap]);

  // Stats calculations
  const stats = useMemo(() => {
    const total = filteredVanzari.length;
    const sumaTotala = filteredVanzari.reduce(
      (sum, v) => sum + v.cantitate_kg * v.pret_lei_kg,
      0
    );
    const medie = total > 0 ? sumaTotala / total : 0;

    return { total, sumaTotala, medie };
  }, [filteredVanzari]);

  // Format sumă
  const formatSuma = (suma: number) => {
    return new Intl.NumberFormat('ro-RO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(suma);
  };

  // Handlers
  const handleEdit = (vanzare: Vanzare) => {
    setEditingVanzare(vanzare);
  };

  const handleDelete = (vanzare: Vanzare) => {
    setDeletingVanzare(vanzare);
  };

  const confirmDelete = () => {
    if (deletingVanzare) {
      deleteMutation.mutate(deletingVanzare.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vânzări Fructe</h1>
          <p className="text-gray-600 mt-1">
            Gestionează vânzările de fructe proaspete
          </p>
        </div>
        <AddVanzareDialog tenantId={tenantId} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Vânzări */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Vânzări</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {stats.total}
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Venituri Totale */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Venituri Totale</p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  +{formatSuma(stats.sumaTotala)} lei
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Medie per Vânzare */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Medie per Vânzare</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {formatSuma(stats.medie)} lei
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
                  placeholder="Caută după ID, client, status..."
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

      {/* Lista Vânzări */}
      {filteredVanzari.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nicio vânzare găsită
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || selectedMonth !== 'all'
                ? 'Încearcă să schimbi filtrele de căutare'
                : 'Adaugă prima vânzare pentru a începe tracking-ul veniturilor'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVanzari.map((vanzare) => (
            <VanzareCard
              key={vanzare.id}
              vanzare={vanzare}
              clientNume={
                vanzare.client_id ? clientMap[vanzare.client_id] : undefined
              }
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <EditVanzareDialog
        vanzare={editingVanzare}
        tenantId={tenantId}
        open={!!editingVanzare}
        onOpenChange={(open) => !open && setEditingVanzare(null)}
      />

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        open={!!deletingVanzare}
        onOpenChange={(open) => !open && setDeletingVanzare(null)}
        onConfirm={confirmDelete}
        itemName={deletingVanzare?.id_vanzare || ''}
        itemType="vânzare"
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
