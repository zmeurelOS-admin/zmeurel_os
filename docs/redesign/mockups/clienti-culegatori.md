# Mockup Clienți + Culegători — aprobat 19.11.2026

Mockup interactiv: https://claude.ai/artifact/WrmPR4FAGKmX7Qg4cLvJGR (10 ecrane: Clienți listă / fișă / formular / meniu ⋯ / noapte, Setări › Preț standard; Culegători listă / fișă / formular / noapte).

## Clienți — decizii (Andrei)

- **Lista:** antet „Clienți” + numărul; buton ⋯ (48 px) în dreapta; căutare după nume sau telefon; filtre-pastile Toți / Persoane / Patiserii / Magazine / Neîncasat (cu numere). Rândul: inițiale, nume, adresă scurtă · ultima comandă; etichetă „Patiserie · 25 lei/kg” / „Magazin · 22 lei/kg” pentru prețul negociat; „Neîncasat X lei” portocaliu. Butonul mare: „Client nou”.
- **Fișa clientului:** înapoi, nume, creion (editează); pastila tipului și a prețului; **Sună + WhatsApp pentru toți clienții** (WhatsApp fără text precompletat); telefon; adresă de livrare; cifrele anului (comenzi, kg, încasat); ultimele comenzi cu status; observații. Butonul mare: **„Comandă nouă”** — deschide formularul din Comenzi cu clientul ales.
- **Formularul** (același pentru nou și editare): nume, telefon („Îl folosim pentru apel și WhatsApp”), tip pe plăci (Persoană / Patiserie / Magazin); la Patiserie și Magazin apare „Preț negociat (lei/kg)”; la Persoană, text: „Plătește prețul standard: acum X lei/kg, din Setări › Preț standard. Îl poți schimba la fiecare comandă.”; adresă (opțional); „+ Notă”; „Salvează clientul”.
- **Meniul ⋯** (foaie de jos): Importă din fișier · Sincronizează cu Google Contacts (ultima sincronizare) · Mesajul WhatsApp implicit (rămâne pentru anunțuri).
- **„Șterge toți clienții”** iese de pe ecranul Clienți și se mută în **Setări › Date**, cu confirmare scrisă.

## Preț standard — decizii (Andrei)

- Azi prețul e fix în cod (35 lei/kg). Devine **setare pe fermă**, ecranul Setări › Preț standard:
  - trei perioade — **Început de sezon** (implicit 35), **Vârf de sezon** (25), **Mediu** (30) — fiecare cu prețul ei;
  - alegi perioada activă; sus: „Comenzile noi primesc acum X lei/kg”;
  - comenzile deja făcute își păstrează prețul; patiseriile/magazinele au prețul negociat; prețul se poate schimba la fiecare comandă.

## Culegători — decizii (Andrei)

- **Lista:** antet + data; două carduri: „Azi” (kg, câți au cules) și „Sezon” (kg, **plătit** lei); segmente Activi · N / Inactivi · N; rândul: inițiale, nume, tip · tarif, kg azi (sau „—”), kg sezon. Butonul mare: „Culegător nou”.
- **Fișa:** înapoi, nume, creion; pastile Activ/Inactiv + tip; „Sună” cu numărul; trei cifre: Tarif, Sezon (kg), **Plătit** (lei); ultimele zile (dată, parcelă, kg); „Marchează inactiv(ă)” în loc de ștergere. Butonul mare: **„Adaugă kg azi”** — deschide formularul din Recoltări cu culegătorul ales.
- **Formularul:** nume și prenume, telefon (opțional), tarif (lei/kg; „Plata se calculează la fiecare recoltare: kg × tarif.”), tip pe plăci (Sezonier / Permanent / Zilier / Colaborator), „+ Notă”.
- **Plata** se calculează și se achită la înregistrarea recoltării — fără evidență de avans/rest.
- **Data angajării și parcelele alocate se scot din formular** (coloanele din baza de date rămân neatinse).
