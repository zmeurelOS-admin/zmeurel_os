create or replace function public.validate_comanda_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
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

  -- Comenzile magazinului asociației sunt livrate prin funcția atomică dedicată,
  -- care actualizează statusul la livrata fără linked_vanzare_id.
  if coalesce(old.data_origin, '') = 'magazin_asociatie'
     and old.status = 'in_livrare'
     and new.status = 'livrata' then
    return new;
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

notify pgrst, 'reload schema';
