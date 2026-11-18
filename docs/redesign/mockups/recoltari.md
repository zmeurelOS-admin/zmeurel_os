# Mockup Recoltări (pilot) — aprobat 18.11.2026

Mockup interactiv: https://claude.ai/artifact/NfqZJG7nTanjryxB3r191R (4 ecrane: listă azi zi/noapte, alegere culegător, kilograme).

## Decizii (Andrei)

- Notarea se face **pe culegător, seara** (o înregistrare sau mai multe cântăriri pe culegător).
- **Prima pagină arată doar azi**: card mare sus cu totalul zilei (kg, lei de plată, calitatea 1, calitatea 2, număr culegători), apoi lista celor notați azi. Fără segmente Săptămână/Sezon, fără listă de „fără kg azi”.
- **Butonul mare** jos: „Adaugă kg” (56 px).
- **Pasul 1 — culegătorul**: plăci mari pe 2 coloane (5–6 culegători): inițială, prenume, nume; bifă verde cu kg pentru cei notați deja azi (atingerea adaugă încă o cântărire); ultima placă „Culegător nou”. Fără căutare.
- **Pasul 2 — kilograme**:
  - data = azi și parcela = ultima folosită, ca pastile schimbabile; cultura se deduce din parcelă;
  - **câmpul de kg pornește GOL, fără nicio valoare propusă** (nici din ultima recoltare); cantitatea se tastează, cu zecimale (cântarul dă ex. 27,35);
  - tastatură numerică mare în aplicație (1–9, virgulă, 0, ștergere), taste ≥ 54 px; câmpul activ are contur verde;
  - calitatea 2 ascunsă până la „Adaugă calitatea 2”;
  - plata estimată (kg × tarif culegător) se recalculează pe loc;
  - jos: „Salvează” (înapoi la listă) și „Salvează + următorul” (înapoi la alegerea culegătorului).

## Deschise

1. Butonul mare „Adaugă kg” înlocuiește FAB-ul (+) pe pagina Recoltări?
2. Tastatura din aplicație (ca în mockup) sau tastatura numerică a telefonului?
