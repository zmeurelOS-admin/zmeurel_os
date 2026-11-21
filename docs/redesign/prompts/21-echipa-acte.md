# Prompt 21 — Echipa și Actele fermei pe kit (+ dreptul „Tratamente”)

Model: Opus 5.5 · Effort: high · Mod: normal (fără plan) · Sesiune: NOUĂ · Branch: `redesign/echipa-acte` (pornit din `main` `4123b60`) · Rezultat: branch verde, cu push, fără merge

## Cum lucrezi

- Lucrezi singur, fără plan și fără să ceri aprobare. Ce te blochează sari, notezi în raport și continui.
- Commit-uri mici, cu push după fiecare. Logica (drepturile pe module, rezumatul „ce poate face”, starea actelor) stă în funcții pure, cu teste.
- Pe kit (`src/components/kit`), cu regulile din `CLAUDE.md`. Adaugi folderele în `KIT_RULE_DIRS`.
- Migrările le scrii, **nu le aplici**; doar aditive. Aplicația merge și înainte de migrare. Înainte de orice migrare citești schema și funcțiile reale cu `select` (`pg_get_functiondef`, `pg_policies`, `pg_constraint`).

## Mockup-ul aprobat

`git show origin/redesign/prompturi-11-12:docs/redesign/mockups/stoc-parcele-echipa.html > /tmp/mockup.html`, capitolul **3 · Echipa și Actele fermei** (Echipa, Invită · ce poate face, Actele fermei). Urmezi ecranele și textele. Numele și cifrele sunt de exemplu.

## Deciziile lui Andrei (21.11, toate recomandările acceptate)

1. **Dreptul „Tratamente” separat**, cu Nu / Citește / Scrie, ca celelalte module (lângă „Lucrări”, care rămâne cheia `activitati`).
2. **Livratorul** rămâne doar cu Livrări (fluxul `invite-livrator` neschimbat ca drepturi).
3. **„Documente legale” devin „Actele fermei”**, sub Setări → Ferma, pe kit, cu **aceleași câmpuri** și aceeași logică de salvare / încărcare (`/api/legal-docs`, `/api/legal-docs/upload`), plus starea „complete / lipsesc N”.

## Ce găsești deja (verifică)

- Baza de date **folosește deja** `operator_can_write('tratamente')` în politicile RLS pentru `aplicari_tratament`, `aplicari_tratament_produse`, `produse_fitosanitare`. Aplicația însă **nu are** modulul `tratamente` în `FARM_MEMBER_MODULES` (`src/lib/farm-members/access.ts`), deci azi niciun operator nu poate scrie tratamente, iar ruta `/tratamente` e legată de `activitati`.
- Citești `operator_can_write` / `operator_can_read` (sau echivalentele) și orice constrângere pe `farm_members.modules_access`, ca să știi dacă `tratamente` e deja acceptat ca nume de modul. Dacă nu, migrare aditivă.

## Ce faci

### Drepturi
- Adaugi modulul `tratamente` (eticheta „Tratamente”, ruta `/tratamente`, implicit `/tratamente`) în `FARM_MEMBER_MODULES` și în tot ce le validează (API-ul `/api/farm-members/[id]/access`, invitațiile, `normalizeFarmMemberAccess`, gărzile de rută / `proxy.ts`, Mai mult pentru operator). Scoți `/tratamente` din rutele lui `activitati`.
- **Compatibilitate:** un operator care avea `activitati` și până acum vedea `/tratamente` trebuie să-l vadă în continuare (citire). Regula, explicată în raport: la citirea drepturilor, dacă `tratamente` lipsește din `modules_access` și `activitati` e prezent, operatorul primește `tratamente: read`. **Fără** `update` pe rândurile existente din `farm_members`.
- Verifici că un operator cu `tratamente: write` poate salva o aplicare (RLS), iar unul cu `read` doar vede.

### Echipa (Setări → Echipa)
- Lista: proprietarul, operatorii, livratorii; sub fiecare nume, pe scurt, ce poate face („Recoltări, Lucrări (scrie) · Tratamente (citește)”, „doar Livrări”). Atingi un om → foaie: schimbă accesul, retrimite linkul (`regenerate-token`), dezactivează (cu confirmare).
- **„Invită pe cineva”** în 2 pași (`StepForm`): (1) cine e: Operator / Livrator, nume, telefon; (2) pentru operator, lista modulelor cu **Nu / Citește / Scrie** (totul pe „Nu” implicit). Pentru livrator pasul 2 lipsește. La final linkul, cu „Trimite pe WhatsApp” (un `<a href="https://wa.me/?text=…">`) și „Copiază linkul”.
- Aceleași API-uri ca azi (`create-invite`, `invite-operator`, `invite-livrator`, `access`, `deactivate`, `regenerate-token`); nu schimbi logica lor de securitate.
- Ecranul de acceptare a invitației (`/invite/[token]`) îl lași funcțional; dacă e simplu, îl treci pe kit.

### Actele fermei
- Ruta nouă sub Setări → Ferma (de ex. `/settings/ferma/acte`); ruta veche a documentelor legale redirecționează acolo. Legăturile din banner (`LegalDocsPersistentBanner`), din cronul `farmer-legal-docs-check` (texte / link-uri din notificări) și din Asociație duc la ruta nouă.
- Ecranul: sus starea („Complete” sau „Lipsesc N date”, cu ce lipsește), apoi rândurile (Ferma: formă juridică, CUI, adresă; Certificat de producător: număr, serie, viză; Contact afișat; Poza certificatului), fiecare deschide o foaie (`BottomSheet`) cu câmpurile lui. **Aceleași câmpuri și reguli de validare** ca în `LegalDocumentsPageClient`; încărcarea pozei la fel ca azi.
- „Ce lipsește” se calculează dintr-o funcție pură, folosită și de banner, ca să spună același lucru.

## Ce NU faci

- Mediul local folosește **baza de PRODUCȚIE**. Din bază doar citești (`select`). Testele manuale se fac **doar într-un cont demo nou**. Nu crea utilizatori reali în producție: invitația o testezi până la generarea linkului (fără să o accepți cu un cont nou), dacă acceptarea ar crea un utilizator nedemo.
- Nu aplici migrări, nu apelezi cronuri, nu schimbi variabile de mediu.
- Nu atingi `public/sw.js` și nu slăbești `.claude/settings.json`.
- Nu modifici rândurile din `farm_members` sau datele actelor. Nu atingi Asociația, magazinul, chatul AI (în afară de legăturile spre acte).

## Verificare în demo (la final), la 390×844, zi și noapte

- Echipa: lista cu rezumatul drepturilor; un operator nou invitat cu Recoltări (scrie), Lucrări (scrie), Tratamente (citește) → linkul se generează; schimbarea accesului; dezactivarea (pe omul creat în test).
- Un livrator invitat: fără pasul 2.
- Actele fermei: starea „lipsesc N”, completarea unui câmp, starea se actualizează; bannerul spune același lucru.
- O trecere la 1280×800.

## Raportul

- ce ai schimbat, pe bucăți, cu commit;
- migrarea (dacă e cazul), cu SQL complet;
- regula de compatibilitate `activitati` → `tratamente: read` și unde stă;
- ce n-ai putut testa (mai ales fluxul complet de acceptare a invitației și drepturile unui operator real);
- verificările: lint, typecheck, check:kit, test:critical:unit, build;
- lista commit-urilor, cu hash.

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
