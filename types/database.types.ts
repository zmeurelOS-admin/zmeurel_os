// ============================================================================
// ZMEUREL OS - DATABASE TYPES
// TypeScript interfaces pentru toate tabelele Supabase
// Data: 10 Februarie 2026
// ============================================================================

// ============================================================================
// PARCELE (Terenuri plantate)
// ============================================================================

export interface Parcela {
    id: string;
    tenant_id: string;
    id_parcela: string; // "P001", "P002" - ID vizibil
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
  
  // Pentru INSERT (fără id, timestamps auto-generate)
  export interface ParcelaInsert {
    tenant_id: string;
    id_parcela: string;
    nume_parcela: string;
    suprafata_m2: number;
    soi_plantat?: string | null;
    an_plantare: number;
    nr_plante?: number | null;
    status?: string;
    gps_lat?: number | null;
    gps_lng?: number | null;
    observatii?: string | null;
  }
  
  // Pentru UPDATE (toate câmpurile opționale)
  export interface ParcelaUpdate {
    id_parcela?: string;
    nume_parcela?: string;
    suprafata_m2?: number;
    soi_plantat?: string | null;
    an_plantare?: number;
    nr_plante?: number | null;
    status?: string;
    gps_lat?: number | null;
    gps_lng?: number | null;
    observatii?: string | null;
  }
  
  // Extended cu calcule (de la VIEW parcele_extended)
  export interface ParcelaExtended extends Parcela {
    densitate_plante_m2: number; // plante / m²
    varsta_ani: number; // anul curent - an_plantare
  }
  
  // ============================================================================
  // ACTIVITATI EXTRA-SEASON
  // ============================================================================
  
  export interface ActivitateExtraSeason {
    id: string;
    tenant_id: string;
    id_activitate: string; // "AES001"
    data: string; // ISO date
    parcela_id: string | null;
    tip_activitate: string;
    descriere: string | null;
    cost_lei: number;
    manopera_ore: number | null;
    manopera_persoane: number | null;
    observatii: string | null;
    created_at: string;
    updated_at: string;
  }
  
  export interface ActivitateExtraSeasonInsert {
    tenant_id: string;
    id_activitate: string;
    data: string;
    parcela_id?: string | null;
    tip_activitate: string;
    descriere?: string | null;
    cost_lei?: number;
    manopera_ore?: number | null;
    manopera_persoane?: number | null;
    observatii?: string | null;
  }
  
  export interface ActivitateExtraSeasonUpdate {
    id_activitate?: string;
    data?: string;
    parcela_id?: string | null;
    tip_activitate?: string;
    descriere?: string | null;
    cost_lei?: number;
    manopera_ore?: number | null;
    manopera_persoane?: number | null;
    observatii?: string | null;
  }
  
  // Extended cu JOIN parcele
  export interface ActivitateExtraSeasonExtended extends ActivitateExtraSeason {
    nume_parcela: string | null;
    soi_plantat: string | null;
    suprafata_m2: number | null;
    cost_lei_per_m2: number;
    cost_lei_per_ora: number;
  }
  
  // ============================================================================
  // NOMENCLATOARE (Enums/Dropdowns)
  // ============================================================================
  
  export interface Nomenclator {
    id: string;
    tip: string; // 'Soi', 'Tip_Activitate_Extra', etc.
    valoare: string;
    descriere: string | null;
    created_at: string;
  }
  
  // Helper pentru dropdown options
  export interface NomenclatorOption {
    value: string;
    label: string;
    descriere?: string;
  }
  
  // ============================================================================
  // TENANTS (Multi-tenancy)
  // ============================================================================
  
  export interface Tenant {
    id: string;
    nume_ferma: string;
    owner_user_id: string;
    plan: string; // 'freemium', 'starter', 'pro', 'enterprise'
    created_at: string;
  }
  
  // ============================================================================
  // HELPER TYPES
  // ============================================================================
  
  // Response wrapper pentru queries
  export interface ApiResponse<T> {
    data: T | null;
    error: Error | null;
  }
  
  // Pagination
  export interface PaginationParams {
    page: number;
    pageSize: number;
  }
  
  export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }
  
  // Filter params
  export interface ParcelaFilters {
    soi_plantat?: string;
    status?: string;
    an_plantare_min?: number;
    an_plantare_max?: number;
  }
  
  // ============================================================================
  // EXPORT ALL
  // ============================================================================
  
  export type {
    // Parcele
    Parcela,
    ParcelaInsert,
    ParcelaUpdate,
    ParcelaExtended,
    // Activitati
    ActivitateExtraSeason,
    ActivitateExtraSeasonInsert,
    ActivitateExtraSeasonUpdate,
    ActivitateExtraSeasonExtended,
    // Nomenclatoare
    Nomenclator,
    NomenclatorOption,
    // Tenants
    Tenant,
    // Helpers
    ApiResponse,
    PaginationParams,
    PaginatedResponse,
    ParcelaFilters,
  };
  