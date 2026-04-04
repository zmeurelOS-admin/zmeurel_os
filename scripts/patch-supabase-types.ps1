$ErrorActionPreference = 'Stop'
$p = (Join-Path (Join-Path $PSScriptRoot '..') 'src/types/supabase.ts' | Resolve-Path)
$utf8 = New-Object System.Text.UTF8Encoding $false
$c = [System.IO.File]::ReadAllText($p, $utf8)

# comenzi Row
$c = $c -replace '(      comenzi: \{\r\n        Row: \{\r\n          cantitate_kg: number\r\n          client_id: string \| null\r\n          client_nume_manual: string \| null\r\n)(          created_at: string)', "`$1          cost_livrare: number`r`n`$2"
$c = $c -replace '(      comenzi: \{\r\n        Row: \{[\s\S]*?          pret_per_kg: number\r\n)(          status: string\r\n          telefon: string \| null\r\n          tenant_id: string\r\n          total: number\r\n          updated_at: string\r\n        \}\r\n        Insert: \{)', "`$1          produs_id: string | null`r`n`$2"

# comenzi Insert (first Insert after comenzi Row only — anchor on comenzi)
$c = $c -replace '(      comenzi: \{\r\n        Row: \{[\s\S]*?        Insert: \{\r\n          cantitate_kg: number\r\n          client_id\?: string \| null\r\n          client_nume_manual\?: string \| null\r\n)(          created_at\?: string)', "`$1          cost_livrare?: number`r`n`$2"
$c = $c -replace '(      comenzi: \{\r\n        Row: \{[\s\S]*?        Insert: \{[\s\S]*?          pret_per_kg: number\r\n)(          status\?: string\r\n          telefon\?: string \| null\r\n          tenant_id: string\r\n          total\?: number\r\n          updated_at\?: string\r\n        \}\r\n        Update: \{)', "`$1          produs_id?: string | null`r`n`$2"

# comenzi Update
$c = $c -replace '(      comenzi: \{\r\n        Row: \{[\s\S]*?        Update: \{\r\n          cantitate_kg\?: number\r\n          client_id\?: string \| null\r\n          client_nume_manual\?: string \| null\r\n)(          created_at\?: string)', "`$1          cost_livrare?: number`r`n`$2"
$c = $c -replace '(      comenzi: \{\r\n        Row: \{[\s\S]*?        Update: \{[\s\S]*?          pret_per_kg\?: number\r\n)(          status\?: string\r\n          telefon\?: string \| null\r\n          tenant_id\?: string\r\n          total\?: number\r\n          updated_at\?: string\r\n        \}\r\n        Relationships: \[\r\n          \{\r\n            foreignKeyName: "comenzi_client_id_fkey")', "`$1          produs_id?: string | null`r`n`$2"

# tenants Row: after is_demo, before nume_ferma
$c = $c -replace '(          id: string\r\n          is_demo: boolean\r\n)(          nume_ferma: string\r\n          onboarding_shown_at: string \| null\r\n)', "`$1          descriere_publica: string | null`r`n          exclude_from_analytics: boolean`r`n          is_association_approved: boolean`r`n          localitate: string | null`r`n`$2"

# tenants Row: poze/specialitate before updated_at
$c = $c -replace '(          plan: string \| null\r\n)(          updated_at: string \| null\r\n        \}\r\n        Insert: \{\r\n          contact_phone\?: string \| null\r\n          created_at\?: string \| null\r\n          demo_seed_id\?: string \| null\r\n          demo_seeded\?: boolean)', "`$1          poze_ferma: string[] | null`r`n          specialitate: string | null`r`n`$2"

# tenants Insert
$c = $c -replace '(          id\?: string\r\n          is_demo\?: boolean\r\n)(          nume_ferma: string\r\n          onboarding_shown_at\?: string \| null\r\n)', "`$1          descriere_publica?: string | null`r`n          exclude_from_analytics?: boolean`r`n          is_association_approved?: boolean`r`n          localitate?: string | null`r`n`$2"
$c = $c -replace '(          plan\?: string \| null\r\n)(          updated_at\?: string \| null\r\n        \}\r\n        Update: \{\r\n          contact_phone\?: string \| null\r\n          created_at\?: string \| null\r\n          demo_seed_id\?: string \| null\r\n          demo_seeded\?: boolean)', "`$1          poze_ferma?: string[] | null`r`n          specialitate?: string | null`r`n`$2"

# tenants Update
$c = $c -replace '(          id\?: string\r\n          is_demo\?: boolean\r\n)(          nume_ferma\?: string\r\n          onboarding_shown_at\?: string \| null\r\n)', "`$1          descriere_publica?: string | null`r`n          exclude_from_analytics?: boolean`r`n          is_association_approved?: boolean`r`n          localitate?: string | null`r`n`$2"
$c = $c -replace '(          plan\?: string \| null\r\n)(          updated_at\?: string \| null\r\n        \}\r\n        Relationships: \[\]\r\n      \}\r\n      vanzari: \{)', "`$1          poze_ferma?: string[] | null`r`n          specialitate?: string | null`r`n`$2"

# profiles
$c = $c -replace '(      profiles: \{\r\n        Row: \{\r\n          created_at: string\r\n          dashboard_layout: Json \| null\r\n)(          hide_onboarding: boolean\r\n          id: string\r\n)', "`$1          exclude_from_analytics: boolean`r`n`$2"
$c = $c -replace '(        Insert: \{\r\n          created_at\?: string\r\n          dashboard_layout\?: Json \| null\r\n)(          hide_onboarding\?: boolean\r\n          id: string\r\n)', "`$1          exclude_from_analytics?: boolean`r`n`$2"
$c = $c -replace '(        Update: \{\r\n          created_at\?: string\r\n          dashboard_layout\?: Json \| null\r\n)(          hide_onboarding\?: boolean\r\n          id\?: string\r\n)', "`$1          exclude_from_analytics?: boolean`r`n`$2"

$insertBlock = @'
      association_members: {
        Row: {
          id: string
          user_id: string
          role: string
          created_at: string
          invited_by: string | null
        }
        Insert: {
          id?: string
          user_id: string
          role?: string
          created_at?: string
          invited_by?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          role?: string
          created_at?: string
          invited_by?: string | null
        }
        Relationships: []
      },
      association_product_offers: {
        Row: {
          id: string
          product_id: string
          tenant_id: string
          offered_by: string
          status: string
          suggested_price: number | null
          message: string | null
          reviewed_by: string | null
          review_note: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          tenant_id: string
          offered_by: string
          status?: string
          suggested_price?: number | null
          message?: string | null
          reviewed_by?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          tenant_id?: string
          offered_by?: string
          status?: string
          suggested_price?: number | null
          message?: string | null
          reviewed_by?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      },
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          body: string | null
          data: Json
          read: boolean
          created_at: string
          entity_type: string | null
          entity_id: string | null
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          body?: string | null
          data?: Json
          read?: boolean
          created_at?: string
          entity_type?: string | null
          entity_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          body?: string | null
          data?: Json
          read?: boolean
          created_at?: string
          entity_type?: string | null
          entity_id?: string | null
        }
        Relationships: []
      },
      produse: {
        Row: {
          id: string
          tenant_id: string
          nume: string
          descriere: string | null
          categorie: string
          unitate_vanzare: string
          gramaj_per_unitate: number | null
          pret_unitar: number | null
          moneda: string
          poza_1_url: string | null
          poza_2_url: string | null
          status: string
          association_listed: boolean
          association_price: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          nume: string
          descriere?: string | null
          categorie?: string
          unitate_vanzare?: string
          gramaj_per_unitate?: number | null
          pret_unitar?: number | null
          moneda?: string
          poza_1_url?: string | null
          poza_2_url?: string | null
          status?: string
          association_listed?: boolean
          association_price?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          nume?: string
          descriere?: string | null
          categorie?: string
          unitate_vanzare?: string
          gramaj_per_unitate?: number | null
          pret_unitar?: number | null
          moneda?: string
          poza_1_url?: string | null
          poza_2_url?: string | null
          status?: string
          association_listed?: boolean
          association_price?: number | null
          created_at?: string
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
      },
'@

$c = $c -replace '(            foreignKeyName: "profiles_tenant_fk"[\s\S]*?        \]\r\n      \})(\r\n)(      recoltari: \{)', "`$1,`r`n$insertBlock`$3"

# Dacă o rulare anterioară a lipit "}" de "recoltari" fără virgulă, repară.
$c = $c.Replace("        ]`r`n      }      recoltari:", "        ]`r`n      },`r`n      recoltari:")

[System.IO.File]::WriteAllText($p, $c, $utf8)
Write-Host 'patched' $p
