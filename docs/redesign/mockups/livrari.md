# Mockup Livrări (folosit în mașină) — aprobat 18.11.2026

Mockup interactiv: https://claude.ai/artifact/AkDRrjRhuZ1SQDk7X1sJbG (6 ecrane: traseul de azi zi/noapte, confirmare livrare, aranjare traseu, după apel, locație diferită).

## Decizii (Andrei)

- **Comenzi și Livrări rămân două module separate, cu interfețe separate.** Livrări = comenzile puse în livrare azi, urmărite din mașină. Între 3 și 30 de opriri pe zi.
- **Ecranul principal**: progres (x din y livrate, kg rămase, lei de încasat); **următoarea oprire** mare (număr pe traseu, client, adresă, cantitate, sumă de încasat evidențiată, nota din comandă) cu **Sună** / **Navighează** / **Livrat** (56 px); restul opririlor numerotate în ordinea drumului; cele livrate strânse într-un rând.
- **Confirmarea livrării** (foaie de jos): felul plății (Cash / Transfer / Nu a plătit); **suma încasată precompletată cu totalul comenzii**; livrare parțială; „Da, livrat”.
- **Locații clienți**:
  - la „Da, livrat”, comutator „Salvează locația de aici” (pornit implicit dacă clientul nu are locație); se salvează doar la precizie GPS < ~50 m; se afișează precizia;
  - dacă livrezi la > ~150 m de locația salvată, apare întrebarea „Livrezi aici și de acum?” → „Da, actualizează” / „Nu, doar de data asta”; altfel locația nu se schimbă niciodată singură;
  - Navighează e inactiv („fără locație încă”) până există locație;
  - de implementat: 2 coloane noi, nullable, pe clienți (lat, lng) + data/precizia salvării — migrare doar aditivă, aprobată înainte de rulare.
- **Navigare**: Google Maps implicit (setare pentru Waze la navigarea spre o singură oprire). Navighează pe fiecare oprire merge la orice număr de opriri. „Pornește în Maps” trimite câte **9 opriri** odată (limita Google Maps: 10 cu plecarea); după ele, butonul trece la următoarele.
- **Optimizare traseu**: pe străzi reale (sensuri unice, intersecții), prin **OpenRouteService** (gratuit, OSM, motor Vroom; endpoint `api.heigit.org`), apelat **de pe server** (cheia nu ajunge în client). Pornește **de unde ești**. Clienții fără locație rămân la final. Aranjare manuală cu săgeți mari sus/jos (nu doar tragere).
- **După apel**: la revenirea în aplicație după „Sună” apare „Cum a fost apelul?”:
  - A răspuns, merg → nimic nu se schimbă;
  - Nu a răspuns → etichetă portocalie cu ora pe oprire + comutator (pornit) „Mut-o la finalul traseului”;
  - Mută pe altă zi → Mâine / Poimâine / Altă dată + notă opțională; comanda iese din traseul de azi și apare în Comenzi la data aleasă.
  - Aceleași acțiuni și în meniul „…” al opririi.
- Modul noapte obligatoriu verificat (folosit seara în mașină).
