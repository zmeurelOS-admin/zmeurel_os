# Mockup Cheltuieli + Investiții + Vânzări — aprobat 19.11.2026

Mockup interactiv: https://claude.ai/artifact/H7aQRD4H2NPoDxAmRcAfyA (8 ecrane: listă cu file Cheltuieli/Investiții, adaugă — pe ce, adaugă — cât, noapte; Vânzări registru, o vânzare, noapte, vânzare rapidă).

## Cheltuieli + Investiții — decizii (Andrei)

- **O singură pagină „Cheltuieli” cu două file**: Cheltuieli (pe lună) și Investiții (pe an). Tabelele rămân separate (`cheltuieli_diverse`, `investitii`); doar interfața e comună. `/investitii` duce la fila Investiții.
- Antet: „Cheltuieli” + pastila perioadei (luna / anul) care se poate schimba.
- Sus: card mare cu totalul perioadei (și numărul) + card cu totalul anului (la Investiții: anul trecut, pentru comparație).
- Rândul: iconița categoriei, ce s-a cumpărat, categorie · dată · furnizor (parcelă la investiții), suma. Cheltuielile generate automat din recoltări (manoperă cules) au eticheta **„Automat din Recoltări”** și se schimbă doar din Recoltări.
- **Adaugă în 2 pași**, ca la Recoltări: (1) „Pe ce ai dat banii?” — plăci cu categoriile, atingerea trece mai departe; (2) suma pe tastatura din aplicație (cifră mare, „lei”), pastila categoriei („schimbă”), data (azi implicit), „+ Furnizor / ce ai cumpărat”, **„+ Poză bon”** (păstrată, opțională), „Salvează X lei” direct din pasul 2. La Investiții, pasul 2 are și „+ Parcelă”.
- **Categorii noi:**
  - Cheltuieli (8): Îngrășăminte · Tratamente · Manoperă · Ambalaje · Motorină și curent · Reparații și consumabile · Taxe și servicii · Altele. (Transport → Motorină și curent; Consumabile → Reparații și consumabile; Diverse → Altele.)
  - Investiții (6): Plantație · Irigație · Spalier și plase · Utilaje și unelte · Construcții și depozitare · Altele.
  - **Datele vechi nu se modifică în baza de date**; categoriile vechi se afișează sub cele noi printr-o mapare în cod.

## Vânzări — decizii (Andrei)

- Vânzările se creează singure când se livrează o comandă (ca azi). Pagina e un **registru**:
  - antet „Vânzări” + pastila lunii;
  - card „Încasat în <lună>” (lei, kg, număr) + card portocaliu „Neîncasat” (lei, număr, „vezi” → fila Neîncasate);
  - segmente Toate / Neîncasate · N; lista pe zile; rândul: client, „kg × preț”, total, Încasat / Neîncasat.
- **O vânzare** (foaie de jos): client, dată, „din comanda livrată”, status; cantitate, preț, total; „Marchează încasat azi” (56 px); „A dat doar o parte…”; „Sună clientul”; „Vezi comanda”.
- **Vânzare rapidă** (buton mare pe Vânzări): fără comandă (la poartă / piață); client opțional („Fără client · la poartă” / „Alege client”); kg pe tastatura din aplicație; preț standard (perioada activă) modificabil; „Rămas în stoc cal. 1”; se salvează **încasată pe loc** și scade din stocul cal. 1 ca o livrare.
- **Încasarea parțială:** venitul se trece **o singură dată, cu toată suma, la data când se încasează restul**. Până atunci vânzarea rămâne Neîncasată, dar se notează cât a dat clientul („A dat 50 lei · rest 70 lei”), ca să se vadă cât mai e de primit.
- Neîncasatul de aici este același cu „Rest de încasat” din Acasă și „Neîncasat” din Clienți.
