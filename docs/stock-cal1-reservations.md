# Flux stoc comercial: cal1 derivat

Data: `2026-06-26` (actualizat `2026-07-11` — Faza 2 unificare, migrația `20260711100000_unified_order_stock_phase2.sql`)

## Reguli

- Punctul unic de adevăr pentru disponibilitate este `public.get_sellable_cal1_stock_summary(p_tenant_id uuid default null)`.
- Disponibilul comercial este derivat, nu citit din ledger-ul istoric:
  `SUM(recoltari.kg_cal1) - SUM(comenzi livrate) - SUM(comenzi in_livrare) + SUM(ajustari_stoc.delta_kg)`, cu termeni suplimentari pentru `shop_orders` istorice nepromovate fără `shop_order_erp_links`. Un shop order CU link ERP e contat o singură dată, prin statusul comenzii bridge (termenii shop au `NOT EXISTS` pe link).
- `miscari_stoc` și `stock_reservations` sunt **arhive înghețate** din `2026-07-11`: niciun flux viu nu mai scrie sau citește din ele. Recoltările (`create/update/delete_recoltare_with_stock`) nu mai sincronizează mișcări; gărzile lor anti-negativ folosesc disponibilul derivat. Trigger-ul `prevent_negative_stock` rămâne definit pe `miscari_stoc`, dar e inert — garda reală e `STOC_INSUFICIENT` din RPC-urile de comenzi/ajustări, sub advisory lock.
- Vânzările directe manuale au fost eliminate (`2026-07-11`): `vanzari` primește rânduri doar din `set_comanda_delivered`/`set_shop_order_delivered`. Pagina `/vanzari` e registru read-only (+ toggle încasare, fără efect pe stoc). `create/update/delete_vanzare_with_stock` rămân în DB doar pentru `reopen_comanda_atomic`/`delete_comanda_atomic` (care apelează `delete_vanzare_with_stock`).
- Pagina `/stocuri` afișează un singur pool vandabil: `Zmeură cal1`, total pe fermă, fără stoc per parcelă, plus formularul și istoricul de ajustări.

## Ajustări stoc (`2026-07-11`)

- `ajustari_stoc.tip` acceptă: `congelat | procesat | pierdere | consum_propriu | corectie_plus | corectie_minus | altul`. Toate în afară de `corectie_plus` sunt scăderi simple (`delta_kg < 0`) din pool-ul de zmeură proaspătă — doar jurnal, fără stoc separat de congelată/procesată.
- Singura cale de scriere este RPC-ul `create_ajustare_stoc(p_tip, p_delta_kg, p_motiv, p_data)`: auth + tenant + `operator_can_write('comenzi')`, advisory lock `stock-mutation`, gardă `STOC_INSUFICIENT` pe disponibilul derivat pentru delta negativ. INSERT/UPDATE/DELETE direct pe tabel sunt revocate din RLS; corecțiile se fac prin ajustări compensatorii.
- UI: `/stocuri` → „Ajustează stocul" (`src/components/stocuri/AjustareStocDialog.tsx`) + secțiunea „Istoric ajustări".

## Comenzi

- `set_comanda_in_delivery(uuid)` validează disponibilul derivat și trece comanda în `in_livrare`. Dacă nu există stoc suficient, aruncă `STOC_INSUFICIENT` cu `DETAIL` în forma `necesar=<kg>;disponibil=<kg>`.
- `set_comanda_delivered(uuid, numeric default null, text default 'platit')` creează exact o `vanzare` financiară și marchează comanda `livrata` cu `linked_vanzare_id` în aceeași actualizare. `status_plata` acceptă doar `platit`/`neplatit`, fără efect asupra stocului.
- Livrarea parțială este păstrată: comanda părinte se reduce la cantitatea livrată, iar restul devine comandă copil `confirmata`.
- `deliver_and_clone_comanda(uuid, numeric, date)` (`2026-07-22`) — livrează integral o comandă `in_livrare` (apelează `set_comanda_delivered` cu `status_plata='platit'`, nicio duplicare de logică) ȘI creează, în aceeași tranzacție, o comandă nouă `programata` cu `parent_comanda_id` spre original — pentru butonul „Copiază comanda pentru livrarea următoare” din Livrări. Folosit doar din acest flux; nu acceptă livrare parțială sau `neplatit`.

## Shop bridge

- `shop_orders` rămâne poarta publică de intake, dar din `2026-07-11` comanda bridge din `comenzi` se creează **la checkout** (`/api/shop/b2c/order` apelează `promote_shop_order_to_comanda` cu service role, idempotent), cu status oglindit (`noua`), `data_origin = 'shop_order_bridge'`, `produs_id` = „Zmeură proaspătă", `order_kind` propagat (`cadou`/`consum_propriu` păstrate, restul `manual`) și rândul `shop_order_erp_links` creat imediat. Comenzile gratuite (`total_lei = 0`, ex. cadou/consum propriu) sunt acceptate — `pret_per_kg = 0`. Nu mai există niciun pas manual de promovare.
- Tranzițiile `noua`/`confirmata`/`anulata` din PATCH `/api/shop/b2c/orders/[id]` trec prin `sync_shop_order_bridge_status(uuid, text)`: actualizează atomic `shop_orders.status` + statusul comenzii bridge, sub advisory lock. Anularea/retrogradarea unui shop order aflat în livrare eliberează astfel stocul angajat (fix R2). Comenzile bridge livrate nu pot fi modificate din shop (redeschidere mai întâi).
- Editarea `items` e blocată cât timp shop order-ul e `in_livrare`; pentru restul statusurilor, `resync_shop_order_bridge_qty(uuid)` recalculează `cantitate_kg`/`pret_per_kg`/`total` pe bridge după editare (fix R3).
- La `in_livrare`, `set_shop_order_in_delivery(uuid, date)` validează stocul derivat și oglindește statusul public (promote rămâne apelat idempotent pentru comenzile istorice fără bridge).
- `mark_comanda_incasata(uuid)` schimbă idempotent doar vânzarea legată la `platit` și completează `data_incasare`; nu ia lock-ul de stoc și nu schimbă disponibilul.
- La `livrata`, `set_shop_order_delivered(uuid, numeric default null)` livrează comanda ERP legată și oglindește `shop_orders.status = livrata`. `set_comanda_delivered` tratează idempotent orice comandă deja `livrata`, chiar fără vânzare legată (cazul celor 6 comenzi istorice din 23 iun migrate prin `20260711110001`).
- `deliver_shop_order_atomic`, `deliver_shop_order_atomic_partial` și RPC-urile vechi cu rezervări rămân definite pentru rollback, dar nu mai sunt apelate de frontend.
- UI-ul filtrează bridge-urile ca să nu dubleze afișarea: `ComenziPageClient` exclude `data_origin = 'shop_order_bridge'` din lista manuală, `fetchComenziManualInLivrare` la fel — comanda shop se afișează o singură dată, din `shop_orders`.
