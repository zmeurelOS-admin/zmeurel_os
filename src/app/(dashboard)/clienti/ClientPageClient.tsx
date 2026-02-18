// src/app/(dashboard)/clienti/ClientPageClient.tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Plus, Users, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ClientCard } from '@/components/clienti/ClientCard';
import { AddClientDialog } from '@/components/clienti/AddClientDialog';
import { EditClientDialog } from '@/components/clienti/EditClientDialog';
import { DeleteConfirmDialog } from '@/components/parcele/DeleteConfirmDialog';
import {
  getClienti,
  createNewClient,
  updateClient,
  deleteClient,
  type Client,
} from '@/lib/supabase/queries/clienti';

interface ClientPageClientProps {
  initialClienti: Client[];
  tenantId: string;
}

export function ClientPageClient({
  initialClienti,
  tenantId,
}: ClientPageClientProps) {
  const queryClient = useQueryClient();

  // ========================================
  // STATE
  // ========================================
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ========================================
  // REACT QUERY
  // ========================================

  // Fetch clienți
  const { data: clienti = initialClienti, isLoading } = useQuery({
    queryKey: ['clienti', tenantId],
    queryFn: () => getClienti(tenantId),
    initialData: initialClienti,
  });

  // Create client
  const createMutation = useMutation({
    mutationFn: (data: any) =>
      createNewClient({
        tenant_id: tenantId,
        nume_client: data.nume_client,
        telefon: data.telefon || null,
        email: data.email || null,
        adresa: data.adresa || null,
        pret_negociat_lei_kg: data.pret_negociat_lei_kg 
          ? Number(data.pret_negociat_lei_kg) 
          : undefined,
        observatii: data.observatii || null,
      }),
    onSuccess: (newClient) => {
      queryClient.invalidateQueries({ queryKey: ['clienti', tenantId] });
      toast.success(`Client "${newClient.nume_client}" adăugat cu succes!`);
      setAddDialogOpen(false);
    },
    onError: (error: any) => {
      console.error('Error creating client:', error);
      toast.error(`Eroare la adăugare: ${error.message}`);
    },
  });

  // Update client
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      updateClient(id, {
        nume_client: data.nume_client,
        telefon: data.telefon || null,
        email: data.email || null,
        adresa: data.adresa || null,
        pret_negociat_lei_kg: data.pret_negociat_lei_kg 
          ? Number(data.pret_negociat_lei_kg) 
          : undefined,
        observatii: data.observatii || null,
      }),
    onSuccess: (updatedClient) => {
      queryClient.invalidateQueries({ queryKey: ['clienti', tenantId] });
      toast.success(`Client "${updatedClient.nume_client}" actualizat!`);
      setEditingClient(null);
    },
    onError: (error: any) => {
      console.error('Error updating client:', error);
      toast.error(`Eroare la actualizare: ${error.message}`);
    },
  });

  // Delete client
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clienti', tenantId] });
      toast.success('Client șters cu succes!');
      setDeletingClient(null);
    },
    onError: (error: any) => {
      console.error('Error deleting client:', error);
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
    setDeletingClient({ id, name });
  };

  const handleConfirmDelete = () => {
    if (deletingClient) {
      deleteMutation.mutate(deletingClient.id);
    }
  };

  // ========================================
  // SEARCH/FILTER
  // ========================================

  const filteredClienti = clienti.filter((client) => {
    const query = searchQuery.toLowerCase();
    return (
      client.nume_client.toLowerCase().includes(query) ||
      client.id_client.toLowerCase().includes(query) ||
      client.telefon?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query) ||
      client.adresa?.toLowerCase().includes(query)
    );
  });

  // Separate by preț negociat
  const clientiCuPretSpecial = filteredClienti.filter(
    (c) => c.pret_negociat_lei_kg !== null && c.pret_negociat_lei_kg > 0
  );
  const clientiPretStandard = filteredClienti.filter(
    (c) => !c.pret_negociat_lei_kg || c.pret_negociat_lei_kg === 0
  );

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
            Clienți
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestionează baza ta de clienți
          </p>
        </div>
        <Button
          onClick={() => setAddDialogOpen(true)}
          size="lg"
          style={{ backgroundColor: '#F16B6B', color: 'white' }}
        >
          <Plus className="w-5 h-5 mr-2" />
          Adaugă Client
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <p className="text-sm text-muted-foreground">Total Clienți</p>
          <p className="text-2xl font-bold">{clienti.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <p className="text-sm text-muted-foreground">Cu Preț Special</p>
          <p className="text-2xl font-bold text-green-600">
            {clientiCuPretSpecial.length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <p className="text-sm text-muted-foreground">Preț Standard</p>
          <p className="text-2xl font-bold text-gray-600">
            {clientiPretStandard.length}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Caută după nume, telefon, email, adresă..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          style={{ backgroundColor: 'white' }}
        />
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Se încarcă clienții...</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && clienti.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border">
          <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Niciun client adăugat</h3>
          <p className="text-muted-foreground mb-6">
            Adaugă primul client pentru a începe
          </p>
          <Button
            onClick={() => setAddDialogOpen(true)}
            style={{ backgroundColor: '#F16B6B', color: 'white' }}
          >
            <Plus className="w-5 h-5 mr-2" />
            Adaugă Primul Client
          </Button>
        </div>
      )}

      {/* Clienți cu Preț Special */}
      {!isLoading && clientiCuPretSpecial.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            Clienți cu Preț Special ({clientiCuPretSpecial.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clientiCuPretSpecial.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                onEdit={setEditingClient}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Clienți Preț Standard */}
      {!isLoading && clientiPretStandard.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
            Clienți Preț Standard ({clientiPretStandard.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clientiPretStandard.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                onEdit={setEditingClient}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* No search results */}
      {!isLoading &&
        clienti.length > 0 &&
        filteredClienti.length === 0 && (
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
      <AddClientDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={handleAdd}
      />

      <EditClientDialog
        client={editingClient}
        open={!!editingClient}
        onOpenChange={(open) => !open && setEditingClient(null)}
        onSubmit={handleEdit}
      />

      <DeleteConfirmDialog
        open={!!deletingClient}
        onOpenChange={(open) => !open && setDeletingClient(null)}
        onConfirm={handleConfirmDelete}
        itemName={deletingClient?.name || ''}
        itemType="client"
      />
    </div>
  );
}
