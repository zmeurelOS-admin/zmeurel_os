# Demo Seed Runtime Debug

## 1) `src/app/auth/callback/route.ts` liniile 230-280 (EXACT)

```ts
    logError('tenant.missing_id', {
      userId: user.id,
    })
    return NextResponse.redirect(toLoginErrorRedirect(baseUrl, 'tenant_create_failed'))
  }

  try {
    const { data: tenantStatusData, error: tenantStatusError } = await supabase
      .from('tenants')
      .select('id, demo_seeded')
      .eq('owner_user_id', user.id)
      .single()

    if (tenantStatusError) {
      throw new Error(`[tenant] status read failed: ${tenantStatusError.message}`)
    }

    const tenantStatus = tenantStatusData as TenantSeedStatus | null

    if (tenantStatus && !tenantStatus.demo_seeded) {
      const { error: seedError } = await supabase.rpc('seed_demo_for_tenant', {
        p_tenant_id: tenantStatus.id,
      })

      if (seedError) {
        throw new Error(`[tenant] demo seed failed: ${seedError.message}`)
      }

      logInfo('tenant.demo_seed_success', {
        userId: user.id,
        tenantId: tenantStatus.id,
      })
    } else {
      logInfo('tenant.demo_seed_skip', {
        userId: user.id,
        tenantId: tenantStatus?.id ?? tenant.id,
        reason: 'already_seeded',
      })
    }
  } catch (error) {
    logError('tenant.demo_seed_failed', {
      userId: user.id,
      tenantId: tenant.id,
      message: (error as Error).message,
    })
    captureException(error, {
      step: 'tenant.demo_seed',
      userId: user.id,
      tenantId: tenant.id,
    })
    return NextResponse.redirect(toLoginErrorRedirect(baseUrl, 'tenant_seed_failed'))
```

## 2) `supabase/migrations/2026030403_seed_demo_service_role_auth_guard.sql` liniile 30-70 (EXACT)

```sql
begin
  if p_tenant_id is null then
    raise exception 'TENANT_REQUIRED';
  end if;

  select owner_user_id
  into v_owner
  from public.tenants
  where id = p_tenant_id;

  if auth.role() = 'service_role' then
    null;
  elsif v_user_id is not null
    and v_owner is not null
    and public.user_can_manage_tenant(p_tenant_id, v_user_id)
  then
    null;
  else
    raise exception 'UNAUTHORIZED';
  end if;

  select t.demo_seeded, t.demo_seed_id
  into v_seeded, v_seed_id
  from public.tenants t
  where t.id = p_tenant_id
  for update;

  if v_seeded = true then
    return jsonb_build_object(
      'status', 'already_seeded',
      'tenant_id', p_tenant_id,
      'demo_seed_id', v_seed_id
    );
  end if;

  if public.tenant_has_core_data(p_tenant_id) then
    return jsonb_build_object(
      'status', 'skipped_existing_data',
      'tenant_id', p_tenant_id
    );
  end if;
```

## 3) Răspunsuri

### a) Ce client Supabase se folosește la RPC în callback?
- În callback se folosește client construit cu `createServerClient(... NEXT_PUBLIC_SUPABASE_ANON_KEY ...)` + cookies (`buildSupabaseClient`), deci client de user session (anon key + JWT user), nu service-role key.

### b) Funcția SQL cere service_role sau acceptă și user normal?
- Acceptă ambele:
  - `auth.role() = 'service_role'` **sau**
  - user autentificat care trece `user_can_manage_tenant(...)`.

### c) Dacă ar cere strict service_role, cu user client ar eșua?
- Da, ar eșua cu `UNAUTHORIZED`.  
- Dar în SQL-ul actual nu e strict service-role; are și ramura pentru user normal autorizat.

### d) Eroarea e prinsă în try/catch — ce se loghează și ce redirect apare?
- În catch se loghează:
  - `logError('tenant.demo_seed_failed', { userId, tenantId, message })`
  - `captureException(error, { step: 'tenant.demo_seed', userId, tenantId })`
- Redirect:
  - `toLoginErrorRedirect(baseUrl, 'tenant_seed_failed')` (adică `/login?error=tenant_seed_failed`).

## 4) Verificare `SUPABASE_SERVICE_ROLE_KEY`

- `.env.local`:
  - variabila `SUPABASE_SERVICE_ROLE_KEY` există.
- `next.config.js`:
  - nu referă `SUPABASE_SERVICE_ROLE_KEY`.
- Referințe în cod:
  - `src/lib/supabase/admin.ts` folosește explicit `process.env.SUPABASE_SERVICE_ROLE_KEY`.
  - este folosit de endpoint-uri admin/GDPR via `getSupabaseAdmin()`.
- Vercel environment settings:
  - din repo nu se poate confirma direct dacă variabila este setată în dashboard-ul Vercel; doar că este necesară pentru rutele care folosesc `getSupabaseAdmin()`.

## 5) VERDICT

Problema nu pare „lipsă service_role” în funcția SQL, deoarece funcția acceptă și user normal autorizat.  

Când apare `UNAUTHORIZED`, cauza probabilă este că RPC-ul rulează fără context auth valid pentru acel request (ex: `auth.uid()` nu ajunge valid în SQL la momentul apelului) sau userul nu trece `user_can_manage_tenant(...)` pentru tenantul trimis.

Ce trebuie schimbat ca să funcționeze robust:
- Apelul de seed din callback să ruleze cu client service-role server-side (ex: `getSupabaseAdmin()`), **sau**
- să păstrezi user client dar să garantezi explicit context auth valid înainte de RPC (session/JWT efectiv disponibil în requestul curent).

În starea actuală, la eșec seed există fallback clar: log + redirect cu `tenant_seed_failed`.
