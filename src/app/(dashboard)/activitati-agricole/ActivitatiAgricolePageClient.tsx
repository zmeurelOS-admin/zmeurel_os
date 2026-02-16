// src/app/(dashboard)/activitati-agricole/ActivitatiAgricolePageClient.tsx
'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Sprout, AlertCircle, CheckCircle } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  ActivitateAgricola,
  getActivitatiAgricole,
  deleteActivitateAgricola,
  calculatePauseStatus,
} from '@/lib/supabase/queries/activitati-agricole';
import { ActivitateAgricolaCard } from '@/components/activitati-agricole/ActivitateAgricolaCard';
import { AddActivitateAgricolaDialog } from '@/components/activitati-agricole/AddActivitateAgricolaDialog';
import { EditActivitateAgricolaDialog } from '@/components/activitati-agricole/EditActivitateAgricolaDialog';
import { DeleteConfirmDialog } from '@/components/parcele/DeleteConfirmDialog';

interface Parcela {
  id: string;
  id_parcela: string;
  nume_parcela: string;
}

interface ActivitatiAgricolePageClientProps {
  initialActivitati: ActivitateAgricola[];
  parcele: Parcela[];
  tenantId: string;
}

export function ActivitatiAgricolePageClient({
  initialActivitati,
  parcele,
  tenantId,
}: ActivitatiAgricolePageClientProps) {
  const queryClient = useQueryClient();

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [editingActivitate, setEditingActivitate] = useState<ActivitateAgricola | null>(null);
  const [deletingActivitate, setDeletingActivitate] = useState<ActivitateAgricola | null>(null);

  // Fetch activități
  const { data: activitati = initialActivitati } = useQuery({
    queryKey: ['activitati-agricole', tenantId],
    queryFn: () => getActivitatiAgricole(tenantId),
    initialData: initialActivitati,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteActivitateAgricola,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activitati-agricole'] });
      toast.success('Activitate ștearsă cu succes!');
      setDeletingActivitate(null);
    },
    onError: (error) => {
      console.error('Error deleting activitate:', error);
      toast.error('Eroare la ștergerea activității');
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

  // Luni disponibile (unice din activități)
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    activitati.forEach((a) => {
      const date = new Date(a.data_aplicare);
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1)
        .toString()
        .padStart(2, '0')}`;
      months.add(monthKey);
    });
    return Array.from(months).sort().reverse();
  }, [activitati]);

  // Format month pentru display: "Februarie 2026"
  const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('ro-RO', { year: 'numeric', month: 'long' });
  };

  // Filtered activități (search + month filter)
  const filteredActivitati = useMemo(() => {
    let filtered = activitati;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.id_activitate.toLowerCase().includes(term) ||
          a.tip_activitate.toLowerCase().includes(term) ||
          a.produs_utilizat?.toLowerCase().includes(term) ||
          (a.parcela_id && parcelaMap[a.parcela_id]?.toLowerCase().includes(term)) ||
          a.operator?.toLowerCase().includes(term) ||
          a.observatii?.toLowerCase().includes(term)
      );
    }

    // Month filter
    if (selectedMonth !== 'all') {
      filtered = filtered.filter((a) => {
        const date = new Date(a.data_aplicare);
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1)
          .toString()
          .padStart(2, '0')}`;
        return monthKey === selectedMonth;
      });
    }

    return filtered;
  }, [activitati, searchTerm, selectedMonth, parcelaMap]);

  // Stats calculations (IMPORTANT: Status pauză)
  const stats = useMemo(() => {
    const total = filteredActivitati.length;
    
    let totalOK = 0;
    let totalPauza = 0;

    filteredActivitati.forEach((a) => {
      if (a.timp_pauza_zile > 0) {
        const { statusPauza } = calculatePauseStatus(a.data_aplicare, a.timp_pauza_zile);
        if (statusPauza === 'OK') {
          totalOK++;
        } else {
          totalPauza++;
        }
      }
    });

    return { total, totalOK, totalPauza };
  }, [filteredActivitati]);

  // Handlers
  const handleEdit = (activitate: ActivitateAgricola) => {
    setEditingActivitate(activitate);
  };

  const handleDelete = (activitate: ActivitateAgricola) => {
    setDeletingActivitate(activitate);
  };

  const confirmDelete = () => {
    if (deletingActivitate) {
      deleteMutation.mutate(deletingActivitate.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Activități Agricole</h1>
          <p className="text-gray-600 mt-1">
            Gestionează tratamente, fertilizări și alte activități
          </p>
        </div>
        <AddActivitateAgricolaDialog tenantId={tenantId} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Activități */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Activități</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {stats.total}
                </p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Sprout className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pauză OK */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Recoltare Permisă (OK)</p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  {stats.totalOK}
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* În Pauză */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">În Pauză (ATENȚIE)</p>
                <p className="text-3xl font-bold text-yellow-600 mt-1">
                  {stats.totalPauza}
                </p>
              </div>
              <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-yellow-600" />
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
                  placeholder="Caută după ID, tip, produs, parcelă..."
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

      {/* Lista Activități */}
      {filteredActivitati.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Sprout className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nicio activitate găsită
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || selectedMonth !== 'all'
                ? 'Încearcă să schimbi filtrele de căutare'
                : 'Adaugă prima activitate agricolă pentru a începe tracking-ul'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredActivitati.map((activitate) => (
            <ActivitateAgricolaCard
              key={activitate.id}
              activitate={activitate}
              parcelaNume={
                activitate.parcela_id ? parcelaMap[activitate.parcela_id] : undefined
              }
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <EditActivitateAgricolaDialog
        activitate={editingActivitate}
        tenantId={tenantId}
        open={!!editingActivitate}
        onOpenChange={(open) => !open && setEditingActivitate(null)}
      />

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        open={!!deletingActivitate}
        onOpenChange={(open) => !open && setDeletingActivitate(null)}
        onConfirm={confirmDelete}
        itemName={deletingActivitate?.id_activitate || ''}
        itemType="activitate agricolă"
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
