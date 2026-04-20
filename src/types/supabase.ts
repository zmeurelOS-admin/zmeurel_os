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
          client_sync_id: string
          conflict_flag: boolean | null
          created_at: string
          created_by: string | null
          cultura_id: string | null
          data_aplicare: string
          data_origin: string | null
          demo_seed_id: string | null
          doza: string | null
          id: string
          id_activitate: string
          observatii: string | null
          operator: string | null
          parcela_id: string | null
          produs_utilizat: string | null
          sync_status: string | null
          tenant_id: string | null
          timp_pauza_zile: number | null
          tip_deprecat: boolean
          tip_activitate: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          client_sync_id?: string
          conflict_flag?: boolean | null
          created_at?: string
          created_by?: string | null
          cultura_id?: string | null
          data_aplicare: string
          data_origin?: string | null
          demo_seed_id?: string | null
          doza?: string | null
          id?: string
          id_activitate: string
          observatii?: string | null
          operator?: string | null
          parcela_id?: string | null
          produs_utilizat?: string | null
          sync_status?: string | null
          tenant_id?: string | null
          timp_pauza_zile?: number | null
          tip_deprecat?: boolean
          tip_activitate?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          client_sync_id?: string
          conflict_flag?: boolean | null
          created_at?: string
          created_by?: string | null
          cultura_id?: string | null
          data_aplicare?: string
          data_origin?: string | null
          demo_seed_id?: string | null
          doza?: string | null
          id?: string
          id_activitate?: string
          observatii?: string | null
          operator?: string | null
          parcela_id?: string | null
          produs_utilizat?: string | null
          sync_status?: string | null
          tenant_id?: string | null
          timp_pauza_zile?: number | null
          tip_deprecat?: boolean
          tip_activitate?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activitati_agricole_cultura_id_fkey"
            columns: ["cultura_id"]
            isOneToOne: false
            referencedRelation: "culturi"
            referencedColumns: ["id"]
          },
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
      aplicari_tratament: {
        Row: {
          cantitate_totala_ml: number | null
          cohort_la_aplicare: string | null
          created_at: string
          created_by: string | null
          cultura_id: string | null
          data_aplicata: string | null
          data_planificata: string | null
          doza_l_per_ha: number | null
          doza_ml_per_hl: number | null
          id: string
          meteo_snapshot: Json | null
          observatii: string | null
          operator: string | null
          parcela_id: string
          plan_linie_id: string | null
          produs_id: string | null
          produs_nume_manual: string | null
          status: string
          stadiu_la_aplicare: string | null
          stoc_mutatie_id: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cantitate_totala_ml?: number | null
          cohort_la_aplicare?: string | null
          created_at?: string
          created_by?: string | null
          cultura_id?: string | null
          data_aplicata?: string | null
          data_planificata?: string | null
          doza_l_per_ha?: number | null
          doza_ml_per_hl?: number | null
          id?: string
          meteo_snapshot?: Json | null
          observatii?: string | null
          operator?: string | null
          parcela_id: string
          plan_linie_id?: string | null
          produs_id?: string | null
          produs_nume_manual?: string | null
          status?: string
          stadiu_la_aplicare?: string | null
          stoc_mutatie_id?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cantitate_totala_ml?: number | null
          cohort_la_aplicare?: string | null
          created_at?: string
          created_by?: string | null
          cultura_id?: string | null
          data_aplicata?: string | null
          data_planificata?: string | null
          doza_l_per_ha?: number | null
          doza_ml_per_hl?: number | null
          id?: string
          meteo_snapshot?: Json | null
          observatii?: string | null
          operator?: string | null
          parcela_id?: string
          plan_linie_id?: string | null
          produs_id?: string | null
          produs_nume_manual?: string | null
          status?: string
          stadiu_la_aplicare?: string | null
          stoc_mutatie_id?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aplicari_tratament_cultura_id_fkey"
            columns: ["cultura_id"]
            isOneToOne: false
            referencedRelation: "culturi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aplicari_tratament_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "parcele"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aplicari_tratament_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "parcele_extended"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aplicari_tratament_plan_linie_id_fkey"
            columns: ["plan_linie_id"]
            isOneToOne: false
            referencedRelation: "planuri_tratament_linii"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aplicari_tratament_produs_id_fkey"
            columns: ["produs_id"]
            isOneToOne: false
            referencedRelation: "produse_fitosanitare"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aplicari_tratament_stoc_mutatie_id_fkey"
            columns: ["stoc_mutatie_id"]
            isOneToOne: false
            referencedRelation: "miscari_stoc"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aplicari_tratament_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          mesaj_user: string | null
          pathname: string | null
          raspuns_ai: string | null
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mesaj_user?: string | null
          pathname?: string | null
          raspuns_ai?: string | null
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mesaj_user?: string | null
          pathname?: string | null
          raspuns_ai?: string | null
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
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
      analytics_events: {
        Row: {
          created_at: string
          event_data: Json
          event_name: string
          id: string
          module: string
          page_url: string | null
          session_id: string | null
          status: string | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_data?: Json
          event_name: string
          id?: string
          module?: string
          page_url?: string | null
          session_id?: string | null
          status?: string | null
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_data?: Json
          event_name?: string
          id?: string
          module?: string
          page_url?: string | null
          session_id?: string | null
          status?: string | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      association_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      association_categories: {
        Row: {
          created_at: string
          is_active: boolean
          key: string
          label: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          key: string
          label: string
          sort_order: number
        }
        Update: {
          created_at?: string
          is_active?: boolean
          key?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      association_public_contacts: {
        Row: {
          created_at: string
          email: string | null
          facebook_url: string | null
          instagram_url: string | null
          order_phone: string | null
          phone: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          facebook_url?: string | null
          instagram_url?: string | null
          order_phone?: string | null
          phone?: string | null
          slug?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          facebook_url?: string | null
          instagram_url?: string | null
          order_phone?: string | null
          phone?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      association_product_offers: {
        Row: {
          created_at: string
          id: string
          message: string | null
          offered_by: string
          product_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          suggested_price: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          offered_by: string
          product_id: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_price?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          offered_by?: string
          product_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_price?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "association_product_offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "produse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "association_product_offers_tenant_id_fkey"
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
      cheltuieli_diverse: {
        Row: {
          categorie: string | null
          client_sync_id: string
          conflict_flag: boolean | null
          created_at: string
          created_by: string | null
          data: string
          data_origin: string | null
          demo_seed_id: string | null
          descriere: string | null
          document_url: string | null
          furnizor: string | null
          id: string
          id_cheltuiala: string
          is_auto_generated: boolean | null
          metoda_plata: string | null
          suma_lei: number
          sync_status: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          categorie?: string | null
          client_sync_id?: string
          conflict_flag?: boolean | null
          created_at?: string
          created_by?: string | null
          data: string
          data_origin?: string | null
          demo_seed_id?: string | null
          descriere?: string | null
          document_url?: string | null
          furnizor?: string | null
          id?: string
          id_cheltuiala: string
          is_auto_generated?: boolean | null
          metoda_plata?: string | null
          suma_lei: number
          sync_status?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          categorie?: string | null
          client_sync_id?: string
          conflict_flag?: boolean | null
          created_at?: string
          created_by?: string | null
          data?: string
          data_origin?: string | null
          demo_seed_id?: string | null
          descriere?: string | null
          document_url?: string | null
          furnizor?: string | null
          id?: string
          id_cheltuiala?: string
          is_auto_generated?: boolean | null
          metoda_plata?: string | null
          suma_lei?: number
          sync_status?: string | null
          tenant_id?: string
          updated_at?: string
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
      clienti: {
        Row: {
          adresa: string | null
          created_at: string
          created_by: string | null
          data_origin: string | null
          demo_seed_id: string | null
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
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          adresa?: string | null
          created_at?: string
          created_by?: string | null
          data_origin?: string | null
          demo_seed_id?: string | null
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
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          adresa?: string | null
          created_at?: string
          created_by?: string | null
          data_origin?: string | null
          demo_seed_id?: string | null
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
          updated_at?: string
          updated_by?: string | null
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
      comenzi: {
        Row: {
          cantitate_kg: number
          client_id: string | null
          client_nume_manual: string | null
          cost_livrare: number
          created_at: string
          data_comanda: string
          data_livrare: string
          data_origin: string | null
          demo_seed_id: string | null
          id: string
          linked_vanzare_id: string | null
          locatie_livrare: string | null
          observatii: string | null
          parent_comanda_id: string | null
          pret_per_kg: number
          produs_id: string | null
          status: string
          telefon: string | null
          tenant_id: string
          total: number
          updated_at: string
          whatsapp_consent: boolean
        }
        Insert: {
          cantitate_kg: number
          client_id?: string | null
          client_nume_manual?: string | null
          cost_livrare?: number
          created_at?: string
          data_comanda?: string
          data_livrare: string
          data_origin?: string | null
          demo_seed_id?: string | null
          id?: string
          linked_vanzare_id?: string | null
          locatie_livrare?: string | null
          observatii?: string | null
          parent_comanda_id?: string | null
          pret_per_kg: number
          produs_id?: string | null
          status?: string
          telefon?: string | null
          tenant_id: string
          total?: number
          updated_at?: string
          whatsapp_consent?: boolean
        }
        Update: {
          cantitate_kg?: number
          client_id?: string | null
          client_nume_manual?: string | null
          cost_livrare?: number
          created_at?: string
          data_comanda?: string
          data_livrare?: string
          data_origin?: string | null
          demo_seed_id?: string | null
          id?: string
          linked_vanzare_id?: string | null
          locatie_livrare?: string | null
          observatii?: string | null
          parent_comanda_id?: string | null
          pret_per_kg?: number
          produs_id?: string | null
          status?: string
          telefon?: string | null
          tenant_id?: string
          total?: number
          updated_at?: string
          whatsapp_consent?: boolean
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
            foreignKeyName: "comenzi_linked_vanzare_id_fkey"
            columns: ["linked_vanzare_id"]
            isOneToOne: false
            referencedRelation: "vanzari"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comenzi_linked_vanzare_id_fkey"
            columns: ["linked_vanzare_id"]
            isOneToOne: false
            referencedRelation: "vanzari_extended"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comenzi_parent_comanda_id_fkey"
            columns: ["parent_comanda_id"]
            isOneToOne: false
            referencedRelation: "comenzi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comenzi_produs_id_fkey"
            columns: ["produs_id"]
            isOneToOne: false
            referencedRelation: "produse"
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
      // Manual sync for crop canonicalization migrations (`crops.cod`, then `crops.grup_biologic`).
      crops: {
        Row: {
          cod: string
          created_at: string
          grup_biologic: string | null
          id: string
          name: string
          tenant_id: string | null
          unit_type: string
        }
        Insert: {
          cod: string
          created_at?: string
          grup_biologic?: string | null
          id?: string
          name: string
          tenant_id?: string | null
          unit_type: string
        }
        Update: {
          cod?: string
          created_at?: string
          grup_biologic?: string | null
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
      culegatori: {
        Row: {
          created_at: string | null
          data_angajare: string | null
          data_origin: string | null
          demo_seed_id: string | null
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
          data_origin?: string | null
          demo_seed_id?: string | null
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
          data_origin?: string | null
          demo_seed_id?: string | null
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
      culture_stage_logs: {
        Row: {
          created_at: string
          cultura_id: string | null
          data: string
          data_origin: string | null
          demo_seed_id: string | null
          etapa: string
          id: string
          observatii: string | null
          tenant_id: string
          unitate_id: string
        }
        Insert: {
          created_at?: string
          cultura_id?: string | null
          data: string
          data_origin?: string | null
          demo_seed_id?: string | null
          etapa: string
          id?: string
          observatii?: string | null
          tenant_id: string
          unitate_id: string
        }
        Update: {
          created_at?: string
          cultura_id?: string | null
          data?: string
          data_origin?: string | null
          demo_seed_id?: string | null
          etapa?: string
          id?: string
          observatii?: string | null
          tenant_id?: string
          unitate_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "culture_stage_logs_cultura_id_fkey"
            columns: ["cultura_id"]
            isOneToOne: false
            referencedRelation: "culturi"
            referencedColumns: ["id"]
          },
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
      culturi: {
        Row: {
          activa: boolean
          created_at: string
          data_desfiintare: string | null
          data_origin: string | null
          data_plantarii: string | null
          demo_seed_id: string | null
          distanta_intre_randuri: number | null
          id: string
          interval_tratament_zile: number | null
          motiv_desfiintare: string | null
          nr_plante: number | null
          nr_randuri: number | null
          observatii: string | null
          sistem_irigare: string | null
          soi: string | null
          solar_id: string
          stadiu: string
          suprafata_ocupata: number | null
          tenant_id: string
          tip_planta: string
          updated_at: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          data_desfiintare?: string | null
          data_origin?: string | null
          data_plantarii?: string | null
          demo_seed_id?: string | null
          distanta_intre_randuri?: number | null
          id?: string
          interval_tratament_zile?: number | null
          motiv_desfiintare?: string | null
          nr_plante?: number | null
          nr_randuri?: number | null
          observatii?: string | null
          sistem_irigare?: string | null
          soi?: string | null
          solar_id: string
          stadiu?: string
          suprafata_ocupata?: number | null
          tenant_id: string
          tip_planta: string
          updated_at?: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          data_desfiintare?: string | null
          data_origin?: string | null
          data_plantarii?: string | null
          demo_seed_id?: string | null
          distanta_intre_randuri?: number | null
          id?: string
          interval_tratament_zile?: number | null
          motiv_desfiintare?: string | null
          nr_plante?: number | null
          nr_randuri?: number | null
          observatii?: string | null
          sistem_irigare?: string | null
          soi?: string | null
          solar_id?: string
          stadiu?: string
          suprafata_ocupata?: number | null
          tenant_id?: string
          tip_planta?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "culturi_solar_id_fkey"
            columns: ["solar_id"]
            isOneToOne: false
            referencedRelation: "parcele"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "culturi_solar_id_fkey"
            columns: ["solar_id"]
            isOneToOne: false
            referencedRelation: "parcele_extended"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "culturi_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      etape_cultura: {
        Row: {
          created_at: string
          cultura_id: string
          data_etapa: string
          etapa: string
          id: string
          observatii: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          cultura_id: string
          data_etapa?: string
          etapa: string
          id?: string
          observatii?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          cultura_id?: string
          data_etapa?: string
          etapa?: string
          id?: string
          observatii?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "etape_cultura_cultura_id_fkey"
            columns: ["cultura_id"]
            isOneToOne: false
            referencedRelation: "culturi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etape_cultura_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          created_at: string
          id: string
          message: string
          page_url: string | null
          rating: number
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          page_url?: string | null
          rating: number
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          page_url?: string | null
          rating?: number
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_tenant_id_fkey"
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
        ]
      }
      investitii: {
        Row: {
          categorie: string | null
          created_at: string | null
          data: string
          data_origin: string | null
          demo_seed_id: string | null
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
          data_origin?: string | null
          demo_seed_id?: string | null
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
          data_origin?: string | null
          demo_seed_id?: string | null
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
      meteo_cache: {
        Row: {
          current_description: string | null
          current_humidity: number | null
          current_icon: string | null
          current_temp: number | null
          current_wind_speed: number | null
          data_fetch: string
          date_expiry: string
          forecast_tomorrow_icon: string | null
          forecast_tomorrow_pop: number | null
          forecast_tomorrow_temp_max: number | null
          forecast_tomorrow_temp_min: number | null
          id: string
          lat: number
          lon: number
          raw_json: Json | null
          tenant_id: string
        }
        Insert: {
          current_description?: string | null
          current_humidity?: number | null
          current_icon?: string | null
          current_temp?: number | null
          current_wind_speed?: number | null
          data_fetch?: string
          date_expiry: string
          forecast_tomorrow_icon?: string | null
          forecast_tomorrow_pop?: number | null
          forecast_tomorrow_temp_max?: number | null
          forecast_tomorrow_temp_min?: number | null
          id?: string
          lat: number
          lon: number
          raw_json?: Json | null
          tenant_id: string
        }
        Update: {
          current_description?: string | null
          current_humidity?: number | null
          current_icon?: string | null
          current_temp?: number | null
          current_wind_speed?: number | null
          data_fetch?: string
          date_expiry?: string
          forecast_tomorrow_icon?: string | null
          forecast_tomorrow_pop?: number | null
          forecast_tomorrow_temp_max?: number | null
          forecast_tomorrow_temp_min?: number | null
          id?: string
          lat?: number
          lon?: number
          raw_json?: Json | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meteo_cache_tenant_id_fkey"
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
          data_origin: string | null
          demo_seed_id: string | null
          depozit: string | null
          descriere: string | null
          id: string
          locatie_id: string | null
          observatii: string | null
          produs: string | null
          referinta_id: string | null
          tenant_id: string
          tip: Database["public"]["Enums"]["miscare_stoc_tip_global"] | null
          tip_miscare: string | null
        }
        Insert: {
          calitate?: string | null
          cantitate_cal1?: number
          cantitate_cal2?: number
          cantitate_kg?: number | null
          created_at?: string
          data?: string
          data_origin?: string | null
          demo_seed_id?: string | null
          depozit?: string | null
          descriere?: string | null
          id?: string
          locatie_id?: string | null
          observatii?: string | null
          produs?: string | null
          referinta_id?: string | null
          tenant_id: string
          tip?: Database["public"]["Enums"]["miscare_stoc_tip_global"] | null
          tip_miscare?: string | null
        }
        Update: {
          calitate?: string | null
          cantitate_cal1?: number
          cantitate_cal2?: number
          cantitate_kg?: number | null
          created_at?: string
          data?: string
          data_origin?: string | null
          demo_seed_id?: string | null
          depozit?: string | null
          descriere?: string | null
          id?: string
          locatie_id?: string | null
          observatii?: string | null
          produs?: string | null
          referinta_id?: string | null
          tenant_id?: string
          tip?: Database["public"]["Enums"]["miscare_stoc_tip_global"] | null
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
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          entity_id: string | null
          entity_type: string | null
          id: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      farmer_legal_docs: {
        Row: {
          certificate_expiry: string | null
          certificate_number: string | null
          certificate_photo_url: string | null
          certificate_series: string | null
          cui: string | null
          created_at: string
          full_name: string | null
          legal_accepted_at: string | null
          legal_docs_complete: boolean
          legal_type: Database['public']['Enums']['farmer_legal_type'] | null
          locality: string | null
          phone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          certificate_expiry?: string | null
          certificate_number?: string | null
          certificate_photo_url?: string | null
          certificate_series?: string | null
          cui?: string | null
          created_at?: string
          full_name?: string | null
          legal_accepted_at?: string | null
          legal_type?: Database['public']['Enums']['farmer_legal_type'] | null
          locality?: string | null
          phone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          certificate_expiry?: string | null
          certificate_number?: string | null
          certificate_photo_url?: string | null
          certificate_series?: string | null
          cui?: string | null
          created_at?: string
          full_name?: string | null
          legal_accepted_at?: string | null
          legal_type?: Database['public']['Enums']['farmer_legal_type'] | null
          locality?: string | null
          phone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "farmer_legal_docs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      farmer_weekly_summary_runs: {
        Row: {
          created_at: string
          tenant_id: string
          week_end: string
          week_start: string
        }
        Insert: {
          created_at?: string
          tenant_id: string
          week_end: string
          week_start: string
        }
        Update: {
          created_at?: string
          tenant_id?: string
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "farmer_weekly_summary_runs_tenant_id_fkey"
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
          apare_in_dashboard: boolean
          contribuie_la_productie: boolean
          created_at: string
          created_by: string | null
          cultura: string | null
          data_origin: string | null
          data_plantarii: string | null
          demo_seed_id: string | null
          distanta_intre_randuri: number | null
          gps_lat: number | null
          gps_lng: number | null
          id: string
          id_parcela: string
          latitudine: number | null
          longitudine: number | null
          nr_plante: number | null
          nr_randuri: number | null
          nume_parcela: string
          observatii: string | null
          rol: string
          sistem_irigare: string | null
          soi: string | null
          soi_plantat: string | null
          /**
           * @deprecated Nefolosit de modulul Tratamente din Faza 0.
           * Folosește stadii_fenologice_parcela pentru stadii fenologice.
           * A nu se folosi în cod nou.
           */
          stadiu: string
          status: string | null
          status_operational: string
          suprafata_m2: number
          tenant_id: string
          tip_fruct: string | null
          tip_unitate: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          an_plantare: number
          apare_in_dashboard?: boolean
          contribuie_la_productie?: boolean
          created_at?: string
          created_by?: string | null
          cultura?: string | null
          data_origin?: string | null
          data_plantarii?: string | null
          demo_seed_id?: string | null
          distanta_intre_randuri?: number | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          id_parcela: string
          latitudine?: number | null
          longitudine?: number | null
          nr_plante?: number | null
          nr_randuri?: number | null
          nume_parcela: string
          observatii?: string | null
          rol?: string
          sistem_irigare?: string | null
          soi?: string | null
          soi_plantat?: string | null
          /**
           * @deprecated Nefolosit de modulul Tratamente din Faza 0.
           * Folosește stadii_fenologice_parcela pentru stadii fenologice.
           * A nu se folosi în cod nou.
           */
          stadiu?: string
          status?: string | null
          status_operational?: string
          suprafata_m2: number
          tenant_id?: string
          tip_fruct?: string | null
          tip_unitate?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          an_plantare?: number
          apare_in_dashboard?: boolean
          contribuie_la_productie?: boolean
          created_at?: string
          created_by?: string | null
          cultura?: string | null
          data_origin?: string | null
          data_plantarii?: string | null
          demo_seed_id?: string | null
          distanta_intre_randuri?: number | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          id_parcela?: string
          latitudine?: number | null
          longitudine?: number | null
          nr_plante?: number | null
          nr_randuri?: number | null
          nume_parcela?: string
          observatii?: string | null
          rol?: string
          sistem_irigare?: string | null
          soi?: string | null
          soi_plantat?: string | null
          /**
           * @deprecated Nefolosit de modulul Tratamente din Faza 0.
           * Folosește stadii_fenologice_parcela pentru stadii fenologice.
           * A nu se folosi în cod nou.
           */
          stadiu?: string
          status?: string | null
          status_operational?: string
          suprafata_m2?: number
          tenant_id?: string
          tip_fruct?: string | null
          tip_unitate?: string
          updated_at?: string
          updated_by?: string | null
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
      parcele_planuri: {
        Row: {
          activ: boolean
          an: number
          created_at: string
          id: string
          parcela_id: string
          plan_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          activ?: boolean
          an: number
          created_at?: string
          id?: string
          parcela_id: string
          plan_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          activ?: boolean
          an?: number
          created_at?: string
          id?: string
          parcela_id?: string
          plan_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parcele_planuri_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "parcele"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcele_planuri_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "parcele_extended"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcele_planuri_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "planuri_tratament"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcele_planuri_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      planuri_tratament: {
        Row: {
          activ: boolean
          arhivat: boolean
          created_at: string
          created_by: string | null
          cultura_tip: string
          descriere: string | null
          id: string
          nume: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activ?: boolean
          arhivat?: boolean
          created_at?: string
          created_by?: string | null
          cultura_tip: string
          descriere?: string | null
          id?: string
          nume: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activ?: boolean
          arhivat?: boolean
          created_at?: string
          created_by?: string | null
          cultura_tip?: string
          descriere?: string | null
          id?: string
          nume?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planuri_tratament_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      configurari_parcela_sezon: {
        Row: {
          an: number
          created_at: string
          id: string
          parcela_id: string
          sistem_conducere: string | null
          tenant_id: string
          tip_ciclu_soi: string | null
          updated_at: string
        }
        Insert: {
          an: number
          created_at?: string
          id?: string
          parcela_id: string
          sistem_conducere?: string | null
          tenant_id: string
          tip_ciclu_soi?: string | null
          updated_at?: string
        }
        Update: {
          an?: number
          created_at?: string
          id?: string
          parcela_id?: string
          sistem_conducere?: string | null
          tenant_id?: string
          tip_ciclu_soi?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "configurari_parcela_sezon_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "parcele"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "configurari_parcela_sezon_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      planuri_tratament_linii: {
        Row: {
          cohort_trigger: string | null
          created_at: string
          doza_l_per_ha: number | null
          doza_ml_per_hl: number | null
          id: string
          observatii: string | null
          ordine: number
          plan_id: string
          produs_id: string | null
          produs_nume_manual: string | null
          stadiu_trigger: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cohort_trigger?: string | null
          created_at?: string
          doza_l_per_ha?: number | null
          doza_ml_per_hl?: number | null
          id?: string
          observatii?: string | null
          ordine: number
          plan_id: string
          produs_id?: string | null
          produs_nume_manual?: string | null
          stadiu_trigger: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cohort_trigger?: string | null
          created_at?: string
          doza_l_per_ha?: number | null
          doza_ml_per_hl?: number | null
          id?: string
          observatii?: string | null
          ordine?: number
          plan_id?: string
          produs_id?: string | null
          produs_nume_manual?: string | null
          stadiu_trigger?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planuri_tratament_linii_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "planuri_tratament"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planuri_tratament_linii_produs_id_fkey"
            columns: ["produs_id"]
            isOneToOne: false
            referencedRelation: "produse_fitosanitare"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planuri_tratament_linii_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      produse: {
        Row: {
          alergeni: string | null
          approximate_weight: string | null
          association_listed: boolean
          association_category: string | null
          association_price: number | null
          categorie: string
          conditii_pastrare: string | null
          created_at: string
          data_origin: string | null
          demo_seed_id: string | null
          descriere: string | null
          farmer_id: string | null
          gramaj_per_unitate: number | null
          id: string
          ingrediente: string | null
          moneda: string
          nume: string
          poza_1_url: string | null
          poza_2_url: string | null
          pret_unitar: number | null
          status: string
          tenant_id: string
          termen_valabilitate: string | null
          tip_produs: string | null
          unitate_vanzare: string
          updated_at: string
        }
        Insert: {
          alergeni?: string | null
          approximate_weight?: string | null
          association_listed?: boolean
          association_category?: string | null
          association_price?: number | null
          categorie?: string
          conditii_pastrare?: string | null
          created_at?: string
          data_origin?: string | null
          demo_seed_id?: string | null
          descriere?: string | null
          farmer_id?: string | null
          gramaj_per_unitate?: number | null
          id?: string
          ingrediente?: string | null
          moneda?: string
          nume: string
          poza_1_url?: string | null
          poza_2_url?: string | null
          pret_unitar?: number | null
          status?: string
          tenant_id: string
          termen_valabilitate?: string | null
          tip_produs?: string | null
          unitate_vanzare?: string
          updated_at?: string
        }
        Update: {
          alergeni?: string | null
          approximate_weight?: string | null
          association_listed?: boolean
          association_category?: string | null
          association_price?: number | null
          categorie?: string
          conditii_pastrare?: string | null
          created_at?: string
          data_origin?: string | null
          demo_seed_id?: string | null
          descriere?: string | null
          farmer_id?: string | null
          gramaj_per_unitate?: number | null
          id?: string
          ingrediente?: string | null
          moneda?: string
          nume?: string
          poza_1_url?: string | null
          poza_2_url?: string | null
          pret_unitar?: number | null
          status?: string
          tenant_id?: string
          termen_valabilitate?: string | null
          tip_produs?: string | null
          unitate_vanzare?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produse_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      produse_fitosanitare: {
        Row: {
          activ: boolean
          created_at: string
          created_by: string | null
          doza_max_l_per_ha: number | null
          doza_max_ml_per_hl: number | null
          doza_min_l_per_ha: number | null
          doza_min_ml_per_hl: number | null
          frac_irac: string | null
          id: string
          interval_min_aplicari_zile: number | null
          nr_max_aplicari_per_sezon: number | null
          nume_comercial: string
          omologat_culturi: string[] | null
          phi_zile: number | null
          substanta_activa: string
          tenant_id: string | null
          tip: string
          updated_at: string
        }
        Insert: {
          activ?: boolean
          created_at?: string
          created_by?: string | null
          doza_max_l_per_ha?: number | null
          doza_max_ml_per_hl?: number | null
          doza_min_l_per_ha?: number | null
          doza_min_ml_per_hl?: number | null
          frac_irac?: string | null
          id?: string
          interval_min_aplicari_zile?: number | null
          nr_max_aplicari_per_sezon?: number | null
          nume_comercial: string
          omologat_culturi?: string[] | null
          phi_zile?: number | null
          substanta_activa: string
          tenant_id?: string | null
          tip: string
          updated_at?: string
        }
        Update: {
          activ?: boolean
          created_at?: string
          created_by?: string | null
          doza_max_l_per_ha?: number | null
          doza_max_ml_per_hl?: number | null
          doza_min_l_per_ha?: number | null
          doza_min_ml_per_hl?: number | null
          frac_irac?: string | null
          id?: string
          interval_min_aplicari_zile?: number | null
          nr_max_aplicari_per_sezon?: number | null
          nume_comercial?: string
          omologat_culturi?: string[] | null
          phi_zile?: number | null
          substanta_activa?: string
          tenant_id?: string | null
          tip?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produse_fitosanitare_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ai_messages_count: number
          created_at: string
          dashboard_layout: Json | null
          exclude_from_analytics: boolean
          hide_onboarding: boolean
          id: string
          is_superadmin: boolean
          last_ai_usage_date: string | null
          phone: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          ai_messages_count?: number
          created_at?: string
          dashboard_layout?: Json | null
          exclude_from_analytics?: boolean
          hide_onboarding?: boolean
          id: string
          is_superadmin?: boolean
          last_ai_usage_date?: string | null
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          ai_messages_count?: number
          created_at?: string
          dashboard_layout?: Json | null
          exclude_from_analytics?: boolean
          hide_onboarding?: boolean
          id?: string
          is_superadmin?: boolean
          last_ai_usage_date?: string | null
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
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
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          keys_auth: string
          keys_p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          keys_auth: string
          keys_p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          keys_auth?: string
          keys_p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      recoltari: {
        Row: {
          cantitate_kg: number
          client_sync_id: string
          conflict_flag: boolean | null
          created_at: string
          created_by: string | null
          culegator_id: string | null
          cultura_id: string | null
          data: string
          data_origin: string | null
          demo_seed_id: string | null
          id: string
          id_recoltare: string
          kg_cal1: number
          kg_cal2: number
          observatii: string | null
          parcela_id: string | null
          pret_lei_pe_kg_snapshot: number
          sync_status: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
          valoare_munca_lei: number
        }
        Insert: {
          cantitate_kg?: number
          client_sync_id?: string
          conflict_flag?: boolean | null
          created_at?: string
          created_by?: string | null
          culegator_id?: string | null
          cultura_id?: string | null
          data: string
          data_origin?: string | null
          demo_seed_id?: string | null
          id?: string
          id_recoltare: string
          kg_cal1?: number
          kg_cal2?: number
          observatii?: string | null
          parcela_id?: string | null
          pret_lei_pe_kg_snapshot?: number
          sync_status?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          valoare_munca_lei?: number
        }
        Update: {
          cantitate_kg?: number
          client_sync_id?: string
          conflict_flag?: boolean | null
          created_at?: string
          created_by?: string | null
          culegator_id?: string | null
          cultura_id?: string | null
          data?: string
          data_origin?: string | null
          demo_seed_id?: string | null
          id?: string
          id_recoltare?: string
          kg_cal1?: number
          kg_cal2?: number
          observatii?: string | null
          parcela_id?: string | null
          pret_lei_pe_kg_snapshot?: number
          sync_status?: string | null
          tenant_id?: string
          updated_at?: string
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
            foreignKeyName: "recoltari_cultura_id_fkey"
            columns: ["cultura_id"]
            isOneToOne: false
            referencedRelation: "culturi"
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
      solar_climate_logs: {
        Row: {
          created_at: string
          data_origin: string | null
          demo_seed_id: string | null
          id: string
          observatii: string | null
          temperatura: number
          tenant_id: string
          umiditate: number
          unitate_id: string
        }
        Insert: {
          created_at?: string
          data_origin?: string | null
          demo_seed_id?: string | null
          id?: string
          observatii?: string | null
          temperatura: number
          tenant_id: string
          umiditate: number
          unitate_id: string
        }
        Update: {
          created_at?: string
          data_origin?: string | null
          demo_seed_id?: string | null
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
      stadii_fenologice_parcela: {
        Row: {
          an: number
          cohort: string | null
          created_at: string
          created_by: string | null
          data_observata: string
          id: string
          observatii: string | null
          parcela_id: string
          stadiu: string
          sursa: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          an: number
          cohort?: string | null
          created_at?: string
          created_by?: string | null
          data_observata: string
          id?: string
          observatii?: string | null
          parcela_id: string
          stadiu: string
          sursa: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          an?: number
          cohort?: string | null
          created_at?: string
          created_by?: string | null
          data_observata?: string
          id?: string
          observatii?: string | null
          parcela_id?: string
          stadiu?: string
          sursa?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stadii_fenologice_parcela_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "parcele"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stadii_fenologice_parcela_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "parcele_extended"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stadii_fenologice_parcela_tenant_id_fkey"
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
          id: string
          total_kg_cal1: number
          total_kg_cal2: number
          total_parcele: number
          total_recoltari: number
          total_revenue: number
          total_revenue_lei: number
          total_tenants: number
          total_vanzari: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          total_kg_cal1?: number
          total_kg_cal2?: number
          total_parcele?: number
          total_recoltari?: number
          total_revenue?: number
          total_revenue_lei?: number
          total_tenants?: number
          total_vanzari?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          total_kg_cal1?: number
          total_kg_cal2?: number
          total_parcele?: number
          total_recoltari?: number
          total_revenue?: number
          total_revenue_lei?: number
          total_tenants?: number
          total_vanzari?: number
          updated_at?: string
        }
        Relationships: []
      }
      tenant_settings: {
        Row: {
          created_at: string | null
          id: string
          latitudine_default: number | null
          longitudine_default: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          latitudine_default?: number | null
          longitudine_default?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          latitudine_default?: number | null
          longitudine_default?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          contact_phone: string | null
          created_at: string | null
          demo_seed_id: string | null
          demo_seeded: boolean
          demo_seeded_at: string | null
          descriere_publica: string | null
          exclude_from_analytics: boolean
          expires_at: string | null
          id: string
          is_association_approved: boolean
          is_demo: boolean
          localitate: string | null
          nume_ferma: string
          onboarding_shown_at: string | null
          owner_user_id: string | null
          plan: string | null
          poze_ferma: string[] | null
          specialitate: string | null
          updated_at: string | null
        }
        Insert: {
          contact_phone?: string | null
          created_at?: string | null
          demo_seed_id?: string | null
          demo_seeded?: boolean
          demo_seeded_at?: string | null
          descriere_publica?: string | null
          exclude_from_analytics?: boolean
          expires_at?: string | null
          id?: string
          is_association_approved?: boolean
          is_demo?: boolean
          localitate?: string | null
          nume_ferma: string
          onboarding_shown_at?: string | null
          owner_user_id?: string | null
          plan?: string | null
          poze_ferma?: string[] | null
          specialitate?: string | null
          updated_at?: string | null
        }
        Update: {
          contact_phone?: string | null
          created_at?: string | null
          demo_seed_id?: string | null
          demo_seeded?: boolean
          demo_seeded_at?: string | null
          descriere_publica?: string | null
          exclude_from_analytics?: boolean
          expires_at?: string | null
          id?: string
          is_association_approved?: boolean
          is_demo?: boolean
          localitate?: string | null
          nume_ferma?: string
          onboarding_shown_at?: string | null
          owner_user_id?: string | null
          plan?: string | null
          poze_ferma?: string[] | null
          specialitate?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vanzari: {
        Row: {
          cantitate_kg: number
          client_id: string | null
          client_sync_id: string
          comanda_id: string | null
          conflict_flag: boolean | null
          created_at: string
          created_by: string | null
          data: string
          data_origin: string | null
          demo_seed_id: string | null
          id: string
          id_vanzare: string
          observatii_ladite: string | null
          pret_lei_kg: number
          produs_id: string | null
          status_plata: string | null
          sync_status: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cantitate_kg: number
          client_id?: string | null
          client_sync_id?: string
          comanda_id?: string | null
          conflict_flag?: boolean | null
          created_at?: string
          created_by?: string | null
          data: string
          data_origin?: string | null
          demo_seed_id?: string | null
          id?: string
          id_vanzare: string
          observatii_ladite?: string | null
          pret_lei_kg: number
          produs_id?: string | null
          status_plata?: string | null
          sync_status?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cantitate_kg?: number
          client_id?: string | null
          client_sync_id?: string
          comanda_id?: string | null
          conflict_flag?: boolean | null
          created_at?: string
          created_by?: string | null
          data?: string
          data_origin?: string | null
          demo_seed_id?: string | null
          id?: string
          id_vanzare?: string
          observatii_ladite?: string | null
          pret_lei_kg?: number
          produs_id?: string | null
          status_plata?: string | null
          sync_status?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
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
            foreignKeyName: "vanzari_comanda_id_fkey"
            columns: ["comanda_id"]
            isOneToOne: false
            referencedRelation: "comenzi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vanzari_produs_id_fkey"
            columns: ["produs_id"]
            isOneToOne: false
            referencedRelation: "produse"
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
          client_nume_manual: string | null
          created_at: string | null
          data: string
          data_comanda: string
          data_livrare_estimata: string | null
          data_origin: string | null
          demo_seed_id: string | null
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
          client_nume_manual?: string | null
          created_at?: string | null
          data: string
          data_comanda?: string
          data_livrare_estimata?: string | null
          data_origin?: string | null
          demo_seed_id?: string | null
          id?: string
          id_vanzare_butasi: string
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
          client_nume_manual?: string | null
          created_at?: string | null
          data?: string
          data_comanda?: string
          data_livrare_estimata?: string | null
          data_origin?: string | null
          demo_seed_id?: string | null
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
          data_origin: string | null
          demo_seed_id: string | null
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
          data_origin?: string | null
          demo_seed_id?: string | null
          id?: string
          pret_unitar: number
          soi: string
          subtotal: number
          tenant_id: string
        }
        Update: {
          cantitate?: number
          comanda_id?: string
          created_at?: string
          data_origin?: string | null
          demo_seed_id?: string | null
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
            foreignKeyName: "vanzari_butasi_items_comanda_id_fkey"
            columns: ["comanda_id"]
            isOneToOne: false
            referencedRelation: "vanzari_butasi_extended"
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
          client_sync_id: string | null
          conflict_flag: boolean | null
          created_at: string | null
          created_by: string | null
          cultura_id: string | null
          data_aplicare: string | null
          data_origin: string | null
          data_recoltare_permisa: string | null
          demo_seed_id: string | null
          doza: string | null
          id: string | null
          id_activitate: string | null
          observatii: string | null
          operator: string | null
          parcela_id: string | null
          produs_utilizat: string | null
          status_pauza: string | null
          sync_status: string | null
          tenant_id: string | null
          timp_pauza_zile: number | null
          tip_activitate: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          client_sync_id?: string | null
          conflict_flag?: boolean | null
          created_at?: string | null
          created_by?: string | null
          cultura_id?: string | null
          data_aplicare?: string | null
          data_origin?: string | null
          data_recoltare_permisa?: never
          demo_seed_id?: string | null
          doza?: string | null
          id?: string | null
          id_activitate?: string | null
          observatii?: string | null
          operator?: string | null
          parcela_id?: string | null
          produs_utilizat?: string | null
          status_pauza?: never
          sync_status?: string | null
          tenant_id?: string | null
          timp_pauza_zile?: number | null
          tip_activitate?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          client_sync_id?: string | null
          conflict_flag?: boolean | null
          created_at?: string | null
          created_by?: string | null
          cultura_id?: string | null
          data_aplicare?: string | null
          data_origin?: string | null
          data_recoltare_permisa?: never
          demo_seed_id?: string | null
          doza?: string | null
          id?: string | null
          id_activitate?: string | null
          observatii?: string | null
          operator?: string | null
          parcela_id?: string | null
          produs_utilizat?: string | null
          status_pauza?: never
          sync_status?: string | null
          tenant_id?: string | null
          timp_pauza_zile?: number | null
          tip_activitate?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activitati_agricole_cultura_id_fkey"
            columns: ["cultura_id"]
            isOneToOne: false
            referencedRelation: "culturi"
            referencedColumns: ["id"]
          },
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
          created_by: string | null
          cultura: string | null
          data_origin: string | null
          data_plantarii: string | null
          demo_seed_id: string | null
          densitate_plante_m2: number | null
          distanta_intre_randuri: number | null
          gps_lat: number | null
          gps_lng: number | null
          id: string | null
          id_parcela: string | null
          nr_plante: number | null
          nr_randuri: number | null
          nume_parcela: string | null
          observatii: string | null
          sistem_irigare: string | null
          soi: string | null
          soi_plantat: string | null
          stadiu: string | null
          status: string | null
          suprafata_m2: number | null
          tenant_id: string | null
          tip_fruct: string | null
          tip_unitate: string | null
          updated_at: string | null
          updated_by: string | null
          varsta_ani: number | null
        }
        Insert: {
          an_plantare?: number | null
          created_at?: string | null
          created_by?: string | null
          cultura?: string | null
          data_origin?: string | null
          data_plantarii?: string | null
          demo_seed_id?: string | null
          densitate_plante_m2?: never
          distanta_intre_randuri?: number | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string | null
          id_parcela?: string | null
          nr_plante?: number | null
          nr_randuri?: number | null
          nume_parcela?: string | null
          observatii?: string | null
          sistem_irigare?: string | null
          soi?: string | null
          soi_plantat?: string | null
          stadiu?: string | null
          status?: string | null
          suprafata_m2?: number | null
          tenant_id?: string | null
          tip_fruct?: string | null
          tip_unitate?: string | null
          updated_at?: string | null
          updated_by?: string | null
          varsta_ani?: never
        }
        Update: {
          an_plantare?: number | null
          created_at?: string | null
          created_by?: string | null
          cultura?: string | null
          data_origin?: string | null
          data_plantarii?: string | null
          demo_seed_id?: string | null
          densitate_plante_m2?: never
          distanta_intre_randuri?: number | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string | null
          id_parcela?: string | null
          nr_plante?: number | null
          nr_randuri?: number | null
          nume_parcela?: string | null
          observatii?: string | null
          sistem_irigare?: string | null
          soi?: string | null
          soi_plantat?: string | null
          stadiu?: string | null
          status?: string | null
          suprafata_m2?: number | null
          tenant_id?: string | null
          tip_fruct?: string | null
          tip_unitate?: string | null
          updated_at?: string | null
          updated_by?: string | null
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
          adresa_livrare: string | null
          avans_data: string | null
          avans_suma: number | null
          cantitate_butasi: number | null
          client_id: string | null
          created_at: string | null
          data: string | null
          data_comanda: string | null
          data_livrare_estimata: string | null
          data_origin: string | null
          demo_seed_id: string | null
          id: string | null
          id_vanzare_butasi: string | null
          observatii: string | null
          parcela_sursa_id: string | null
          pret_unitar_lei: number | null
          soi_butasi: string | null
          status: string | null
          tenant_id: string | null
          tip_fruct: string | null
          total_lei: number | null
          updated_at: string | null
        }
        Insert: {
          adresa_livrare?: string | null
          avans_data?: string | null
          avans_suma?: number | null
          cantitate_butasi?: number | null
          client_id?: string | null
          created_at?: string | null
          data?: string | null
          data_comanda?: string | null
          data_livrare_estimata?: string | null
          data_origin?: string | null
          demo_seed_id?: string | null
          id?: string | null
          id_vanzare_butasi?: string | null
          observatii?: string | null
          parcela_sursa_id?: string | null
          pret_unitar_lei?: number | null
          soi_butasi?: string | null
          status?: string | null
          tenant_id?: string | null
          tip_fruct?: string | null
          total_lei?: number | null
          updated_at?: string | null
        }
        Update: {
          adresa_livrare?: string | null
          avans_data?: string | null
          avans_suma?: number | null
          cantitate_butasi?: number | null
          client_id?: string | null
          created_at?: string | null
          data?: string | null
          data_comanda?: string | null
          data_livrare_estimata?: string | null
          data_origin?: string | null
          demo_seed_id?: string | null
          id?: string | null
          id_vanzare_butasi?: string | null
          observatii?: string | null
          parcela_sursa_id?: string | null
          pret_unitar_lei?: number | null
          soi_butasi?: string | null
          status?: string | null
          tenant_id?: string | null
          tip_fruct?: string | null
          total_lei?: number | null
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
      vanzari_extended: {
        Row: {
          cantitate_kg: number | null
          client_id: string | null
          client_sync_id: string | null
          comanda_id: string | null
          conflict_flag: boolean | null
          created_at: string | null
          created_by: string | null
          data: string | null
          data_origin: string | null
          demo_seed_id: string | null
          id: string | null
          id_vanzare: string | null
          observatii_ladite: string | null
          pret_lei_kg: number | null
          status_plata: string | null
          sync_status: string | null
          tenant_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          cantitate_kg?: number | null
          client_id?: string | null
          client_sync_id?: string | null
          comanda_id?: string | null
          conflict_flag?: boolean | null
          created_at?: string | null
          created_by?: string | null
          data?: string | null
          data_origin?: string | null
          demo_seed_id?: string | null
          id?: string | null
          id_vanzare?: string | null
          observatii_ladite?: string | null
          pret_lei_kg?: number | null
          status_plata?: string | null
          sync_status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          cantitate_kg?: number | null
          client_id?: string | null
          client_sync_id?: string | null
          comanda_id?: string | null
          conflict_flag?: boolean | null
          created_at?: string | null
          created_by?: string | null
          data?: string | null
          data_origin?: string | null
          demo_seed_id?: string | null
          id?: string | null
          id_vanzare?: string | null
          observatii_ladite?: string | null
          pret_lei_kg?: number | null
          status_plata?: string | null
          sync_status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
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
            foreignKeyName: "vanzari_comanda_id_fkey"
            columns: ["comanda_id"]
            isOneToOne: false
            referencedRelation: "comenzi"
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
      admin_count_audit_logs: { Args: never; Returns: number }
      admin_list_audit_logs: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          action: string
          actor_email: string
          created_at: string
          id: string
          new_plan: string
          old_plan: string
          tenant_name: string
        }[]
      }
      admin_list_tenants: {
        Args: never
        Returns: {
          created_at: string
          is_association_approved: boolean
          owner_email: string
          parcels_count: number
          plan: string
          tenant_id: string
          tenant_name: string
          users_count: number
        }[]
      }
      admin_set_tenant_plan: {
        Args: { p_plan: string; p_tenant_id: string }
        Returns: {
          id: string
          plan: string
          updated_at: string
        }[]
      }
      bucharest_today: { Args: never; Returns: string }
      check_and_increment_ai_usage: {
        Args: { p_limit: number; p_today: string; p_user_id: string }
        Returns: Json
      }
      create_notification: {
        Args: {
          p_body?: string
          p_data?: Json
          p_entity_id?: string
          p_entity_type?: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      create_recoltare_with_stock:
        | {
            Args: {
              p_culegator_id: string
              p_data: string
              p_kg_cal1?: number
              p_kg_cal2?: number
              p_observatii?: string
              p_parcela_id: string
            }
            Returns: {
              cantitate_kg: number
              client_sync_id: string
              conflict_flag: boolean | null
              created_at: string
              created_by: string | null
              culegator_id: string | null
              cultura_id: string | null
              data: string
              data_origin: string | null
              demo_seed_id: string | null
              id: string
              id_recoltare: string
              kg_cal1: number
              kg_cal2: number
              observatii: string | null
              parcela_id: string | null
              pret_lei_pe_kg_snapshot: number
              sync_status: string | null
              tenant_id: string
              updated_at: string
              updated_by: string | null
              valoare_munca_lei: number
            }
            SetofOptions: {
              from: "*"
              to: "recoltari"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_culegator_id: string
              p_data: string
              p_kg_cal1?: number
              p_kg_cal2?: number
              p_observatii?: string
              p_parcela_id: string
              p_tenant_id?: string
            }
            Returns: {
              cantitate_kg: number
              client_sync_id: string
              conflict_flag: boolean | null
              created_at: string
              created_by: string | null
              culegator_id: string | null
              cultura_id: string | null
              data: string
              data_origin: string | null
              demo_seed_id: string | null
              id: string
              id_recoltare: string
              kg_cal1: number
              kg_cal2: number
              observatii: string | null
              parcela_id: string | null
              pret_lei_pe_kg_snapshot: number
              sync_status: string | null
              tenant_id: string
              updated_at: string
              updated_by: string | null
              valoare_munca_lei: number
            }
            SetofOptions: {
              from: "*"
              to: "recoltari"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      create_vanzare_with_stock: {
        Args: {
          p_calitate?: string
          p_cantitate_kg?: number
          p_client_id?: string
          p_client_sync_id?: string
          p_comanda_id?: string
          p_data: string
          p_observatii_ladite?: string
          p_pret_lei_kg?: number
          p_status_plata?: string
          p_sync_status?: string
          p_tenant_id?: string
        }
        Returns: {
          cantitate_kg: number
          client_id: string | null
          client_sync_id: string
          comanda_id: string | null
          conflict_flag: boolean | null
          created_at: string
          created_by: string | null
          data: string
          data_origin: string | null
          demo_seed_id: string | null
          id: string
          id_vanzare: string
          observatii_ladite: string | null
          pret_lei_kg: number
          produs_id: string | null
          status_plata: string | null
          sync_status: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "vanzari"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_tenant_id: { Args: never; Returns: string }
      delete_comanda_atomic: {
        Args: { p_comanda_id: string; p_tenant_id?: string }
        Returns: undefined
      }
      delete_demo_for_tenant: { Args: { p_tenant_id: string }; Returns: Json }
      delete_recoltare_with_stock: {
        Args: { p_recoltare_id: string }
        Returns: undefined
      }
      delete_vanzare_with_stock: {
        Args: { p_vanzare_id: string }
        Returns: undefined
      }
      deliver_order_atomic: {
        Args: {
          p_delivered_qty: number
          p_order_id: string
          p_payment_status?: string
          p_remaining_delivery_date?: string
        }
        Returns: Json
      }
      upsert_plan_tratament_cu_linii: {
        Args: {
          p_an: number
          p_linii: Json
          p_parcele_ids: string[] | null
          p_plan_data: Json
          p_plan_id: string | null
        }
        Returns: Json
      }
      generate_business_id: { Args: { prefix: string }; Returns: string }
      get_association_role: { Args: { p_user_id: string }; Returns: string }
      is_superadmin: { Args: { check_user_id?: string }; Returns: boolean }
      refresh_tenant_metrics_daily: {
        Args: { p_date?: string }
        Returns: {
          created_at: string
          date: string
          id: string
          total_kg_cal1: number
          total_kg_cal2: number
          total_parcele: number
          total_recoltari: number
          total_revenue: number
          total_revenue_lei: number
          total_tenants: number
          total_vanzari: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tenant_metrics_daily"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reopen_comanda_atomic: {
        Args: { p_comanda_id: string; p_tenant_id?: string }
        Returns: {
          cantitate_kg: number
          client_id: string | null
          client_nume_manual: string | null
          cost_livrare: number
          created_at: string
          data_comanda: string
          data_livrare: string
          data_origin: string | null
          demo_seed_id: string | null
          id: string
          linked_vanzare_id: string | null
          locatie_livrare: string | null
          observatii: string | null
          parent_comanda_id: string | null
          pret_per_kg: number
          produs_id: string | null
          status: string
          telefon: string | null
          tenant_id: string
          total: number
          updated_at: string
          whatsapp_consent: boolean
        }
        SetofOptions: {
          from: "*"
          to: "comenzi"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_recoltare_stock_identity: {
        Args: {
          p_observatii?: string
          p_parcela_id: string
          p_tenant_id?: string
        }
        Returns: Json
      }
      seed_demo_for_tenant:
        | { Args: { p_tenant_id: string }; Returns: Json }
        | { Args: { p_demo_type?: string; p_tenant_id: string }; Returns: Json }
      sync_recoltare_stock_movements: {
        Args: {
          p_data: string
          p_kg_cal1?: number
          p_kg_cal2?: number
          p_observatii?: string
          p_parcela_id: string
          p_recoltare_id: string
          p_tenant_id: string
        }
        Returns: undefined
      }
      tenant_has_core_data: { Args: { p_tenant_id: string }; Returns: boolean }
      update_my_farm_name: {
        Args: { p_farm_name: string }
        Returns: {
          farm_name: string
          tenant_id: string
        }[]
      }
      update_recoltare_with_stock: {
        Args: {
          p_culegator_id: string
          p_data: string
          p_kg_cal1?: number
          p_kg_cal2?: number
          p_observatii?: string
          p_parcela_id: string
          p_recoltare_id: string
        }
        Returns: {
          cantitate_kg: number
          client_sync_id: string
          conflict_flag: boolean | null
          created_at: string
          created_by: string | null
          culegator_id: string | null
          cultura_id: string | null
          data: string
          data_origin: string | null
          demo_seed_id: string | null
          id: string
          id_recoltare: string
          kg_cal1: number
          kg_cal2: number
          observatii: string | null
          parcela_id: string | null
          pret_lei_pe_kg_snapshot: number
          sync_status: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
          valoare_munca_lei: number
        }
        SetofOptions: {
          from: "*"
          to: "recoltari"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_vanzare_with_stock: {
        Args: {
          p_cantitate_kg?: number
          p_client_id?: string
          p_data?: string
          p_observatii_ladite?: string
          p_pret_lei_kg?: number
          p_status_plata?: string
          p_tenant_id?: string
          p_vanzare_id: string
        }
        Returns: {
          cantitate_kg: number
          client_id: string | null
          client_sync_id: string
          comanda_id: string | null
          conflict_flag: boolean | null
          created_at: string
          created_by: string | null
          data: string
          data_origin: string | null
          demo_seed_id: string | null
          id: string
          id_vanzare: string
          observatii_ladite: string | null
          pret_lei_kg: number
          produs_id: string | null
          status_plata: string | null
          sync_status: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "vanzari"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_with_idempotency: {
        Args: { payload: Json; table_name: string }
        Returns: Json
      }
      user_can_manage_tenant: {
        Args: { p_tenant_id: string; p_user_id: string }
        Returns: boolean
      }
      validate_suprafata_culturi: {
        Args: { p_cultura_id?: string; p_solar_id: string; p_suprafata: number }
        Returns: boolean
      }
    }
    Enums: {
      comanda_status:
        | "noua"
        | "confirmata"
        | "programata"
        | "in_livrare"
        | "livrata"
        | "anulata"
      farmer_legal_type:
        | "certificat_producator"
        | "pfa"
        | "ii"
        | "srl"
      miscare_stoc_tip_global:
        | "recoltare"
        | "ajustare"
        | "vanzare"
        | "transformare"
        | "corectie"
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
    Enums: {
      comanda_status: [
        "noua",
        "confirmata",
        "programata",
        "in_livrare",
        "livrata",
        "anulata",
      ],
      farmer_legal_type: [
        "certificat_producator",
        "pfa",
        "ii",
        "srl",
      ],
      miscare_stoc_tip_global: [
        "recoltare",
        "ajustare",
        "vanzare",
        "transformare",
        "corectie",
      ],
    },
  },
} as const
