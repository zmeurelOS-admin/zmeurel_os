do $$
declare
  policy_row record;
  rewritten_qual text;
  rewritten_with_check text;
  role_clause text;
  using_clause text;
  with_check_clause text;
begin
  for policy_row in
    select
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual,
      with_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') ilike '%from tenants%'
        or coalesce(with_check, '') ilike '%from tenants%'
      )
      and (
        coalesce(qual, '') ilike '%owner_user_id = auth.uid()%'
        or coalesce(with_check, '') ilike '%owner_user_id = auth.uid()%'
      )
    order by tablename, policyname
  loop
    rewritten_qual := policy_row.qual;
    rewritten_with_check := policy_row.with_check;

    if rewritten_qual is not null then
      rewritten_qual := regexp_replace(
        rewritten_qual,
        'EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+tenants\s+t\s+WHERE\s+\(\(t\.id\s*=\s*([[:alnum:]_\.]+)\)\s+AND\s+\(t\.owner_user_id\s*=\s*auth\.uid\(\)\)\)\)',
        '(\1 = ( SELECT tenant_id FROM public.profiles WHERE id = auth.uid() ))',
        'gi'
      );

      rewritten_qual := regexp_replace(
        rewritten_qual,
        'SELECT\s+(?:tenants|t)\.id\s+FROM\s+tenants(?:\s+t)?\s+WHERE\s+\((?:tenants|t)\.owner_user_id\s*=\s*auth\.uid\(\)\)\s+LIMIT\s+1',
        'SELECT tenant_id FROM public.profiles WHERE id = auth.uid()',
        'gi'
      );
    end if;

    if rewritten_with_check is not null then
      rewritten_with_check := regexp_replace(
        rewritten_with_check,
        'EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+tenants\s+t\s+WHERE\s+\(\(t\.id\s*=\s*([[:alnum:]_\.]+)\)\s+AND\s+\(t\.owner_user_id\s*=\s*auth\.uid\(\)\)\)\)',
        '(\1 = ( SELECT tenant_id FROM public.profiles WHERE id = auth.uid() ))',
        'gi'
      );

      rewritten_with_check := regexp_replace(
        rewritten_with_check,
        'SELECT\s+(?:tenants|t)\.id\s+FROM\s+tenants(?:\s+t)?\s+WHERE\s+\((?:tenants|t)\.owner_user_id\s*=\s*auth\.uid\(\)\)\s+LIMIT\s+1',
        'SELECT tenant_id FROM public.profiles WHERE id = auth.uid()',
        'gi'
      );
    end if;

    if coalesce(rewritten_qual, '') = coalesce(policy_row.qual, '')
       and coalesce(rewritten_with_check, '') = coalesce(policy_row.with_check, '') then
      continue;
    end if;

    role_clause := '';
    if policy_row.roles is not null
       and not (cardinality(policy_row.roles) = 1 and policy_row.roles[1] = 'public') then
      select ' to ' || string_agg(
        case
          when role_name = 'public' then 'public'
          else quote_ident(role_name)
        end,
        ', '
      )
      into role_clause
      from unnest(policy_row.roles) as role_name;
    end if;

    using_clause := '';
    if rewritten_qual is not null and btrim(rewritten_qual) <> '' then
      using_clause := format(' using (%s)', rewritten_qual);
    end if;

    with_check_clause := '';
    if rewritten_with_check is not null and btrim(rewritten_with_check) <> '' then
      with_check_clause := format(' with check (%s)', rewritten_with_check);
    end if;

    execute format(
      'drop policy if exists %I on public.%I',
      policy_row.policyname,
      policy_row.tablename
    );

    execute format(
      'create policy %I on public.%I as %s for %s%s%s%s',
      policy_row.policyname,
      policy_row.tablename,
      lower(policy_row.permissive),
      policy_row.cmd,
      role_clause,
      using_clause,
      with_check_clause
    );
  end loop;
end
$$;

notify pgrst, 'reload schema';
