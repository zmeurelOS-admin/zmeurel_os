update public.vanzari
set status_plata = case
  when lower(coalesce(status_plata, '')) in ('incasata', 'incasat', 'platit', 'achitata', 'achitat') then 'platit'
  when lower(coalesce(status_plata, '')) = 'avans' then 'avans'
  when lower(coalesce(status_plata, '')) = 'restanta' then 'restanta'
  else status_plata
end
where lower(coalesce(status_plata, '')) in (
  'incasata',
  'incasat',
  'platit',
  'achitata',
  'achitat',
  'avans',
  'restanta'
);
