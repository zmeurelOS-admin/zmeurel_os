# Paste-to-X

## Scop

`Paste-to-X` extinde pattern-ul existent `paste-to-order` către mai multe module care primesc frecvent input semi-structurat din WhatsApp, note rapide sau transcrieri vocale.

Implementarea curentă din repo adaugă:

- registru comun pentru modelul Anthropic și prompturile de extracție
- scheme Zod pentru payload-urile AI țintă
- ordine de rollout și politici de autosave/draft
- factory server-side reutilizabil pentru validare request, auth, access, rate limit și parsing AI

Nu adaugă încă UI sau rute noi pentru `cheltuieli`, `investitii`, `recoltari` sau `tratamente`.

## Fișiere canonice

- `src/lib/ai/paste-to-x.ts`
- `src/lib/ai/paste-to-x-handler-factory.ts`
- `src/lib/ai/__tests__/paste-to-x.test.ts`
- `src/app/api/parse-order/parse-order-handler.ts`

## Module și policy

| Modul | Țintă | Policy |
|---|---|---|
| `comenzi` | `comenzi` | auto-save, cu validările existente |
| `cheltuieli` | `cheltuieli_diverse` | auto-save |
| `investitii` | `investitii` | auto-save cu prag de confirmare recomandat la 2000 lei |
| `recoltari` | `recoltari` | draft/input brut, fără insert direct |
| `tratamente` | `aplicari_tratament` + `aplicari_tratament_produse` | draft obligatoriu, fără insert direct |

## Compatibilitate cu `/api/parse-order`

Ruta existentă `/api/parse-order` rămâne backward-compatible cu schema ei actuală, folosită de `ComenziDinMesajSheet`.

Registrul `Paste-to-X` și factory-ul server-side sunt infrastructura comună pentru noile module și pentru alinierea internă a `parse-order` la același tipar de handler, fără să rupă flow-ul curent de Comenzi și fără să schimbe `route.ts`.
