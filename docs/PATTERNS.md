# PATTERNS.md — Patterns Zmeurel OS
_Last updated: 2026-03-20_

---

## 1. Structura paginilor (App Router)

### Pattern: server component thin + client component complet

Fiecare pagină din `(dashboard)` urmează structura:

```
src/app/(dashboard)/[module]/
  page.tsx          ← server component thin (renderizează *PageClient)
  *PageClient.tsx   ← 'use client' — useQuery, mutații, UI complet
  loading.tsx       ← skeleton (Suspense boundary)
  error.tsx         ← error boundary (opțional)
```

**Excepție importantă:**
`activitati-agricole/page.tsx` este **el însuși** implementarea client completă.
`activitati-agricole/ActivitatiAgricolePageClient.tsx` este **cod mort** (UI static vechi).

**Exemplu page.tsx tipic:**
```tsx
// page.tsx
import { CheltuialaPageClient } from './CheltuialaPageClient'
export default function CheltuialaPage() {
  return <CheltuialaPageClient />
}
```

---

## 2. Auth & Multi-tenancy

### Proxy (Next.js 16)

`src/proxy.ts` (singur fișier; Next 16 nu folosește `middleware.ts` lângă el) rulează pe fiecare request:
1. Validează cookie sesiune Supabase
2. Rezolvă `tenant_id` din tabelul `profiles`
3. Injectează headere în request:
   - `x-zmeurel-user-id`
   - `x-zmeurel-user-email`
   - `x-zmeurel-tenant-id`
4. Redirecționează: neautentificat → `/login`, fără tenant → `/start`

### Layout dashboard citește headerele (fără DB round-trip)

```tsx
// src/app/(dashboard)/layout.tsx
const headersList = headers()
const userId = headersList.get('x-zmeurel-user-id')
const email = headersList.get('x-zmeurel-user-email')
const tenantId = headersList.get('x-zmeurel-tenant-id')
```

### Rezolvare tenant în queries

```ts
// getTenantId — folosit în mutații (aruncă excepție dacă lipsă)
const tenantId = await getTenantId(supabase) // src/lib/tenant/get-tenant.ts

// getTenantIdOrNull — folosit în server components (nu aruncă în error boundary)
const tenantId = await getTenantIdOrNull(supabase)
if (!tenantId) return null
```

**Regulă:** Server components de pagină folosesc ÎNTOTDEAUNA `getTenantIdOrNull`.

---

## 3. Clienți Supabase

| Scenariu | Client | Import |
|----------|--------|--------|
| Client component / query fn | Singleton browser | `getSupabase()` din `src/lib/supabase/client.ts` |
| Server component / API route | Per-request server | `createClient()` din `src/lib/supabase/server.ts` |
| Admin / bypass RLS | Service role | `getSupabaseAdmin()` din `src/lib/supabase/admin.ts` |

```ts
// Browser singleton (folosit în toate query functions din lib/supabase/queries/)
const supabase = getSupabase()
const tenantId = await getTenantId(supabase)
const { data } = await supabase.from('parcele').select('*').eq('tenant_id', tenantId)
```

---

## 4. Pattern useQuery (TanStack Query v5)

### Configurare globală (src/app/providers.tsx)
```ts
staleTime: 60_000
gcTime: 10 * 60_000
refetchOnWindowFocus: false
refetchOnReconnect: false
refetchOnMount: false
retry: 1
```

### Pattern standard query în PageClient
```tsx
'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { getParcele, createParcela, deleteParcela } from '@/lib/supabase/queries/parcele'

export function ParcelaPageClient() {
  const queryClient = useQueryClient()

  const { data: parcele = [], isLoading, error } = useQuery({
    queryKey: queryKeys.parcele,
    queryFn: getParcele,
    staleTime: 30_000,           // override local când e nevoie
    refetchOnWindowFocus: false,
  })

  // ... render
}
```

### Invalidare cache după mutații
```ts
await queryClient.invalidateQueries({ queryKey: queryKeys.parcele })
// sau pentru mai multe:
await Promise.all([
  queryClient.invalidateQueries({ queryKey: queryKeys.parcele }),
  queryClient.invalidateQueries({ queryKey: queryKeys.recoltari }),
])
```

---

## 5. Pattern mutații (useMutation)

```tsx
const createMutation = useMutation({
  mutationFn: (input: CreateParcelaInput) => createParcela(input),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.parcele })
    toast.success('Parcela a fost adăugată')
    setOpen(false)
  },
  onError: (error) => {
    console.error('Eroare creare parcelă:', error)
    toast.error('Eroare la adăugarea parcelei')
  },
})

// Apel:
createMutation.mutate(formData)
```

---

## 6. Idempotency (Offline-first)

Toate mutațiile de creare includ `client_sync_id`:

```ts
// src/lib/offline/generateClientId.ts
export function generateClientId(): string {
  return crypto.randomUUID()
}

// În query function:
const client_sync_id = generateClientId()
const { data, error } = await supabase
  .from('parcele')
  .upsert({ ...input, client_sync_id, tenant_id: tenantId }, {
    onConflict: 'client_sync_id',
  })
  .select()
  .single()
```

**Conflict 409 / cod `23505` = succes** (înregistrarea există deja):
```ts
if (error?.code === '23505' || error?.status === 409) {
  // tratăm ca succes — record există deja
  return existingRecord
}
```

---

## 7. RPCs Supabase (stock management)

Operațiile care modifică stocul se fac EXCLUSIV prin RPC:

```ts
// Creare recoltare + actualizare stoc (atomic)
const { data, error } = await supabase.rpc('create_recoltare_with_stock', {
  p_tenant_id: tenantId,
  p_parcela_id: input.parcelaId,
  p_data: input.data,
  p_kg_cal1: input.kgCal1,
  p_kg_cal2: input.kgCal2,
  // ...
})

// Ștergere + inversare stoc (atomic)
const { error } = await supabase.rpc('delete_recoltare_with_stock', {
  p_recoltare_id: id,
  p_tenant_id: tenantId,
})
```

**RPCs disponibile:**
- `create_recoltare_with_stock` / `update_recoltare_with_stock` / `delete_recoltare_with_stock`
- `create_vanzare_with_stock` / `update_vanzare_with_stock` / `delete_vanzare_with_stock`
- `deliver_comanda_with_stock` / `delete_comanda_atomic` / `reopen_comanda_atomic`
- `refresh_tenant_metrics_daily`

---

## 8. Pattern Dialog/Sheet open-close

### Dialog simplu cu state local
```tsx
const [open, setOpen] = useState(false)

<Button onClick={() => setOpen(true)}>Adaugă</Button>
<AddParcelaDialog open={open} onOpenChange={setOpen} />
```

### Dialog cu tracking analytics (lifecycle complet)
```tsx
const hasOpenedRef = useRef(false)
const submittedRef = useRef(false)

// La deschidere dialog:
useEffect(() => {
  if (open && !hasOpenedRef.current) {
    hasOpenedRef.current = true
    trackEvent({ eventName: 'open_create_form', moduleName: 'parcele', status: 'started' })
  }
  if (!open && hasOpenedRef.current && !submittedRef.current) {
    // Dialog închis fără submit
    trackEvent({ eventName: 'form_abandoned', moduleName: 'parcele', status: 'abandoned' })
    hasOpenedRef.current = false
  }
}, [open])

// La submit reușit:
submittedRef.current = true
trackEvent({ eventName: 'create_success', moduleName: 'parcele', status: 'success' })

// La submit eșuat:
trackEvent({ eventName: 'create_failed', moduleName: 'parcele', status: 'failed' })
```

---

## 9. Pattern formulare (react-hook-form + shadcn)

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'

const schema = z.object({
  numeParcela: z.string().min(1, 'Numele este obligatoriu'),
  suprafataM2: z.number().positive('Suprafața trebuie să fie pozitivă'),
})

type FormValues = z.infer<typeof schema>

function AddParcelaDialog({ open, onOpenChange }) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { numeParcela: '', suprafataM2: 0 },
  })

  const onSubmit = form.handleSubmit((values) => {
    createMutation.mutate(values)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <Form {...form}>
          <FormDialogLayout
            title="Adaugă parcelă"
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
            isLoading={createMutation.isPending}
          >
            <FormField
              control={form.control}
              name="numeParcela"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nume parcelă</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormDialogLayout>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

---

## 10. Pattern ștergere cu confirmare

```tsx
const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

// Declanșare ștergere:
<Button variant="destructive" onClick={() => setDeleteTarget(item.id)}>
  Șterge
</Button>

// Dialog confirmare:
<ConfirmDeleteDialog
  open={!!deleteTarget}
  onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
  title="Șterge parcela?"
  description="Această acțiune este ireversibilă."
  onConfirm={() => {
    if (deleteTarget) deleteMutation.mutate(deleteTarget)
  }}
  isLoading={deleteMutation.isPending}
/>
```

---

## 11. Analytics — fire-and-forget

**NICIODATĂ** nu `await` apeluri de tracking în business logic:

```ts
// CORECT — fire-and-forget
trackEvent({ eventName: 'create_success', moduleName: 'parcele', status: 'success' })

// GREȘIT — blochează operația
await trackEvent(...)
```

### Hook pentru tracking vizualizare modul
```tsx
// Adaugă în fiecare PageClient:
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'

export function ParcelaPageClient() {
  useTrackModuleView('parcele') // fires once on mount
  // ...
}
```

---

## 12. Error handling în server components

```tsx
// ✅ CORECT — server component pagină
export default async function ParceleServerPage() {
  const supabase = createClient()
  const tenantId = await getTenantIdOrNull(supabase) // nu aruncă
  if (!tenantId) return <div>Eroare: fără tenant</div>
  return <ParcelaPageClient />
}

// ❌ GREȘIT — aruncă în error boundary
const tenantId = await getTenantId(supabase) // aruncă dacă nu găsește
```

---

## 13. Reset cache fermă

Când o mutație afectează TOATE datele fermei (ex: resetare date, schimbare tenant):

```ts
// src/lib/supabase/client.ts exportă:
export async function resetTenantCaches() {
  queryClient.cancelQueries()
  queryClient.clear()
}

// Utilizare în settings/reset:
await resetTenantCaches()
router.push('/dashboard')
```

---

## 14. Business IDs

Toate înregistrările primesc un ID business uman-citibil generat la creare:

| Prefix | Modul |
|--------|-------|
| `AA-XXXX` | Activități agricole |
| `CH-XXXX` | Cheltuieli |
| `C-XXXX` | Clienți |
| `CUL-XXXX` | Culegători |
| `INV-XXXX` | Investiții |

```ts
// src/lib/supabase/business-ids.ts
const businessId = await generateBusinessId('AA') // → 'AA-1234'
```

---

## 15. Routing App Router

```
src/app/
  (auth)/          → rute publice (fără layout dashboard)
  (dashboard)/     → rute protejate (cu sidebar, auth required)
  (onboarding)/    → rute publice (fără sidebar)
  api/             → API routes (route handlers)
  admin/           → NU există! Admin e în (dashboard)/admin/
```

**Redirect logic (middleware):**
- `/` → landing page (public)
- `/dashboard` → necesită sesiune + tenant
- `/start` → onboarding/demo (public)
- `/admin/*` → necesită sesiune + `is_superadmin = true`

---

## 16. Supabase Schema Patterns

### Upsert idempotent
```ts
const { data, error } = await supabase
  .from('table')
  .upsert(payload, { onConflict: 'client_sync_id' })
  .select()
  .single()
```

### Select cu tenant filter (standard pentru toate queries)
```ts
const { data } = await supabase
  .from('parcele')
  .select('*')
  .eq('tenant_id', tenantId)
  .order('created_at', { ascending: false })
```

### RPC call
```ts
const { data, error } = await supabase.rpc('function_name', {
  p_param1: value1,
  p_param2: value2,
})
if (error) throw error
return data
```

---

## 17. Responsive Data View (P2 desktop tables)

Pentru modulele comerciale/gestiune mutate în P2 la tabel pe desktop, pattern-ul este:

- `<md` → se păstrează **cardurile mobile existente**, fără schimbări de layout sau dialoguri
- `md+` → se folosește `src/components/ui/ResponsiveDataView.tsx`
- sortarea este **client-side** prin `@tanstack/react-table`
- search-ul desktop este local în tabel și caută în valorile coloanelor vizibile
- filtrele/pills rămân definite în pagina modulului, deasupra componentei

Pattern de utilizare:

```tsx
<ResponsiveDataView
  columns={columns}
  data={desktopRows}
  mobileData={mobileRows} // opțional; util când desktop agregă altfel decât cardurile
  getRowId={(row) => row.id}
  renderCard={(row) => <ExistingMobileCard item={row} />}
/>
```

Note:

- Coloana `Acțiuni` pe desktop folosește `sticky right` când modulul are edit/delete
- `stocuri` rămâne read-only pe desktop; nu primește coloana `Acțiuni`
- `comenzi` păstrează panoul lateral desktop pentru acțiuni speciale precum livrare/redeschidere, iar lista din stânga trece pe DataTable
