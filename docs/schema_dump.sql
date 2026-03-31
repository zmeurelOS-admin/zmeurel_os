


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."comanda_status" AS ENUM (
    'noua',
    'confirmata',
    'programata',
    'in_livrare',
    'livrata',
    'anulata'
);


ALTER TYPE "public"."comanda_status" OWNER TO "postgres";


CREATE TYPE "public"."miscare_stoc_tip_global" AS ENUM (
    'recoltare',
    'ajustare',
    'vanzare',
    'transformare',
    'corectie'
);


ALTER TYPE "public"."miscare_stoc_tip_global" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_count_audit_logs"() RETURNS bigint
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  total_count bigint;
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'FORBIDDEN';
  end if;

  select count(*)::bigint
  into total_count
  from public.audit_logs;

  return total_count;
end;
$$;


ALTER FUNCTION "public"."admin_count_audit_logs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_audit_logs"("p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "created_at" timestamp with time zone, "actor_email" "text", "tenant_name" "text", "old_plan" "text", "new_plan" "text", "action" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select
    a.id::uuid,
    a.created_at::timestamptz,
    u.email::text as actor_email,
    t.nume_ferma::text as tenant_name,
    a.old_plan::text,
    a.new_plan::text,
    a.action::text
  from public.audit_logs a
  left join public.tenants t on t.id = a.target_tenant_id
  left join auth.users u on u.id = a.actor_user_id
  order by a.created_at desc
  limit greatest(coalesce(p_limit, 50), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;


ALTER FUNCTION "public"."admin_list_audit_logs"("p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_tenants"() RETURNS TABLE("tenant_id" "uuid", "tenant_name" "text", "owner_email" "text", "plan" "text", "created_at" timestamp with time zone, "parcels_count" bigint, "users_count" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select
    t.id::uuid as tenant_id,
    t.nume_ferma::text as tenant_name,
    u.email::text as owner_email,
    t.plan::text,
    t.created_at::timestamptz,
    (
      select count(*)::bigint
      from public.parcele p
      where p.tenant_id = t.id
    ) as parcels_count,
    (
      select count(*)::bigint
      from auth.users ux
      where ux.id = t.owner_user_id
    ) as users_count
  from public.tenants t
  left join auth.users u on u.id = t.owner_user_id
  order by t.created_at desc nulls last;
end;
$$;


ALTER FUNCTION "public"."admin_list_tenants"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_tenant_plan"("p_tenant_id" "uuid", "p_plan" "text") RETURNS TABLE("id" "uuid", "plan" "text", "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  normalized_plan text;
  previous_plan text;
  updated_row public.tenants%rowtype;
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'FORBIDDEN';
  end if;

  normalized_plan := lower(trim(p_plan));

  if normalized_plan not in ('freemium', 'pro', 'enterprise') then
    raise exception 'INVALID_PLAN';
  end if;

  select t.plan
  into previous_plan
  from public.tenants t
  where t.id = p_tenant_id
  for update;

  if not found then
    raise exception 'TENANT_NOT_FOUND';
  end if;

  update public.tenants t
  set
    plan = normalized_plan,
    updated_at = now()
  where t.id = p_tenant_id
  returning * into updated_row;

  if previous_plan is distinct from normalized_plan then
    insert into public.audit_logs (
      actor_user_id,
      action,
      target_tenant_id,
      old_plan,
      new_plan
    ) values (
      auth.uid(),
      'plan_changed',
      p_tenant_id,
      previous_plan,
      normalized_plan
    );
  end if;

  return query
  select updated_row.id, updated_row.plan, updated_row.updated_at;
end;
$$;


ALTER FUNCTION "public"."admin_set_tenant_plan"("p_tenant_id" "uuid", "p_plan" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bucharest_today"() RETURNS "date"
    LANGUAGE "sql" STABLE
    AS $$
  select (now() at time zone 'Europe/Bucharest')::date
$$;


ALTER FUNCTION "public"."bucharest_today"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_and_increment_ai_usage"("p_user_id" "uuid", "p_today" "date", "p_limit" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count int;
  v_date  date;
BEGIN
  -- Caller may only touch their own row
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- Lock the row for the duration of this transaction
  SELECT ai_messages_count, last_ai_usage_date
  INTO   v_count, v_date
  FROM   profiles
  WHERE  id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'profile_not_found');
  END IF;

  -- New day → reset counter
  IF v_date IS DISTINCT FROM p_today THEN
    v_count := 0;
  END IF;

  -- Hard limit check
  IF v_count >= p_limit THEN
    RETURN jsonb_build_object('allowed', false, 'count', v_count, 'limit', p_limit);
  END IF;

  -- Atomic increment
  UPDATE profiles
  SET    ai_messages_count  = v_count + 1,
         last_ai_usage_date = p_today
  WHERE  id = p_user_id;

  RETURN jsonb_build_object('allowed', true, 'count', v_count + 1, 'limit', p_limit);
END;
$$;


ALTER FUNCTION "public"."check_and_increment_ai_usage"("p_user_id" "uuid", "p_today" "date", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_culturi_suprafata"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Validare doar dacă suprafata_ocupata e completată
  if new.suprafata_ocupata is not null then
    if not public.validate_suprafata_culturi(new.solar_id, new.suprafata_ocupata, new.id) then
      raise exception 'SUPRAFATA_OVERFLOW: Suprafața ocupată de culturi depășește suprafața totală a solarului.'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."check_culturi_suprafata"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_stock_not_negative"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_total_cal1 numeric;
  v_total_cal2 numeric;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.tenant_id is not null then
    select
      coalesce(sum(ms.cantitate_cal1), 0),
      coalesce(sum(ms.cantitate_cal2), 0)
    into v_total_cal1, v_total_cal2
    from public.miscari_stoc ms
    where ms.tenant_id = old.tenant_id
      and ms.produs is not distinct from old.produs
      and ms.locatie_id is not distinct from old.locatie_id
      and ms.depozit is not distinct from old.depozit;

    if v_total_cal1 < 0 or v_total_cal2 < 0 then
      raise exception 'negative_stock'
        using hint = format(
          'Stocul ar deveni negativ: cal1=%s, cal2=%s pentru produs=%s, locatie=%s, depozit=%s',
          v_total_cal1,
          v_total_cal2,
          coalesce(old.produs, '[null]'),
          coalesce(old.locatie_id::text, '[null]'),
          coalesce(old.depozit, '[null]')
        );
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE')
     and new.tenant_id is not null
     and (
       tg_op <> 'UPDATE'
       or new.tenant_id is distinct from old.tenant_id
       or new.produs is distinct from old.produs
       or new.locatie_id is distinct from old.locatie_id
       or new.depozit is distinct from old.depozit
     ) then
    select
      coalesce(sum(ms.cantitate_cal1), 0),
      coalesce(sum(ms.cantitate_cal2), 0)
    into v_total_cal1, v_total_cal2
    from public.miscari_stoc ms
    where ms.tenant_id = new.tenant_id
      and ms.produs is not distinct from new.produs
      and ms.locatie_id is not distinct from new.locatie_id
      and ms.depozit is not distinct from new.depozit;

    if v_total_cal1 < 0 or v_total_cal2 < 0 then
      raise exception 'negative_stock'
        using hint = format(
          'Stocul ar deveni negativ: cal1=%s, cal2=%s pentru produs=%s, locatie=%s, depozit=%s',
          v_total_cal1,
          v_total_cal2,
          coalesce(new.produs, '[null]'),
          coalesce(new.locatie_id::text, '[null]'),
          coalesce(new.depozit, '[null]')
        );
    end if;
  end if;

  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."check_stock_not_negative"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."recoltari" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "id_recoltare" character varying(50) NOT NULL,
    "data" "date" NOT NULL,
    "culegator_id" "uuid",
    "parcela_id" "uuid",
    "observatii" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cantitate_kg" numeric DEFAULT 0 NOT NULL,
    "kg_cal1" numeric DEFAULT 0 NOT NULL,
    "kg_cal2" numeric DEFAULT 0 NOT NULL,
    "pret_lei_pe_kg_snapshot" numeric DEFAULT 0 NOT NULL,
    "valoare_munca_lei" numeric DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "client_sync_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sync_status" "text" DEFAULT 'synced'::"text",
    "conflict_flag" boolean DEFAULT false,
    "data_origin" "text",
    "demo_seed_id" "uuid",
    "cultura_id" "uuid"
);


ALTER TABLE "public"."recoltari" OWNER TO "postgres";


COMMENT ON TABLE "public"."recoltari" IS 'Producție zilnică per culegător și parcelă';



CREATE OR REPLACE FUNCTION "public"."create_recoltare_with_stock"("p_data" "date", "p_parcela_id" "uuid", "p_culegator_id" "uuid", "p_kg_cal1" numeric DEFAULT 0, "p_kg_cal2" numeric DEFAULT 0, "p_observatii" "text" DEFAULT NULL::"text") RETURNS "public"."recoltari"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_tarif numeric;
  v_kg_cal1 numeric := round(greatest(coalesce(p_kg_cal1, 0), 0)::numeric, 2);
  v_kg_cal2 numeric := round(greatest(coalesce(p_kg_cal2, 0), 0)::numeric, 2);
  v_total_kg numeric := round((greatest(coalesce(p_kg_cal1, 0), 0) + greatest(coalesce(p_kg_cal2, 0), 0))::numeric, 2);
  v_valoare_munca numeric;
  v_recoltare public.recoltari;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  select t.id
  into v_tenant_id
  from public.tenants t
  where t.owner_user_id = v_user_id
  limit 1;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  perform 1
  from public.parcele p
  where p.id = p_parcela_id
    and p.tenant_id = v_tenant_id;

  if not found then
    raise exception 'Parcela este invalida pentru tenantul curent.';
  end if;

  select c.tarif_lei_kg
  into v_tarif
  from public.culegatori c
  where c.id = p_culegator_id
    and c.tenant_id = v_tenant_id;

  if v_tarif is null or v_tarif <= 0 then
    raise exception 'Culegatorul nu are tarif setat in profil';
  end if;

  v_valoare_munca := round((v_total_kg * v_tarif)::numeric, 2);

  insert into public.recoltari (
    tenant_id,
    id_recoltare,
    data,
    parcela_id,
    culegator_id,
    kg_cal1,
    kg_cal2,
    pret_lei_pe_kg_snapshot,
    valoare_munca_lei,
    observatii
  )
  values (
    v_tenant_id,
    public.generate_business_id('REC'),
    p_data,
    p_parcela_id,
    p_culegator_id,
    v_kg_cal1,
    v_kg_cal2,
    round(v_tarif::numeric, 2),
    v_valoare_munca,
    nullif(btrim(coalesce(p_observatii, '')), '')
  )
  returning *
  into v_recoltare;

  if v_kg_cal1 > 0 then
    insert into public.miscari_stoc (
      tenant_id,
      locatie_id,
      produs,
      calitate,
      depozit,
      tip_miscare,
      cantitate_kg,
      tip,
      cantitate_cal1,
      cantitate_cal2,
      referinta_id,
      data
    )
    values (
      v_tenant_id,
      p_parcela_id,
      'zmeura',
      'cal1',
      'fresh',
      'recoltare',
      v_kg_cal1,
      'recoltare',
      v_kg_cal1,
      0,
      v_recoltare.id,
      p_data
    );
  end if;

  if v_kg_cal2 > 0 then
    insert into public.miscari_stoc (
      tenant_id,
      locatie_id,
      produs,
      calitate,
      depozit,
      tip_miscare,
      cantitate_kg,
      tip,
      cantitate_cal1,
      cantitate_cal2,
      referinta_id,
      data
    )
    values (
      v_tenant_id,
      p_parcela_id,
      'zmeura',
      'cal2',
      'fresh',
      'recoltare',
      v_kg_cal2,
      'recoltare',
      0,
      v_kg_cal2,
      v_recoltare.id,
      p_data
    );
  end if;

  return v_recoltare;
end;
$$;


ALTER FUNCTION "public"."create_recoltare_with_stock"("p_data" "date", "p_parcela_id" "uuid", "p_culegator_id" "uuid", "p_kg_cal1" numeric, "p_kg_cal2" numeric, "p_observatii" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_recoltare_with_stock"("p_data" "date", "p_parcela_id" "uuid", "p_culegator_id" "uuid", "p_kg_cal1" numeric DEFAULT 0, "p_kg_cal2" numeric DEFAULT 0, "p_observatii" "text" DEFAULT NULL::"text", "p_tenant_id" "uuid" DEFAULT NULL::"uuid") RETURNS "public"."recoltari"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_tarif numeric;
  v_kg_cal1 numeric := round(greatest(coalesce(p_kg_cal1, 0), 0)::numeric, 2);
  v_kg_cal2 numeric := round(greatest(coalesce(p_kg_cal2, 0), 0)::numeric, 2);
  v_total_kg numeric := round((greatest(coalesce(p_kg_cal1, 0), 0) + greatest(coalesce(p_kg_cal2, 0), 0))::numeric, 2);
  v_valoare_munca numeric;
  v_recoltare public.recoltari;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  select public.current_tenant_id()
  into v_tenant_id;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  if p_tenant_id is not null and p_tenant_id <> v_tenant_id then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));

  perform 1
  from public.parcele p
  where p.id = p_parcela_id
    and p.tenant_id = v_tenant_id;

  if not found then
    raise exception 'Parcela este invalida pentru tenantul curent.';
  end if;

  select c.tarif_lei_kg
  into v_tarif
  from public.culegatori c
  where c.id = p_culegator_id
    and c.tenant_id = v_tenant_id;

  if v_tarif is null or v_tarif <= 0 then
    raise exception 'Culegatorul nu are tarif setat in profil';
  end if;

  v_valoare_munca := round((v_total_kg * v_tarif)::numeric, 2);

  insert into public.recoltari (
    tenant_id,
    id_recoltare,
    data,
    parcela_id,
    culegator_id,
    kg_cal1,
    kg_cal2,
    pret_lei_pe_kg_snapshot,
    valoare_munca_lei,
    observatii
  )
  values (
    v_tenant_id,
    public.generate_business_id('REC'),
    p_data,
    p_parcela_id,
    p_culegator_id,
    v_kg_cal1,
    v_kg_cal2,
    round(v_tarif::numeric, 2),
    v_valoare_munca,
    nullif(btrim(coalesce(p_observatii, '')), '')
  )
  returning *
  into v_recoltare;

  perform public.sync_recoltare_stock_movements(
    v_recoltare.id,
    v_tenant_id,
    p_parcela_id,
    p_data,
    v_kg_cal1,
    v_kg_cal2,
    v_recoltare.observatii
  );

  return v_recoltare;
end;
$$;


ALTER FUNCTION "public"."create_recoltare_with_stock"("p_data" "date", "p_parcela_id" "uuid", "p_culegator_id" "uuid", "p_kg_cal1" numeric, "p_kg_cal2" numeric, "p_observatii" "text", "p_tenant_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vanzari" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "id_vanzare" character varying(50) NOT NULL,
    "data" "date" NOT NULL,
    "client_id" "uuid",
    "cantitate_kg" numeric(8,2) NOT NULL,
    "pret_lei_kg" numeric(6,2) NOT NULL,
    "status_plata" character varying(20) DEFAULT 'Plătit'::character varying,
    "observatii_ladite" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "client_sync_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sync_status" "text" DEFAULT 'synced'::"text",
    "conflict_flag" boolean DEFAULT false,
    "data_origin" "text",
    "demo_seed_id" "uuid",
    "comanda_id" "uuid",
    "produs_id" "uuid",
    CONSTRAINT "vanzari_cantitate_kg_check" CHECK (("cantitate_kg" > (0)::numeric)),
    CONSTRAINT "vanzari_pret_lei_kg_check" CHECK (("pret_lei_kg" >= (0)::numeric)),
    CONSTRAINT "vanzari_status_plata_check" CHECK ((("status_plata" IS NULL) OR ("lower"("btrim"(("status_plata")::"text")) = ANY (ARRAY['avans'::"text", 'incasat'::"text", 'neplatit'::"text", 'platit'::"text", 'restanta'::"text"]))))
);


ALTER TABLE "public"."vanzari" OWNER TO "postgres";


COMMENT ON TABLE "public"."vanzari" IS 'Vânzări fructe proaspete';



CREATE OR REPLACE FUNCTION "public"."create_vanzare_with_stock"("p_data" "date", "p_client_id" "uuid" DEFAULT NULL::"uuid", "p_comanda_id" "uuid" DEFAULT NULL::"uuid", "p_cantitate_kg" numeric DEFAULT 0, "p_pret_lei_kg" numeric DEFAULT 0, "p_status_plata" "text" DEFAULT 'Platit'::"text", "p_observatii_ladite" "text" DEFAULT NULL::"text", "p_client_sync_id" "text" DEFAULT NULL::"text", "p_sync_status" "text" DEFAULT 'synced'::"text", "p_tenant_id" "uuid" DEFAULT NULL::"uuid", "p_calitate" "text" DEFAULT 'cal1'::"text") RETURNS "public"."vanzari"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_cantitate numeric := round(greatest(coalesce(p_cantitate_kg, 0), 0)::numeric, 2);
  v_pret numeric := round(greatest(coalesce(p_pret_lei_kg, 0), 0)::numeric, 2);
  v_vanzare public.vanzari;
  v_calitate text := lower(coalesce(nullif(btrim(coalesce(p_calitate, '')), ''), 'cal1'));
  v_cantitate_cal1 numeric := 0;
  v_cantitate_cal2 numeric := 0;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  select public.current_tenant_id()
  into v_tenant_id;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  if p_tenant_id is not null and p_tenant_id <> v_tenant_id then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));

  if v_cantitate <= 0 then
    raise exception 'Cantitatea trebuie sa fie mai mare decat 0.';
  end if;

  if v_pret <= 0 then
    raise exception 'Pretul trebuie sa fie mai mare decat 0.';
  end if;

  if v_calitate not in ('cal1', 'cal2') then
    raise exception 'Calitatea trebuie sa fie cal1 sau cal2.';
  end if;

  if v_calitate = 'cal1' then
    v_cantitate_cal1 := -v_cantitate;
  else
    v_cantitate_cal2 := -v_cantitate;
  end if;

  if p_client_id is not null then
    perform 1
    from public.clienti c
    where c.id = p_client_id
      and c.tenant_id = v_tenant_id;

    if not found then
      raise exception 'Client invalid pentru tenantul curent.';
    end if;
  end if;

  if p_comanda_id is not null then
    perform 1
    from public.comenzi c
    where c.id = p_comanda_id
      and c.tenant_id = v_tenant_id;

    if not found then
      raise exception 'Comanda invalida pentru tenantul curent.';
    end if;
  end if;

  insert into public.vanzari (
    tenant_id,
    client_sync_id,
    id_vanzare,
    data,
    client_id,
    comanda_id,
    cantitate_kg,
    pret_lei_kg,
    status_plata,
    observatii_ladite,
    sync_status,
    created_by,
    updated_by
  )
  values (
    v_tenant_id,
    coalesce(nullif(btrim(coalesce(p_client_sync_id, '')), ''), gen_random_uuid()::text),
    public.generate_business_id('V'),
    p_data,
    p_client_id,
    p_comanda_id,
    v_cantitate,
    v_pret,
    coalesce(nullif(btrim(coalesce(p_status_plata, '')), ''), 'Platit'),
    nullif(btrim(coalesce(p_observatii_ladite, '')), ''),
    coalesce(nullif(btrim(coalesce(p_sync_status, '')), ''), 'synced'),
    v_user_id,
    v_user_id
  )
  returning *
  into v_vanzare;

  insert into public.miscari_stoc (
    tenant_id,
    tip,
    tip_miscare,
    cantitate_kg,
    cantitate_cal1,
    cantitate_cal2,
    referinta_id,
    data,
    descriere,
    calitate
  )
  values (
    v_tenant_id,
    'vanzare',
    'vanzare',
    v_cantitate,
    v_cantitate_cal1,
    v_cantitate_cal2,
    v_vanzare.id,
    p_data,
    'Scadere stoc la vanzare',
    v_calitate
  );

  return v_vanzare;
end;
$$;


ALTER FUNCTION "public"."create_vanzare_with_stock"("p_data" "date", "p_client_id" "uuid", "p_comanda_id" "uuid", "p_cantitate_kg" numeric, "p_pret_lei_kg" numeric, "p_status_plata" "text", "p_observatii_ladite" "text", "p_client_sync_id" "text", "p_sync_status" "text", "p_tenant_id" "uuid", "p_calitate" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_tenant_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id
  from public.profiles
  where id = auth.uid()
  limit 1;

  return v_tenant_id;
end;
$$;


ALTER FUNCTION "public"."current_tenant_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_comanda_atomic"("p_comanda_id" "uuid", "p_tenant_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_current_tenant_id uuid;
  v_tenant_id uuid;
  v_order public.comenzi;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  select public.current_tenant_id()
  into v_current_tenant_id;

  if v_current_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  if p_tenant_id is not null and p_tenant_id <> v_current_tenant_id then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  v_tenant_id := v_current_tenant_id;

  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));

  select *
  into v_order
  from public.comenzi
  where id = p_comanda_id
    and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Comanda este invalida pentru tenantul curent.';
  end if;

  if v_order.linked_vanzare_id is not null then
    perform public.delete_vanzare_with_stock(v_order.linked_vanzare_id);
  end if;

  delete from public.comenzi
  where id = v_order.id
    and tenant_id = v_tenant_id;
end;
$$;


ALTER FUNCTION "public"."delete_comanda_atomic"("p_comanda_id" "uuid", "p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_demo_for_tenant"("p_tenant_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_user_id uuid := auth.uid();
  v_seed_id uuid;
  v_deleted bigint := 0;
  v_count bigint := 0;
  tbl text;
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  if p_tenant_id is null then
    raise exception 'TENANT_REQUIRED';
  end if;

  if not public.user_can_manage_tenant(p_tenant_id, v_user_id) then
    raise exception 'FORBIDDEN';
  end if;

  select t.demo_seed_id
  into v_seed_id
  from public.tenants t
  where t.id = p_tenant_id
  for update;

  foreach tbl in array array[
    'comenzi',
    'vanzari',
    'vanzari_butasi_items',
    'vanzari_butasi',
    'recoltari',
    'cheltuieli_diverse',
    'activitati_agricole',
    'culegatori',
    'clienti',
    'parcele',
    'investitii',
    'miscari_stoc'
  ] loop
    if to_regclass('public.' || tbl) is not null then
      execute format(
        'with deleted_rows as (
           delete from public.%I
           where tenant_id = $1
             and (
               data_origin = ''demo''
               or ($2 is not null and demo_seed_id = $2)
             )
           returning 1
         )
         select count(*) from deleted_rows',
        tbl
      )
      into v_count
      using p_tenant_id, v_seed_id;

      v_deleted := v_deleted + coalesce(v_count, 0);
    end if;
  end loop;

  update public.tenants
  set
    demo_seeded = false,
    demo_seed_id = null,
    demo_seeded_at = null,
    updated_at = now()
  where id = p_tenant_id;

  return jsonb_build_object(
    'status', 'deleted',
    'tenant_id', p_tenant_id,
    'deleted_rows', v_deleted
  );
end
$_$;


ALTER FUNCTION "public"."delete_demo_for_tenant"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_recoltare_with_stock"("p_recoltare_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_recoltare public.recoltari;
  v_total_stock_after numeric := 0;
  v_total_stock_before numeric := 0;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  select public.current_tenant_id()
  into v_tenant_id;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));

  select *
  into v_recoltare
  from public.recoltari r
  where r.id = p_recoltare_id
    and r.tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Recoltarea este invalida pentru tenantul curent.';
  end if;

  perform 1
  from (
    with affected_buckets as (
      select distinct
        ms.locatie_id,
        ms.produs,
        ms.calitate,
        ms.depozit
      from public.miscari_stoc ms
      where ms.tenant_id = v_tenant_id
        and ms.referinta_id = p_recoltare_id
        and (
          ms.tip = 'recoltare'
          or ms.tip_miscare = 'recoltare'
        )
        and ms.locatie_id is not null
        and ms.produs is not null
        and ms.calitate is not null
        and ms.depozit is not null
    ),
    current_rows as (
      select
        ms.locatie_id,
        ms.produs,
        ms.calitate,
        ms.depozit,
        case
          when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0)
          else coalesce(ms.cantitate_kg, 0)
        end as signed_qty
      from public.miscari_stoc ms
      where ms.tenant_id = v_tenant_id
    ),
    simulated_rows as (
      select
        ms.locatie_id,
        ms.produs,
        ms.calitate,
        ms.depozit,
        case
          when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0)
          else coalesce(ms.cantitate_kg, 0)
        end as signed_qty
      from public.miscari_stoc ms
      where ms.tenant_id = v_tenant_id
        and not (
          ms.referinta_id = p_recoltare_id
          and (
            ms.tip = 'recoltare'
            or ms.tip_miscare = 'recoltare'
          )
        )
    )
    select 1
    from affected_buckets bucket
    left join current_rows current_state
      on current_state.locatie_id = bucket.locatie_id
     and current_state.produs = bucket.produs
     and current_state.calitate = bucket.calitate
     and current_state.depozit = bucket.depozit
    left join simulated_rows row_state
      on row_state.locatie_id = bucket.locatie_id
     and row_state.produs = bucket.produs
     and row_state.calitate = bucket.calitate
     and row_state.depozit = bucket.depozit
    group by bucket.locatie_id, bucket.produs, bucket.calitate, bucket.depozit
    having round(coalesce(sum(row_state.signed_qty), 0)::numeric, 2) < 0
       and round(coalesce(sum(row_state.signed_qty), 0)::numeric, 2) < round(coalesce(sum(current_state.signed_qty), 0)::numeric, 2)
  ) as negative_bucket
  limit 1;

  if found then
    raise exception 'cannot_delete_harvested_stock'
      using hint = 'Stocul ar deveni negativ. Există vânzări care depind de această recoltare.';
  end if;

  select round(coalesce(sum(current_total.signed_qty), 0)::numeric, 2)
  into v_total_stock_before
  from (
    select
      case
        when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0)
        else coalesce(ms.cantitate_kg, 0)
      end as signed_qty
    from public.miscari_stoc ms
    where ms.tenant_id = v_tenant_id
  ) as current_total;

  select round(coalesce(sum(simulated_total.signed_qty), 0)::numeric, 2)
  into v_total_stock_after
  from (
    select
      case
        when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0)
        else coalesce(ms.cantitate_kg, 0)
      end as signed_qty
    from public.miscari_stoc ms
    where ms.tenant_id = v_tenant_id
      and not (
        ms.referinta_id = p_recoltare_id
        and (
          ms.tip = 'recoltare'
          or ms.tip_miscare = 'recoltare'
        )
      )
  ) as simulated_total;

  if v_total_stock_after < 0 and v_total_stock_after < v_total_stock_before then
    raise exception 'cannot_delete_harvested_stock'
      using hint = 'Stocul ar deveni negativ. Există vânzări care depind de această recoltare.';
  end if;

  delete from public.miscari_stoc
  where tenant_id = v_tenant_id
    and referinta_id = p_recoltare_id
    and (
      tip = 'recoltare'
      or tip_miscare = 'recoltare'
    );

  delete from public.recoltari
  where id = p_recoltare_id
    and tenant_id = v_tenant_id;
end;
$$;


ALTER FUNCTION "public"."delete_recoltare_with_stock"("p_recoltare_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_vanzare_with_stock"("p_vanzare_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  select public.current_tenant_id()
  into v_tenant_id;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  delete from public.miscari_stoc ms
  where ms.tenant_id = v_tenant_id
    and ms.referinta_id = p_vanzare_id
    and (
      ms.tip = 'vanzare'
      or ms.tip_miscare = 'vanzare'
    );

  delete from public.vanzari v
  where v.id = p_vanzare_id
    and v.tenant_id = v_tenant_id;
end;
$$;


ALTER FUNCTION "public"."delete_vanzare_with_stock"("p_vanzare_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deliver_order_atomic"("p_order_id" "uuid", "p_delivered_qty" numeric, "p_payment_status" "text" DEFAULT 'Restanta'::"text", "p_remaining_delivery_date" "date" DEFAULT NULL::"date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_order public.comenzi;
  v_sale public.vanzari;
  v_delivered_order public.comenzi;
  v_remaining_order public.comenzi;
  v_sale_observatii text;
  v_delivered_qty numeric := round(greatest(coalesce(p_delivered_qty, 0), 0)::numeric, 2);
  v_current_qty numeric;
  v_remaining_qty numeric;
  v_total_available numeric;
  v_remaining_to_allocate numeric;
  v_take numeric;
  v_deducted_stock numeric := 0;
  v_today date := current_date;
  v_remaining_date date;
  v_bucket record;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  select public.current_tenant_id()
  into v_tenant_id;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));

  select *
  into v_order
  from public.comenzi
  where id = p_order_id
    and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Comanda este invalida pentru tenantul curent.';
  end if;

  v_current_qty := round(coalesce(v_order.cantitate_kg, 0)::numeric, 2);

  if v_delivered_qty <= 0 then
    raise exception 'Cantitatea livrata trebuie sa fie mai mare decat 0.';
  end if;

  if v_delivered_qty > v_current_qty then
    raise exception 'Cantitatea livrata nu poate depasi cantitatea comandata.';
  end if;

  if v_order.status = 'anulata' then
    raise exception 'Comanda anulata nu poate fi livrata.';
  end if;

  if v_order.status = 'livrata' or v_order.linked_vanzare_id is not null then
    raise exception 'Comanda este deja livrata.';
  end if;

  select coalesce(sum(stock_bucket.available_kg), 0)
  into v_total_available
  from (
    select round(
      sum(
        case
          when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0)
          else coalesce(ms.cantitate_kg, 0)
        end
      )::numeric,
      2
    ) as available_kg
    from public.miscari_stoc ms
    where ms.tenant_id = v_tenant_id
      and ms.locatie_id is not null
      and ms.produs is not null
      and ms.calitate is not null
      and ms.depozit is not null
      and ms.tip_miscare is not null
      and ms.cantitate_kg is not null
    group by ms.locatie_id, ms.produs, ms.calitate, ms.depozit
    having sum(
      case
        when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0)
        else coalesce(ms.cantitate_kg, 0)
      end
    ) > 0
  ) as stock_bucket;

  if v_total_available < v_delivered_qty then
    raise exception 'Stoc insuficient pentru livrare.';
  end if;

  v_sale_observatii := concat_ws(' | ', nullif(btrim(coalesce(v_order.observatii, '')), ''), format('Livrare comanda %s', v_order.id));

  insert into public.vanzari (
    tenant_id,
    client_sync_id,
    id_vanzare,
    data,
    client_id,
    comanda_id,
    cantitate_kg,
    pret_lei_kg,
    status_plata,
    observatii_ladite,
    sync_status,
    created_by,
    updated_by
  )
  values (
    v_tenant_id,
    gen_random_uuid()::text,
    public.generate_business_id('V'),
    v_today,
    v_order.client_id,
    v_order.id,
    v_delivered_qty,
    round(coalesce(v_order.pret_per_kg, 0)::numeric, 2),
    coalesce(nullif(btrim(coalesce(p_payment_status, '')), ''), 'Restanta'),
    nullif(btrim(v_sale_observatii), ''),
    'synced',
    v_user_id,
    v_user_id
  )
  returning *
  into v_sale;

  v_remaining_to_allocate := v_delivered_qty;

  for v_bucket in
    select
      ms.locatie_id,
      ms.produs,
      ms.calitate,
      ms.depozit,
      round(
        sum(
          case
            when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0)
            else coalesce(ms.cantitate_kg, 0)
          end
        )::numeric,
        2
      ) as available_kg
    from public.miscari_stoc ms
    where ms.tenant_id = v_tenant_id
      and ms.locatie_id is not null
      and ms.produs is not null
      and ms.calitate is not null
      and ms.depozit is not null
      and ms.tip_miscare is not null
      and ms.cantitate_kg is not null
    group by ms.locatie_id, ms.produs, ms.calitate, ms.depozit
    having sum(
      case
        when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0)
        else coalesce(ms.cantitate_kg, 0)
      end
    ) > 0
    order by available_kg desc
  loop
    exit when v_remaining_to_allocate <= 0;

    v_take := round(least(v_bucket.available_kg, v_remaining_to_allocate)::numeric, 2);
    if v_take <= 0 then
      continue;
    end if;

    insert into public.miscari_stoc (
      tenant_id,
      locatie_id,
      produs,
      calitate,
      depozit,
      tip_miscare,
      cantitate_kg,
      tip,
      cantitate_cal1,
      cantitate_cal2,
      referinta_id,
      data,
      observatii,
      descriere
    )
    values (
      v_tenant_id,
      v_bucket.locatie_id,
      v_bucket.produs,
      v_bucket.calitate,
      v_bucket.depozit,
      'vanzare',
      v_take,
      'vanzare',
      case when v_bucket.calitate = 'cal1' then -v_take else 0 end,
      case when v_bucket.calitate = 'cal2' then -v_take else 0 end,
      v_sale.id,
      v_today,
      'Consum stoc prin livrare comanda',
      'Consum stoc prin livrare comanda'
    );

    v_deducted_stock := round((v_deducted_stock + v_take)::numeric, 2);
    v_remaining_to_allocate := round((v_remaining_to_allocate - v_take)::numeric, 2);
  end loop;

  if v_remaining_to_allocate > 0 then
    raise exception 'Stoc insuficient pentru livrare.';
  end if;

  update public.comenzi
  set status = 'livrata',
      linked_vanzare_id = v_sale.id,
      observatii = concat_ws(
        ' | ',
        nullif(btrim(coalesce(v_order.observatii, '')), ''),
        format('Livrata: %s kg', trim(to_char(v_delivered_qty, 'FM999999990.00')))
      ),
      updated_at = now()
  where id = v_order.id
    and tenant_id = v_tenant_id
  returning *
  into v_delivered_order;

  v_remaining_qty := round((v_current_qty - v_delivered_qty)::numeric, 2);

  if v_remaining_qty > 0 then
    v_remaining_date := coalesce(p_remaining_delivery_date, v_today + 1);

    insert into public.comenzi (
      tenant_id,
      client_id,
      client_nume_manual,
      telefon,
      locatie_livrare,
      data_comanda,
      data_livrare,
      cantitate_kg,
      pret_per_kg,
      total,
      status,
      observatii,
      parent_comanda_id
    )
    values (
      v_tenant_id,
      v_order.client_id,
      v_order.client_nume_manual,
      v_order.telefon,
      v_order.locatie_livrare,
      v_today,
      v_remaining_date,
      v_remaining_qty,
      round(coalesce(v_order.pret_per_kg, 0)::numeric, 2),
      round((v_remaining_qty * coalesce(v_order.pret_per_kg, 0))::numeric, 2),
      case when v_remaining_date > v_today then 'programata' else 'confirmata' end,
      concat_ws(
        ' | ',
        nullif(btrim(coalesce(v_order.observatii, '')), ''),
        format('Rest din comanda %s', v_order.id)
      ),
      v_order.id
    )
    returning *
    into v_remaining_order;
  end if;

  return jsonb_build_object(
    'delivered_order', to_jsonb(v_delivered_order),
    'vanzare', to_jsonb(v_sale),
    'remaining_order', to_jsonb(v_remaining_order),
    'deducted_stock_kg', v_deducted_stock
  );
end;
$$;


ALTER FUNCTION "public"."deliver_order_atomic"("p_order_id" "uuid", "p_delivered_qty" numeric, "p_payment_status" "text", "p_remaining_delivery_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_superadmin_for_plan_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is not null
     and new.plan is distinct from old.plan
     and not public.is_superadmin(auth.uid()) then
    raise exception 'FORBIDDEN_PLAN_UPDATE';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_superadmin_for_plan_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_vanzari_butasi_items_tenant"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  order_tenant uuid;
begin
  select tenant_id
  into order_tenant
  from public.vanzari_butasi
  where id = new.comanda_id;

  if order_tenant is null then
    raise exception 'Comanda invalida sau fara tenant';
  end if;

  if new.tenant_id is null then
    new.tenant_id := order_tenant;
  end if;

  if new.tenant_id <> order_tenant then
    raise exception 'tenant_id din item trebuie sa corespunda comenzii';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_vanzari_butasi_items_tenant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_business_id"("prefix" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  next_val bigint;
  normalized_prefix text;
begin
  normalized_prefix := upper(btrim(coalesce(prefix, '')));

  if normalized_prefix = '' then
    raise exception 'Prefix is required for generate_business_id(prefix).';
  end if;

  select nextval('public.business_id_seq'::regclass) into next_val;

  return normalized_prefix ||
    case
      when next_val < 1000 then lpad(next_val::text, 3, '0')
      else next_val::text
    end;
end;
$$;


ALTER FUNCTION "public"."generate_business_id"("prefix" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_auth_user_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  created_tenant_id uuid;
  farm_name text;
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  farm_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'farm_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), '') || '''s Farm',
    'Ferma mea'
  );

  insert into public.tenants (nume_ferma, owner_user_id)
  values (farm_name, new.id)
  returning id into created_tenant_id;

  update public.profiles
  set tenant_id = created_tenant_id,
      updated_at = now()
  where id = new.id;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_auth_user_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
begin
  insert into public.profiles (id, is_superadmin)
  values (new.id, false)
  on conflict (id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_auth_user_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.tenants (id, nume_ferma, owner_user_id, created_at)
  values (
    new.id,
    'Ferma mea',
    new.id,
    now()
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."integrations_google_contacts_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."integrations_google_contacts_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_superadmin"("check_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = check_user_id
      and coalesce(p.is_superadmin, false) = true
  );
$$;


ALTER FUNCTION "public"."is_superadmin"("check_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_privileged_profile_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin

  if new.tenant_id <> old.tenant_id then
    raise exception 'Changing tenant_id is not allowed';
  end if;

  if new.is_superadmin <> old.is_superadmin then
    raise exception 'Changing is_superadmin is not allowed';
  end if;

  return new;

end;
$$;


ALTER FUNCTION "public"."prevent_privileged_profile_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_profiles_privileged_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if new.tenant_id <> old.tenant_id then
    raise exception 'changing tenant_id is not allowed';
  end if;

  if new.is_superadmin <> old.is_superadmin then
    raise exception 'changing is_superadmin is not allowed';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."protect_profiles_privileged_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recoltari_sync_cantitate_kg"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.kg_cal1 := coalesce(new.kg_cal1, 0);
  new.kg_cal2 := coalesce(new.kg_cal2, 0);
  new.cantitate_kg := coalesce(new.kg_cal1, 0) + coalesce(new.kg_cal2, 0);
  return new;
end;
$$;


ALTER FUNCTION "public"."recoltari_sync_cantitate_kg"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_metrics_daily" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "total_tenants" integer DEFAULT 0 NOT NULL,
    "total_parcele" integer DEFAULT 0 NOT NULL,
    "total_recoltari" integer DEFAULT 0 NOT NULL,
    "total_vanzari" integer DEFAULT 0 NOT NULL,
    "total_kg_cal1" numeric DEFAULT 0 NOT NULL,
    "total_kg_cal2" numeric DEFAULT 0 NOT NULL,
    "total_revenue" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "total_revenue_lei" numeric DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tenant_metrics_daily" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_tenant_metrics_daily"("p_date" "date" DEFAULT CURRENT_DATE) RETURNS "public"."tenant_metrics_daily"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  target_date date := coalesce(p_date, current_date);
  metrics_row public.tenant_metrics_daily;
begin
  if auth.uid() is not null and not public.is_superadmin(auth.uid()) then
    raise exception 'FORBIDDEN';
  end if;

  insert into public.tenant_metrics_daily (
    date,
    total_tenants,
    total_parcele,
    total_recoltari,
    total_vanzari,
    total_kg_cal1,
    total_kg_cal2,
    total_revenue_lei,
    updated_at
  )
  values (
    target_date,
    (
      select count(distinct tenant_id)::int
      from (
        select r.tenant_id from public.recoltari r where r.data = target_date
        union all
        select v.tenant_id from public.vanzari v where v.data = target_date
        union all
        select a.tenant_id from public.activitati_agricole a where a.data_aplicare = target_date
      ) active_tenants
      where tenant_id is not null
    ),
    (
      select count(*)::int
      from public.parcele p
      where p.tenant_id is not null
    ),
    (
      select count(*)::int
      from public.recoltari r
      where r.data = target_date
    ),
    (
      select count(*)::int
      from public.vanzari v
      where v.data = target_date
    ),
    (
      select coalesce(sum(coalesce(r.kg_cal1, 0)), 0)
      from public.recoltari r
      where r.data = target_date
    ),
    (
      select coalesce(sum(coalesce(r.kg_cal2, 0)), 0)
      from public.recoltari r
      where r.data = target_date
    ),
    (
      coalesce((
        select sum(coalesce(v.cantitate_kg, 0) * coalesce(v.pret_lei_kg, 0))
        from public.vanzari v
        where v.data = target_date
      ), 0)
      +
      coalesce((
        select sum(coalesce(vb.cantitate_butasi, 0) * coalesce(vb.pret_unitar_lei, 0))
        from public.vanzari_butasi vb
        where vb.data = target_date
      ), 0)
    ),
    now()
  )
  on conflict (date)
  do update set
    total_tenants = excluded.total_tenants,
    total_parcele = excluded.total_parcele,
    total_recoltari = excluded.total_recoltari,
    total_vanzari = excluded.total_vanzari,
    total_kg_cal1 = excluded.total_kg_cal1,
    total_kg_cal2 = excluded.total_kg_cal2,
    total_revenue_lei = excluded.total_revenue_lei,
    updated_at = now()
  returning * into metrics_row;

  return metrics_row;
end;
$$;


ALTER FUNCTION "public"."refresh_tenant_metrics_daily"("p_date" "date") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comenzi" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "client_nume_manual" "text",
    "telefon" "text",
    "locatie_livrare" "text",
    "data_comanda" "date" DEFAULT CURRENT_DATE NOT NULL,
    "data_livrare" "date" NOT NULL,
    "cantitate_kg" numeric NOT NULL,
    "pret_per_kg" numeric NOT NULL,
    "total" numeric DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'noua'::"text" NOT NULL,
    "observatii" "text",
    "linked_vanzare_id" "uuid",
    "parent_comanda_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "data_origin" "text",
    "demo_seed_id" "uuid",
    "produs_id" "uuid",
    CONSTRAINT "comenzi_cantitate_kg_check" CHECK (("cantitate_kg" > (0)::numeric)),
    CONSTRAINT "comenzi_cantitate_positive_check" CHECK (("cantitate_kg" > (0)::numeric)),
    CONSTRAINT "comenzi_pret_per_kg_check" CHECK (("pret_per_kg" > (0)::numeric)),
    CONSTRAINT "comenzi_pret_positive_check" CHECK (("pret_per_kg" > (0)::numeric)),
    CONSTRAINT "comenzi_status_check" CHECK (("status" = ANY (ARRAY['noua'::"text", 'confirmata'::"text", 'programata'::"text", 'in_livrare'::"text", 'livrata'::"text", 'anulata'::"text"]))),
    CONSTRAINT "comenzi_total_check" CHECK (("total" >= (0)::numeric)),
    CONSTRAINT "comenzi_total_non_negative_check" CHECK (("total" >= (0)::numeric))
);


ALTER TABLE "public"."comenzi" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reopen_comanda_atomic"("p_comanda_id" "uuid", "p_tenant_id" "uuid" DEFAULT NULL::"uuid") RETURNS "public"."comenzi"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_current_tenant_id uuid;
  v_tenant_id uuid;
  v_order public.comenzi;
  v_reopened public.comenzi;
  v_reopen_status public.comanda_status;
  v_blocking_children integer := 0;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  select public.current_tenant_id()
  into v_current_tenant_id;

  if v_current_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  if p_tenant_id is not null and p_tenant_id <> v_current_tenant_id then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  v_tenant_id := v_current_tenant_id;

  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));

  select *
  into v_order
  from public.comenzi
  where id = p_comanda_id
    and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Comanda este invalida pentru tenantul curent.';
  end if;

  if v_order.status <> 'livrata' then
    raise exception 'Doar comenzile livrate pot fi redeschise.';
  end if;

  select count(*)
  into v_blocking_children
  from public.comenzi child_order
  where child_order.tenant_id = v_tenant_id
    and child_order.parent_comanda_id = v_order.id
    and (
      child_order.linked_vanzare_id is not null
      or child_order.status = 'livrata'
    );

  if v_blocking_children > 0 then
    raise exception 'Comanda are livrari ulterioare si nu poate fi redeschisa.';
  end if;

  if v_order.linked_vanzare_id is not null then
    perform public.delete_vanzare_with_stock(v_order.linked_vanzare_id);
  end if;

  delete from public.comenzi child_order
  where child_order.tenant_id = v_tenant_id
    and child_order.parent_comanda_id = v_order.id
    and child_order.linked_vanzare_id is null;

  v_reopen_status := case
    when v_order.data_livrare is not null and v_order.data_livrare > current_date
      then 'programata'::public.comanda_status
    else 'confirmata'::public.comanda_status
  end;

  update public.comenzi
  set status = v_reopen_status,
      linked_vanzare_id = null,
      updated_at = now(),
      observatii = concat_ws(
        ' | ',
        nullif(btrim(coalesce(v_order.observatii, '')), ''),
        'Comanda redeschisa'
      )
  where id = v_order.id
    and tenant_id = v_tenant_id
  returning *
  into v_reopened;

  return v_reopened;
end;
$$;


ALTER FUNCTION "public"."reopen_comanda_atomic"("p_comanda_id" "uuid", "p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_recoltare_stock_identity"("p_parcela_id" "uuid", "p_observatii" "text" DEFAULT NULL::"text", "p_tenant_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_tenant_id uuid := coalesce(p_tenant_id, public.current_tenant_id());
  v_parcela record;
  v_harvest_match text[];
  v_parcel_match text[];
  v_harvest_json jsonb;
  v_parcel_json jsonb;
  v_primary_crop jsonb;
  v_cultura text;
  v_soi text;
begin
  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  select p.tip_fruct, p.cultura, p.soi, p.soi_plantat, p.observatii
  into v_parcela
  from public.parcele p
  where p.id = p_parcela_id
    and p.tenant_id = v_tenant_id;

  if not found then
    raise exception 'Parcela este invalida pentru tenantul curent.';
  end if;

  select regexp_match(
    coalesce(p_observatii, ''),
    '\[zmeurel:harvest-crop\](.*?)\[/zmeurel:harvest-crop\]'
  )
  into v_harvest_match;

  if v_harvest_match is not null and array_length(v_harvest_match, 1) > 0 then
    begin
      v_harvest_json := nullif(btrim(v_harvest_match[1]), '')::jsonb;
    exception
      when others then
        v_harvest_json := null;
    end;
  end if;

  select regexp_match(
    coalesce(v_parcela.observatii, ''),
    '\[zmeurel:parcel-crops\](.*?)\[/zmeurel:parcel-crops\]'
  )
  into v_parcel_match;

  if v_parcel_match is not null and array_length(v_parcel_match, 1) > 0 then
    begin
      v_parcel_json := nullif(btrim(v_parcel_match[1]), '')::jsonb;
    exception
      when others then
        v_parcel_json := null;
    end;
  end if;

  if v_parcel_json is not null
     and jsonb_typeof(v_parcel_json) = 'array'
     and jsonb_array_length(v_parcel_json) > 0 then
    v_primary_crop := v_parcel_json -> 0;
  end if;

  v_cultura := nullif(
    btrim(
      coalesce(
        v_harvest_json ->> 'culture',
        v_primary_crop ->> 'culture',
        v_parcela.cultura,
        v_parcela.tip_fruct,
        ''
      )
    ),
    ''
  );

  v_soi := nullif(
    btrim(
      coalesce(
        v_harvest_json ->> 'variety',
        v_primary_crop ->> 'variety',
        v_parcela.soi,
        v_parcela.soi_plantat,
        ''
      )
    ),
    ''
  );

  return jsonb_build_object(
    'produs', coalesce(v_cultura, 'produs-necunoscut'),
    'cultura', v_cultura,
    'soi', v_soi
  );
end;
$$;


ALTER FUNCTION "public"."resolve_recoltare_stock_identity"("p_parcela_id" "uuid", "p_observatii" "text", "p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_demo_for_tenant"("p_tenant_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.seed_demo_for_tenant(p_tenant_id, 'berries');
$$;


ALTER FUNCTION "public"."seed_demo_for_tenant"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_demo_for_tenant"("p_tenant_id" "uuid", "p_demo_type" "text" DEFAULT 'berries'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_owner uuid;
  v_seed_id uuid;
  v_seeded boolean := false;
  v_code text;
  v_demo_type text := lower(coalesce(nullif(trim(p_demo_type), ''), 'berries'));
  v_fixture_tag text := '[DEMO_FIXTURE_V2]';

  v_client_1 uuid;
  v_client_2 uuid;
  v_client_3 uuid;
  v_parcela_1 uuid;
  v_parcela_2 uuid;
  v_cultura_1 uuid;
  v_cultura_2 uuid;
  v_culegator_1 uuid;
  v_culegator_2 uuid;

  d_today date := current_date;
begin
  if p_tenant_id is null then
    raise exception 'TENANT_REQUIRED';
  end if;

  if v_demo_type not in ('berries', 'solar') then
    raise exception 'INVALID_DEMO_TYPE';
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
      'demo_seed_id', v_seed_id,
      'demo_type', v_demo_type
    );
  end if;

  if public.tenant_has_core_data(p_tenant_id) then
    return jsonb_build_object(
      'status', 'skipped_existing_data',
      'tenant_id', p_tenant_id,
      'demo_type', v_demo_type
    );
  end if;

  v_seed_id := gen_random_uuid();
  v_code := upper(substr(replace(v_seed_id::text, '-', ''), 1, 6));

  if to_regclass('public.parcele') is not null then
    if v_demo_type = 'solar' then
      insert into public.parcele (
        tenant_id, id_parcela, nume_parcela, tip_fruct, soi_plantat, suprafata_m2, nr_plante, an_plantare, status, observatii,
        tip_unitate, cultura, soi, nr_randuri, distanta_intre_randuri, sistem_irigare, data_plantarii,
        data_origin, demo_seed_id
      )
      values
        (
          p_tenant_id, 'DEMO-PAR-' || v_code || '-01', 'Solar 1 - Rosii', 'Legume', 'Siriana F1', 420, 680, extract(year from d_today)::int, 'Activ',
          v_fixture_tag || ' Solar demo rosii',
          'solar', 'Rosii', 'Siriana F1', 8, 0.8, 'picurare', d_today - 32,
          'demo', v_seed_id
        ),
        (
          p_tenant_id, 'DEMO-PAR-' || v_code || '-02', 'Solar 2 - Castraveti', 'Legume', 'Cornichon F1', 380, 620, extract(year from d_today)::int, 'Activ',
          v_fixture_tag || ' Solar demo castraveti',
          'solar', 'Castraveti', 'Cornichon F1', 7, 0.9, 'picurare', d_today - 24,
          'demo', v_seed_id
        );
    else
      insert into public.parcele (
        tenant_id, id_parcela, nume_parcela, tip_fruct, soi_plantat, suprafata_m2, nr_plante, an_plantare, status, observatii,
        tip_unitate, cultura, soi, nr_randuri, distanta_intre_randuri, sistem_irigare, data_plantarii,
        data_origin, demo_seed_id
      )
      values
        (
          p_tenant_id, 'DEMO-PAR-' || v_code || '-01', 'Zmeura Delniwa', 'Zmeura', 'Delniwa', 1200, 920, 2023, 'Activ',
          v_fixture_tag || ' Parcela demo Delniwa',
          'camp', null, null, null, null, null, null,
          'demo', v_seed_id
        ),
        (
          p_tenant_id, 'DEMO-PAR-' || v_code || '-02', 'Zmeura Maravilla', 'Zmeura', 'Maravilla', 1350, 1050, 2022, 'Activ',
          v_fixture_tag || ' Parcela demo Maravilla',
          'camp', null, null, null, null, null, null,
          'demo', v_seed_id
        );
    end if;

    select id into v_parcela_1
    from public.parcele
    where tenant_id = p_tenant_id and demo_seed_id = v_seed_id
    order by created_at asc limit 1;

    select id into v_parcela_2
    from public.parcele
    where tenant_id = p_tenant_id and demo_seed_id = v_seed_id
    order by created_at asc offset 1 limit 1;
  end if;

  -- Creare culturi pentru demo solar
  if v_demo_type = 'solar' and to_regclass('public.culturi') is not null
     and v_parcela_1 is not null and v_parcela_2 is not null then
    insert into public.culturi (
      tenant_id, solar_id, tip_planta, soi, nr_plante, nr_randuri, distanta_intre_randuri,
      sistem_irigare, data_plantarii, stadiu, activa,
      data_origin, demo_seed_id
    ) values
      (p_tenant_id, v_parcela_1, 'Roșii', 'Siriana F1', 680, 8, 0.8, 'picurare', d_today - 32, 'inflorire', true, 'demo', v_seed_id),
      (p_tenant_id, v_parcela_2, 'Castraveți', 'Cornichon F1', 620, 7, 0.9, 'picurare', d_today - 24, 'crestere', true, 'demo', v_seed_id);

    select id into v_cultura_1
    from public.culturi
    where tenant_id = p_tenant_id and demo_seed_id = v_seed_id
    order by created_at asc limit 1;

    select id into v_cultura_2
    from public.culturi
    where tenant_id = p_tenant_id and demo_seed_id = v_seed_id
    order by created_at asc offset 1 limit 1;
  end if;

  if to_regclass('public.culegatori') is not null then
    insert into public.culegatori (
      tenant_id, id_culegator, nume_prenume, tarif_lei_kg, data_angajare, status_activ, telefon, tip_angajare, observatii,
      data_origin, demo_seed_id
    ) values
      (p_tenant_id, 'DEMO-CUL-' || v_code || '-01', 'Ion Popescu', 5.25, d_today - interval '120 day', true, '0745001100', 'Sezonier', v_fixture_tag || ' Culegator demo', 'demo', v_seed_id),
      (p_tenant_id, 'DEMO-CUL-' || v_code || '-02', 'Maria Ionescu', 5.00, d_today - interval '95 day', true, '0745002200', 'Sezonier', v_fixture_tag || ' Culegator demo', 'demo', v_seed_id);

    select id into v_culegator_1
    from public.culegatori
    where tenant_id = p_tenant_id and demo_seed_id = v_seed_id
    order by created_at asc limit 1;

    select id into v_culegator_2
    from public.culegatori
    where tenant_id = p_tenant_id and demo_seed_id = v_seed_id
    order by created_at asc offset 1 limit 1;
  end if;

  if to_regclass('public.clienti') is not null then
    if v_demo_type = 'solar' then
      insert into public.clienti (tenant_id, id_client, nume_client, telefon, email, adresa, pret_negociat_lei_kg, observatii, data_origin, demo_seed_id) values
        (p_tenant_id, 'DEMO-CLI-' || v_code || '-01', 'Bistro Verde', '0740100200', 'bistro@example.ro', 'Suceava', 16, v_fixture_tag || ' Client demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-CLI-' || v_code || '-02', 'Magazin de proximitate', '0740300400', 'magazin@example.ro', 'Radauti', 14, v_fixture_tag || ' Client demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-CLI-' || v_code || '-03', 'Piata Centrala', '0740500600', 'piata@example.ro', 'Suceava', 13, v_fixture_tag || ' Client demo', 'demo', v_seed_id);
    else
      insert into public.clienti (tenant_id, id_client, nume_client, telefon, email, adresa, pret_negociat_lei_kg, observatii, data_origin, demo_seed_id) values
        (p_tenant_id, 'DEMO-CLI-' || v_code || '-01', 'Cofetaria Sweet', '0740100200', 'sweet@example.ro', 'Suceava', 25, v_fixture_tag || ' Client demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-CLI-' || v_code || '-02', 'Magazin Local', '0740300400', 'magazin@example.ro', 'Radauti', 23, v_fixture_tag || ' Client demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-CLI-' || v_code || '-03', 'Client Piata', '0740500600', 'piata@example.ro', 'Piata Centrala', 22, v_fixture_tag || ' Client demo', 'demo', v_seed_id);
    end if;

    select id into v_client_1
    from public.clienti
    where tenant_id = p_tenant_id and demo_seed_id = v_seed_id
    order by created_at asc limit 1;

    select id into v_client_2
    from public.clienti
    where tenant_id = p_tenant_id and demo_seed_id = v_seed_id
    order by created_at asc offset 1 limit 1;

    select id into v_client_3
    from public.clienti
    where tenant_id = p_tenant_id and demo_seed_id = v_seed_id
    order by created_at asc offset 2 limit 1;
  end if;

  if to_regclass('public.activitati_agricole') is not null then
    if v_demo_type = 'solar' then
      insert into public.activitati_agricole (
        tenant_id, id_activitate, data_aplicare, parcela_id, cultura_id, tip_activitate, produs_utilizat, doza, timp_pauza_zile, operator, observatii,
        data_origin, demo_seed_id
      ) values
        (p_tenant_id, 'DEMO-ACT-' || v_code || '-01', d_today - interval '2 day', v_parcela_1, v_cultura_1, 'copilit', 'lucrare manuala', '-', 0, 'Operator solar', v_fixture_tag || ' Activitate solar demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-ACT-' || v_code || '-02', d_today - interval '1 day', v_parcela_2, v_cultura_2, 'palisat', 'sfoara palisare', '-', 0, 'Operator solar', v_fixture_tag || ' Activitate solar demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-ACT-' || v_code || '-03', d_today, v_parcela_1, v_cultura_1, 'fertigare', 'NPK 20-20-20', '2 kg/1000l', 0, 'Operator solar', v_fixture_tag || ' Activitate solar demo', 'demo', v_seed_id);
    else
      insert into public.activitati_agricole (
        tenant_id, id_activitate, data_aplicare, parcela_id, tip_activitate, produs_utilizat, doza, timp_pauza_zile, operator, observatii,
        data_origin, demo_seed_id
      ) values
        (p_tenant_id, 'DEMO-ACT-' || v_code || '-01', d_today - interval '4 day', v_parcela_1, 'tratament', 'fungicid', '2 l/ha', 3, 'Operator camp', v_fixture_tag || ' Activitate camp demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-ACT-' || v_code || '-02', d_today - interval '2 day', v_parcela_2, 'taieri', 'manual', '-', 0, 'Operator camp', v_fixture_tag || ' Activitate camp demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-ACT-' || v_code || '-03', d_today - interval '1 day', v_parcela_1, 'legat', 'sfoara', '-', 0, 'Operator camp', v_fixture_tag || ' Activitate camp demo', 'demo', v_seed_id);
    end if;
  end if;

  if to_regclass('public.recoltari') is not null then
    if v_demo_type = 'solar' then
      insert into public.recoltari (
        tenant_id, id_recoltare, data, parcela_id, cultura_id, culegator_id, kg_cal1, kg_cal2, cantitate_kg, pret_lei_pe_kg_snapshot, valoare_munca_lei, observatii,
        data_origin, demo_seed_id
      ) values
        (p_tenant_id, 'DEMO-REC-' || v_code || '-01', d_today, v_parcela_1, v_cultura_1, v_culegator_1, 62, 8, 70, 5.25, 367.5, v_fixture_tag || ' Recoltare solar demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-REC-' || v_code || '-02', d_today, v_parcela_2, v_cultura_2, v_culegator_2, 48, 6, 54, 5.00, 270, v_fixture_tag || ' Recoltare solar demo', 'demo', v_seed_id);
    else
      insert into public.recoltari (
        tenant_id, id_recoltare, data, parcela_id, culegator_id, kg_cal1, kg_cal2, cantitate_kg, pret_lei_pe_kg_snapshot, valoare_munca_lei, observatii,
        data_origin, demo_seed_id
      ) values
        (p_tenant_id, 'DEMO-REC-' || v_code || '-01', d_today, v_parcela_1, v_culegator_1, 35, 5, 40, 5.25, 210, v_fixture_tag || ' Recoltare camp demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-REC-' || v_code || '-02', d_today, v_parcela_2, v_culegator_2, 28, 4, 32, 5.00, 160, v_fixture_tag || ' Recoltare camp demo', 'demo', v_seed_id);
    end if;
  end if;

  if to_regclass('public.cheltuieli_diverse') is not null then
    if v_demo_type = 'solar' then
      insert into public.cheltuieli_diverse (tenant_id, id_cheltuiala, data, categorie, descriere, suma_lei, furnizor, data_origin, demo_seed_id) values
        (p_tenant_id, 'DEMO-CH-' || v_code || '-01', d_today, 'ingrasamant', v_fixture_tag || ' Nutrienti fertigare', 250, 'Agro Input', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-CH-' || v_code || '-02', d_today - interval '1 day', 'energie', v_fixture_tag || ' Consum ventilatie', 135, 'Furnizor Energie', 'demo', v_seed_id);
    else
      insert into public.cheltuieli_diverse (tenant_id, id_cheltuiala, data, categorie, descriere, suma_lei, furnizor, data_origin, demo_seed_id) values
        (p_tenant_id, 'DEMO-CH-' || v_code || '-01', d_today, 'motorina', v_fixture_tag || ' Alimentare utilaj', 120, 'Statie carburant', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-CH-' || v_code || '-02', d_today - interval '1 day', 'ambalaje', v_fixture_tag || ' Ladite recoltare', 85, 'Depozit ambalaje', 'demo', v_seed_id);
    end if;
  end if;

  if to_regclass('public.vanzari') is not null then
    if v_demo_type = 'solar' then
      insert into public.vanzari (tenant_id, id_vanzare, data, client_id, cantitate_kg, pret_lei_kg, status_plata, observatii_ladite, data_origin, demo_seed_id) values
        (p_tenant_id, 'DEMO-VNZ-' || v_code || '-01', d_today, v_client_1, 18, 16, 'incasat', v_fixture_tag || ' Vanzare solar demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-VNZ-' || v_code || '-02', d_today, v_client_2, 22, 14, 'incasat', v_fixture_tag || ' Vanzare solar demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-VNZ-' || v_code || '-03', d_today - interval '1 day', v_client_3, 16, 13, 'incasat', v_fixture_tag || ' Vanzare solar demo', 'demo', v_seed_id);
    else
      insert into public.vanzari (tenant_id, id_vanzare, data, client_id, cantitate_kg, pret_lei_kg, status_plata, observatii_ladite, data_origin, demo_seed_id) values
        (p_tenant_id, 'DEMO-VNZ-' || v_code || '-01', d_today, v_client_1, 12, 25, 'incasat', v_fixture_tag || ' Vanzare berries demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-VNZ-' || v_code || '-02', d_today, v_client_2, 8, 23, 'incasat', v_fixture_tag || ' Vanzare berries demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-VNZ-' || v_code || '-03', d_today - interval '1 day', v_client_3, 10, 22, 'incasat', v_fixture_tag || ' Vanzare berries demo', 'demo', v_seed_id);
    end if;
  end if;

  if to_regclass('public.comenzi') is not null then
    if v_demo_type = 'solar' then
      insert into public.comenzi (tenant_id, client_id, client_nume_manual, telefon, locatie_livrare, data_comanda, data_livrare, cantitate_kg, pret_per_kg, total, status, observatii, data_origin, demo_seed_id) values
        (p_tenant_id, v_client_1, null, '0740100200', 'Suceava', d_today, d_today, 15, 16, 240, 'programata', v_fixture_tag || ' Comanda solar demo', 'demo', v_seed_id),
        (p_tenant_id, v_client_2, null, '0740300400', 'Radauti', d_today, d_today + 1, 20, 14, 280, 'noua', v_fixture_tag || ' Comanda solar demo', 'demo', v_seed_id);
    else
      insert into public.comenzi (tenant_id, client_id, client_nume_manual, telefon, locatie_livrare, data_comanda, data_livrare, cantitate_kg, pret_per_kg, total, status, observatii, data_origin, demo_seed_id) values
        (p_tenant_id, v_client_1, null, '0740100200', 'Suceava', d_today, d_today, 10, 25, 250, 'programata', v_fixture_tag || ' Comanda berries demo', 'demo', v_seed_id),
        (p_tenant_id, v_client_2, null, '0740300400', 'Radauti', d_today, d_today + 1, 14, 23, 322, 'noua', v_fixture_tag || ' Comanda berries demo', 'demo', v_seed_id);
    end if;
  end if;

  if v_demo_type = 'solar' and to_regclass('public.solar_climate_logs') is not null then
    insert into public.solar_climate_logs (tenant_id, unitate_id, temperatura, umiditate, observatii, created_at, data_origin, demo_seed_id) values
      (p_tenant_id, v_parcela_1, 25.4, 67, v_fixture_tag || ' Climat solar 1', now() - interval '6 hour', 'demo', v_seed_id),
      (p_tenant_id, v_parcela_1, 27.1, 63, v_fixture_tag || ' Climat solar 1', now() - interval '2 hour', 'demo', v_seed_id),
      (p_tenant_id, v_parcela_2, 24.2, 71, v_fixture_tag || ' Climat solar 2', now() - interval '5 hour', 'demo', v_seed_id),
      (p_tenant_id, v_parcela_2, 26.3, 66, v_fixture_tag || ' Climat solar 2', now() - interval '1 hour', 'demo', v_seed_id);
  end if;

  if v_demo_type = 'solar' and to_regclass('public.culture_stage_logs') is not null then
    insert into public.culture_stage_logs (tenant_id, unitate_id, cultura_id, etapa, data, observatii, created_at, data_origin, demo_seed_id) values
      (p_tenant_id, v_parcela_1, v_cultura_1, 'plantare', d_today - 32, v_fixture_tag || ' Etapa solar', now() - interval '30 day', 'demo', v_seed_id),
      (p_tenant_id, v_parcela_1, v_cultura_1, 'primele flori', d_today - 14, v_fixture_tag || ' Etapa solar', now() - interval '12 day', 'demo', v_seed_id),
      (p_tenant_id, v_parcela_2, v_cultura_2, 'plantare', d_today - 24, v_fixture_tag || ' Etapa solar', now() - interval '22 day', 'demo', v_seed_id),
      (p_tenant_id, v_parcela_2, v_cultura_2, 'primele flori', d_today - 10, v_fixture_tag || ' Etapa solar', now() - interval '8 day', 'demo', v_seed_id);
  end if;

  update public.tenants
  set demo_seeded = true, demo_seed_id = v_seed_id, demo_seeded_at = now(), updated_at = now()
  where id = p_tenant_id;

  return jsonb_build_object(
    'status', 'seeded',
    'tenant_id', p_tenant_id,
    'demo_seed_id', v_seed_id,
    'demo_type', v_demo_type
  );
end
$$;


ALTER FUNCTION "public"."seed_demo_for_tenant"("p_tenant_id" "uuid", "p_demo_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_analytics_event_context"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Neautorizat';
  end if;

  if new.user_id is null then
    new.user_id := auth.uid();
  end if;

  if new.tenant_id is null then
    new.tenant_id := public.current_tenant_id();
  end if;

  if new.event_data is null then
    new.event_data := '{}'::jsonb;
  end if;

  if new.created_at is null then
    new.created_at := now();
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."set_analytics_event_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_audit_fields_minimal"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, now());
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.updated_by := coalesce(auth.uid(), new.updated_by, new.created_by);
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := coalesce(auth.uid(), old.updated_by, old.created_by);
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."set_audit_fields_minimal"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_comenzi_tenant_and_audit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  resolved_tenant uuid;
begin
  if tg_op = 'INSERT' then
    if new.tenant_id is null then
      select t.id
      into resolved_tenant
      from public.tenants t
      where t.owner_user_id = auth.uid()
      limit 1;

      new.tenant_id := resolved_tenant;
    end if;

    new.created_at := coalesce(new.created_at, now());
  end if;

  new.updated_at := now();
  new.total := round((coalesce(new.cantitate_kg, 0) * coalesce(new.pret_per_kg, 0))::numeric, 2);
  return new;
end;
$$;


ALTER FUNCTION "public"."set_comenzi_tenant_and_audit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_culturi_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_culturi_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_sync_audit_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.client_sync_id is null then
    new.client_sync_id := gen_random_uuid();
  end if;

  if new.sync_status is null then
    new.sync_status := 'synced';
  end if;

  if tg_op = 'INSERT' then
    if new.created_by is null then
      new.created_by := auth.uid();
    end if;
    if new.updated_by is null then
      new.updated_by := coalesce(auth.uid(), new.created_by);
    end if;
  else
    new.updated_by := coalesce(auth.uid(), new.updated_by);
  end if;

  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_sync_audit_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_tenant_id_from_owner"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.tenant_id is not null then
    return new;
  end if;

  select tenant_id
  into new.tenant_id
  from profiles
  where id = auth.uid();

  return new;
end;
$$;


ALTER FUNCTION "public"."set_tenant_id_from_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at_profiles"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at_profiles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_vanzari_butasi_tenant_and_public_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  resolved_tenant uuid;
  next_number bigint;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  if new.tenant_id is null then
    select t.id
    into resolved_tenant
    from public.tenants t
    where t.owner_user_id = auth.uid()
    limit 1;

    new.tenant_id := resolved_tenant;
  end if;

  if new.tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  if new.id_vanzare_butasi is null or btrim(new.id_vanzare_butasi) = '' then
    -- Serialize per-tenant ID generation to avoid race conditions.
    perform 1
    from public.tenants t
    where t.id = new.tenant_id
    for update;

    select
      coalesce(
        max(
          case
            when vb.id_vanzare_butasi ~ '^VB[0-9]+$'
              then substring(vb.id_vanzare_butasi from 3)::bigint
            else null
          end
        ),
        0
      ) + 1
    into next_number
    from public.vanzari_butasi vb
    where vb.tenant_id = new.tenant_id;

    new.id_vanzare_butasi := 'VB' || lpad(next_number::text, 3, '0');
  end if;

  return new;
end;
$_$;


ALTER FUNCTION "public"."set_vanzari_butasi_tenant_and_public_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_recoltare_stock_movements"("p_recoltare_id" "uuid", "p_tenant_id" "uuid", "p_parcela_id" "uuid", "p_data" "date", "p_kg_cal1" numeric DEFAULT 0, "p_kg_cal2" numeric DEFAULT 0, "p_observatii" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_identity jsonb;
  v_produs text;
  v_kg_cal1 numeric := round(greatest(coalesce(p_kg_cal1, 0), 0)::numeric, 2);
  v_kg_cal2 numeric := round(greatest(coalesce(p_kg_cal2, 0), 0)::numeric, 2);
begin
  delete from public.miscari_stoc
  where tenant_id = p_tenant_id
    and referinta_id = p_recoltare_id
    and (
      tip = 'recoltare'
      or tip_miscare = 'recoltare'
    );

  if p_parcela_id is null then
    return;
  end if;

  v_identity := public.resolve_recoltare_stock_identity(p_parcela_id, p_observatii, p_tenant_id);
  v_produs := coalesce(nullif(btrim(v_identity ->> 'produs'), ''), 'produs-necunoscut');

  if v_kg_cal1 > 0 then
    insert into public.miscari_stoc (
      tenant_id,
      locatie_id,
      produs,
      calitate,
      depozit,
      tip_miscare,
      cantitate_kg,
      tip,
      cantitate_cal1,
      cantitate_cal2,
      referinta_id,
      data
    )
    values (
      p_tenant_id,
      p_parcela_id,
      v_produs,
      'cal1',
      'fresh',
      'recoltare',
      v_kg_cal1,
      'recoltare',
      v_kg_cal1,
      0,
      p_recoltare_id,
      p_data
    );
  end if;

  if v_kg_cal2 > 0 then
    insert into public.miscari_stoc (
      tenant_id,
      locatie_id,
      produs,
      calitate,
      depozit,
      tip_miscare,
      cantitate_kg,
      tip,
      cantitate_cal1,
      cantitate_cal2,
      referinta_id,
      data
    )
    values (
      p_tenant_id,
      p_parcela_id,
      v_produs,
      'cal2',
      'fresh',
      'recoltare',
      v_kg_cal2,
      'recoltare',
      0,
      v_kg_cal2,
      p_recoltare_id,
      p_data
    );
  end if;
end;
$$;


ALTER FUNCTION "public"."sync_recoltare_stock_movements"("p_recoltare_id" "uuid", "p_tenant_id" "uuid", "p_parcela_id" "uuid", "p_data" "date", "p_kg_cal1" numeric, "p_kg_cal2" numeric, "p_observatii" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tenant_has_core_data"("p_tenant_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  tbl text;
  v_has boolean;
begin
  foreach tbl in array array[
    'parcele',
    'activitati_agricole',
    'recoltari',
    'cheltuieli_diverse',
    'vanzari',
    'vanzari_butasi',
    'comenzi',
    'clienti',
    'culegatori',
    'investitii'
  ] loop
    if to_regclass('public.' || tbl) is not null then
      execute format(
        'select exists(select 1 from public.%I where tenant_id = $1)',
        tbl
      )
      into v_has
      using p_tenant_id;

      if coalesce(v_has, false) then
        return true;
      end if;
    end if;
  end loop;

  return false;
end
$_$;


ALTER FUNCTION "public"."tenant_has_core_data"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_my_farm_name"("p_farm_name" "text") RETURNS TABLE("tenant_id" "uuid", "farm_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(coalesce(p_farm_name, ''));
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'INVALID_FARM_NAME';
  end if;

  return query
  update public.tenants t
  set
    nume_ferma = v_name,
    updated_at = now()
  where t.owner_user_id = v_user_id
  returning t.id, t.nume_ferma;

  if not found then
    raise exception 'TENANT_NOT_FOUND';
  end if;
end
$$;


ALTER FUNCTION "public"."update_my_farm_name"("p_farm_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_recoltare_with_stock"("p_recoltare_id" "uuid", "p_data" "date", "p_parcela_id" "uuid", "p_culegator_id" "uuid", "p_kg_cal1" numeric DEFAULT 0, "p_kg_cal2" numeric DEFAULT 0, "p_observatii" "text" DEFAULT NULL::"text") RETURNS "public"."recoltari"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_tarif numeric;
  v_kg_cal1 numeric := round(greatest(coalesce(p_kg_cal1, 0), 0)::numeric, 2);
  v_kg_cal2 numeric := round(greatest(coalesce(p_kg_cal2, 0), 0)::numeric, 2);
  v_total_kg numeric := round((greatest(coalesce(p_kg_cal1, 0), 0) + greatest(coalesce(p_kg_cal2, 0), 0))::numeric, 2);
  v_valoare_munca numeric;
  v_recoltare public.recoltari;
  v_current_recoltare public.recoltari;
  v_new_identity jsonb;
  v_new_produs text;
  v_total_stock_after numeric := 0;
  v_total_stock_before numeric := 0;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  select public.current_tenant_id()
  into v_tenant_id;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));

  select *
  into v_current_recoltare
  from public.recoltari r
  where r.id = p_recoltare_id
    and r.tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Recoltarea este invalida pentru tenantul curent.';
  end if;

  perform 1
  from public.parcele p
  where p.id = p_parcela_id
    and p.tenant_id = v_tenant_id;

  if not found then
    raise exception 'Parcela este invalida pentru tenantul curent.';
  end if;

  select c.tarif_lei_kg
  into v_tarif
  from public.culegatori c
  where c.id = p_culegator_id
    and c.tenant_id = v_tenant_id;

  if v_tarif is null or v_tarif <= 0 then
    raise exception 'Culegatorul nu are tarif setat in profil';
  end if;

  v_new_identity := public.resolve_recoltare_stock_identity(p_parcela_id, p_observatii, v_tenant_id);
  v_new_produs := coalesce(nullif(btrim(v_new_identity ->> 'produs'), ''), 'produs-necunoscut');

  perform 1
  from (
    with affected_buckets as (
      select distinct bucket.locatie_id, bucket.produs, bucket.calitate, bucket.depozit
      from (
        select
          ms.locatie_id,
          ms.produs,
          ms.calitate,
          ms.depozit
        from public.miscari_stoc ms
        where ms.tenant_id = v_tenant_id
          and ms.referinta_id = p_recoltare_id
          and (
            ms.tip = 'recoltare'
            or ms.tip_miscare = 'recoltare'
          )
          and ms.locatie_id is not null
          and ms.produs is not null
          and ms.calitate is not null
          and ms.depozit is not null
        union all
        select p_parcela_id, v_new_produs, 'cal1', 'fresh'
        where v_kg_cal1 > 0
        union all
        select p_parcela_id, v_new_produs, 'cal2', 'fresh'
        where v_kg_cal2 > 0
      ) as bucket
    ),
    current_rows as (
      select
        ms.locatie_id,
        ms.produs,
        ms.calitate,
        ms.depozit,
        case
          when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0)
          else coalesce(ms.cantitate_kg, 0)
        end as signed_qty
      from public.miscari_stoc ms
      where ms.tenant_id = v_tenant_id
    ),
    simulated_rows as (
      select
        ms.locatie_id,
        ms.produs,
        ms.calitate,
        ms.depozit,
        case
          when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0)
          else coalesce(ms.cantitate_kg, 0)
        end as signed_qty
      from public.miscari_stoc ms
      where ms.tenant_id = v_tenant_id
        and not (
          ms.referinta_id = p_recoltare_id
          and (
            ms.tip = 'recoltare'
            or ms.tip_miscare = 'recoltare'
          )
        )
      union all
      select p_parcela_id, v_new_produs, 'cal1', 'fresh', v_kg_cal1
      where v_kg_cal1 > 0
      union all
      select p_parcela_id, v_new_produs, 'cal2', 'fresh', v_kg_cal2
      where v_kg_cal2 > 0
    )
    select 1
    from affected_buckets bucket
    left join current_rows current_state
      on current_state.locatie_id = bucket.locatie_id
     and current_state.produs = bucket.produs
     and current_state.calitate = bucket.calitate
     and current_state.depozit = bucket.depozit
    left join simulated_rows row_state
      on row_state.locatie_id = bucket.locatie_id
     and row_state.produs = bucket.produs
     and row_state.calitate = bucket.calitate
     and row_state.depozit = bucket.depozit
    group by bucket.locatie_id, bucket.produs, bucket.calitate, bucket.depozit
    having round(coalesce(sum(row_state.signed_qty), 0)::numeric, 2) < 0
       and round(coalesce(sum(row_state.signed_qty), 0)::numeric, 2) < round(coalesce(sum(current_state.signed_qty), 0)::numeric, 2)
  ) as negative_bucket
  limit 1;

  if found then
    raise exception 'insufficient_stock_after_edit'
      using hint = 'Stocul ar deveni negativ după editare. Există vânzări care depind de această recoltare.';
  end if;

  select round(coalesce(sum(current_total.signed_qty), 0)::numeric, 2)
  into v_total_stock_before
  from (
    select
      case
        when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0)
        else coalesce(ms.cantitate_kg, 0)
      end as signed_qty
    from public.miscari_stoc ms
    where ms.tenant_id = v_tenant_id
  ) as current_total;

  select round(coalesce(sum(simulated_total.signed_qty), 0)::numeric, 2)
  into v_total_stock_after
  from (
    select
      case
        when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0)
        else coalesce(ms.cantitate_kg, 0)
      end as signed_qty
    from public.miscari_stoc ms
    where ms.tenant_id = v_tenant_id
      and not (
        ms.referinta_id = p_recoltare_id
        and (
          ms.tip = 'recoltare'
          or ms.tip_miscare = 'recoltare'
        )
      )
    union all
    select v_kg_cal1
    where v_kg_cal1 > 0
    union all
    select v_kg_cal2
    where v_kg_cal2 > 0
  ) as simulated_total;

  if v_total_stock_after < 0 and v_total_stock_after < v_total_stock_before then
    raise exception 'insufficient_stock_after_edit'
      using hint = 'Stocul ar deveni negativ după editare. Există vânzări care depind de această recoltare.';
  end if;

  v_valoare_munca := round((v_total_kg * v_tarif)::numeric, 2);

  update public.recoltari
  set data = p_data,
      parcela_id = p_parcela_id,
      culegator_id = p_culegator_id,
      kg_cal1 = v_kg_cal1,
      kg_cal2 = v_kg_cal2,
      pret_lei_pe_kg_snapshot = round(v_tarif::numeric, 2),
      valoare_munca_lei = v_valoare_munca,
      observatii = nullif(btrim(coalesce(p_observatii, '')), ''),
      updated_at = now()
  where id = p_recoltare_id
    and tenant_id = v_tenant_id
  returning *
  into v_recoltare;

  perform public.sync_recoltare_stock_movements(
    v_recoltare.id,
    v_tenant_id,
    p_parcela_id,
    p_data,
    v_kg_cal1,
    v_kg_cal2,
    v_recoltare.observatii
  );

  return v_recoltare;
end;
$$;


ALTER FUNCTION "public"."update_recoltare_with_stock"("p_recoltare_id" "uuid", "p_data" "date", "p_parcela_id" "uuid", "p_culegator_id" "uuid", "p_kg_cal1" numeric, "p_kg_cal2" numeric, "p_observatii" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_vanzare_with_stock"("p_vanzare_id" "uuid", "p_data" "date" DEFAULT NULL::"date", "p_client_id" "uuid" DEFAULT NULL::"uuid", "p_cantitate_kg" numeric DEFAULT NULL::numeric, "p_pret_lei_kg" numeric DEFAULT NULL::numeric, "p_status_plata" "text" DEFAULT NULL::"text", "p_observatii_ladite" "text" DEFAULT NULL::"text", "p_tenant_id" "uuid" DEFAULT NULL::"uuid") RETURNS "public"."vanzari"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_vanzare public.vanzari;
  v_existing_move public.miscari_stoc;
  v_existing_move_count integer := 0;
  v_old_qty numeric := 0;
  v_new_qty numeric := 0;
  v_new_price numeric := 0;
  v_delta numeric := 0;
  v_available_stock numeric := 0;
  v_move_quality text;
  v_status_plata text;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  select public.current_tenant_id()
  into v_tenant_id;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  if p_tenant_id is not null and p_tenant_id <> v_tenant_id then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));

  select *
  into v_vanzare
  from public.vanzari
  where id = p_vanzare_id
    and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Vanzarea este invalida pentru tenantul curent.';
  end if;

  select count(*)::int
  into v_existing_move_count
  from public.miscari_stoc ms
  where ms.tenant_id = v_tenant_id
    and ms.referinta_id = p_vanzare_id
    and (
      ms.tip = 'vanzare'
      or ms.tip_miscare = 'vanzare'
    );

  if v_existing_move_count = 0 then
    raise exception 'Miscarea de stoc asociata vanzarii lipseste.';
  end if;

  select *
  into v_existing_move
  from public.miscari_stoc ms
  where ms.tenant_id = v_tenant_id
    and ms.referinta_id = p_vanzare_id
    and (
      ms.tip = 'vanzare'
      or ms.tip_miscare = 'vanzare'
    )
  order by ms.created_at asc
  limit 1
  for update;

  v_old_qty := round(coalesce(v_vanzare.cantitate_kg, 0)::numeric, 2);
  v_new_qty := round(greatest(coalesce(p_cantitate_kg, v_vanzare.cantitate_kg, 0), 0)::numeric, 2);
  v_new_price := round(greatest(coalesce(p_pret_lei_kg, v_vanzare.pret_lei_kg, 0), 0)::numeric, 2);
  v_delta := round((v_new_qty - v_old_qty)::numeric, 2);

  if v_new_qty <= 0 then
    raise exception 'Cantitatea trebuie sa fie mai mare decat 0.';
  end if;

  if v_new_price <= 0 then
    raise exception 'Pretul trebuie sa fie mai mare decat 0.';
  end if;

  if v_existing_move_count > 1 and v_delta <> 0 then
    raise exception 'Cantitatea nu poate fi editata pentru vanzarile provenite din livrari cu mai multe alocari de stoc.';
  end if;

  if v_delta > 0 then
    if v_existing_move.locatie_id is not null
      and v_existing_move.produs is not null
      and v_existing_move.calitate is not null
      and v_existing_move.depozit is not null then
      select coalesce(
        sum(
          case
            when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0)
            else coalesce(ms.cantitate_kg, 0)
          end
        ),
        0
      )
      into v_available_stock
      from public.miscari_stoc ms
      where ms.tenant_id = v_tenant_id
        and ms.locatie_id = v_existing_move.locatie_id
        and ms.produs = v_existing_move.produs
        and ms.calitate = v_existing_move.calitate
        and ms.depozit = v_existing_move.depozit
        and ms.tip_miscare is not null
        and ms.cantitate_kg is not null;
    else
      select coalesce(
        sum(
          case
            when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0)
            else coalesce(ms.cantitate_kg, 0)
          end
        ),
        0
      )
      into v_available_stock
      from public.miscari_stoc ms
      where ms.tenant_id = v_tenant_id
        and ms.tip_miscare is not null
        and ms.cantitate_kg is not null;
    end if;

    if round(v_available_stock::numeric, 2) < v_delta then
      raise exception 'Stoc insuficient pentru a mari vanzarea.';
    end if;
  end if;

  v_status_plata := coalesce(
    nullif(btrim(coalesce(p_status_plata, '')), ''),
    nullif(btrim(coalesce(v_vanzare.status_plata, '')), ''),
    'platit'
  );

  update public.vanzari
  set data = coalesce(p_data, v_vanzare.data),
      client_id = coalesce(p_client_id, v_vanzare.client_id),
      cantitate_kg = v_new_qty,
      pret_lei_kg = v_new_price,
      status_plata = v_status_plata,
      observatii_ladite = coalesce(
        nullif(btrim(coalesce(p_observatii_ladite, '')), ''),
        v_vanzare.observatii_ladite
      ),
      updated_at = now(),
      updated_by = v_user_id
  where id = p_vanzare_id
    and tenant_id = v_tenant_id
  returning *
  into v_vanzare;

  if v_existing_move_count = 1 then
    v_move_quality := coalesce(
      v_existing_move.calitate,
      case
        when coalesce(v_existing_move.cantitate_cal2, 0) <> 0 then 'cal2'
        else 'cal1'
      end
    );

    update public.miscari_stoc
    set tenant_id = v_tenant_id,
        locatie_id = v_existing_move.locatie_id,
        produs = v_existing_move.produs,
        calitate = v_existing_move.calitate,
        depozit = v_existing_move.depozit,
        tip = 'vanzare',
        tip_miscare = 'vanzare',
        cantitate_kg = v_new_qty,
        cantitate_cal1 = case when v_move_quality = 'cal2' then 0 else -v_new_qty end,
        cantitate_cal2 = case when v_move_quality = 'cal2' then -v_new_qty else 0 end,
        referinta_id = v_vanzare.id,
        data = coalesce(p_data, v_existing_move.data, v_vanzare.data),
        observatii = coalesce(v_existing_move.observatii, 'Scadere stoc la vanzare'),
        descriere = coalesce(v_existing_move.descriere, 'Scadere stoc la vanzare')
    where id = v_existing_move.id;
  else
    update public.miscari_stoc
    set tenant_id = v_tenant_id,
        tip = 'vanzare',
        tip_miscare = 'vanzare',
        referinta_id = v_vanzare.id,
        data = coalesce(p_data, data),
        observatii = coalesce(observatii, 'Consum stoc prin livrare comanda'),
        descriere = coalesce(descriere, 'Consum stoc prin livrare comanda')
    where tenant_id = v_tenant_id
      and referinta_id = p_vanzare_id
      and (
        tip = 'vanzare'
        or tip_miscare = 'vanzare'
      );
  end if;

  return v_vanzare;
end;
$$;


ALTER FUNCTION "public"."update_vanzare_with_stock"("p_vanzare_id" "uuid", "p_data" "date", "p_client_id" "uuid", "p_cantitate_kg" numeric, "p_pret_lei_kg" numeric, "p_status_plata" "text", "p_observatii_ladite" "text", "p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_with_idempotency"("table_name" "text", "payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  result jsonb;
  assignments text;
  lww_condition text := '(coalesce(excluded.updated_at, now()) >= coalesce(t.updated_at, ''epoch''::timestamptz))';
  conflict_condition text := '(t.updated_at is not null and excluded.updated_at is not null and t.updated_at <> excluded.updated_at and abs(extract(epoch from (excluded.updated_at - t.updated_at))) < 5)';
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_payload_tenant uuid;
  v_payload jsonb := coalesce(payload, '{}'::jsonb);
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  if table_name not in ('recoltari', 'vanzari', 'activitati_agricole', 'cheltuieli_diverse') then
    raise exception 'Unsupported table: %', table_name;
  end if;

  select public.current_tenant_id()
  into v_tenant_id;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  begin
    if nullif(btrim(coalesce(v_payload ->> 'tenant_id', '')), '') is not null then
      v_payload_tenant := (v_payload ->> 'tenant_id')::uuid;
    end if;
  exception
    when invalid_text_representation then
      raise exception 'Tenant invalid pentru utilizatorul curent.';
  end;

  if v_payload_tenant is not null and v_payload_tenant <> v_tenant_id then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  v_payload := jsonb_set(v_payload, '{tenant_id}', to_jsonb(v_tenant_id), true);

  select string_agg(
    case
      when c.column_name = 'conflict_flag' then format(
        '%1$I = case when %2$s then true when %3$s then false else t.%1$I end',
        c.column_name,
        conflict_condition,
        lww_condition
      )
      else format(
        '%1$I = case when %2$s then excluded.%1$I else t.%1$I end',
        c.column_name,
        lww_condition
      )
    end,
    ', '
  )
  into assignments
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = table_name
    and c.column_name not in ('id', 'created_at', 'created_by', 'client_sync_id');

  execute format(
    'with incoming as (
      select * from jsonb_populate_record(null::public.%1$I, $1)
    ),
    upserted as (
      insert into public.%1$I as t
      select * from incoming
      on conflict (client_sync_id)
      do update set %2$s
      returning t.*
    )
    select to_jsonb(upserted) from upserted',
    table_name,
    assignments
  )
  into result
  using v_payload;

  return result;
end;
$_$;


ALTER FUNCTION "public"."upsert_with_idempotency"("table_name" "text", "payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_can_manage_tenant"("p_tenant_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_allowed boolean := false;
begin
  if p_user_id is null or p_tenant_id is null then
    return false;
  end if;

  select exists (
    select 1
    from public.tenants t
    where t.id = p_tenant_id
      and t.owner_user_id = p_user_id
  ) into v_allowed;

  if v_allowed then
    return true;
  end if;

  -- Optional membership tables (if project evolves). Checked safely at runtime.
  if to_regclass('public.tenant_memberships') is not null then
    begin
      execute
        'select exists (
           select 1
           from public.tenant_memberships tm
           where tm.tenant_id = $1
             and tm.user_id = $2
         )'
      into v_allowed
      using p_tenant_id, p_user_id;
      if v_allowed then
        return true;
      end if;
    exception when others then
      -- Ignore unknown structure.
      null;
    end;
  end if;

  if to_regclass('public.tenant_users') is not null then
    begin
      execute
        'select exists (
           select 1
           from public.tenant_users tu
           where tu.tenant_id = $1
             and tu.user_id = $2
         )'
      into v_allowed
      using p_tenant_id, p_user_id;
      if v_allowed then
        return true;
      end if;
    exception when others then
      null;
    end;
  end if;

  return false;
end
$_$;


ALTER FUNCTION "public"."user_can_manage_tenant"("p_tenant_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_comanda_status_transition"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if old.status = 'anulata' then
    raise exception 'invalid_status_transition'
      using hint = 'Nu se poate modifica o comandă anulată.';
  end if;

  if old.status = 'livrata' then
    if new.status not in ('confirmata', 'programata') then
      raise exception 'invalid_status_transition'
        using hint = format(
          'Tranziția %s -> %s nu este permisă. Folosiți funcția de redeschidere.',
          old.status,
          new.status
        );
    end if;

    if new.linked_vanzare_id is not null then
      raise exception 'invalid_status_transition'
        using hint = 'Redeschiderea trebuie să elimine linked_vanzare_id în aceeași operație.';
    end if;
  end if;

  if new.status = 'livrata'
     and old.linked_vanzare_id is null
     and (
       new.linked_vanzare_id is null
       or new.linked_vanzare_id is not distinct from old.linked_vanzare_id
     ) then
    raise exception 'invalid_status_transition'
      using hint = 'Livrarea se face doar prin funcția deliver_order_atomic.';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."validate_comanda_status_transition"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_suprafata_culturi"("p_solar_id" "uuid", "p_suprafata" numeric, "p_cultura_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_suprafata_totala  numeric;
  v_suprafata_ocupata numeric;
begin
  select suprafata_m2
  into v_suprafata_totala
  from public.parcele
  where id = p_solar_id;

  if v_suprafata_totala is null then
    return false;
  end if;

  select coalesce(sum(suprafata_ocupata), 0)
  into v_suprafata_ocupata
  from public.culturi
  where solar_id = p_solar_id
    and activa = true
    and (p_cultura_id is null or id != p_cultura_id);

  return (v_suprafata_ocupata + p_suprafata) <= v_suprafata_totala;
end;
$$;


ALTER FUNCTION "public"."validate_suprafata_culturi"("p_solar_id" "uuid", "p_suprafata" numeric, "p_cultura_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activitati_agricole" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid",
    "id_activitate" character varying(100) NOT NULL,
    "data_aplicare" timestamp with time zone NOT NULL,
    "parcela_id" "uuid",
    "tip_activitate" character varying(100),
    "produs_utilizat" character varying(150),
    "doza" character varying(50),
    "timp_pauza_zile" integer DEFAULT 0,
    "operator" character varying(100),
    "observatii" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "client_sync_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sync_status" "text" DEFAULT 'synced'::"text",
    "conflict_flag" boolean DEFAULT false,
    "data_origin" "text",
    "demo_seed_id" "uuid",
    "cultura_id" "uuid",
    CONSTRAINT "activitati_agricole_timp_pauza_zile_check" CHECK (("timp_pauza_zile" >= 0))
);


ALTER TABLE "public"."activitati_agricole" OWNER TO "postgres";


COMMENT ON TABLE "public"."activitati_agricole" IS 'Tratamente fitosanitare, fertilizări, irigări';



COMMENT ON COLUMN "public"."activitati_agricole"."timp_pauza_zile" IS 'Zile până la recoltare permisă (IMPORTANT legislație pesticide!)';



CREATE OR REPLACE VIEW "public"."activitati_extended" WITH ("security_invoker"='true') AS
 SELECT "id",
    "tenant_id",
    "id_activitate",
    "data_aplicare",
    "parcela_id",
    "tip_activitate",
    "produs_utilizat",
    "doza",
    "timp_pauza_zile",
    "operator",
    "observatii",
    "created_at",
    "updated_at",
        CASE
            WHEN ("timp_pauza_zile" IS NULL) THEN NULL::"date"
            ELSE (("data_aplicare")::"date" + "timp_pauza_zile")
        END AS "data_recoltare_permisa",
        CASE
            WHEN ("timp_pauza_zile" IS NULL) THEN 'fara_pauza'::"text"
            WHEN (CURRENT_DATE <= (("data_aplicare")::"date" + "timp_pauza_zile")) THEN 'in_pauza'::"text"
            ELSE 'expirata'::"text"
        END AS "status_pauza",
    "client_sync_id",
    "conflict_flag",
    "created_by",
    "updated_by",
    "sync_status",
    "data_origin",
    "demo_seed_id",
    "cultura_id"
   FROM "public"."activitati_agricole" "a";


ALTER VIEW "public"."activitati_extended" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activitati_extra_season" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "id_activitate" character varying(50) NOT NULL,
    "data" "date" NOT NULL,
    "parcela_id" "uuid",
    "tip_activitate" character varying(50) NOT NULL,
    "descriere" "text",
    "cost_lei" numeric(10,2) DEFAULT 0,
    "manopera_ore" numeric(5,2),
    "manopera_persoane" integer,
    "observatii" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."activitati_extra_season" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parcele" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "id_parcela" character varying(30) NOT NULL,
    "nume_parcela" character varying(100) NOT NULL,
    "suprafata_m2" numeric(10,2) NOT NULL,
    "tip_fruct" character varying(50),
    "soi_plantat" character varying(100),
    "an_plantare" integer NOT NULL,
    "nr_plante" integer,
    "status" character varying(20) DEFAULT 'Activ'::character varying,
    "gps_lat" numeric(10,8),
    "gps_lng" numeric(11,8),
    "observatii" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "data_origin" "text",
    "demo_seed_id" "uuid",
    "tip_unitate" "text" DEFAULT 'camp'::"text" NOT NULL,
    "cultura" "text",
    "soi" "text",
    "nr_randuri" integer,
    "distanta_intre_randuri" numeric,
    "sistem_irigare" "text",
    "data_plantarii" "date",
    "stadiu" "text" DEFAULT 'crestere'::"text" NOT NULL,
    "rol" "text" DEFAULT 'comercial'::"text" NOT NULL,
    "latitudine" double precision,
    "longitudine" double precision,
    "apare_in_dashboard" boolean DEFAULT true NOT NULL,
    "contribuie_la_productie" boolean DEFAULT true NOT NULL,
    "status_operational" "text" DEFAULT 'activ'::"text" NOT NULL,
    CONSTRAINT "parcele_an_plantare_check" CHECK ((("an_plantare" >= 1900) AND ("an_plantare" <= 2100))),
    CONSTRAINT "parcele_nr_plante_check" CHECK (("nr_plante" >= 0)),
    CONSTRAINT "parcele_rol_check" CHECK (("rol" = ANY (ARRAY['comercial'::"text", 'personal'::"text", 'experimental'::"text", 'inactiv'::"text"]))),
    CONSTRAINT "parcele_status_operational_check" CHECK (("status_operational" = ANY (ARRAY['activ'::"text", 'in_pauza'::"text", 'neproductiv'::"text", 'infiintare'::"text", 'arhivat'::"text"]))),
    CONSTRAINT "parcele_suprafata_m2_check" CHECK (("suprafata_m2" > (0)::numeric)),
    CONSTRAINT "parcele_tip_unitate_check" CHECK (("tip_unitate" = ANY (ARRAY['camp'::"text", 'solar'::"text", 'livada'::"text", 'cultura_mare'::"text"])))
);


ALTER TABLE "public"."parcele" OWNER TO "postgres";


COMMENT ON TABLE "public"."parcele" IS 'Parcele/loturi de teren plantate cu fructe';



COMMENT ON COLUMN "public"."parcele"."id_parcela" IS 'ID afișat user (ex: P001, P002)';



COMMENT ON COLUMN "public"."parcele"."rol" IS 'Scop teren: comercial, personal, experimental, inactiv';



COMMENT ON COLUMN "public"."parcele"."apare_in_dashboard" IS 'Daca terenul intra in contextul implicit al dashboard-ului principal (in combinatie cu scopul comercial)';



COMMENT ON COLUMN "public"."parcele"."contribuie_la_productie" IS 'Daca terenul conteaza pentru productie / vanzari in rapoarte si dashboard';



COMMENT ON COLUMN "public"."parcele"."status_operational" IS 'Stare operationala aferenta fermei (activ, in pauza etc.), separata de statusul ciclului culturii';



CREATE OR REPLACE VIEW "public"."activitati_extra_extended" WITH ("security_invoker"='true') AS
 SELECT "a"."id",
    "a"."tenant_id",
    "a"."id_activitate",
    "a"."data",
    "a"."parcela_id",
    "a"."tip_activitate",
    "a"."descriere",
    "a"."cost_lei",
    "a"."manopera_ore",
    "a"."manopera_persoane",
    "a"."observatii",
    "a"."created_at",
    "a"."updated_at",
    "p"."nume_parcela",
    "p"."soi_plantat",
    "p"."suprafata_m2",
        CASE
            WHEN ("p"."suprafata_m2" > (0)::numeric) THEN ("a"."cost_lei" / "p"."suprafata_m2")
            ELSE (0)::numeric
        END AS "cost_lei_per_m2",
        CASE
            WHEN ("a"."manopera_ore" > (0)::numeric) THEN ("a"."cost_lei" / "a"."manopera_ore")
            ELSE (0)::numeric
        END AS "cost_lei_per_ora"
   FROM ("public"."activitati_extra_season" "a"
     LEFT JOIN "public"."parcele" "p" ON (("a"."parcela_id" = "p"."id")));


ALTER VIEW "public"."activitati_extra_extended" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "mesaj_user" "text",
    "raspuns_ai" "text",
    "pathname" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alert_dismissals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "alert_key" "text" NOT NULL,
    "dismissed_on" "date" DEFAULT ("now"())::"date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."alert_dismissals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_name" "text" NOT NULL,
    "event_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "module" "text" DEFAULT 'general'::"text" NOT NULL,
    "page_url" "text",
    "status" "text",
    "session_id" "text"
);


ALTER TABLE "public"."analytics_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_user_id" "uuid",
    "action" "text" NOT NULL,
    "target_tenant_id" "uuid",
    "old_plan" "text",
    "new_plan" "text"
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."business_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."business_id_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cheltuieli_diverse" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "id_cheltuiala" character varying(50) NOT NULL,
    "data" "date" NOT NULL,
    "categorie" character varying(50),
    "descriere" "text",
    "suma_lei" numeric(10,2) NOT NULL,
    "furnizor" character varying(100),
    "document_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "client_sync_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sync_status" "text" DEFAULT 'synced'::"text",
    "conflict_flag" boolean DEFAULT false,
    "data_origin" "text",
    "demo_seed_id" "uuid",
    "is_auto_generated" boolean DEFAULT false,
    "metoda_plata" "text",
    CONSTRAINT "cheltuieli_diverse_suma_lei_check" CHECK (("suma_lei" >= (0)::numeric)),
    CONSTRAINT "cheltuieli_metoda_plata_check" CHECK ((("metoda_plata" IS NULL) OR ("lower"("btrim"("metoda_plata")) = ANY (ARRAY['alta'::"text", 'card'::"text", 'cash'::"text", 'transfer'::"text", 'transfer bancar'::"text"]))))
);


ALTER TABLE "public"."cheltuieli_diverse" OWNER TO "postgres";


COMMENT ON TABLE "public"."cheltuieli_diverse" IS 'Cheltuieli operaționale: electricitate, combustibil, reparații, etc.';



CREATE TABLE IF NOT EXISTS "public"."clienti" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "id_client" character varying(50) NOT NULL,
    "nume_client" character varying(100) NOT NULL,
    "telefon" character varying(20),
    "email" character varying(100),
    "adresa" "text",
    "pret_negociat_lei_kg" numeric(6,2),
    "observatii" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "google_resource_name" "text",
    "google_etag" "text",
    "data_origin" "text",
    "demo_seed_id" "uuid"
);


ALTER TABLE "public"."clienti" OWNER TO "postgres";


COMMENT ON TABLE "public"."clienti" IS 'Clienți pentru vânzări fructe și butași';



COMMENT ON COLUMN "public"."clienti"."pret_negociat_lei_kg" IS 'Preț special pentru clientul fidel. NULL = preț curent de piață';



CREATE TABLE IF NOT EXISTS "public"."crop_varieties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "crop_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "tenant_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "crop_varieties_name_not_blank" CHECK (("char_length"(TRIM(BOTH FROM "name")) > 0))
);


ALTER TABLE "public"."crop_varieties" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crops" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "unit_type" "text" NOT NULL,
    "tenant_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "crops_name_not_blank" CHECK (("length"(TRIM(BOTH FROM "name")) > 0)),
    CONSTRAINT "crops_unit_type_check" CHECK (("unit_type" = ANY (ARRAY['camp'::"text", 'solar'::"text", 'livada'::"text"])))
);


ALTER TABLE "public"."crops" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."culegatori" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid",
    "id_culegator" character varying(50) NOT NULL,
    "nume_prenume" character varying(100) NOT NULL,
    "telefon" character varying(20),
    "tip_angajare" character varying(20) DEFAULT 'Sezonier'::character varying,
    "tarif_lei_kg" numeric(5,2) DEFAULT 0,
    "data_angajare" "date",
    "status_activ" boolean DEFAULT true,
    "observatii" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "data_origin" "text",
    "demo_seed_id" "uuid",
    CONSTRAINT "culegatori_tarif_lei_kg_check" CHECK (("tarif_lei_kg" >= (0)::numeric))
);


ALTER TABLE "public"."culegatori" OWNER TO "postgres";


COMMENT ON TABLE "public"."culegatori" IS 'Personal pentru recoltare';



COMMENT ON COLUMN "public"."culegatori"."tarif_lei_kg" IS 'Tarif pe kg. 0 = salariu fix lunar';



CREATE TABLE IF NOT EXISTS "public"."culture_stage_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "unitate_id" "uuid" NOT NULL,
    "etapa" "text" NOT NULL,
    "data" "date" NOT NULL,
    "observatii" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "data_origin" "text",
    "demo_seed_id" "uuid",
    "cultura_id" "uuid"
);


ALTER TABLE "public"."culture_stage_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."culturi" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "solar_id" "uuid" NOT NULL,
    "tip_planta" "text" NOT NULL,
    "soi" "text",
    "suprafata_ocupata" numeric,
    "nr_plante" integer,
    "nr_randuri" integer,
    "distanta_intre_randuri" numeric,
    "sistem_irigare" "text",
    "data_plantarii" "date",
    "stadiu" "text" DEFAULT 'crestere'::"text" NOT NULL,
    "activa" boolean DEFAULT true NOT NULL,
    "data_desfiintare" "date",
    "motiv_desfiintare" "text",
    "observatii" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "data_origin" "text",
    "demo_seed_id" "uuid",
    "interval_tratament_zile" integer DEFAULT 14,
    CONSTRAINT "culturi_stadiu_check" CHECK ((("stadiu" IS NULL) OR ("lower"("btrim"("stadiu")) = ANY (ARRAY['altele'::"text", 'crestere'::"text", 'cules'::"text", 'daunator'::"text", 'fructificare'::"text", 'incoltit'::"text", 'inflorire'::"text", 'inflorit'::"text", 'plantare'::"text", 'recoltare'::"text", 'repaus'::"text", 'seceta'::"text", 'vegetativ'::"text"]))))
);


ALTER TABLE "public"."culturi" OWNER TO "postgres";


COMMENT ON COLUMN "public"."culturi"."interval_tratament_zile" IS 'Număr maxim de zile recomandat între tratamente. Folosit pentru alerte dashboard.';



CREATE TABLE IF NOT EXISTS "public"."etape_cultura" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "cultura_id" "uuid" NOT NULL,
    "etapa" "text" NOT NULL,
    "observatii" "text",
    "data_etapa" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."etape_cultura" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "message" "text" NOT NULL,
    "page_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "feedback_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integrations_google_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "user_email" "text" NOT NULL,
    "connected_email" "text",
    "access_token" "text",
    "refresh_token" "text",
    "token_expires_at" timestamp with time zone,
    "scope" "text",
    "sync_token" "text",
    "sync_enabled" boolean DEFAULT true NOT NULL,
    "sync_window" "text" DEFAULT 'seara'::"text" NOT NULL,
    "last_sync_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "integrations_google_contacts_sync_window_check" CHECK (("sync_window" = ANY (ARRAY['dimineata'::"text", 'seara'::"text"])))
);


ALTER TABLE "public"."integrations_google_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."investitii" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "id_investitie" character varying(50) NOT NULL,
    "data" "date" NOT NULL,
    "parcela_id" "uuid",
    "categorie" character varying(50),
    "furnizor" character varying(100),
    "descriere" "text",
    "suma_lei" numeric(10,2) NOT NULL,
    "document_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "data_origin" "text",
    "demo_seed_id" "uuid",
    CONSTRAINT "investitii_suma_lei_check" CHECK (("suma_lei" >= (0)::numeric))
);


ALTER TABLE "public"."investitii" OWNER TO "postgres";


COMMENT ON TABLE "public"."investitii" IS 'Investiții capitale: butași, spalieri, irigații, etc.';



CREATE TABLE IF NOT EXISTS "public"."meteo_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "lat" double precision NOT NULL,
    "lon" double precision NOT NULL,
    "data_fetch" timestamp with time zone DEFAULT "now"() NOT NULL,
    "date_expiry" timestamp with time zone NOT NULL,
    "current_temp" real,
    "current_icon" "text",
    "current_description" "text",
    "current_wind_speed" real,
    "current_humidity" integer,
    "forecast_tomorrow_temp_min" real,
    "forecast_tomorrow_temp_max" real,
    "forecast_tomorrow_icon" "text",
    "forecast_tomorrow_pop" real,
    "raw_json" "jsonb"
);


ALTER TABLE "public"."meteo_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."miscari_stoc" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "locatie_id" "uuid",
    "produs" "text",
    "calitate" "text",
    "depozit" "text",
    "tip_miscare" "text",
    "cantitate_kg" numeric,
    "referinta_id" "uuid",
    "data" "date" DEFAULT CURRENT_DATE NOT NULL,
    "observatii" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tip" "public"."miscare_stoc_tip_global",
    "cantitate_cal1" numeric DEFAULT 0 NOT NULL,
    "cantitate_cal2" numeric DEFAULT 0 NOT NULL,
    "descriere" "text",
    "data_origin" "text",
    "demo_seed_id" "uuid",
    CONSTRAINT "miscari_stoc_calitate_check" CHECK (("calitate" = ANY (ARRAY['cal1'::"text", 'cal2'::"text"]))),
    CONSTRAINT "miscari_stoc_cantitate_non_negative" CHECK (("cantitate_kg" >= (0)::numeric)),
    CONSTRAINT "miscari_stoc_depozit_check" CHECK (("depozit" = ANY (ARRAY['fresh'::"text", 'congelat'::"text", 'procesat'::"text"]))),
    CONSTRAINT "miscari_stoc_tip_miscare_check" CHECK (("tip_miscare" = ANY (ARRAY['recoltare'::"text", 'vanzare'::"text", 'consum'::"text", 'oferit_gratuit'::"text", 'procesare'::"text", 'congelare'::"text", 'pierdere'::"text", 'ajustare'::"text"])))
);


ALTER TABLE "public"."miscari_stoc" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nomenclatoare" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid",
    "tip" character varying(50) NOT NULL,
    "valoare" character varying(100) NOT NULL,
    "descriere" "text",
    "nivel" character varying(20) DEFAULT 'tenant'::character varying,
    "activ" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."nomenclatoare" OWNER TO "postgres";


COMMENT ON TABLE "public"."nomenclatoare" IS 'Valori pentru dropdown-uri: soiuri, categorii, tipuri activități, etc.';



COMMENT ON COLUMN "public"."nomenclatoare"."nivel" IS 'system=obligatoriu (nu se șterge), default=sugestii (user le poate șterge), tenant=personale user';



COMMENT ON COLUMN "public"."nomenclatoare"."activ" IS 'User poate dezactiva fără să șteargă';



CREATE OR REPLACE VIEW "public"."parcele_extended" WITH ("security_invoker"='true') AS
 SELECT "id",
    "tenant_id",
    "id_parcela",
    "nume_parcela",
    "suprafata_m2",
    "tip_fruct",
    "soi_plantat",
    "an_plantare",
    "nr_plante",
    "status",
    "gps_lat",
    "gps_lng",
    "observatii",
    "created_at",
    "updated_at",
        CASE
            WHEN (("suprafata_m2" > (0)::numeric) AND ("nr_plante" IS NOT NULL)) THEN "round"((("nr_plante")::numeric / ("suprafata_m2")::numeric), 4)
            ELSE NULL::numeric
        END AS "densitate_plante_m2",
        CASE
            WHEN ("an_plantare" IS NULL) THEN NULL::numeric
            ELSE EXTRACT(year FROM "age"((CURRENT_DATE)::timestamp with time zone, ("make_date"("an_plantare", 1, 1))::timestamp with time zone))
        END AS "varsta_ani",
    "tip_unitate",
    "cultura",
    "soi",
    "stadiu",
    "data_plantarii",
    "nr_randuri",
    "distanta_intre_randuri",
    "sistem_irigare",
    "created_by",
    "updated_by",
    "data_origin",
    "demo_seed_id"
   FROM "public"."parcele" "p";


ALTER VIEW "public"."parcele_extended" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."produse" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "nume" "text" NOT NULL,
    "descriere" "text",
    "categorie" "text" DEFAULT 'fruct'::"text" NOT NULL,
    "unitate_vanzare" "text" DEFAULT 'kg'::"text" NOT NULL,
    "gramaj_per_unitate" numeric,
    "pret_unitar" numeric,
    "moneda" "text" DEFAULT 'RON'::"text" NOT NULL,
    "poza_1_url" "text",
    "poza_2_url" "text",
    "status" "text" DEFAULT 'activ'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "data_origin" "text",
    "demo_seed_id" "uuid",
    CONSTRAINT "produse_categorie_check" CHECK (("categorie" = ANY (ARRAY['fruct'::"text", 'leguma'::"text", 'procesat'::"text", 'altele'::"text"]))),
    CONSTRAINT "produse_status_check" CHECK (("status" = ANY (ARRAY['activ'::"text", 'inactiv'::"text"]))),
    CONSTRAINT "produse_unitate_vanzare_check" CHECK (("unitate_vanzare" = ANY (ARRAY['kg'::"text", 'buc'::"text", 'ladă'::"text", 'casoletă'::"text", 'palet'::"text", 'cutie'::"text"])))
);


ALTER TABLE "public"."produse" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_superadmin" boolean DEFAULT false NOT NULL,
    "tenant_id" "uuid",
    "hide_onboarding" boolean DEFAULT false NOT NULL,
    "ai_messages_count" integer DEFAULT 0 NOT NULL,
    "last_ai_usage_date" "date",
    "phone" "text",
    "dashboard_layout" "jsonb"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."solar_climate_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "unitate_id" "uuid" NOT NULL,
    "temperatura" numeric NOT NULL,
    "umiditate" numeric NOT NULL,
    "observatii" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "data_origin" "text",
    "demo_seed_id" "uuid"
);


ALTER TABLE "public"."solar_climate_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "latitudine_default" double precision,
    "longitudine_default" double precision,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tenant_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "nume_ferma" character varying(100) NOT NULL,
    "owner_user_id" "uuid",
    "plan" character varying(20) DEFAULT 'freemium'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "demo_seeded" boolean DEFAULT false NOT NULL,
    "demo_seed_id" "uuid",
    "demo_seeded_at" timestamp with time zone,
    "is_demo" boolean DEFAULT false NOT NULL,
    "expires_at" timestamp with time zone,
    "contact_phone" "text",
    "onboarding_shown_at" timestamp with time zone,
    CONSTRAINT "tenants_plan_check" CHECK ((("plan")::"text" = ANY ((ARRAY['freemium'::character varying, 'pro'::character varying, 'enterprise'::character varying])::"text"[])))
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";


COMMENT ON TABLE "public"."tenants" IS 'Ferme/companii - fiecare user are un tenant';



COMMENT ON COLUMN "public"."tenants"."plan" IS 'Plan abonament: freemium (1 parcelă), starter (5 parcele), pro (unlimited), enterprise (multi-user)';



CREATE TABLE IF NOT EXISTS "public"."vanzari_butasi" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid",
    "id_vanzare_butasi" character varying(50) NOT NULL,
    "data" "date" NOT NULL,
    "client_id" "uuid",
    "parcela_sursa_id" "uuid",
    "tip_fruct" character varying(50),
    "soi_butasi" character varying(100),
    "cantitate_butasi" integer NOT NULL,
    "pret_unitar_lei" numeric(6,2) NOT NULL,
    "observatii" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "data_comanda" "date" DEFAULT CURRENT_DATE NOT NULL,
    "data_livrare_estimata" "date",
    "status" "text" DEFAULT 'noua'::"text" NOT NULL,
    "adresa_livrare" "text",
    "avans_suma" numeric DEFAULT 0 NOT NULL,
    "avans_data" "date",
    "total_lei" numeric DEFAULT 0 NOT NULL,
    "data_origin" "text",
    "demo_seed_id" "uuid",
    "client_nume_manual" "text",
    CONSTRAINT "vanzari_butasi_cantitate_butasi_check" CHECK (("cantitate_butasi" > 0)),
    CONSTRAINT "vanzari_butasi_pret_unitar_lei_check" CHECK (("pret_unitar_lei" >= (0)::numeric))
);


ALTER TABLE "public"."vanzari_butasi" OWNER TO "postgres";


COMMENT ON TABLE "public"."vanzari_butasi" IS 'Vânzări butași/material săditor';



CREATE OR REPLACE VIEW "public"."vanzari_butasi_extended" WITH ("security_invoker"='true') AS
 SELECT "id",
    "tenant_id",
    "id_vanzare_butasi",
    "data",
    "client_id",
    "parcela_sursa_id",
    "tip_fruct",
    "soi_butasi",
    "cantitate_butasi",
    "pret_unitar_lei",
    "observatii",
    "created_at",
    "updated_at",
    "data_comanda",
    "data_livrare_estimata",
    "status",
    "adresa_livrare",
    "avans_suma",
    "avans_data",
    "total_lei",
    "data_origin",
    "demo_seed_id"
   FROM "public"."vanzari_butasi";


ALTER VIEW "public"."vanzari_butasi_extended" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vanzari_butasi_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "comanda_id" "uuid" NOT NULL,
    "soi" "text" NOT NULL,
    "cantitate" integer NOT NULL,
    "pret_unitar" numeric NOT NULL,
    "subtotal" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "data_origin" "text",
    "demo_seed_id" "uuid",
    CONSTRAINT "vanzari_butasi_items_cantitate_check" CHECK (("cantitate" > 0)),
    CONSTRAINT "vanzari_butasi_items_pret_unitar_check" CHECK (("pret_unitar" > (0)::numeric)),
    CONSTRAINT "vanzari_butasi_items_subtotal_check" CHECK (("subtotal" > (0)::numeric))
);


ALTER TABLE "public"."vanzari_butasi_items" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vanzari_extended" WITH ("security_invoker"='true') AS
 SELECT "id",
    "tenant_id",
    "id_vanzare",
    "data",
    "client_id",
    "cantitate_kg",
    "pret_lei_kg",
    "status_plata",
    "observatii_ladite",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by",
    "client_sync_id",
    "sync_status",
    "conflict_flag",
    "data_origin",
    "demo_seed_id",
    "comanda_id"
   FROM "public"."vanzari" "v";


ALTER VIEW "public"."vanzari_extended" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activitati_agricole"
    ADD CONSTRAINT "activitati_agricole_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activitati_agricole"
    ADD CONSTRAINT "activitati_agricole_tenant_id_id_activitate_key" UNIQUE ("tenant_id", "id_activitate");



ALTER TABLE ONLY "public"."activitati_extra_season"
    ADD CONSTRAINT "activitati_extra_season_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activitati_extra_season"
    ADD CONSTRAINT "activitati_extra_season_tenant_id_id_activitate_key" UNIQUE ("tenant_id", "id_activitate");



ALTER TABLE ONLY "public"."ai_conversations"
    ADD CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alert_dismissals"
    ADD CONSTRAINT "alert_dismissals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alert_dismissals"
    ADD CONSTRAINT "alert_dismissals_tenant_id_user_id_alert_key_dismissed_on_key" UNIQUE ("tenant_id", "user_id", "alert_key", "dismissed_on");



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cheltuieli_diverse"
    ADD CONSTRAINT "cheltuieli_diverse_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cheltuieli_diverse"
    ADD CONSTRAINT "cheltuieli_diverse_tenant_id_id_cheltuiala_key" UNIQUE ("tenant_id", "id_cheltuiala");



ALTER TABLE ONLY "public"."clienti"
    ADD CONSTRAINT "clienti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clienti"
    ADD CONSTRAINT "clienti_tenant_id_id_client_key" UNIQUE ("tenant_id", "id_client");



ALTER TABLE ONLY "public"."comenzi"
    ADD CONSTRAINT "comenzi_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crop_varieties"
    ADD CONSTRAINT "crop_varieties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crops"
    ADD CONSTRAINT "crops_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."culegatori"
    ADD CONSTRAINT "culegatori_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."culegatori"
    ADD CONSTRAINT "culegatori_tenant_id_id_culegator_key" UNIQUE ("tenant_id", "id_culegator");



ALTER TABLE ONLY "public"."culture_stage_logs"
    ADD CONSTRAINT "culture_stage_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."culturi"
    ADD CONSTRAINT "culturi_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."etape_cultura"
    ADD CONSTRAINT "etape_cultura_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integrations_google_contacts"
    ADD CONSTRAINT "integrations_google_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integrations_google_contacts"
    ADD CONSTRAINT "integrations_google_contacts_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."investitii"
    ADD CONSTRAINT "investitii_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."investitii"
    ADD CONSTRAINT "investitii_tenant_id_id_investitie_key" UNIQUE ("tenant_id", "id_investitie");



ALTER TABLE ONLY "public"."meteo_cache"
    ADD CONSTRAINT "meteo_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."miscari_stoc"
    ADD CONSTRAINT "miscari_stoc_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nomenclatoare"
    ADD CONSTRAINT "nomenclatoare_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parcele"
    ADD CONSTRAINT "parcele_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parcele"
    ADD CONSTRAINT "parcele_tenant_id_id_parcela_key" UNIQUE ("tenant_id", "id_parcela");



ALTER TABLE ONLY "public"."produse"
    ADD CONSTRAINT "produse_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recoltari"
    ADD CONSTRAINT "recoltari_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recoltari"
    ADD CONSTRAINT "recoltari_tenant_id_id_recoltare_key" UNIQUE ("tenant_id", "id_recoltare");



ALTER TABLE ONLY "public"."solar_climate_logs"
    ADD CONSTRAINT "solar_climate_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_metrics_daily"
    ADD CONSTRAINT "tenant_metrics_daily_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_settings"
    ADD CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_settings"
    ADD CONSTRAINT "tenant_settings_tenant_id_key" UNIQUE ("tenant_id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vanzari_butasi_items"
    ADD CONSTRAINT "vanzari_butasi_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vanzari_butasi"
    ADD CONSTRAINT "vanzari_butasi_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vanzari_butasi"
    ADD CONSTRAINT "vanzari_butasi_tenant_id_id_vanzare_butasi_key" UNIQUE ("tenant_id", "id_vanzare_butasi");



ALTER TABLE ONLY "public"."vanzari"
    ADD CONSTRAINT "vanzari_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vanzari"
    ADD CONSTRAINT "vanzari_tenant_id_id_vanzare_key" UNIQUE ("tenant_id", "id_vanzare");



CREATE UNIQUE INDEX "activitati_agricole_client_sync_id_uq" ON "public"."activitati_agricole" USING "btree" ("client_sync_id");



CREATE INDEX "activitati_agricole_cultura_id_idx" ON "public"."activitati_agricole" USING "btree" ("cultura_id");



CREATE INDEX "activitati_agricole_tenant_created_at_idx" ON "public"."activitati_agricole" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "activitati_agricole_tenant_demo_seed_idx" ON "public"."activitati_agricole" USING "btree" ("tenant_id", "demo_seed_id");



CREATE INDEX "ai_conversations_user_created_idx" ON "public"."ai_conversations" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "ai_conversations_user_tenant_idx" ON "public"."ai_conversations" USING "btree" ("user_id", "tenant_id", "created_at" DESC);



CREATE INDEX "alert_dismissals_tenant_user_day_idx" ON "public"."alert_dismissals" USING "btree" ("tenant_id", "user_id", "dismissed_on");



CREATE INDEX "alert_dismissals_tenant_user_key_idx" ON "public"."alert_dismissals" USING "btree" ("tenant_id", "user_id", "alert_key");



CREATE INDEX "alert_dismissals_user_tenant_idx" ON "public"."alert_dismissals" USING "btree" ("tenant_id", "user_id", "dismissed_on");



CREATE INDEX "analytics_events_created_at_idx" ON "public"."analytics_events" USING "btree" ("created_at" DESC);



CREATE INDEX "analytics_events_event_name_idx" ON "public"."analytics_events" USING "btree" ("event_name");



CREATE INDEX "analytics_events_module_idx" ON "public"."analytics_events" USING "btree" ("module");



CREATE INDEX "analytics_events_status_idx" ON "public"."analytics_events" USING "btree" ("status");



CREATE INDEX "analytics_events_tenant_id_idx" ON "public"."analytics_events" USING "btree" ("tenant_id");



CREATE INDEX "audit_logs_created_at_desc_idx" ON "public"."audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "audit_logs_target_tenant_idx" ON "public"."audit_logs" USING "btree" ("target_tenant_id");



CREATE UNIQUE INDEX "cheltuieli_diverse_client_sync_id_uq" ON "public"."cheltuieli_diverse" USING "btree" ("client_sync_id");



CREATE INDEX "cheltuieli_diverse_tenant_created_at_idx" ON "public"."cheltuieli_diverse" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "cheltuieli_diverse_tenant_demo_seed_idx" ON "public"."cheltuieli_diverse" USING "btree" ("tenant_id", "demo_seed_id");



CREATE INDEX "clienti_tenant_created_at_idx" ON "public"."clienti" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "clienti_tenant_demo_seed_idx" ON "public"."clienti" USING "btree" ("tenant_id", "demo_seed_id");



CREATE UNIQUE INDEX "clienti_tenant_google_resource_name_uq" ON "public"."clienti" USING "btree" ("tenant_id", "google_resource_name") WHERE ("google_resource_name" IS NOT NULL);



CREATE INDEX "comenzi_client_idx" ON "public"."comenzi" USING "btree" ("tenant_id", "client_id");



CREATE INDEX "comenzi_data_livrare_idx" ON "public"."comenzi" USING "btree" ("tenant_id", "data_livrare");



CREATE INDEX "comenzi_status_idx" ON "public"."comenzi" USING "btree" ("tenant_id", "status");



CREATE INDEX "comenzi_tenant_created_at_idx" ON "public"."comenzi" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "comenzi_tenant_demo_seed_idx" ON "public"."comenzi" USING "btree" ("tenant_id", "demo_seed_id");



CREATE INDEX "comenzi_tenant_idx" ON "public"."comenzi" USING "btree" ("tenant_id");



CREATE INDEX "crop_varieties_crop_id_idx" ON "public"."crop_varieties" USING "btree" ("crop_id");



CREATE UNIQUE INDEX "crop_varieties_scope_name_uniq_idx" ON "public"."crop_varieties" USING "btree" ("crop_id", COALESCE("tenant_id", '00000000-0000-0000-0000-000000000000'::"uuid"), "lower"("name"));



CREATE INDEX "crop_varieties_tenant_id_idx" ON "public"."crop_varieties" USING "btree" ("tenant_id");



CREATE INDEX "crops_tenant_id_idx" ON "public"."crops" USING "btree" ("tenant_id");



CREATE UNIQUE INDEX "crops_unique_global" ON "public"."crops" USING "btree" ("unit_type", "lower"("name")) WHERE ("tenant_id" IS NULL);



CREATE UNIQUE INDEX "crops_unique_tenant" ON "public"."crops" USING "btree" ("tenant_id", "unit_type", "lower"("name")) WHERE ("tenant_id" IS NOT NULL);



CREATE INDEX "crops_unit_type_idx" ON "public"."crops" USING "btree" ("unit_type");



CREATE INDEX "culegatori_tenant_created_at_idx" ON "public"."culegatori" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "culegatori_tenant_demo_seed_idx" ON "public"."culegatori" USING "btree" ("tenant_id", "demo_seed_id");



CREATE INDEX "culture_stage_logs_created_idx" ON "public"."culture_stage_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "culture_stage_logs_cultura_id_idx" ON "public"."culture_stage_logs" USING "btree" ("cultura_id");



CREATE INDEX "culture_stage_logs_tenant_demo_seed_idx" ON "public"."culture_stage_logs" USING "btree" ("tenant_id", "demo_seed_id");



CREATE INDEX "culture_stage_logs_tenant_unitate_data_idx" ON "public"."culture_stage_logs" USING "btree" ("tenant_id", "unitate_id", "data" DESC);



CREATE INDEX "culturi_activa_idx" ON "public"."culturi" USING "btree" ("activa") WHERE ("activa" = true);



CREATE INDEX "culturi_demo_seed_idx" ON "public"."culturi" USING "btree" ("tenant_id", "demo_seed_id");



CREATE INDEX "culturi_solar_id_idx" ON "public"."culturi" USING "btree" ("solar_id");



CREATE INDEX "culturi_tenant_id_idx" ON "public"."culturi" USING "btree" ("tenant_id");



CREATE INDEX "culturi_tenant_solar_idx" ON "public"."culturi" USING "btree" ("tenant_id", "solar_id");



CREATE INDEX "culturi_tip_planta_idx" ON "public"."culturi" USING "btree" ("lower"("tip_planta"));



CREATE INDEX "etape_cultura_cultura_data_idx" ON "public"."etape_cultura" USING "btree" ("cultura_id", "data_etapa" DESC, "created_at" DESC);



CREATE INDEX "idx_activitati_agricole_tenant_id" ON "public"."activitati_agricole" USING "btree" ("tenant_id");



CREATE INDEX "idx_activitati_data" ON "public"."activitati_agricole" USING "btree" ("data_aplicare" DESC);



CREATE INDEX "idx_activitati_extra_data" ON "public"."activitati_extra_season" USING "btree" ("data" DESC);



CREATE INDEX "idx_activitati_extra_parcela" ON "public"."activitati_extra_season" USING "btree" ("parcela_id");



CREATE INDEX "idx_activitati_extra_season_tenant_id" ON "public"."activitati_extra_season" USING "btree" ("tenant_id");



CREATE INDEX "idx_activitati_extra_tenant" ON "public"."activitati_extra_season" USING "btree" ("tenant_id");



CREATE INDEX "idx_activitati_extra_tip" ON "public"."activitati_extra_season" USING "btree" ("tip_activitate");



CREATE INDEX "idx_activitati_parcela" ON "public"."activitati_agricole" USING "btree" ("parcela_id");



CREATE INDEX "idx_activitati_tenant" ON "public"."activitati_agricole" USING "btree" ("tenant_id");



CREATE INDEX "idx_alert_dismissals_tenant_id" ON "public"."alert_dismissals" USING "btree" ("tenant_id");



CREATE INDEX "idx_analytics_events_created_at" ON "public"."analytics_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_analytics_events_event_name" ON "public"."analytics_events" USING "btree" ("event_name");



CREATE INDEX "idx_analytics_events_module" ON "public"."analytics_events" USING "btree" ("module");



CREATE INDEX "idx_analytics_events_name" ON "public"."analytics_events" USING "btree" ("event_name", "created_at" DESC);



CREATE INDEX "idx_analytics_events_tenant" ON "public"."analytics_events" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_analytics_events_tenant_id" ON "public"."analytics_events" USING "btree" ("tenant_id");



CREATE INDEX "idx_analytics_events_user_id" ON "public"."analytics_events" USING "btree" ("user_id");



CREATE INDEX "idx_cheltuieli_data" ON "public"."cheltuieli_diverse" USING "btree" ("data" DESC);



CREATE INDEX "idx_cheltuieli_diverse_tenant_id" ON "public"."cheltuieli_diverse" USING "btree" ("tenant_id");



CREATE INDEX "idx_cheltuieli_tenant" ON "public"."cheltuieli_diverse" USING "btree" ("tenant_id");



CREATE INDEX "idx_clienti_tenant" ON "public"."clienti" USING "btree" ("tenant_id");



CREATE INDEX "idx_clienti_tenant_id" ON "public"."clienti" USING "btree" ("tenant_id");



CREATE INDEX "idx_comenzi_tenant_id" ON "public"."comenzi" USING "btree" ("tenant_id");



CREATE INDEX "idx_crop_varieties_tenant_id" ON "public"."crop_varieties" USING "btree" ("tenant_id");



CREATE INDEX "idx_crops_tenant_id" ON "public"."crops" USING "btree" ("tenant_id");



CREATE INDEX "idx_culegatori_activ" ON "public"."culegatori" USING "btree" ("status_activ");



CREATE INDEX "idx_culegatori_tenant" ON "public"."culegatori" USING "btree" ("tenant_id");



CREATE INDEX "idx_culegatori_tenant_id" ON "public"."culegatori" USING "btree" ("tenant_id");



CREATE INDEX "idx_culture_stage_logs_tenant_id" ON "public"."culture_stage_logs" USING "btree" ("tenant_id");



CREATE INDEX "idx_feedback_created_at" ON "public"."feedback" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_feedback_tenant_id" ON "public"."feedback" USING "btree" ("tenant_id");



CREATE INDEX "idx_feedback_user_id" ON "public"."feedback" USING "btree" ("user_id");



CREATE INDEX "idx_integrations_google_contacts_tenant_id" ON "public"."integrations_google_contacts" USING "btree" ("tenant_id");



CREATE INDEX "idx_investitii_data" ON "public"."investitii" USING "btree" ("data" DESC);



CREATE INDEX "idx_investitii_parcela" ON "public"."investitii" USING "btree" ("parcela_id");



CREATE INDEX "idx_investitii_tenant" ON "public"."investitii" USING "btree" ("tenant_id");



CREATE INDEX "idx_investitii_tenant_id" ON "public"."investitii" USING "btree" ("tenant_id");



CREATE INDEX "idx_meteo_cache_tenant_expiry" ON "public"."meteo_cache" USING "btree" ("tenant_id", "date_expiry");



CREATE INDEX "idx_miscari_stoc_tenant_id" ON "public"."miscari_stoc" USING "btree" ("tenant_id");



CREATE INDEX "idx_nomenclatoare_nivel" ON "public"."nomenclatoare" USING "btree" ("nivel");



CREATE INDEX "idx_nomenclatoare_tenant_id" ON "public"."nomenclatoare" USING "btree" ("tenant_id");



CREATE INDEX "idx_nomenclatoare_tenant_tip" ON "public"."nomenclatoare" USING "btree" ("tenant_id", "tip");



CREATE INDEX "idx_parcele_status" ON "public"."parcele" USING "btree" ("status");



CREATE INDEX "idx_parcele_tenant" ON "public"."parcele" USING "btree" ("tenant_id");



CREATE INDEX "idx_parcele_tenant_id" ON "public"."parcele" USING "btree" ("tenant_id");



CREATE INDEX "idx_produse_tenant" ON "public"."produse" USING "btree" ("tenant_id");



CREATE INDEX "idx_produse_tenant_demo_seed" ON "public"."produse" USING "btree" ("tenant_id", "demo_seed_id");



CREATE INDEX "idx_produse_tenant_status" ON "public"."produse" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_profiles_tenant_id" ON "public"."profiles" USING "btree" ("tenant_id");



CREATE INDEX "idx_recoltari_culegator" ON "public"."recoltari" USING "btree" ("culegator_id");



CREATE INDEX "idx_recoltari_data" ON "public"."recoltari" USING "btree" ("data" DESC);



CREATE INDEX "idx_recoltari_parcela" ON "public"."recoltari" USING "btree" ("parcela_id");



CREATE INDEX "idx_recoltari_tenant" ON "public"."recoltari" USING "btree" ("tenant_id");



CREATE INDEX "idx_recoltari_tenant_id" ON "public"."recoltari" USING "btree" ("tenant_id");



CREATE INDEX "idx_solar_climate_logs_tenant_id" ON "public"."solar_climate_logs" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenant_settings_tenant_id" ON "public"."tenant_settings" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenants_demo_expires" ON "public"."tenants" USING "btree" ("is_demo", "expires_at") WHERE ("is_demo" = true);



CREATE INDEX "idx_vanzari_butasi_client" ON "public"."vanzari_butasi" USING "btree" ("client_id");



CREATE INDEX "idx_vanzari_butasi_data" ON "public"."vanzari_butasi" USING "btree" ("data" DESC);



CREATE INDEX "idx_vanzari_butasi_items_tenant_id" ON "public"."vanzari_butasi_items" USING "btree" ("tenant_id");



CREATE INDEX "idx_vanzari_butasi_tenant" ON "public"."vanzari_butasi" USING "btree" ("tenant_id");



CREATE INDEX "idx_vanzari_butasi_tenant_id" ON "public"."vanzari_butasi" USING "btree" ("tenant_id");



CREATE INDEX "idx_vanzari_client" ON "public"."vanzari" USING "btree" ("client_id");



CREATE INDEX "idx_vanzari_data" ON "public"."vanzari" USING "btree" ("data" DESC);



CREATE INDEX "idx_vanzari_tenant" ON "public"."vanzari" USING "btree" ("tenant_id");



CREATE INDEX "idx_vanzari_tenant_id" ON "public"."vanzari" USING "btree" ("tenant_id");



CREATE INDEX "investitii_tenant_demo_seed_idx" ON "public"."investitii" USING "btree" ("tenant_id", "demo_seed_id");



CREATE INDEX "miscari_stoc_loc_prod_cal_data_idx" ON "public"."miscari_stoc" USING "btree" ("locatie_id", "produs", "calitate", "data");



CREATE INDEX "miscari_stoc_tenant_created_at_idx" ON "public"."miscari_stoc" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "miscari_stoc_tenant_demo_seed_idx" ON "public"."miscari_stoc" USING "btree" ("tenant_id", "demo_seed_id");



CREATE INDEX "miscari_stoc_tenant_locatie_idx" ON "public"."miscari_stoc" USING "btree" ("tenant_id", "locatie_id");



CREATE INDEX "miscari_stoc_tenant_tip_data_idx" ON "public"."miscari_stoc" USING "btree" ("tenant_id", "tip", "data");



CREATE INDEX "parcele_tenant_created_at_idx" ON "public"."parcele" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "parcele_tenant_demo_seed_idx" ON "public"."parcele" USING "btree" ("tenant_id", "demo_seed_id");



CREATE INDEX "profiles_is_superadmin_idx" ON "public"."profiles" USING "btree" ("is_superadmin") WHERE ("is_superadmin" = true);



CREATE INDEX "profiles_tenant_id_idx" ON "public"."profiles" USING "btree" ("tenant_id");



CREATE UNIQUE INDEX "recoltari_client_sync_id_uq" ON "public"."recoltari" USING "btree" ("client_sync_id");



CREATE INDEX "recoltari_cultura_id_idx" ON "public"."recoltari" USING "btree" ("cultura_id");



CREATE INDEX "recoltari_parcela_id_idx" ON "public"."recoltari" USING "btree" ("parcela_id");



CREATE INDEX "recoltari_tenant_created_at_idx" ON "public"."recoltari" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "recoltari_tenant_demo_seed_idx" ON "public"."recoltari" USING "btree" ("tenant_id", "demo_seed_id");



CREATE INDEX "solar_climate_logs_created_idx" ON "public"."solar_climate_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "solar_climate_logs_tenant_demo_seed_idx" ON "public"."solar_climate_logs" USING "btree" ("tenant_id", "demo_seed_id");



CREATE INDEX "solar_climate_logs_tenant_unitate_created_idx" ON "public"."solar_climate_logs" USING "btree" ("tenant_id", "unitate_id", "created_at" DESC);



CREATE INDEX "tenant_metrics_daily_date_desc_idx" ON "public"."tenant_metrics_daily" USING "btree" ("date" DESC);



CREATE UNIQUE INDEX "tenant_metrics_daily_date_key_idx" ON "public"."tenant_metrics_daily" USING "btree" ("date");



CREATE INDEX "vanzari_butasi_items_comanda_id_idx" ON "public"."vanzari_butasi_items" USING "btree" ("comanda_id");



CREATE INDEX "vanzari_butasi_items_tenant_demo_seed_idx" ON "public"."vanzari_butasi_items" USING "btree" ("tenant_id", "demo_seed_id");



CREATE INDEX "vanzari_butasi_items_tenant_id_idx" ON "public"."vanzari_butasi_items" USING "btree" ("tenant_id");



CREATE INDEX "vanzari_butasi_tenant_demo_seed_idx" ON "public"."vanzari_butasi" USING "btree" ("tenant_id", "demo_seed_id");



CREATE INDEX "vanzari_client_id_idx" ON "public"."vanzari" USING "btree" ("client_id");



CREATE UNIQUE INDEX "vanzari_client_sync_id_uq" ON "public"."vanzari" USING "btree" ("client_sync_id");



CREATE INDEX "vanzari_comanda_id_idx" ON "public"."vanzari" USING "btree" ("comanda_id");



CREATE INDEX "vanzari_tenant_created_at_idx" ON "public"."vanzari" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "vanzari_tenant_demo_seed_idx" ON "public"."vanzari" USING "btree" ("tenant_id", "demo_seed_id");



CREATE OR REPLACE TRIGGER "activitati_agricole_set_audit_fields_minimal" BEFORE INSERT OR UPDATE ON "public"."activitati_agricole" FOR EACH ROW EXECUTE FUNCTION "public"."set_audit_fields_minimal"();



CREATE OR REPLACE TRIGGER "activitati_agricole_set_sync_audit_fields" BEFORE INSERT OR UPDATE ON "public"."activitati_agricole" FOR EACH ROW EXECUTE FUNCTION "public"."set_sync_audit_fields"();



CREATE OR REPLACE TRIGGER "analytics_events_set_context" BEFORE INSERT ON "public"."analytics_events" FOR EACH ROW EXECUTE FUNCTION "public"."set_analytics_event_context"();



CREATE OR REPLACE TRIGGER "cheltuieli_diverse_set_audit_fields_minimal" BEFORE INSERT OR UPDATE ON "public"."cheltuieli_diverse" FOR EACH ROW EXECUTE FUNCTION "public"."set_audit_fields_minimal"();



CREATE OR REPLACE TRIGGER "cheltuieli_diverse_set_sync_audit_fields" BEFORE INSERT OR UPDATE ON "public"."cheltuieli_diverse" FOR EACH ROW EXECUTE FUNCTION "public"."set_sync_audit_fields"();



CREATE OR REPLACE TRIGGER "clienti_set_audit_fields_minimal" BEFORE INSERT OR UPDATE ON "public"."clienti" FOR EACH ROW EXECUTE FUNCTION "public"."set_audit_fields_minimal"();



CREATE OR REPLACE TRIGGER "comenzi_set_tenant_and_audit" BEFORE INSERT OR UPDATE ON "public"."comenzi" FOR EACH ROW EXECUTE FUNCTION "public"."set_comenzi_tenant_and_audit"();



CREATE OR REPLACE TRIGGER "culturi_check_suprafata" BEFORE INSERT OR UPDATE OF "suprafata_ocupata", "solar_id" ON "public"."culturi" FOR EACH ROW EXECUTE FUNCTION "public"."check_culturi_suprafata"();



CREATE OR REPLACE TRIGGER "culturi_updated_at" BEFORE UPDATE ON "public"."culturi" FOR EACH ROW EXECUTE FUNCTION "public"."set_culturi_updated_at"();



CREATE OR REPLACE TRIGGER "handle_tenant_settings_updated_at" BEFORE UPDATE ON "public"."tenant_settings" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "parcele_set_audit_fields_minimal" BEFORE INSERT OR UPDATE ON "public"."parcele" FOR EACH ROW EXECUTE FUNCTION "public"."set_audit_fields_minimal"();



CREATE CONSTRAINT TRIGGER "prevent_negative_stock" AFTER INSERT OR DELETE OR UPDATE ON "public"."miscari_stoc" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."check_stock_not_negative"();



CREATE OR REPLACE TRIGGER "profiles_prevent_privileged_changes" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."protect_profiles_privileged_fields"();



CREATE OR REPLACE TRIGGER "recoltari_set_audit_fields_minimal" BEFORE INSERT OR UPDATE ON "public"."recoltari" FOR EACH ROW EXECUTE FUNCTION "public"."set_audit_fields_minimal"();



CREATE OR REPLACE TRIGGER "recoltari_set_sync_audit_fields" BEFORE INSERT OR UPDATE ON "public"."recoltari" FOR EACH ROW EXECUTE FUNCTION "public"."set_sync_audit_fields"();



CREATE OR REPLACE TRIGGER "set_tenant_id_before_insert_activitati" BEFORE INSERT ON "public"."activitati_agricole" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id_from_owner"();



CREATE OR REPLACE TRIGGER "set_tenant_id_before_insert_cheltuieli" BEFORE INSERT ON "public"."cheltuieli_diverse" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id_from_owner"();



CREATE OR REPLACE TRIGGER "set_tenant_id_before_insert_clienti" BEFORE INSERT ON "public"."clienti" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id_from_owner"();



CREATE OR REPLACE TRIGGER "set_tenant_id_before_insert_culegatori" BEFORE INSERT ON "public"."culegatori" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id_from_owner"();



CREATE OR REPLACE TRIGGER "set_tenant_id_before_insert_investitii" BEFORE INSERT ON "public"."investitii" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id_from_owner"();



CREATE OR REPLACE TRIGGER "set_tenant_id_before_insert_parcele" BEFORE INSERT ON "public"."parcele" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id_from_owner"();



CREATE OR REPLACE TRIGGER "set_tenant_id_before_insert_recoltari" BEFORE INSERT ON "public"."recoltari" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id_from_owner"();



CREATE OR REPLACE TRIGGER "set_tenant_id_before_insert_vanzari" BEFORE INSERT ON "public"."vanzari" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id_from_owner"();



CREATE OR REPLACE TRIGGER "set_tenant_id_before_insert_vanzari_butasi" BEFORE INSERT ON "public"."vanzari_butasi" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id_from_owner"();



CREATE OR REPLACE TRIGGER "trg_integrations_google_contacts_updated_at" BEFORE UPDATE ON "public"."integrations_google_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."integrations_google_contacts_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profiles_set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_profiles"();



CREATE OR REPLACE TRIGGER "trg_recoltari_sync_cantitate_kg" BEFORE INSERT OR UPDATE ON "public"."recoltari" FOR EACH ROW EXECUTE FUNCTION "public"."recoltari_sync_cantitate_kg"();



CREATE OR REPLACE TRIGGER "trg_tenants_plan_superadmin_only" BEFORE UPDATE ON "public"."tenants" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_superadmin_for_plan_change"();



CREATE OR REPLACE TRIGGER "update_activitati_agricole_updated_at" BEFORE UPDATE ON "public"."activitati_agricole" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_activitati_extra_season_updated_at" BEFORE UPDATE ON "public"."activitati_extra_season" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_cheltuieli_diverse_updated_at" BEFORE UPDATE ON "public"."cheltuieli_diverse" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_clienti_updated_at" BEFORE UPDATE ON "public"."clienti" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_culegatori_updated_at" BEFORE UPDATE ON "public"."culegatori" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_investitii_updated_at" BEFORE UPDATE ON "public"."investitii" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_parcele_updated_at" BEFORE UPDATE ON "public"."parcele" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_recoltari_updated_at" BEFORE UPDATE ON "public"."recoltari" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_vanzari_butasi_updated_at" BEFORE UPDATE ON "public"."vanzari_butasi" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_vanzari_updated_at" BEFORE UPDATE ON "public"."vanzari" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "validate_comanda_status" BEFORE UPDATE OF "status" ON "public"."comenzi" FOR EACH ROW EXECUTE FUNCTION "public"."validate_comanda_status_transition"();



CREATE OR REPLACE TRIGGER "vanzari_butasi_items_enforce_tenant" BEFORE INSERT OR UPDATE ON "public"."vanzari_butasi_items" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_vanzari_butasi_items_tenant"();



CREATE OR REPLACE TRIGGER "vanzari_butasi_set_tenant_and_public_id" BEFORE INSERT ON "public"."vanzari_butasi" FOR EACH ROW EXECUTE FUNCTION "public"."set_vanzari_butasi_tenant_and_public_id"();



CREATE OR REPLACE TRIGGER "vanzari_set_audit_fields_minimal" BEFORE INSERT OR UPDATE ON "public"."vanzari" FOR EACH ROW EXECUTE FUNCTION "public"."set_audit_fields_minimal"();



CREATE OR REPLACE TRIGGER "vanzari_set_sync_audit_fields" BEFORE INSERT OR UPDATE ON "public"."vanzari" FOR EACH ROW EXECUTE FUNCTION "public"."set_sync_audit_fields"();



ALTER TABLE ONLY "public"."activitati_agricole"
    ADD CONSTRAINT "activitati_agricole_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."activitati_agricole"
    ADD CONSTRAINT "activitati_agricole_cultura_id_fkey" FOREIGN KEY ("cultura_id") REFERENCES "public"."culturi"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activitati_agricole"
    ADD CONSTRAINT "activitati_agricole_parcela_id_fkey" FOREIGN KEY ("parcela_id") REFERENCES "public"."parcele"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activitati_agricole"
    ADD CONSTRAINT "activitati_agricole_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activitati_agricole"
    ADD CONSTRAINT "activitati_agricole_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."activitati_extra_season"
    ADD CONSTRAINT "activitati_extra_season_parcela_id_fkey" FOREIGN KEY ("parcela_id") REFERENCES "public"."parcele"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activitati_extra_season"
    ADD CONSTRAINT "activitati_extra_season_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_conversations"
    ADD CONSTRAINT "ai_conversations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alert_dismissals"
    ADD CONSTRAINT "alert_dismissals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alert_dismissals"
    ADD CONSTRAINT "alert_dismissals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_target_tenant_id_fkey" FOREIGN KEY ("target_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cheltuieli_diverse"
    ADD CONSTRAINT "cheltuieli_diverse_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."cheltuieli_diverse"
    ADD CONSTRAINT "cheltuieli_diverse_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cheltuieli_diverse"
    ADD CONSTRAINT "cheltuieli_diverse_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."clienti"
    ADD CONSTRAINT "clienti_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."clienti"
    ADD CONSTRAINT "clienti_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clienti"
    ADD CONSTRAINT "clienti_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."comenzi"
    ADD CONSTRAINT "comenzi_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clienti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comenzi"
    ADD CONSTRAINT "comenzi_linked_vanzare_id_fkey" FOREIGN KEY ("linked_vanzare_id") REFERENCES "public"."vanzari"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comenzi"
    ADD CONSTRAINT "comenzi_parent_comanda_id_fkey" FOREIGN KEY ("parent_comanda_id") REFERENCES "public"."comenzi"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comenzi"
    ADD CONSTRAINT "comenzi_produs_id_fkey" FOREIGN KEY ("produs_id") REFERENCES "public"."produse"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comenzi"
    ADD CONSTRAINT "comenzi_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crop_varieties"
    ADD CONSTRAINT "crop_varieties_crop_id_fkey" FOREIGN KEY ("crop_id") REFERENCES "public"."crops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crop_varieties"
    ADD CONSTRAINT "crop_varieties_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crops"
    ADD CONSTRAINT "crops_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."culegatori"
    ADD CONSTRAINT "culegatori_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."culture_stage_logs"
    ADD CONSTRAINT "culture_stage_logs_cultura_id_fkey" FOREIGN KEY ("cultura_id") REFERENCES "public"."culturi"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."culture_stage_logs"
    ADD CONSTRAINT "culture_stage_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."culture_stage_logs"
    ADD CONSTRAINT "culture_stage_logs_unitate_id_fkey" FOREIGN KEY ("unitate_id") REFERENCES "public"."parcele"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."culturi"
    ADD CONSTRAINT "culturi_solar_id_fkey" FOREIGN KEY ("solar_id") REFERENCES "public"."parcele"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."culturi"
    ADD CONSTRAINT "culturi_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."etape_cultura"
    ADD CONSTRAINT "etape_cultura_cultura_id_fkey" FOREIGN KEY ("cultura_id") REFERENCES "public"."culturi"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."etape_cultura"
    ADD CONSTRAINT "etape_cultura_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integrations_google_contacts"
    ADD CONSTRAINT "integrations_google_contacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integrations_google_contacts"
    ADD CONSTRAINT "integrations_google_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."investitii"
    ADD CONSTRAINT "investitii_parcela_id_fkey" FOREIGN KEY ("parcela_id") REFERENCES "public"."parcele"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."investitii"
    ADD CONSTRAINT "investitii_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meteo_cache"
    ADD CONSTRAINT "meteo_cache_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."miscari_stoc"
    ADD CONSTRAINT "miscari_stoc_locatie_id_fkey" FOREIGN KEY ("locatie_id") REFERENCES "public"."parcele"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."miscari_stoc"
    ADD CONSTRAINT "miscari_stoc_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nomenclatoare"
    ADD CONSTRAINT "nomenclatoare_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parcele"
    ADD CONSTRAINT "parcele_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."parcele"
    ADD CONSTRAINT "parcele_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parcele"
    ADD CONSTRAINT "parcele_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."produse"
    ADD CONSTRAINT "produse_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recoltari"
    ADD CONSTRAINT "recoltari_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."recoltari"
    ADD CONSTRAINT "recoltari_culegator_id_fkey" FOREIGN KEY ("culegator_id") REFERENCES "public"."culegatori"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recoltari"
    ADD CONSTRAINT "recoltari_cultura_id_fkey" FOREIGN KEY ("cultura_id") REFERENCES "public"."culturi"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recoltari"
    ADD CONSTRAINT "recoltari_parcela_id_fkey" FOREIGN KEY ("parcela_id") REFERENCES "public"."parcele"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recoltari"
    ADD CONSTRAINT "recoltari_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recoltari"
    ADD CONSTRAINT "recoltari_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."solar_climate_logs"
    ADD CONSTRAINT "solar_climate_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."solar_climate_logs"
    ADD CONSTRAINT "solar_climate_logs_unitate_id_fkey" FOREIGN KEY ("unitate_id") REFERENCES "public"."parcele"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_settings"
    ADD CONSTRAINT "tenant_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vanzari_butasi"
    ADD CONSTRAINT "vanzari_butasi_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clienti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vanzari_butasi_items"
    ADD CONSTRAINT "vanzari_butasi_items_comanda_id_fkey" FOREIGN KEY ("comanda_id") REFERENCES "public"."vanzari_butasi"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vanzari_butasi_items"
    ADD CONSTRAINT "vanzari_butasi_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vanzari_butasi"
    ADD CONSTRAINT "vanzari_butasi_parcela_sursa_id_fkey" FOREIGN KEY ("parcela_sursa_id") REFERENCES "public"."parcele"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vanzari_butasi"
    ADD CONSTRAINT "vanzari_butasi_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vanzari"
    ADD CONSTRAINT "vanzari_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clienti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vanzari"
    ADD CONSTRAINT "vanzari_comanda_id_fkey" FOREIGN KEY ("comanda_id") REFERENCES "public"."comenzi"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vanzari"
    ADD CONSTRAINT "vanzari_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."vanzari"
    ADD CONSTRAINT "vanzari_produs_id_fkey" FOREIGN KEY ("produs_id") REFERENCES "public"."produse"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vanzari"
    ADD CONSTRAINT "vanzari_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vanzari"
    ADD CONSTRAINT "vanzari_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



CREATE POLICY "Superadmin can read all" ON "public"."analytics_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_superadmin" = true)))));



CREATE POLICY "Superadmins can read all events" ON "public"."analytics_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_superadmin" = true)))));



CREATE POLICY "Users can insert own events" ON "public"."analytics_events" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own meteo cache" ON "public"."meteo_cache" FOR INSERT WITH CHECK (("tenant_id" = (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid"));



CREATE POLICY "Users can insert own tenant settings" ON "public"."tenant_settings" FOR INSERT WITH CHECK (("tenant_id" = ("current_setting"('app.current_tenant_id'::"text", true))::"uuid"));



CREATE POLICY "Users can update own meteo cache" ON "public"."meteo_cache" FOR UPDATE USING (("tenant_id" = (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid")) WITH CHECK (("tenant_id" = (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid"));



CREATE POLICY "Users can update own tenant settings" ON "public"."tenant_settings" FOR UPDATE USING (("tenant_id" = ("current_setting"('app.current_tenant_id'::"text", true))::"uuid"));



CREATE POLICY "Users can view own meteo cache" ON "public"."meteo_cache" FOR SELECT USING (("tenant_id" = (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid"));



CREATE POLICY "Users can view own tenant settings" ON "public"."tenant_settings" FOR SELECT USING (("tenant_id" = ("current_setting"('app.current_tenant_id'::"text", true))::"uuid"));



ALTER TABLE "public"."activitati_agricole" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activitati_agricole_delete" ON "public"."activitati_agricole" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "activitati_agricole_insert" ON "public"."activitati_agricole" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "activitati_agricole_select" ON "public"."activitati_agricole" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "activitati_agricole_update" ON "public"."activitati_agricole" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



ALTER TABLE "public"."activitati_extra_season" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activitati_extra_season_delete" ON "public"."activitati_extra_season" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "activitati_extra_season_insert" ON "public"."activitati_extra_season" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "activitati_extra_season_select" ON "public"."activitati_extra_season" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "activitati_extra_season_update" ON "public"."activitati_extra_season" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "ai_conv_delete_own" ON "public"."ai_conversations" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "ai_conv_insert_own" ON "public"."ai_conversations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "ai_conv_select_own" ON "public"."ai_conversations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "ai_conv_update_own" ON "public"."ai_conversations" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."ai_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."alert_dismissals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "alert_dismissals_delete" ON "public"."alert_dismissals" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND ("tenant_id" = "public"."current_tenant_id"())));



CREATE POLICY "alert_dismissals_insert" ON "public"."alert_dismissals" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND ("tenant_id" = "public"."current_tenant_id"())));



CREATE POLICY "alert_dismissals_select" ON "public"."alert_dismissals" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND ("tenant_id" = "public"."current_tenant_id"())));



ALTER TABLE "public"."analytics_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "analytics_events_insert_own_tenant" ON "public"."analytics_events" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND ("tenant_id" = "public"."current_tenant_id"())));



CREATE POLICY "analytics_events_superadmin_delete" ON "public"."analytics_events" FOR DELETE USING ("public"."is_superadmin"());



CREATE POLICY "analytics_events_superadmin_insert" ON "public"."analytics_events" FOR INSERT WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "analytics_events_superadmin_select" ON "public"."analytics_events" FOR SELECT USING ("public"."is_superadmin"());



CREATE POLICY "analytics_events_superadmin_update" ON "public"."analytics_events" FOR UPDATE USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_superadmin_delete" ON "public"."audit_logs" FOR DELETE USING ("public"."is_superadmin"());



CREATE POLICY "audit_logs_superadmin_insert" ON "public"."audit_logs" FOR INSERT WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "audit_logs_superadmin_select" ON "public"."audit_logs" FOR SELECT USING ("public"."is_superadmin"());



CREATE POLICY "audit_logs_superadmin_update" ON "public"."audit_logs" FOR UPDATE USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



ALTER TABLE "public"."cheltuieli_diverse" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cheltuieli_diverse_delete" ON "public"."cheltuieli_diverse" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "cheltuieli_diverse_insert" ON "public"."cheltuieli_diverse" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "cheltuieli_diverse_select" ON "public"."cheltuieli_diverse" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "cheltuieli_diverse_update" ON "public"."cheltuieli_diverse" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



ALTER TABLE "public"."clienti" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clienti_delete" ON "public"."clienti" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "clienti_insert" ON "public"."clienti" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "clienti_select" ON "public"."clienti" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "clienti_update" ON "public"."clienti" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



ALTER TABLE "public"."comenzi" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comenzi_delete" ON "public"."comenzi" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "comenzi_insert" ON "public"."comenzi" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "comenzi_select" ON "public"."comenzi" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "comenzi_update" ON "public"."comenzi" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



ALTER TABLE "public"."crop_varieties" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "crop_varieties_delete" ON "public"."crop_varieties" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "crop_varieties_insert" ON "public"."crop_varieties" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "crop_varieties_select" ON "public"."crop_varieties" FOR SELECT TO "authenticated" USING ((("tenant_id" IS NULL) OR ("tenant_id" = "public"."current_tenant_id"())));



CREATE POLICY "crop_varieties_superadmin_all" ON "public"."crop_varieties" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "crop_varieties_update" ON "public"."crop_varieties" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



ALTER TABLE "public"."crops" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "crops_delete" ON "public"."crops" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "crops_insert" ON "public"."crops" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "crops_select" ON "public"."crops" FOR SELECT TO "authenticated" USING ((("tenant_id" IS NULL) OR ("tenant_id" = "public"."current_tenant_id"())));



CREATE POLICY "crops_update" ON "public"."crops" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



ALTER TABLE "public"."culegatori" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "culegatori_delete" ON "public"."culegatori" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "culegatori_insert" ON "public"."culegatori" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "culegatori_select" ON "public"."culegatori" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "culegatori_update" ON "public"."culegatori" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



ALTER TABLE "public"."culture_stage_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "culture_stage_logs_delete" ON "public"."culture_stage_logs" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "culture_stage_logs_insert" ON "public"."culture_stage_logs" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "culture_stage_logs_select" ON "public"."culture_stage_logs" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "culture_stage_logs_update" ON "public"."culture_stage_logs" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



ALTER TABLE "public"."culturi" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "culturi_delete" ON "public"."culturi" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "culturi_insert" ON "public"."culturi" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "culturi_select" ON "public"."culturi" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "culturi_superadmin_delete" ON "public"."culturi" FOR DELETE USING ("public"."is_superadmin"());



CREATE POLICY "culturi_superadmin_insert" ON "public"."culturi" FOR INSERT WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "culturi_superadmin_select" ON "public"."culturi" FOR SELECT USING ("public"."is_superadmin"());



CREATE POLICY "culturi_superadmin_update" ON "public"."culturi" FOR UPDATE USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "culturi_update" ON "public"."culturi" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



ALTER TABLE "public"."etape_cultura" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "etape_cultura_delete" ON "public"."etape_cultura" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "etape_cultura_insert" ON "public"."etape_cultura" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "etape_cultura_select" ON "public"."etape_cultura" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "etape_cultura_update" ON "public"."etape_cultura" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



ALTER TABLE "public"."feedback" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feedback_insert_own" ON "public"."feedback" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND (("tenant_id" = ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_superadmin" = true)))))));



CREATE POLICY "feedback_select_superadmin" ON "public"."feedback" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_superadmin" = true)))));



ALTER TABLE "public"."integrations_google_contacts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "integrations_google_contacts_admin_delete" ON "public"."integrations_google_contacts" FOR DELETE USING ((("user_email" = 'popa.andrei.sv@gmail.com'::"text") AND ("auth"."uid"() = "user_id")));



CREATE POLICY "integrations_google_contacts_admin_insert" ON "public"."integrations_google_contacts" FOR INSERT WITH CHECK ((("user_email" = 'popa.andrei.sv@gmail.com'::"text") AND ("auth"."uid"() = "user_id") AND ("tenant_id" = ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "integrations_google_contacts_admin_select" ON "public"."integrations_google_contacts" FOR SELECT USING ((("user_email" = 'popa.andrei.sv@gmail.com'::"text") AND ("auth"."uid"() = "user_id")));



CREATE POLICY "integrations_google_contacts_admin_update" ON "public"."integrations_google_contacts" FOR UPDATE USING ((("user_email" = 'popa.andrei.sv@gmail.com'::"text") AND ("auth"."uid"() = "user_id"))) WITH CHECK ((("user_email" = 'popa.andrei.sv@gmail.com'::"text") AND ("auth"."uid"() = "user_id") AND ("tenant_id" = ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "integrations_google_contacts_superadmin_delete" ON "public"."integrations_google_contacts" FOR DELETE USING ("public"."is_superadmin"());



CREATE POLICY "integrations_google_contacts_superadmin_insert" ON "public"."integrations_google_contacts" FOR INSERT WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "integrations_google_contacts_superadmin_select" ON "public"."integrations_google_contacts" FOR SELECT USING ("public"."is_superadmin"());



CREATE POLICY "integrations_google_contacts_superadmin_update" ON "public"."integrations_google_contacts" FOR UPDATE USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



ALTER TABLE "public"."investitii" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "investitii_delete" ON "public"."investitii" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "investitii_insert" ON "public"."investitii" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "investitii_select" ON "public"."investitii" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "investitii_update" ON "public"."investitii" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



ALTER TABLE "public"."meteo_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."miscari_stoc" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "miscari_stoc_delete" ON "public"."miscari_stoc" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "miscari_stoc_insert" ON "public"."miscari_stoc" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "miscari_stoc_select" ON "public"."miscari_stoc" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "miscari_stoc_update" ON "public"."miscari_stoc" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



ALTER TABLE "public"."nomenclatoare" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "nomenclatoare_delete" ON "public"."nomenclatoare" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "nomenclatoare_insert" ON "public"."nomenclatoare" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "nomenclatoare_select" ON "public"."nomenclatoare" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "nomenclatoare_update" ON "public"."nomenclatoare" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



ALTER TABLE "public"."parcele" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "parcele_delete" ON "public"."parcele" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "parcele_insert" ON "public"."parcele" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "parcele_select" ON "public"."parcele" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "parcele_update" ON "public"."parcele" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



ALTER TABLE "public"."produse" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "produse_delete_tenant" ON "public"."produse" FOR DELETE USING (("tenant_id" = ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "produse_insert_tenant" ON "public"."produse" FOR INSERT WITH CHECK (("tenant_id" = ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "produse_select_tenant" ON "public"."produse" FOR SELECT USING (("tenant_id" = ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "produse_update_tenant" ON "public"."produse" FOR UPDATE USING (("tenant_id" = ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_own_select" ON "public"."profiles" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "profiles_select_superadmin" ON "public"."profiles" FOR SELECT USING ("public"."is_superadmin"("auth"."uid"()));



CREATE POLICY "profiles_superadmin_select" ON "public"."profiles" FOR SELECT USING ("public"."is_superadmin"());



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK ((("id" = "auth"."uid"()) AND ("is_superadmin" = ( SELECT "p"."is_superadmin"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))) AND (NOT ("tenant_id" IS DISTINCT FROM ( SELECT "p"."tenant_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"())))) AND (NOT ("ai_messages_count" IS DISTINCT FROM ( SELECT "p"."ai_messages_count"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"())))) AND (NOT ("last_ai_usage_date" IS DISTINCT FROM ( SELECT "p"."last_ai_usage_date"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))))));



ALTER TABLE "public"."recoltari" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recoltari_delete" ON "public"."recoltari" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "recoltari_insert" ON "public"."recoltari" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "recoltari_select" ON "public"."recoltari" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "recoltari_update" ON "public"."recoltari" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



ALTER TABLE "public"."solar_climate_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "solar_climate_logs_delete" ON "public"."solar_climate_logs" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "solar_climate_logs_insert" ON "public"."solar_climate_logs" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "solar_climate_logs_select" ON "public"."solar_climate_logs" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "solar_climate_logs_update" ON "public"."solar_climate_logs" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



ALTER TABLE "public"."tenant_metrics_daily" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_metrics_daily_service_insert" ON "public"."tenant_metrics_daily" FOR INSERT WITH CHECK (false);



CREATE POLICY "tenant_metrics_daily_service_update" ON "public"."tenant_metrics_daily" FOR UPDATE USING (false);



CREATE POLICY "tenant_metrics_daily_superadmin_select" ON "public"."tenant_metrics_daily" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_superadmin" = true)))));



CREATE POLICY "tenant_owner_insert" ON "public"."tenants" FOR INSERT WITH CHECK (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "tenant_owner_policy" ON "public"."tenants" USING (("owner_user_id" = "auth"."uid"())) WITH CHECK (("owner_user_id" = "auth"."uid"()));



ALTER TABLE "public"."tenant_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenants_owner_or_superadmin_insert" ON "public"."tenants" FOR INSERT WITH CHECK ((("owner_user_id" = "auth"."uid"()) OR "public"."is_superadmin"()));



CREATE POLICY "tenants_owner_or_superadmin_select" ON "public"."tenants" FOR SELECT USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_superadmin"()));



CREATE POLICY "tenants_owner_update" ON "public"."tenants" FOR UPDATE USING (("owner_user_id" = "auth"."uid"())) WITH CHECK (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "tenants_superadmin_delete" ON "public"."tenants" FOR DELETE USING ("public"."is_superadmin"());



CREATE POLICY "tenants_superadmin_update" ON "public"."tenants" FOR UPDATE USING ("public"."is_superadmin"("auth"."uid"())) WITH CHECK ("public"."is_superadmin"("auth"."uid"()));



ALTER TABLE "public"."vanzari" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vanzari_butasi" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vanzari_butasi_delete" ON "public"."vanzari_butasi" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "vanzari_butasi_insert" ON "public"."vanzari_butasi" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



ALTER TABLE "public"."vanzari_butasi_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vanzari_butasi_items_delete" ON "public"."vanzari_butasi_items" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "vanzari_butasi_items_insert" ON "public"."vanzari_butasi_items" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "vanzari_butasi_items_select" ON "public"."vanzari_butasi_items" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "vanzari_butasi_items_update" ON "public"."vanzari_butasi_items" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "vanzari_butasi_select" ON "public"."vanzari_butasi" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "vanzari_butasi_update" ON "public"."vanzari_butasi" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "vanzari_delete" ON "public"."vanzari" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "vanzari_insert" ON "public"."vanzari" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "vanzari_select" ON "public"."vanzari" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "vanzari_update" ON "public"."vanzari" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_count_audit_logs"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_count_audit_logs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_count_audit_logs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_list_audit_logs"("p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_list_audit_logs"("p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_list_audit_logs"("p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_list_tenants"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_list_tenants"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_list_tenants"() TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_set_tenant_plan"("p_tenant_id" "uuid", "p_plan" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_set_tenant_plan"("p_tenant_id" "uuid", "p_plan" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_set_tenant_plan"("p_tenant_id" "uuid", "p_plan" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."bucharest_today"() TO "anon";
GRANT ALL ON FUNCTION "public"."bucharest_today"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."bucharest_today"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_and_increment_ai_usage"("p_user_id" "uuid", "p_today" "date", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_and_increment_ai_usage"("p_user_id" "uuid", "p_today" "date", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_and_increment_ai_usage"("p_user_id" "uuid", "p_today" "date", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_culturi_suprafata"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_culturi_suprafata"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_culturi_suprafata"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_stock_not_negative"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_stock_not_negative"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_stock_not_negative"() TO "service_role";



GRANT ALL ON TABLE "public"."recoltari" TO "anon";
GRANT ALL ON TABLE "public"."recoltari" TO "authenticated";
GRANT ALL ON TABLE "public"."recoltari" TO "service_role";



GRANT ALL ON FUNCTION "public"."create_recoltare_with_stock"("p_data" "date", "p_parcela_id" "uuid", "p_culegator_id" "uuid", "p_kg_cal1" numeric, "p_kg_cal2" numeric, "p_observatii" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_recoltare_with_stock"("p_data" "date", "p_parcela_id" "uuid", "p_culegator_id" "uuid", "p_kg_cal1" numeric, "p_kg_cal2" numeric, "p_observatii" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_recoltare_with_stock"("p_data" "date", "p_parcela_id" "uuid", "p_culegator_id" "uuid", "p_kg_cal1" numeric, "p_kg_cal2" numeric, "p_observatii" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_recoltare_with_stock"("p_data" "date", "p_parcela_id" "uuid", "p_culegator_id" "uuid", "p_kg_cal1" numeric, "p_kg_cal2" numeric, "p_observatii" "text", "p_tenant_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_recoltare_with_stock"("p_data" "date", "p_parcela_id" "uuid", "p_culegator_id" "uuid", "p_kg_cal1" numeric, "p_kg_cal2" numeric, "p_observatii" "text", "p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_recoltare_with_stock"("p_data" "date", "p_parcela_id" "uuid", "p_culegator_id" "uuid", "p_kg_cal1" numeric, "p_kg_cal2" numeric, "p_observatii" "text", "p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_recoltare_with_stock"("p_data" "date", "p_parcela_id" "uuid", "p_culegator_id" "uuid", "p_kg_cal1" numeric, "p_kg_cal2" numeric, "p_observatii" "text", "p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."vanzari" TO "anon";
GRANT ALL ON TABLE "public"."vanzari" TO "authenticated";
GRANT ALL ON TABLE "public"."vanzari" TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_vanzare_with_stock"("p_data" "date", "p_client_id" "uuid", "p_comanda_id" "uuid", "p_cantitate_kg" numeric, "p_pret_lei_kg" numeric, "p_status_plata" "text", "p_observatii_ladite" "text", "p_client_sync_id" "text", "p_sync_status" "text", "p_tenant_id" "uuid", "p_calitate" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_vanzare_with_stock"("p_data" "date", "p_client_id" "uuid", "p_comanda_id" "uuid", "p_cantitate_kg" numeric, "p_pret_lei_kg" numeric, "p_status_plata" "text", "p_observatii_ladite" "text", "p_client_sync_id" "text", "p_sync_status" "text", "p_tenant_id" "uuid", "p_calitate" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_vanzare_with_stock"("p_data" "date", "p_client_id" "uuid", "p_comanda_id" "uuid", "p_cantitate_kg" numeric, "p_pret_lei_kg" numeric, "p_status_plata" "text", "p_observatii_ladite" "text", "p_client_sync_id" "text", "p_sync_status" "text", "p_tenant_id" "uuid", "p_calitate" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_vanzare_with_stock"("p_data" "date", "p_client_id" "uuid", "p_comanda_id" "uuid", "p_cantitate_kg" numeric, "p_pret_lei_kg" numeric, "p_status_plata" "text", "p_observatii_ladite" "text", "p_client_sync_id" "text", "p_sync_status" "text", "p_tenant_id" "uuid", "p_calitate" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_tenant_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_tenant_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_comanda_atomic"("p_comanda_id" "uuid", "p_tenant_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_comanda_atomic"("p_comanda_id" "uuid", "p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_comanda_atomic"("p_comanda_id" "uuid", "p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_comanda_atomic"("p_comanda_id" "uuid", "p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_demo_for_tenant"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_demo_for_tenant"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_demo_for_tenant"("p_tenant_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_recoltare_with_stock"("p_recoltare_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_recoltare_with_stock"("p_recoltare_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_recoltare_with_stock"("p_recoltare_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_recoltare_with_stock"("p_recoltare_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_vanzare_with_stock"("p_vanzare_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_vanzare_with_stock"("p_vanzare_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_vanzare_with_stock"("p_vanzare_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."deliver_order_atomic"("p_order_id" "uuid", "p_delivered_qty" numeric, "p_payment_status" "text", "p_remaining_delivery_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."deliver_order_atomic"("p_order_id" "uuid", "p_delivered_qty" numeric, "p_payment_status" "text", "p_remaining_delivery_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."deliver_order_atomic"("p_order_id" "uuid", "p_delivered_qty" numeric, "p_payment_status" "text", "p_remaining_delivery_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."deliver_order_atomic"("p_order_id" "uuid", "p_delivered_qty" numeric, "p_payment_status" "text", "p_remaining_delivery_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_superadmin_for_plan_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_superadmin_for_plan_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_superadmin_for_plan_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_vanzari_butasi_items_tenant"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_vanzari_butasi_items_tenant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_vanzari_butasi_items_tenant"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_business_id"("prefix" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_business_id"("prefix" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_business_id"("prefix" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_auth_user_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_auth_user_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_auth_user_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_auth_user_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."integrations_google_contacts_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."integrations_google_contacts_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."integrations_google_contacts_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_superadmin"("check_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_superadmin"("check_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_superadmin"("check_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_privileged_profile_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_privileged_profile_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_privileged_profile_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_profiles_privileged_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_profiles_privileged_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_profiles_privileged_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recoltari_sync_cantitate_kg"() TO "anon";
GRANT ALL ON FUNCTION "public"."recoltari_sync_cantitate_kg"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recoltari_sync_cantitate_kg"() TO "service_role";



GRANT ALL ON TABLE "public"."tenant_metrics_daily" TO "anon";
GRANT ALL ON TABLE "public"."tenant_metrics_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_metrics_daily" TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_tenant_metrics_daily"("p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_tenant_metrics_daily"("p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_tenant_metrics_daily"("p_date" "date") TO "service_role";



GRANT ALL ON TABLE "public"."comenzi" TO "anon";
GRANT ALL ON TABLE "public"."comenzi" TO "authenticated";
GRANT ALL ON TABLE "public"."comenzi" TO "service_role";



REVOKE ALL ON FUNCTION "public"."reopen_comanda_atomic"("p_comanda_id" "uuid", "p_tenant_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reopen_comanda_atomic"("p_comanda_id" "uuid", "p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reopen_comanda_atomic"("p_comanda_id" "uuid", "p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reopen_comanda_atomic"("p_comanda_id" "uuid", "p_tenant_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."resolve_recoltare_stock_identity"("p_parcela_id" "uuid", "p_observatii" "text", "p_tenant_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolve_recoltare_stock_identity"("p_parcela_id" "uuid", "p_observatii" "text", "p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_recoltare_stock_identity"("p_parcela_id" "uuid", "p_observatii" "text", "p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_recoltare_stock_identity"("p_parcela_id" "uuid", "p_observatii" "text", "p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_demo_for_tenant"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."seed_demo_for_tenant"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_demo_for_tenant"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_demo_for_tenant"("p_tenant_id" "uuid", "p_demo_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."seed_demo_for_tenant"("p_tenant_id" "uuid", "p_demo_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_demo_for_tenant"("p_tenant_id" "uuid", "p_demo_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_analytics_event_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_analytics_event_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_analytics_event_context"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_audit_fields_minimal"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_audit_fields_minimal"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_audit_fields_minimal"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_comenzi_tenant_and_audit"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_comenzi_tenant_and_audit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_comenzi_tenant_and_audit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_culturi_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_culturi_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_culturi_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_sync_audit_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_sync_audit_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_sync_audit_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_tenant_id_from_owner"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_tenant_id_from_owner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_tenant_id_from_owner"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at_profiles"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at_profiles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at_profiles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_vanzari_butasi_tenant_and_public_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_vanzari_butasi_tenant_and_public_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_vanzari_butasi_tenant_and_public_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_recoltare_stock_movements"("p_recoltare_id" "uuid", "p_tenant_id" "uuid", "p_parcela_id" "uuid", "p_data" "date", "p_kg_cal1" numeric, "p_kg_cal2" numeric, "p_observatii" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_recoltare_stock_movements"("p_recoltare_id" "uuid", "p_tenant_id" "uuid", "p_parcela_id" "uuid", "p_data" "date", "p_kg_cal1" numeric, "p_kg_cal2" numeric, "p_observatii" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_recoltare_stock_movements"("p_recoltare_id" "uuid", "p_tenant_id" "uuid", "p_parcela_id" "uuid", "p_data" "date", "p_kg_cal1" numeric, "p_kg_cal2" numeric, "p_observatii" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_recoltare_stock_movements"("p_recoltare_id" "uuid", "p_tenant_id" "uuid", "p_parcela_id" "uuid", "p_data" "date", "p_kg_cal1" numeric, "p_kg_cal2" numeric, "p_observatii" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."tenant_has_core_data"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."tenant_has_core_data"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."tenant_has_core_data"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_my_farm_name"("p_farm_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_my_farm_name"("p_farm_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_my_farm_name"("p_farm_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_recoltare_with_stock"("p_recoltare_id" "uuid", "p_data" "date", "p_parcela_id" "uuid", "p_culegator_id" "uuid", "p_kg_cal1" numeric, "p_kg_cal2" numeric, "p_observatii" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_recoltare_with_stock"("p_recoltare_id" "uuid", "p_data" "date", "p_parcela_id" "uuid", "p_culegator_id" "uuid", "p_kg_cal1" numeric, "p_kg_cal2" numeric, "p_observatii" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_recoltare_with_stock"("p_recoltare_id" "uuid", "p_data" "date", "p_parcela_id" "uuid", "p_culegator_id" "uuid", "p_kg_cal1" numeric, "p_kg_cal2" numeric, "p_observatii" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_recoltare_with_stock"("p_recoltare_id" "uuid", "p_data" "date", "p_parcela_id" "uuid", "p_culegator_id" "uuid", "p_kg_cal1" numeric, "p_kg_cal2" numeric, "p_observatii" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_vanzare_with_stock"("p_vanzare_id" "uuid", "p_data" "date", "p_client_id" "uuid", "p_cantitate_kg" numeric, "p_pret_lei_kg" numeric, "p_status_plata" "text", "p_observatii_ladite" "text", "p_tenant_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_vanzare_with_stock"("p_vanzare_id" "uuid", "p_data" "date", "p_client_id" "uuid", "p_cantitate_kg" numeric, "p_pret_lei_kg" numeric, "p_status_plata" "text", "p_observatii_ladite" "text", "p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_vanzare_with_stock"("p_vanzare_id" "uuid", "p_data" "date", "p_client_id" "uuid", "p_cantitate_kg" numeric, "p_pret_lei_kg" numeric, "p_status_plata" "text", "p_observatii_ladite" "text", "p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_vanzare_with_stock"("p_vanzare_id" "uuid", "p_data" "date", "p_client_id" "uuid", "p_cantitate_kg" numeric, "p_pret_lei_kg" numeric, "p_status_plata" "text", "p_observatii_ladite" "text", "p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_with_idempotency"("table_name" "text", "payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_with_idempotency"("table_name" "text", "payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_with_idempotency"("table_name" "text", "payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_can_manage_tenant"("p_tenant_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_can_manage_tenant"("p_tenant_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_manage_tenant"("p_tenant_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_comanda_status_transition"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_comanda_status_transition"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_comanda_status_transition"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_suprafata_culturi"("p_solar_id" "uuid", "p_suprafata" numeric, "p_cultura_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_suprafata_culturi"("p_solar_id" "uuid", "p_suprafata" numeric, "p_cultura_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_suprafata_culturi"("p_solar_id" "uuid", "p_suprafata" numeric, "p_cultura_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."activitati_agricole" TO "anon";
GRANT ALL ON TABLE "public"."activitati_agricole" TO "authenticated";
GRANT ALL ON TABLE "public"."activitati_agricole" TO "service_role";



GRANT ALL ON TABLE "public"."activitati_extended" TO "anon";
GRANT ALL ON TABLE "public"."activitati_extended" TO "authenticated";
GRANT ALL ON TABLE "public"."activitati_extended" TO "service_role";



GRANT ALL ON TABLE "public"."activitati_extra_season" TO "anon";
GRANT ALL ON TABLE "public"."activitati_extra_season" TO "authenticated";
GRANT ALL ON TABLE "public"."activitati_extra_season" TO "service_role";



GRANT ALL ON TABLE "public"."parcele" TO "anon";
GRANT ALL ON TABLE "public"."parcele" TO "authenticated";
GRANT ALL ON TABLE "public"."parcele" TO "service_role";



GRANT ALL ON TABLE "public"."activitati_extra_extended" TO "anon";
GRANT ALL ON TABLE "public"."activitati_extra_extended" TO "authenticated";
GRANT ALL ON TABLE "public"."activitati_extra_extended" TO "service_role";



GRANT ALL ON TABLE "public"."ai_conversations" TO "anon";
GRANT ALL ON TABLE "public"."ai_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."alert_dismissals" TO "anon";
GRANT ALL ON TABLE "public"."alert_dismissals" TO "authenticated";
GRANT ALL ON TABLE "public"."alert_dismissals" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_events" TO "anon";
GRANT ALL ON TABLE "public"."analytics_events" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_events" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."business_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."business_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."business_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cheltuieli_diverse" TO "anon";
GRANT ALL ON TABLE "public"."cheltuieli_diverse" TO "authenticated";
GRANT ALL ON TABLE "public"."cheltuieli_diverse" TO "service_role";



GRANT ALL ON TABLE "public"."clienti" TO "anon";
GRANT ALL ON TABLE "public"."clienti" TO "authenticated";
GRANT ALL ON TABLE "public"."clienti" TO "service_role";



GRANT ALL ON TABLE "public"."crop_varieties" TO "anon";
GRANT ALL ON TABLE "public"."crop_varieties" TO "authenticated";
GRANT ALL ON TABLE "public"."crop_varieties" TO "service_role";



GRANT ALL ON TABLE "public"."crops" TO "anon";
GRANT ALL ON TABLE "public"."crops" TO "authenticated";
GRANT ALL ON TABLE "public"."crops" TO "service_role";



GRANT ALL ON TABLE "public"."culegatori" TO "anon";
GRANT ALL ON TABLE "public"."culegatori" TO "authenticated";
GRANT ALL ON TABLE "public"."culegatori" TO "service_role";



GRANT ALL ON TABLE "public"."culture_stage_logs" TO "anon";
GRANT ALL ON TABLE "public"."culture_stage_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."culture_stage_logs" TO "service_role";



GRANT ALL ON TABLE "public"."culturi" TO "anon";
GRANT ALL ON TABLE "public"."culturi" TO "authenticated";
GRANT ALL ON TABLE "public"."culturi" TO "service_role";



GRANT ALL ON TABLE "public"."etape_cultura" TO "anon";
GRANT ALL ON TABLE "public"."etape_cultura" TO "authenticated";
GRANT ALL ON TABLE "public"."etape_cultura" TO "service_role";



GRANT ALL ON TABLE "public"."feedback" TO "anon";
GRANT ALL ON TABLE "public"."feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback" TO "service_role";



GRANT ALL ON TABLE "public"."integrations_google_contacts" TO "anon";
GRANT ALL ON TABLE "public"."integrations_google_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."integrations_google_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."investitii" TO "anon";
GRANT ALL ON TABLE "public"."investitii" TO "authenticated";
GRANT ALL ON TABLE "public"."investitii" TO "service_role";



GRANT ALL ON TABLE "public"."meteo_cache" TO "anon";
GRANT ALL ON TABLE "public"."meteo_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."meteo_cache" TO "service_role";



GRANT ALL ON TABLE "public"."miscari_stoc" TO "anon";
GRANT ALL ON TABLE "public"."miscari_stoc" TO "authenticated";
GRANT ALL ON TABLE "public"."miscari_stoc" TO "service_role";



GRANT ALL ON TABLE "public"."nomenclatoare" TO "anon";
GRANT ALL ON TABLE "public"."nomenclatoare" TO "authenticated";
GRANT ALL ON TABLE "public"."nomenclatoare" TO "service_role";



GRANT ALL ON TABLE "public"."parcele_extended" TO "anon";
GRANT ALL ON TABLE "public"."parcele_extended" TO "authenticated";
GRANT ALL ON TABLE "public"."parcele_extended" TO "service_role";



GRANT ALL ON TABLE "public"."produse" TO "anon";
GRANT ALL ON TABLE "public"."produse" TO "authenticated";
GRANT ALL ON TABLE "public"."produse" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."solar_climate_logs" TO "anon";
GRANT ALL ON TABLE "public"."solar_climate_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."solar_climate_logs" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_settings" TO "anon";
GRANT ALL ON TABLE "public"."tenant_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_settings" TO "service_role";



GRANT ALL ON TABLE "public"."tenants" TO "anon";
GRANT ALL ON TABLE "public"."tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."tenants" TO "service_role";



GRANT ALL ON TABLE "public"."vanzari_butasi" TO "anon";
GRANT ALL ON TABLE "public"."vanzari_butasi" TO "authenticated";
GRANT ALL ON TABLE "public"."vanzari_butasi" TO "service_role";



GRANT ALL ON TABLE "public"."vanzari_butasi_extended" TO "anon";
GRANT ALL ON TABLE "public"."vanzari_butasi_extended" TO "authenticated";
GRANT ALL ON TABLE "public"."vanzari_butasi_extended" TO "service_role";



GRANT ALL ON TABLE "public"."vanzari_butasi_items" TO "anon";
GRANT ALL ON TABLE "public"."vanzari_butasi_items" TO "authenticated";
GRANT ALL ON TABLE "public"."vanzari_butasi_items" TO "service_role";



GRANT ALL ON TABLE "public"."vanzari_extended" TO "anon";
GRANT ALL ON TABLE "public"."vanzari_extended" TO "authenticated";
GRANT ALL ON TABLE "public"."vanzari_extended" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







