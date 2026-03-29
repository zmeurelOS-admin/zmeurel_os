# Product AI Baseline

Last updated: 2026-03-26

## Scope

This baseline tracks the stable, reusable truths for AI chat product audits in Zmeurel OS. It should change only when runtime behavior or audit criteria materially change.

## Runtime Source Of Truth

- `src/app/api/chat/route.ts`
- `src/app/api/chat/contract-helpers.ts`
- `src/lib/financial/chat-router.ts`
- `src/components/ai/AiBottomSheet.tsx`

## Stable Runtime Facts

- Runtime provider: `@ai-sdk/google`
- Main runtime model: `process.env.AI_GEMINI_MODEL ?? 'gemini-2.5-flash'`
- Optional simple runtime model: `process.env.AI_GEMINI_SIMPLE_MODEL` for short/simple requests
- Runtime style: deterministic-first pipeline, LLM second
- Supported `open_form` contracts in runtime route: `cheltuiala`, `investitie`, `recoltare`, `activitate`, `comanda`, `client`
- LLM `open_form` payloads are validated through Zod in `contract-helpers.ts`

## Current Product Baseline

- Backend multi-turn continuity is real and integration-tested for short follow-ups, corrections, and field clearing.
- Entity resolution already uses real tenant data, but only from narrow candidate sets:
  - parcele: `parcele.nume`
  - clienți: `clienti.nume_client`
  - produse comandă: `comenzi.produs`
  - produse activitate: `activitati_agricole.produs_utilizat`
- Entity matching currently relies on normalization, prefix checks, and Levenshtein distance `<= 2`.
- Parcel variety/crop data exists in runtime queries (`nume_parcela`, `soi`, `cultura`, `soi_plantat`) but is not yet part of AI chat canonical matching.
- Financial free-text cleanup is stricter than before, but there is still no shared global sanitizer for `observatii` across all forms.
- API integration coverage is present for backend endpoint behavior.
- Equivalent UI handoff coverage is not yet present for bottom-sheet to page/dialog prefill flows.

## Current Frontend Contract Baseline

- Confirmed `openForm` query handling exists for:
  - `cheltuiala`
  - `investitie`
- The following flows still require explicit parity verification whenever audited:
  - `recoltare`
  - `activitate`
  - `comanda`
  - `client`

## Future Audit Checklist

1. Verify runtime model/provider from `route.ts`, not from older docs.
2. Verify deterministic extraction, continuation, and canonicalization before blaming the model.
3. Verify backend `open_form` output separately from UI handoff behavior.
4. Verify whether tenant entities include parcel names, parcel varieties/crops, clients, and recent products.
5. Audit `observatii`/leftover handling separately from core field extraction.
