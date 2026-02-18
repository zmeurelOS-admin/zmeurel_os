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

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [editingActivitate, setEditingActivitate] = useState<ActivitateAgricola | null>(null);
  const [deletingActivitate, setDeletingActivitate] = useState<ActivitateAgricola | null>(null);

  const { data: activitati = initialActivitati } = useQuery({
    queryKey: ['activitati-agricole', tenantId],
    queryFn: () => getActivitatiAgricole(tenantId),
    initialData: initialActivitati,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteActivitateAgricola,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activitati-agricole'] });
      toast.success('Activitate stearsa cu succes!');
      setDeletingActivitate(null);
    },
    onError: (error) => {
      console.error('Error deleting activitate:', error);
      toast.error('Eroare la stergerea activitatii');
    },
  });

  const parcelaMap = useMemo(() => {
    const map: Record<string, string> = {};
    parcele.forEach((p) => {
      map[p.id] = `${p.id_parcela} - ${p.nume_parcela}`;
    });
    return map;
  }, [parcele]);

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

  const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('ro-RO', { year: 'numeric', month: 'long' });
  };

  const filteredActivitati = useMemo(() => {
    let filtered = activitati;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.id_activitate.toLowerCase().includes(term) ||
          a.tip_activitate?.toLowerCase().includes(term) ||
          a.produs_utilizat?.toLowerCase().includes(term) ||
          (a.parcela_id && parcelaMap[a.parcela_id]?.toLowerCase().includes(term)) ||
          a.operator?.toLowerCase().includes(term) ||
          a.observatii?.toLowerCase().includes(term)
      );
    }

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

  const stats = useMemo(() => {
    const total = filteredActivitati.length;
    let totalOK = 0;
    let totalPauza = 0;

    filteredActivitati.forEach((a) => {
      if (a.timp_pauza_zile > 0) {
        const { status } = calculatePauseStatus(a.data_aplicare, a.timp_pauza_zile);
        if (status === 'OK') {
          totalOK++;
        } else {
          totalPauza++;
        }
      }
    });

    return { total, totalOK, totalPauza };
  }, [filteredActivitati]);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Activitati Agricole</h1>
          <p className="text-gray-600 mt-1">
            Gestioneaza tratamente, fertilizari si alte activitati
          </p>
        </div>
        <AddActivitateAgricolaDialog tenantId={tenantId} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Activitati</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Sprout className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Recoltare Permisa (OK)</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{stats.totalOK}</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Pauza (ATENTIE)</p>
                <p className="text-3xl font-bold text-yellow-600 mt-1">{stats.totalPauza}</p>
              </div>
              <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="search">Cautare</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  type="text"
                  placeholder="Cauta dupa ID, tip, produs, parcela..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="month">Filtrare pe luna</Label>
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

      {filteredActivitati.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Sprout className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nicio activitate gasita
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || selectedMonth !== 'all'
                ? 'Incearca sa schimbi filtrele de cautare'
                : 'Adauga prima activitate agricola pentru a incepe tracking-ul'}
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

      <EditActivitateAgricolaDialog
        activitate={editingActivitate}
        tenantId={tenantId}
        open={!!editingActivitate}
        onOpenChange={(open) => !open && setEditingActivitate(null)}
      />

      <DeleteConfirmDialog
        open={!!deletingActivitate}
        onOpenChange={(open) => !open && setDeletingActivitate(null)}
        onConfirm={confirmDelete}
        itemName={deletingActivitate?.id_activitate || ''}
        itemType="activitate agricola"
      />
    </div>
  );
}
