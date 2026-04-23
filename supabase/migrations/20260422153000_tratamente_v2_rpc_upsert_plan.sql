-- Tratamente V2: acelasi RPC public, dar payload-ul liniilor poate contine `produse[]`.
-- Limitare pas 3: RPC-ul pastreaza pattern-ul existent delete+insert pentru linii;
-- aplicari_tratament au FK ON DELETE SET NULL, deci istoricul aplicarilor nu este sters.

CREATE OR REPLACE FUNCTION public.upsert_plan_tratament_cu_linii(
  p_plan_id uuid,
  p_plan_data jsonb,
  p_linii jsonb,
  p_parcele_ids uuid[],
  p_an integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_plan_id uuid;
  v_linie jsonb;
  v_produs jsonb;
  v_produse jsonb;
  v_linie_id uuid;
  v_parcela_id uuid;
  v_selected_parcele uuid[] := COALESCE(p_parcele_ids, ARRAY[]::uuid[]);
  v_existing_assoc_id uuid;
  v_line_items jsonb;
  v_parcele_json jsonb;
  v_plan_json jsonb;
  v_produs_ordine integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Neautorizat';
  END IF;

  SELECT public.current_tenant_id()
  INTO v_tenant_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant invalid pentru utilizatorul curent.';
  END IF;

  IF p_plan_data IS NULL OR jsonb_typeof(p_plan_data) <> 'object' THEN
    RAISE EXCEPTION 'Datele planului sunt invalide.';
  END IF;

  IF p_linii IS NULL OR jsonb_typeof(p_linii) <> 'array' THEN
    RAISE EXCEPTION 'Liniile planului sunt invalide.';
  END IF;

  IF p_an IS NULL OR p_an < 2020 OR p_an > 2100 THEN
    RAISE EXCEPTION 'Anul de asociere este invalid.';
  END IF;

  IF p_plan_id IS NULL THEN
    INSERT INTO public.planuri_tratament (
      tenant_id,
      nume,
      cultura_tip,
      descriere,
      activ,
      arhivat,
      created_by,
      updated_by
    )
    VALUES (
      v_tenant_id,
      NULLIF(BTRIM(p_plan_data ->> 'nume'), ''),
      NULLIF(BTRIM(p_plan_data ->> 'cultura_tip'), ''),
      NULLIF(BTRIM(p_plan_data ->> 'descriere'), ''),
      COALESCE((p_plan_data ->> 'activ')::boolean, true),
      COALESCE((p_plan_data ->> 'arhivat')::boolean, false),
      v_user_id,
      v_user_id
    )
    RETURNING id INTO v_plan_id;
  ELSE
    PERFORM 1
    FROM public.planuri_tratament
    WHERE id = p_plan_id
      AND tenant_id = v_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Planul de tratament nu există în tenantul curent.';
    END IF;

    UPDATE public.planuri_tratament
    SET
      nume = NULLIF(BTRIM(p_plan_data ->> 'nume'), ''),
      cultura_tip = NULLIF(BTRIM(p_plan_data ->> 'cultura_tip'), ''),
      descriere = NULLIF(BTRIM(p_plan_data ->> 'descriere'), ''),
      activ = COALESCE((p_plan_data ->> 'activ')::boolean, activ),
      arhivat = COALESCE((p_plan_data ->> 'arhivat')::boolean, arhivat),
      updated_by = v_user_id
    WHERE id = p_plan_id
      AND tenant_id = v_tenant_id;

    v_plan_id := p_plan_id;
  END IF;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Planul nu a putut fi salvat.';
  END IF;

  DELETE FROM public.planuri_tratament_linii
  WHERE plan_id = v_plan_id
    AND tenant_id = v_tenant_id;

  FOR v_linie IN
    SELECT value
    FROM jsonb_array_elements(p_linii)
  LOOP
    v_produse := CASE
      WHEN jsonb_typeof(v_linie -> 'produse') = 'array'
        AND jsonb_array_length(v_linie -> 'produse') > 0
      THEN v_linie -> 'produse'
      ELSE jsonb_build_array(
        jsonb_build_object(
          'ordine', 1,
          'produs_id', v_linie ->> 'produs_id',
          'produs_nume_manual', v_linie ->> 'produs_nume_manual',
          'doza_ml_per_hl', v_linie ->> 'doza_ml_per_hl',
          'doza_l_per_ha', v_linie ->> 'doza_l_per_ha',
          'observatii', v_linie ->> 'observatii'
        )
      )
    END;

    INSERT INTO public.planuri_tratament_linii (
      tenant_id,
      plan_id,
      ordine,
      stadiu_trigger,
      cohort_trigger,
      tip_interventie,
      scop,
      regula_repetare,
      interval_repetare_zile,
      numar_repetari_max,
      fereastra_start_offset_zile,
      fereastra_end_offset_zile,
      produs_id,
      produs_nume_manual,
      doza_ml_per_hl,
      doza_l_per_ha,
      observatii
    )
    VALUES (
      v_tenant_id,
      v_plan_id,
      COALESCE((v_linie ->> 'ordine')::integer, 0),
      NULLIF(BTRIM(v_linie ->> 'stadiu_trigger'), ''),
      NULLIF(BTRIM(v_linie ->> 'cohort_trigger'), ''),
      NULLIF(BTRIM(v_linie ->> 'tip_interventie'), ''),
      NULLIF(BTRIM(v_linie ->> 'scop'), ''),
      COALESCE(NULLIF(BTRIM(v_linie ->> 'regula_repetare'), ''), 'fara_repetare'),
      NULLIF(v_linie ->> 'interval_repetare_zile', '')::integer,
      NULLIF(v_linie ->> 'numar_repetari_max', '')::integer,
      NULLIF(v_linie ->> 'fereastra_start_offset_zile', '')::integer,
      NULLIF(v_linie ->> 'fereastra_end_offset_zile', '')::integer,
      NULLIF(v_linie ->> 'produs_id', '')::uuid,
      NULLIF(BTRIM(v_linie ->> 'produs_nume_manual'), ''),
      NULLIF(v_linie ->> 'doza_ml_per_hl', '')::numeric,
      NULLIF(v_linie ->> 'doza_l_per_ha', '')::numeric,
      NULLIF(BTRIM(v_linie ->> 'observatii'), '')
    )
    RETURNING id INTO v_linie_id;

    v_produs_ordine := 0;
    FOR v_produs IN
      SELECT value
      FROM jsonb_array_elements(v_produse)
    LOOP
      v_produs_ordine := v_produs_ordine + 1;

      INSERT INTO public.planuri_tratament_linie_produse (
        tenant_id,
        plan_linie_id,
        ordine,
        produs_id,
        produs_nume_manual,
        produs_nume_snapshot,
        substanta_activa_snapshot,
        tip_snapshot,
        frac_irac_snapshot,
        phi_zile_snapshot,
        doza_ml_per_hl,
        doza_l_per_ha,
        observatii
      )
      SELECT
        v_tenant_id,
        v_linie_id,
        COALESCE(NULLIF(v_produs ->> 'ordine', '')::integer, v_produs_ordine),
        payload.produs_id,
        CASE WHEN payload.produs_id IS NULL THEN payload.produs_nume_manual ELSE NULL END,
        COALESCE(
          produs.nume_comercial,
          NULLIF(BTRIM(v_produs ->> 'produs_nume_snapshot'), ''),
          payload.produs_nume_manual
        ),
        COALESCE(produs.substanta_activa, NULLIF(BTRIM(v_produs ->> 'substanta_activa_snapshot'), '')),
        COALESCE(produs.tip, NULLIF(BTRIM(v_produs ->> 'tip_snapshot'), '')),
        COALESCE(produs.frac_irac, NULLIF(BTRIM(v_produs ->> 'frac_irac_snapshot'), '')),
        COALESCE(produs.phi_zile, NULLIF(v_produs ->> 'phi_zile_snapshot', '')::integer),
        NULLIF(v_produs ->> 'doza_ml_per_hl', '')::numeric,
        NULLIF(v_produs ->> 'doza_l_per_ha', '')::numeric,
        NULLIF(BTRIM(v_produs ->> 'observatii'), '')
      FROM (
        SELECT
          NULLIF(v_produs ->> 'produs_id', '')::uuid AS produs_id,
          NULLIF(BTRIM(v_produs ->> 'produs_nume_manual'), '') AS produs_nume_manual
      ) payload
      LEFT JOIN public.produse_fitosanitare produs
        ON produs.id = payload.produs_id
       AND (produs.tenant_id IS NULL OR produs.tenant_id = v_tenant_id)
      WHERE COALESCE(
        produs.nume_comercial,
        NULLIF(BTRIM(v_produs ->> 'produs_nume_snapshot'), ''),
        payload.produs_nume_manual
      ) IS NOT NULL;
    END LOOP;
  END LOOP;

  UPDATE public.parcele_planuri
  SET activ = false
  WHERE tenant_id = v_tenant_id
    AND plan_id = v_plan_id
    AND an = p_an
    AND activ = true;

  IF p_parcele_ids IS NOT NULL THEN
    FOREACH v_parcela_id IN ARRAY v_selected_parcele
    LOOP
      PERFORM 1
      FROM public.parcele
      WHERE id = v_parcela_id
        AND tenant_id = v_tenant_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Parcela % nu aparține tenantului curent.', v_parcela_id;
      END IF;

      UPDATE public.parcele_planuri
      SET activ = false
      WHERE tenant_id = v_tenant_id
        AND parcela_id = v_parcela_id
        AND an = p_an
        AND activ = true;

      SELECT id
      INTO v_existing_assoc_id
      FROM public.parcele_planuri
      WHERE tenant_id = v_tenant_id
        AND parcela_id = v_parcela_id
        AND plan_id = v_plan_id
        AND an = p_an
      LIMIT 1;

      IF v_existing_assoc_id IS NULL THEN
        INSERT INTO public.parcele_planuri (
          tenant_id,
          parcela_id,
          plan_id,
          an,
          activ
        )
        VALUES (
          v_tenant_id,
          v_parcela_id,
          v_plan_id,
          p_an,
          true
        );
      ELSE
        UPDATE public.parcele_planuri
        SET activ = true
        WHERE id = v_existing_assoc_id
          AND tenant_id = v_tenant_id;
      END IF;

      v_existing_assoc_id := NULL;
    END LOOP;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'tenant_id', l.tenant_id,
        'plan_id', l.plan_id,
        'ordine', l.ordine,
        'stadiu_trigger', l.stadiu_trigger,
        'cohort_trigger', l.cohort_trigger,
        'tip_interventie', l.tip_interventie,
        'scop', l.scop,
        'regula_repetare', l.regula_repetare,
        'interval_repetare_zile', l.interval_repetare_zile,
        'numar_repetari_max', l.numar_repetari_max,
        'fereastra_start_offset_zile', l.fereastra_start_offset_zile,
        'fereastra_end_offset_zile', l.fereastra_end_offset_zile,
        'produs_id', l.produs_id,
        'produs_nume_manual', l.produs_nume_manual,
        'doza_ml_per_hl', l.doza_ml_per_hl,
        'doza_l_per_ha', l.doza_l_per_ha,
        'observatii', l.observatii,
        'created_at', l.created_at,
        'updated_at', l.updated_at,
        'produse', COALESCE((
          SELECT jsonb_agg(to_jsonb(lp) ORDER BY lp.ordine ASC)
          FROM public.planuri_tratament_linie_produse lp
          WHERE lp.plan_linie_id = l.id
            AND lp.tenant_id = v_tenant_id
        ), '[]'::jsonb)
      )
      ORDER BY l.ordine ASC, l.created_at ASC
    ),
    '[]'::jsonb
  )
  INTO v_line_items
  FROM public.planuri_tratament_linii l
  WHERE l.tenant_id = v_tenant_id
    AND l.plan_id = v_plan_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', pp.id,
        'tenant_id', pp.tenant_id,
        'parcela_id', pp.parcela_id,
        'plan_id', pp.plan_id,
        'an', pp.an,
        'activ', pp.activ,
        'created_at', pp.created_at,
        'updated_at', pp.updated_at,
        'parcela_nume', p.nume_parcela,
        'parcela_cod', p.id_parcela,
        'suprafata_m2', p.suprafata_m2
      )
      ORDER BY pp.an DESC, p.nume_parcela ASC
    ),
    '[]'::jsonb
  )
  INTO v_parcele_json
  FROM public.parcele_planuri pp
  JOIN public.parcele p
    ON p.id = pp.parcela_id
   AND p.tenant_id = v_tenant_id
  WHERE pp.tenant_id = v_tenant_id
    AND pp.plan_id = v_plan_id
    AND pp.activ = true;

  SELECT jsonb_build_object(
    'id', pt.id,
    'tenant_id', pt.tenant_id,
    'nume', pt.nume,
    'cultura_tip', pt.cultura_tip,
    'descriere', pt.descriere,
    'activ', pt.activ,
    'arhivat', pt.arhivat,
    'created_at', pt.created_at,
    'updated_at', pt.updated_at,
    'created_by', pt.created_by,
    'updated_by', pt.updated_by
  )
  INTO v_plan_json
  FROM public.planuri_tratament pt
  WHERE pt.id = v_plan_id
    AND pt.tenant_id = v_tenant_id;

  RETURN jsonb_build_object(
    'plan', v_plan_json,
    'linii', v_line_items,
    'parcele_asociate', v_parcele_json
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_plan_tratament_cu_linii(uuid, jsonb, jsonb, uuid[], integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_plan_tratament_cu_linii(uuid, jsonb, jsonb, uuid[], integer) TO service_role;

NOTIFY pgrst, 'reload schema';
