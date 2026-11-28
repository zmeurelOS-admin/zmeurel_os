Model: Opus 5.5 · Effort: high

# Prompt 35 — desktopul refăcut pentru ecran mare

## Context

Caietul Fermei (`caietulfermei.ro`). Next.js App Router, TypeScript, Tailwind, shadcn/ui, Supabase (RLS, `current_tenant_id()`), Vercel. Producția = `main` (`43b5db4`, promptul 34). Citește `CLAUDE.md`, `docs/redesign/` (kitul, `tokens.md`, deciziile, `raport-34-final.md`).

În 34, desktopul a primit interfața de telefon pe o coloană de 720 px. **Greșit.** Andrei vrea ca pe desktop să se folosească tot spațiul, cu o organizare diferită. Pe desktop lucrează la: birou (bani, rapoarte, registre), comenzi și livrări, tratamente și parcele, asociația.

**Prototipul aprobat:** `docs/redesign/mockups/desktop-prototip.html` (deschide-l în browser; comutatorul A/B sus, panoul „Ce se schimbă”). Andrei a ales **hibridul**:
- **Acasă și Bani** ca în varianta **B** (tablou: cifre, grafice, tabele, registre).
- **Comenzi, Parcele, Tratamente** (și celelalte module cu liste) ca în varianta **A** (listă în stânga, fișa elementului ales în dreapta, fără schimbarea paginii), cu un comutator **„Tabel”** (tabel pe toată lățimea, totaluri, selecție multiplă, export).
- **Formularele pe desktop:** într-un panou în dreapta, pe o singură pagină, nu pe pași.
- **Fără pagină separată „Azi pe ferma”**: ce e de făcut azi stă în Acasă.
- **Asociația** în bara laterală doar pentru conturile de asociație.

**Telefonul nu se schimbă.** Tot ce e nou se aplică de la `lg` (≥ 1024 px). Sub `lg`, totul arată exact ca în producție acum.

## Fluxul (obligatoriu)

1. **Întâi planul** în `docs/redesign/plan-35-desktop.md`: pe fiecare secțiune ce faci, fișiere modificate/noi/șterse, componente noi (unde stau în kit), date folosite (ce interogări există deja, ce lipsește), migrări (SQL complet, doar dacă e nevoie), teste, riscuri; la final **întrebări numerotate, fiecare cu recomandarea ta**. Fă commit doar cu planul pe branch-ul `redesign/35-desktop` (din `origin/main`), push, și **oprește-te**.
2. După aprobare: implementezi pe același branch, commit + push după fiecare secțiune, **fără merge în `main`**.
3. La final: raport `docs/redesign/raport-35-desktop.md` (pe secțiuni, commit-uri, teste, ce n-ai putut testa, capturi la 1280 px și 1440 px pentru fiecare ecran atins + 360 px ca dovadă că telefonul a rămas la fel).

## Secțiuni

### §1 Carcasa desktop
- **Bara laterală** (~232 px, restrângibilă), grupată după treabă, din aceeași sursă `src/lib/navigatie/meniu.ts` (adaugă gruparea pentru desktop acolo; bara de jos și „Mai mult” de pe telefon rămân neschimbate):
  - sus: Acasă;
  - **Vânzări:** Comenzi, Livrări, Clienți, Stocuri, Vânzări, Produse, Material săditor;
  - **Ferma:** Parcele, Tratamente (cu Magazia), Recoltări, Lucrări, Culegători;
  - **Bani:** Bani și rapoarte (`/rapoarte`), Cheltuieli, Investiții;
  - **Asociația:** doar pentru conturile de asociație;
  - jos: Setări, contul, clopoțelul. Aceleași reguli de acces ca acum (operator, superadmin, banii doar proprietarul) — o singură funcție de vizibilitate.
  - Propune în plan ordinea și dacă Livrări rămâne separat sau intră în Comenzi (recomandarea ta).
- **Antetul paginii** pe desktop: titlul + un rând scurt de context în stânga; căutarea globală și acțiunea principală a paginii („+ Comandă”, „+ Tratament” …) în dreapta. Fără butonul plutitor pe desktop.
- **Conținutul pe toată lățimea** (cu o limită rezonabilă, ex. 1600 px, propune), nu 720 px. Scoate `max-w-modul` pe desktop din modulele refăcute.

### §2 Căutarea globală
Câmp în antet + scurtătura Ctrl/⌘ K: caută în comenzi, clienți, parcele, culegători și în paginile din meniu; rezultatele grupate; Enter deschide elementul (în lista + fișa modulului). Fără căutare server nouă dacă se poate face din datele deja încărcate sau din interogări existente cu filtru (propune în plan). Respectă drepturile operatorului.

### §3 Acasă pe desktop (varianta B)
- Rând de cifre: venit sezon, recoltat (kg), de încasat (cu „peste 30 zile”), stoc cal. I (cu „comandat”), cheltuieli sezon / profit. Banii doar la proprietar; operatorul vede doar ce are drept.
- Grafic recoltă pe săptămâni (sezonul curent, comparat cu anul trecut dacă există date).
- „De făcut azi” (aceleași surse ca pe telefon: comenzi de livrat, capcane, tratamente din plan/întârziate, neîncasate ≥ 30 zile, îngheț, „Primii pași”, extrasezonul).
- Producție pe parcelă, comenzile pe zilele următoare, vremea pe 3 zile, ultimele înregistrări.
- Sezonul = de la prima recoltare din an (decizia existentă). Cardurile fără date au stare goală utilă, nu zero-uri.
- Fără widgeturi mutabile și fără editarea grilei (au fost scoase intenționat).

### §4 Listă + detaliu (varianta A) — tiparul comun
- Componentă nouă de kit pentru desktop (ex. `VedereListaDetaliu`): lista în stânga (~360–420 px, cu filtre-chip sus și căutare în listă), fișa în dreapta; elementul ales e în URL (`?id=`), ca să se poată trimite linkul și ca „înapoi” din browser să meargă; săgețile sus/jos mută selecția.
- Comutator **Listă / Tabel** în antet: tabelul are coloane sortabile, totaluri jos, selecție multiplă cu acțiuni în bloc unde au sens, export CSV (descărcare din browser).
- Fișa din dreapta refolosește conținutul fișelor de pe telefon unde există (fără logică dublată); acțiunile sunt butoane în capul fișei.

### §5 Comenzi și Livrări
- Listă + detaliu: filtre Azi / Mâine / Săptămâna / De pregătit / În livrare / Neîncasate; fișa cu acțiunile (Pune în livrare, Marchează livrată, Încasează, Editează, WhatsApp), istoricul, clientul pe scurt, livrările de azi în ordine.
- Tabel: client, telefon, livrare, adresă, kg, lei/kg, total, plată, stare; în bloc „Pune în livrare”.
- Regulile rămân: comanda livrată nu se mai modifică; în livrare nu trece peste stoc; „La poartă” livrată pe loc; avans la livrare.

### §6 Parcele
- Listă + fișa parcelei: stadiul acum (pe lăstari), cifre (recoltat, kg/plantă, profit pe parcelă dacă datele permit — altfel întrebare în plan), acțiunile (+ Tratament, + Lucrare, + Recoltare, Stadiul), jurnalul, sezonul pe lăstari, recolta pe săptămâni.
- Tabel: parcelă, cultură, plante, suprafață, stadiu, recoltat, ultima lucrare.

### §7 Tratamente
- Taburile Aplicări · Plan · Capcane · Analize și Magazia rămân; pe desktop fiecare tab = listă + detaliu (aplicarea, linia de plan, grupul de capcane, analiza, produsul din magazie).
- Tabel la Aplicări (data, parcele, tip, produse, stare) + „Registrul de tratamente” în antet.
- Opțional (întrebare în plan): calendarul parcele × săptămâni din varianta B ca vedere separată.

### §8 Bani și rapoarte (varianta B), doar proprietarul
- `/rapoarte` pe desktop: cifrele anului (venit, cheltuieli, profit, investiții), grafic venit și cheltuieli pe luni, profit pe parcelă (dacă datele permit; altfel spune în plan ce lipsește), registrul de încasări și plăți pe lună (vizualizare; exportul complet rămâne pentru promptul următor dacă e mare — spune în plan), exporturile existente într-o secțiune „Registre și exporturi”.
- Vânzări, Cheltuieli, Investiții: listă + detaliu + Tabel (tiparul §4).

### §9 Formularele pe desktop
- Pe desktop, `StepForm` se deschide într-un **panou în dreapta** (~460–520 px) și arată pașii ca secțiuni pe o singură pagină, cu „Salvează” jos. Aceeași logică, validare, `closeGuard`, `clientSyncId`, analytics; nicio logică de formular dublată. Tastatura numerică din aplicație nu apare pe desktop (câmpuri normale cu tastatura fizică).
- Propune în plan cum (variantă de randare în `StepForm` vs. componentă nouă) și care formulare nu se potrivesc (ex. recoltarea pe culegători) și cum le tratezi.

### §10 Restul modulelor
Clienți, Culegători, Stocuri, Produse, Recoltări, Lucrări, Material săditor, Setări, Notificări, Asociația: pe desktop cel puțin listă + detaliu (sau tabel acolo unde e o listă de rânduri) pe toată lățimea; Setări pe două coloane (meniul setărilor + pagina). Listează în plan ce primește fiecare.

## Teste

- E2E la 1280 și 1440 px: fiecare ecran din §3–§8 se deschide, lista + fișa merg, selecția e în URL, comutatorul Tabel merge, căutarea globală găsește o comandă și o parcelă din demo, panoul de formular se deschide și se închide (Esc, X) fără să salveze.
- Testul „text în chenar” de la 34 rulează și la 1280 / 1440 pe ecranele noi.
- Telefonul neatins: testele smoke existente (19) + testul „înapoi” + testul „text în chenar” la 360 trec neschimbate.
- Teste unitare pentru gruparea meniului pe desktop (proprietar, operator, superadmin, asociație), pentru calculele din Acasă și Bani (sezon, profit pe parcelă, registru) și pentru căutarea globală.

## Reguli

- Local și preview folosesc baza de **PRODUCȚIE** (`ilybohhdeplwcrbpblqw`). Scrieri doar în ferme demo (`@demo.zmeurel.local`). Nu atinge ferma reală `99485d6b-f186-49db-a379-bb9a12d34968`.
- Migrări doar dacă sunt absolut necesare, doar aditive, în `supabase/migrations/`, **nu le aplica tu**; politici modificate cu `alter policy`. `SECURITY DEFINER` noi: `revoke ... from public, anon` + verificare internă a fermei/utilizatorului. Banii rămân doar ai proprietarului (RLS existent; nimic din Acasă/Bani nu ocolește asta).
- Kitul: doar tokenii canonici, fără hex, fără `dark:`, straturile din `tokens.md`; componentele noi în `src/components/kit/` și exportate din `index.ts`; `npm run check:kit` trece. Zi și noapte.
- Interzise: comiterea `public/sw.js`, `git commit -a`, slăbirea `.claude/settings.json`, apelarea cronurilor în producție, cheile secrete, pachete noi în `package.json` fără motiv scris în plan (graficele: SVG/HTML propriu sau o bibliotecă deja instalată).
- Nu schimbi deciziile din `docs/redesign/`. Texte în română, pe limba fermierului.
- Înainte de fiecare push: `npm run test:critical:unit`, `npm run lint`, `npm run typecheck`, `npm run check:kit`, `npm run build` (`check:server-supabase-boundaries` pică deja pe `main`; notează, nu e din 35). La final și `npm run test:e2e:smoke` + testele noi.
- Dacă te oprești la limita de utilizare: notează în raport ce e gata și ce rămâne, în ordine.

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
