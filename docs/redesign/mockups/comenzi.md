# Mockup Comenzi — aprobat 18.11.2026

Mockup interactiv: https://claude.ai/artifact/Y2wLwSeJkTmnwM3eiigSVq (6 ecrane: comenzi pe zile zi/noapte, comandă nouă pas 1 și 2, pune în livrare azi, notificări prioritare).

Modul **separat** de Livrări (decizie: două module, interfețe separate).

## Decizii (Andrei)

- **Prima pagină pe zile**: carduri sus „Azi de livrat” (kg, nr. comenzi, lei) și „Mâine”; segmente Azi / Mâine / Programate / Fără dată; card de comandă: client, localitate, kg, sumă, status (Programată / În livrare / Nouă fără dată), plată dacă există.
- **Butonul mare**: „Comandă nouă” (56 px). Sus: „Din mesaj” (lipești textul WhatsApp/SMS, se completează formularul — funcția există deja).
- **Legătura cu Livrări**: pe Azi, „Pune în livrare azi (n)” → listă bifabilă (toate bifate implicit) → „Trimite în Livrări”. Ordinea se aranjează în Livrări.
- **Comandă nouă, pasul 1 — clientul**: căutare după nume sau telefon, „Client nou (nume + telefon)”, lista clienților recenți. **Nu se afișează „cât ia de obicei”.**
- **Comandă nouă, pasul 2**:
  - cantitatea **doar în kg**, plăci 2–10 kg + „Alta”; **nimic preselectat**;
  - data livrării: Azi / Mâine / Poimâine / Altă zi / Fără dată;
  - adresa precompletată din fișa clientului, editabilă;
  - **prețul vine din fișa clientului**: persoane fizice = preț standard; patiserii = preț negociat, valabil tot anul. Câmpurile există deja în `clienti` (`tip`, `pret_negociat_lei_kg`) — fără migrare; modulul Clienți trebuie să le arate clar. În lista de clienți patiseriile au etichetă „Patiserie · X lei/kg”.
  - „+ Notă pentru livrare”.
- **Comandă prioritară** (comutator la pasul 2; cere dată de livrare):
  - apare prima în listă, cu steag portocaliu „Prioritară”;
  - pe Azi: banner „N prioritare azi · X kg — de livrat cu prioritate” (mesajul este despre livrare, nu despre cules);
  - notificare push dimineața în ziua livrării (implicit 07:00): „Azi ai N livrări prioritare” + listă și kg;
  - notificare seara (implicit 18:00) doar dacă a rămas una nelivrată (din ea: livrezi sau muți pe mâine);
  - în „Pune în livrare” vin primele, bifate; în Livrări stau la începutul traseului (optimizarea le păstrează primele).
  - Orele notificărilor modificabile din Setări.

## Deschise

- Avansul: notat la comandă sau doar la livrare.
