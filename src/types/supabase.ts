export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activitati_agricole: {
        Row: {
          created_at: string | null
          data_aplicare: string
          doza: string | null
          id: string
          id_activitate: string
          observatii: string | null
          operator: string | null
          parcela_id: string | null
          produs_utilizat: string | null
          tenant_id: string | null
          timp_pauza_zile: number | null
          tip_activitate: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_aplicare: string
          doza?: string | null
          id?: string
          id_activitate: string
          observatii?: string | null
          operator?: string | null
          parcela_id?: string | null
          produs_utilizat?: string | null
          tenant_id?: string | null
          timp_pauza_zile?: number | null
          tip_activitate?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_aplicare?: string
          doza?: string | null
          id?: string
          id_activitate?: string
          observatii?: string | null
          operator?: string | null
          parcela_id?: string | null
          produs_utilizat?: string | null
          tenant_id?: string | null
          timp_pauza_zile?: number | null
          tip_activitate?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activitati_agricole_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "parcele"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activitati_agricole_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "parcele_extended"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activitati_agricole_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      activitati_extra_season: {
        Row: {
          cost_lei: number | null
          created_at: string | null
          data: string
          descriere: string | null
          id: string
          id_activitate: string
          manopera_ore: number | null
          manopera_persoane: number | null
          observatii: string | null
          parcela_id: string | null
          tenant_id: string
          tip_activitate: string
          updated_at: string | null
        }
        Insert: {
          cost_lei?: number | null
          created_at?: string | null
          data: string
          descriere?: string | null
          id?: string
          id_activitate: string
          manopera_ore?: number | null
          manopera_persoane?: number | null
          observatii?: string | null
          parcela_id?: string | null
          tenant_id: string
          tip_activitate: string
          updated_at?: string | null
        }
        Update: {
          cost_lei?: number | null
          created_at?: string | null
          data?: string
          descriere?: string | null
          id?: string
          id_activitate?: string
          manopera_ore?: number | null
          manopera_persoane?: number | null
          observatii?: string | null
          parcela_id?: string | null
          tenant_id?: string
          tip_activitate?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activitati_extra_season_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "parcele"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activitati_extra_season_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "parcele_extended"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activitati_extra_season_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          new_plan: string | null
          old_plan: string | null
          target_tenant_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          new_plan?: string | null
          old_plan?: string | null
          target_tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          new_plan?: string | null
          old_plan?: string | null
          target_tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_target_tenant_id_fkey"
            columns: ["target_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_dismissals: {
        Row: {
          alert_key: string
          created_at: string
          dismissed_on: string
          id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          alert_key: string
          created_at?: string
          dismissed_on?: string
          id?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          alert_key?: string
          created_at?: string
          dismissed_on?: string
          id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_dismissals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cheltuieli_diverse: {
        Row: {
          categorie: string | null
          client_sync_id: string | null
          conflict_flag: boolean | null
          created_at: string | null
          created_by: string | null
          data: string
          descriere: string | null
          document_url: string | null
          furnizor: string | null
          id: string
          id_cheltuiala: string
          sync_status: string | null
          suma_lei: number
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          categorie?: string | null
          client_sync_id?: string | null
          conflict_flag?: boolean | null
          created_at?: string | null
          created_by?: string | null
          data: string
          descriere?: string | null
          document_url?: string | null
          furnizor?: string | null
          id?: string
          id_cheltuiala: string
          sync_status?: string | null
          suma_lei: number
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          categorie?: string | null
          client_sync_id?: string | null
          conflict_flag?: boolean | null
          created_at?: string | null
          created_by?: string | null
          data?: string
          descriere?: string | null
          document_url?: string | null
          furnizor?: string | null
          id?: string
          id_cheltuiala?: string
          sync_status?: string | null
          suma_lei?: number
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cheltuieli_diverse_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      comenzi: {
        Row: {
          cantitate_kg: number
          client_id: string | null
          client_nume_manual: string | null
          created_at: string
          data_comanda: string
          data_livrare: string
          id: string
          locatie_livrare: string | null
          observatii: string | null
          pret_per_kg: number
          status: string
          telefon: string | null
          tenant_id: string
          total: number
          updated_at: string
        }
        Insert: {
          cantitate_kg: number
          client_id?: string | null
          client_nume_manual?: string | null
          created_at?: string
          data_comanda?: string
          data_livrare: string
          id?: string
          locatie_livrare?: string | null
          observatii?: string | null
          pret_per_kg: number
          status?: string
          telefon?: string | null
          tenant_id?: string
          total?: number
          updated_at?: string
        }
        Update: {
          cantitate_kg?: number
          client_id?: string | null
          client_nume_manual?: string | null
          created_at?: string
          data_comanda?: string
          data_livrare?: string
          id?: string
          locatie_livrare?: string | null
          observatii?: string | null
          pret_per_kg?: number
          status?: string
          telefon?: string | null
          tenant_id?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comenzi_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comenzi_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      clienti: {
        Row: {
          adresa: string | null
          created_at: string | null
          email: string | null
          google_etag: string | null
          google_resource_name: string | null
          id: string
          id_client: string
          nume_client: string
          observatii: string | null
          pret_negociat_lei_kg: number | null
          telefon: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          adresa?: string | null
          created_at?: string | null
          email?: string | null
          google_etag?: string | null
          google_resource_name?: string | null
          id?: string
          id_client: string
          nume_client: string
          observatii?: string | null
          pret_negociat_lei_kg?: number | null
          telefon?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Update: {
          adresa?: string | null
          created_at?: string | null
          email?: string | null
          google_etag?: string | null
          google_resource_name?: string | null
          id?: string
          id_client?: string
          nume_client?: string
          observatii?: string | null
          pret_negociat_lei_kg?: number | null
          telefon?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clienti_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      culegatori: {
        Row: {
          created_at: string | null
          data_angajare: string | null
          id: string
          id_culegator: string
          nume_prenume: string
          observatii: string | null
          status_activ: boolean | null
          tarif_lei_kg: number | null
          telefon: string | null
          tenant_id: string | null
          tip_angajare: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_angajare?: string | null
          id?: string
          id_culegator: string
          nume_prenume: string
          observatii?: string | null
          status_activ?: boolean | null
          tarif_lei_kg?: number | null
          telefon?: string | null
          tenant_id?: string | null
          tip_angajare?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_angajare?: string | null
          id?: string
          id_culegator?: string
          nume_prenume?: string
          observatii?: string | null
          status_activ?: boolean | null
          tarif_lei_kg?: number | null
          telefon?: string | null
          tenant_id?: string | null
          tip_angajare?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "culegatori_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      investitii: {
        Row: {
          categorie: string | null
          created_at: string | null
          data: string
          descriere: string | null
          document_url: string | null
          furnizor: string | null
          id: string
          id_investitie: string
          parcela_id: string | null
          suma_lei: number
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          categorie?: string | null
          created_at?: string | null
          data: string
          descriere?: string | null
          document_url?: string | null
          furnizor?: string | null
          id?: string
          id_investitie: string
          parcela_id?: string | null
          suma_lei: number
          tenant_id?: string
          updated_at?: string | null
        }
        Update: {
          categorie?: string | null
          created_at?: string | null
          data?: string
          descriere?: string | null
          document_url?: string | null
          furnizor?: string | null
          id?: string
          id_investitie?: string
          parcela_id?: string | null
          suma_lei?: number
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investitii_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "parcele"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investitii_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "parcele_extended"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investitii_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      miscari_stoc: {
        Row: {
          calitate: string | null
          cantitate_cal1: number
          cantitate_cal2: number
          cantitate_kg: number | null
          created_at: string
          data: string
          depozit: string | null
          descriere: string | null
          id: string
          locatie_id: string | null
          observatii: string | null
          produs: string | null
          referinta_id: string | null
          tenant_id: string
          tip: string | null
          tip_miscare: string | null
        }
        Insert: {
          calitate?: string | null
          cantitate_cal1?: number
          cantitate_cal2?: number
          cantitate_kg?: number | null
          created_at?: string
          data?: string
          depozit?: string | null
          descriere?: string | null
          id?: string
          locatie_id?: string | null
          observatii?: string | null
          produs?: string | null
          referinta_id?: string | null
          tenant_id?: string
          tip?: string | null
          tip_miscare?: string | null
        }
        Update: {
          calitate?: string | null
          cantitate_cal1?: number
          cantitate_cal2?: number
          cantitate_kg?: number | null
          created_at?: string
          data?: string
          depozit?: string | null
          descriere?: string | null
          id?: string
          locatie_id?: string | null
          observatii?: string | null
          produs?: string | null
          referinta_id?: string | null
          tenant_id?: string
          tip?: string | null
          tip_miscare?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "miscari_stoc_locatie_id_fkey"
            columns: ["locatie_id"]
            isOneToOne: false
            referencedRelation: "parcele"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "miscari_stoc_locatie_id_fkey"
            columns: ["locatie_id"]
            isOneToOne: false
            referencedRelation: "parcele_extended"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "miscari_stoc_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations_google_contacts: {
        Row: {
          access_token: string | null
          connected_email: string | null
          created_at: string
          id: string
          last_sync_at: string | null
          refresh_token: string | null
          scope: string | null
          sync_enabled: boolean
          sync_token: string | null
          sync_window: string
          tenant_id: string
          token_expires_at: string | null
          updated_at: string
          user_email: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          connected_email?: string | null
          created_at?: string
          id?: string
          last_sync_at?: string | null
          refresh_token?: string | null
          scope?: string | null
          sync_enabled?: boolean
          sync_token?: string | null
          sync_window?: string
          tenant_id: string
          token_expires_at?: string | null
          updated_at?: string
          user_email: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          connected_email?: string | null
          created_at?: string
          id?: string
          last_sync_at?: string | null
          refresh_token?: string | null
          scope?: string | null
          sync_enabled?: boolean
          sync_token?: string | null
          sync_window?: string
          tenant_id?: string
          token_expires_at?: string | null
          updated_at?: string
          user_email?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_google_contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_google_contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      nomenclatoare: {
        Row: {
          activ: boolean | null
          created_at: string | null
          descriere: string | null
          id: string
          nivel: string | null
          tenant_id: string | null
          tip: string
          updated_at: string | null
          valoare: string
        }
        Insert: {
          activ?: boolean | null
          created_at?: string | null
          descriere?: string | null
          id?: string
          nivel?: string | null
          tenant_id?: string | null
          tip: string
          updated_at?: string | null
          valoare: string
        }
        Update: {
          activ?: boolean | null
          created_at?: string | null
          descriere?: string | null
          id?: string
          nivel?: string | null
          tenant_id?: string | null
          tip?: string
          updated_at?: string | null
          valoare?: string
        }
        Relationships: [
          {
            foreignKeyName: "nomenclatoare_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      parcele: {
        Row: {
          an_plantare: number
          cultura: string | null
          created_at: string | null
          data_plantarii: string | null
          distanta_intre_randuri: number | null
          gps_lat: number | null
          gps_lng: number | null
          id: string
          id_parcela: string
          nr_plante: number | null
          nr_randuri: number | null
          nume_parcela: string
          observatii: string | null
          sistem_irigare: string | null
          soi: string | null
          soi_plantat: string | null
          stadiu?: string | null
          status: string | null
          suprafata_m2: number
          tenant_id: string
          tip_unitate: string
          tip_fruct: string | null
          updated_at: string | null
        }
        Insert: {
          an_plantare: number
          cultura?: string | null
          created_at?: string | null
          data_plantarii?: string | null
          distanta_intre_randuri?: number | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          id_parcela: string
          nr_plante?: number | null
          nr_randuri?: number | null
          nume_parcela: string
          observatii?: string | null
          sistem_irigare?: string | null
          soi?: string | null
          soi_plantat?: string | null
          stadiu?: string | null
          status?: string | null
          suprafata_m2: number
          tenant_id?: string
          tip_unitate?: string
          tip_fruct?: string | null
          updated_at?: string | null
        }
        Update: {
          an_plantare?: number
          cultura?: string | null
          created_at?: string | null
          data_plantarii?: string | null
          distanta_intre_randuri?: number | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          id_parcela?: string
          nr_plante?: number | null
          nr_randuri?: number | null
          nume_parcela?: string
          observatii?: string | null
          sistem_irigare?: string | null
          soi?: string | null
          soi_plantat?: string | null
          stadiu?: string | null
          status?: string | null
          suprafata_m2?: number
          tenant_id?: string
          tip_unitate?: string
          tip_fruct?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parcele_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      culture_stage_logs: {
        Row: {
          created_at: string
          data: string
          etapa: string
          id: string
          observatii: string | null
          tenant_id: string
          unitate_id: string
        }
        Insert: {
          created_at?: string
          data: string
          etapa: string
          id?: string
          observatii?: string | null
          tenant_id: string
          unitate_id: string
        }
        Update: {
          created_at?: string
          data?: string
          etapa?: string
          id?: string
          observatii?: string | null
          tenant_id?: string
          unitate_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "culture_stage_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "culture_stage_logs_unitate_id_fkey"
            columns: ["unitate_id"]
            isOneToOne: false
            referencedRelation: "parcele"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "culture_stage_logs_unitate_id_fkey"
            columns: ["unitate_id"]
            isOneToOne: false
            referencedRelation: "parcele_extended"
            referencedColumns: ["id"]
          },
        ]
      }
      crop_varieties: {
        Row: {
          created_at: string
          crop_id: string
          id: string
          name: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          crop_id: string
          id?: string
          name: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          crop_id?: string
          id?: string
          name?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crop_varieties_crop_id_fkey"
            columns: ["crop_id"]
            isOneToOne: false
            referencedRelation: "crops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crop_varieties_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crops: {
        Row: {
          created_at: string
          id: string
          name: string
          tenant_id: string | null
          unit_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          tenant_id?: string | null
          unit_type: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string | null
          unit_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crops_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          hide_onboarding: boolean
          id: string
          is_superadmin: boolean
          tenant_id: string | null
        }
        Insert: {
          hide_onboarding?: boolean
          id: string
          is_superadmin?: boolean
          tenant_id?: string | null
        }
        Update: {
          hide_onboarding?: boolean
          id?: string
          is_superadmin?: boolean
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      solar_climate_logs: {
        Row: {
          created_at: string
          id: string
          observatii: string | null
          temperatura: number
          tenant_id: string
          umiditate: number
          unitate_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          observatii?: string | null
          temperatura: number
          tenant_id: string
          umiditate: number
          unitate_id: string
        }
        Update: {
          created_at?: string
          id?: string
          observatii?: string | null
          temperatura?: number
          tenant_id?: string
          umiditate?: number
          unitate_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solar_climate_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solar_climate_logs_unitate_id_fkey"
            columns: ["unitate_id"]
            isOneToOne: false
            referencedRelation: "parcele"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solar_climate_logs_unitate_id_fkey"
            columns: ["unitate_id"]
            isOneToOne: false
            referencedRelation: "parcele_extended"
            referencedColumns: ["id"]
          },
        ]
      }
      recoltari: {
        Row: {
          cantitate_kg: number
          client_sync_id: string | null
          conflict_flag: boolean | null
          created_at: string | null
          created_by: string | null
          culegator_id: string | null
          data: string
          id: string
          id_recoltare: string
          kg_cal1: number
          kg_cal2: number
          observatii: string | null
          parcela_id: string | null
          pret_lei_pe_kg_snapshot: number
          sync_status: string | null
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
          valoare_munca_lei: number
        }
        Insert: {
          cantitate_kg?: number
          client_sync_id?: string | null
          conflict_flag?: boolean | null
          created_at?: string | null
          created_by?: string | null
          culegator_id?: string | null
          data: string
          id?: string
          id_recoltare: string
          kg_cal1?: number
          kg_cal2?: number
          observatii?: string | null
          parcela_id?: string | null
          pret_lei_pe_kg_snapshot?: number
          sync_status?: string | null
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
          valoare_munca_lei?: number
        }
        Update: {
          cantitate_kg?: number
          client_sync_id?: string | null
          conflict_flag?: boolean | null
          created_at?: string | null
          created_by?: string | null
          culegator_id?: string | null
          data?: string
          id?: string
          id_recoltare?: string
          kg_cal1?: number
          kg_cal2?: number
          observatii?: string | null
          parcela_id?: string | null
          pret_lei_pe_kg_snapshot?: number
          sync_status?: string | null
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
          valoare_munca_lei?: number
        }
        Relationships: [
          {
            foreignKeyName: "recoltari_culegator_id_fkey"
            columns: ["culegator_id"]
            isOneToOne: false
            referencedRelation: "culegatori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recoltari_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "parcele"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recoltari_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "parcele_extended"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recoltari_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_metrics_daily: {
        Row: {
          created_at: string
          date: string
          total_kg_cal1: number
          total_kg_cal2: number
          total_parcele: number
          total_recoltari: number
          total_revenue_lei: number
          total_tenants: number
          total_vanzari: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          total_kg_cal1?: number
          total_kg_cal2?: number
          total_parcele?: number
          total_recoltari?: number
          total_revenue_lei?: number
          total_tenants?: number
          total_vanzari?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          total_kg_cal1?: number
          total_kg_cal2?: number
          total_parcele?: number
          total_recoltari?: number
          total_revenue_lei?: number
          total_tenants?: number
          total_vanzari?: number
          updated_at?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          is_demo: boolean
          nume_ferma: string
          owner_user_id: string | null
          plan: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_demo?: boolean
          nume_ferma: string
          owner_user_id?: string | null
          plan?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_demo?: boolean
          nume_ferma?: string
          owner_user_id?: string | null
          plan?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vanzari: {
        Row: {
          cantitate_kg: number
          client_id: string | null
          comanda_id: string | null
          created_at: string | null
          data: string
          id: string
          id_vanzare: string
          observatii_ladite: string | null
          pret_lei_kg: number
          status_plata: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          cantitate_kg: number
          client_id?: string | null
          comanda_id?: string | null
          created_at?: string | null
          data: string
          id?: string
          id_vanzare: string
          observatii_ladite?: string | null
          pret_lei_kg: number
          status_plata?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Update: {
          cantitate_kg?: number
          client_id?: string | null
          comanda_id?: string | null
          created_at?: string | null
          data?: string
          id?: string
          id_vanzare?: string
          observatii_ladite?: string | null
          pret_lei_kg?: number
          status_plata?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vanzari_comanda_id_fkey"
            columns: ["comanda_id"]
            isOneToOne: false
            referencedRelation: "comenzi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vanzari_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vanzari_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vanzari_butasi: {
        Row: {
          adresa_livrare: string | null
          avans_data: string | null
          avans_suma: number
          cantitate_butasi: number
          client_id: string | null
          created_at: string | null
          data: string
          data_comanda: string
          data_livrare_estimata: string | null
          id: string
          id_vanzare_butasi: string
          observatii: string | null
          parcela_sursa_id: string | null
          pret_unitar_lei: number
          soi_butasi: string | null
          status: string
          tenant_id: string | null
          tip_fruct: string | null
          total_lei: number
          updated_at: string | null
        }
        Insert: {
          adresa_livrare?: string | null
          avans_data?: string | null
          avans_suma?: number
          cantitate_butasi: number
          client_id?: string | null
          created_at?: string | null
          data: string
          data_comanda?: string
          data_livrare_estimata?: string | null
          id?: string
          id_vanzare_butasi?: string
          observatii?: string | null
          parcela_sursa_id?: string | null
          pret_unitar_lei: number
          soi_butasi?: string | null
          status?: string
          tenant_id?: string | null
          tip_fruct?: string | null
          total_lei?: number
          updated_at?: string | null
        }
        Update: {
          adresa_livrare?: string | null
          avans_data?: string | null
          avans_suma?: number
          cantitate_butasi?: number
          client_id?: string | null
          created_at?: string | null
          data?: string
          data_comanda?: string
          data_livrare_estimata?: string | null
          id?: string
          id_vanzare_butasi?: string
          observatii?: string | null
          parcela_sursa_id?: string | null
          pret_unitar_lei?: number
          soi_butasi?: string | null
          status?: string
          tenant_id?: string | null
          tip_fruct?: string | null
          total_lei?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vanzari_butasi_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vanzari_butasi_parcela_sursa_id_fkey"
            columns: ["parcela_sursa_id"]
            isOneToOne: false
            referencedRelation: "parcele"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vanzari_butasi_parcela_sursa_id_fkey"
            columns: ["parcela_sursa_id"]
            isOneToOne: false
            referencedRelation: "parcele_extended"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vanzari_butasi_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vanzari_butasi_items: {
        Row: {
          cantitate: number
          comanda_id: string
          created_at: string
          id: string
          pret_unitar: number
          soi: string
          subtotal: number
          tenant_id: string
        }
        Insert: {
          cantitate: number
          comanda_id: string
          created_at?: string
          id?: string
          pret_unitar: number
          soi: string
          subtotal: number
          tenant_id?: string
        }
        Update: {
          cantitate?: number
          comanda_id?: string
          created_at?: string
          id?: string
          pret_unitar?: number
          soi?: string
          subtotal?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vanzari_butasi_items_comanda_id_fkey"
            columns: ["comanda_id"]
            isOneToOne: false
            referencedRelation: "vanzari_butasi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vanzari_butasi_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      activitati_extended: {
        Row: {
          created_at: string | null
          data_aplicare: string | null
          data_recoltare_permisa: string | null
          doza: string | null
          id: string | null
          id_activitate: string | null
          observatii: string | null
          operator: string | null
          parcela_id: string | null
          produs_utilizat: string | null
          status_pauza: string | null
          tenant_id: string | null
          timp_pauza_zile: number | null
          tip_activitate: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_aplicare?: string | null
          data_recoltare_permisa?: never
          doza?: string | null
          id?: string | null
          id_activitate?: string | null
          observatii?: string | null
          operator?: string | null
          parcela_id?: string | null
          produs_utilizat?: string | null
          status_pauza?: never
          tenant_id?: string | null
          timp_pauza_zile?: number | null
          tip_activitate?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_aplicare?: string | null
          data_recoltare_permisa?: never
          doza?: string | null
          id?: string | null
          id_activitate?: string | null
          observatii?: string | null
          operator?: string | null
          parcela_id?: string | null
          produs_utilizat?: string | null
          status_pauza?: never
          tenant_id?: string | null
          timp_pauza_zile?: number | null
          tip_activitate?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activitati_agricole_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "parcele"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activitati_agricole_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "parcele_extended"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activitati_agricole_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      activitati_extra_extended: {
        Row: {
          cost_lei: number | null
          cost_lei_per_m2: number | null
          cost_lei_per_ora: number | null
          created_at: string | null
          data: string | null
          descriere: string | null
          id: string | null
          id_activitate: string | null
          manopera_ore: number | null
          manopera_persoane: number | null
          nume_parcela: string | null
          observatii: string | null
          parcela_id: string | null
          soi_plantat: string | null
          suprafata_m2: number | null
          tenant_id: string | null
          tip_activitate: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activitati_extra_season_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "parcele"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activitati_extra_season_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "parcele_extended"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activitati_extra_season_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      parcele_extended: {
        Row: {
          an_plantare: number | null
          created_at: string | null
          densitate_plante_m2: number | null
          gps_lat: number | null
          gps_lng: number | null
          id: string | null
          id_parcela: string | null
          nr_plante: number | null
          nume_parcela: string | null
          observatii: string | null
          soi_plantat: string | null
          status: string | null
          suprafata_m2: number | null
          tenant_id: string | null
          tip_fruct: string | null
          updated_at: string | null
          varsta_ani: number | null
        }
        Insert: {
          an_plantare?: number | null
          created_at?: string | null
          densitate_plante_m2?: never
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string | null
          id_parcela?: string | null
          nr_plante?: number | null
          nume_parcela?: string | null
          observatii?: string | null
          soi_plantat?: string | null
          status?: string | null
          suprafata_m2?: number | null
          tenant_id?: string | null
          tip_fruct?: string | null
          updated_at?: string | null
          varsta_ani?: never
        }
        Update: {
          an_plantare?: number | null
          created_at?: string | null
          densitate_plante_m2?: never
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string | null
          id_parcela?: string | null
          nr_plante?: number | null
          nume_parcela?: string | null
          observatii?: string | null
          soi_plantat?: string | null
          status?: string | null
          suprafata_m2?: number | null
          tenant_id?: string | null
          tip_fruct?: string | null
          updated_at?: string | null
          varsta_ani?: never
        }
        Relationships: [
          {
            foreignKeyName: "parcele_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vanzari_butasi_extended: {
        Row: {
          cantitate_butasi: number | null
          client_id: string | null
          created_at: string | null
          data: string | null
          id: string | null
          id_vanzare_butasi: string | null
          observatii: string | null
          parcela_sursa_id: string | null
          pret_unitar_lei: number | null
          soi_butasi: string | null
          tenant_id: string | null
          tip_fruct: string | null
          updated_at: string | null
          valoare_totala_lei: number | null
        }
        Insert: {
          cantitate_butasi?: number | null
          client_id?: string | null
          created_at?: string | null
          data?: string | null
          id?: string | null
          id_vanzare_butasi?: string | null
          observatii?: string | null
          parcela_sursa_id?: string | null
          pret_unitar_lei?: number | null
          soi_butasi?: string | null
          tenant_id?: string | null
          tip_fruct?: string | null
          updated_at?: string | null
          valoare_totala_lei?: never
        }
        Update: {
          cantitate_butasi?: number | null
          client_id?: string | null
          created_at?: string | null
          data?: string | null
          id?: string | null
          id_vanzare_butasi?: string | null
          observatii?: string | null
          parcela_sursa_id?: string | null
          pret_unitar_lei?: number | null
          soi_butasi?: string | null
          tenant_id?: string | null
          tip_fruct?: string | null
          updated_at?: string | null
          valoare_totala_lei?: never
        }
        Relationships: [
          {
            foreignKeyName: "vanzari_butasi_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vanzari_butasi_parcela_sursa_id_fkey"
            columns: ["parcela_sursa_id"]
            isOneToOne: false
            referencedRelation: "parcele"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vanzari_butasi_parcela_sursa_id_fkey"
            columns: ["parcela_sursa_id"]
            isOneToOne: false
            referencedRelation: "parcele_extended"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vanzari_butasi_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vanzari_extended: {
        Row: {
          cantitate_kg: number | null
          client_id: string | null
          created_at: string | null
          data: string | null
          id: string | null
          id_vanzare: string | null
          observatii_ladite: string | null
          pret_lei_kg: number | null
          status_plata: string | null
          tenant_id: string | null
          updated_at: string | null
          valoare_totala_lei: number | null
        }
        Insert: {
          cantitate_kg?: number | null
          client_id?: string | null
          created_at?: string | null
          data?: string | null
          id?: string | null
          id_vanzare?: string | null
          observatii_ladite?: string | null
          pret_lei_kg?: number | null
          status_plata?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          valoare_totala_lei?: never
        }
        Update: {
          cantitate_kg?: number | null
          client_id?: string | null
          created_at?: string | null
          data?: string | null
          id?: string | null
          id_vanzare?: string | null
          observatii_ladite?: string | null
          pret_lei_kg?: number | null
          status_plata?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          valoare_totala_lei?: never
        }
        Relationships: [
          {
            foreignKeyName: "vanzari_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vanzari_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_count_audit_logs: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      admin_list_audit_logs: {
        Args: {
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          action: string
          actor_email: string | null
          created_at: string
          id: string
          new_plan: string | null
          old_plan: string | null
          tenant_name: string | null
        }[]
      }
      admin_list_tenants: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string | null
          owner_email: string | null
          parcels_count: number
          plan: string | null
          tenant_id: string
          tenant_name: string
          users_count: number
        }[]
      }
      admin_set_tenant_plan: {
        Args: {
          p_plan: string
          p_tenant_id: string
        }
        Returns: {
          id: string
          plan: string
          updated_at: string | null
        }[]
      }
      bucharest_today: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      refresh_tenant_metrics_daily: {
        Args: {
          p_date?: string
        }
        Returns: {
          created_at: string
          date: string
          total_kg_cal1: number
          total_kg_cal2: number
          total_parcele: number
          total_recoltari: number
          total_revenue_lei: number
          total_tenants: number
          total_vanzari: number
          updated_at: string
        }
      }
      is_superadmin: {
        Args: {
          check_user_id?: string
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
