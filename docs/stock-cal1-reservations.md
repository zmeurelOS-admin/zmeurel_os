# Flux stoc comercial: cal1 derivat

Data: `2026-06-26`

## Reguli

- Punctul unic de adevăr pentru disponibilitate este `public.get_sellable_cal1_stock_summary(p_tenant_id uuid default null)`.
- Disponibilul comercial este derivat, nu citit din ledger-ul istoric:
  `SUM(recoltari.kg_cal1) - SUM(comenzi livrate) - SUM(comenzi in_livrare) + SUM(ajustari_stoc.delta_kg)`, cu termeni suplimentari pentru `shop_orders` istorice nepromovate fără `shop_order_erp_links`.
- `miscari_stoc` și `stock_reservations` rămân arhive pentru datele istorice. Fluxul nou de comenzi nu mai scrie în ele.
- Pagina `/stocuri` afișează un singur pool vandabil: `Zmeură cal1`, total pe fermă, fără stoc per parcelă.

## Comenzi

- `set_comanda_in_delivery(uuid)` validează disponibilul derivat și trece comanda în `in_livrare`. Dacă nu există stoc suficient, aruncă `STOC_INSUFICIENT` cu `DETAIL` în forma `necesar=<kg>;disponibil=<kg>`.
- `set_comanda_delivered(uuid, numeric default null, text default 'platit')` creează exact o `vanzare` financiară și marchează comanda `livrata` cu `linked_vanzare_id` în aceeași actualizare. `status_plata` acceptă doar `platit`/`neplatit`, fără efect asupra stocului.
- Livrarea parțială este păstrată: comanda părinte se reduce la cantitatea livrată, iar restul devine comandă copil `confirmata`.

## Shop bridge

- `shop_orders` rămâne poarta publică. La `in_livrare`, `promote_shop_order_to_comanda(uuid)` creează idempotent comanda ERP bridge și `shop_order_erp_links`, apoi `set_shop_order_in_delivery(uuid, date)` validează stocul și oglindește statusul public.
- `mark_comanda_incasata(uuid)` schimbă idempotent doar vânzarea legată la `platit` și completează `data_incasare`; nu ia lock-ul de stoc și nu schimbă disponibilul.
- La `livrata`, `set_shop_order_delivered(uuid, numeric default null)` livrează comanda ERP legată și oglindește `shop_orders.status = livrata`.
- `deliver_shop_order_atomic`, `deliver_shop_order_atomic_partial` și RPC-urile vechi cu rezervări rămân definite pentru rollback, dar nu mai sunt apelate de frontend.
