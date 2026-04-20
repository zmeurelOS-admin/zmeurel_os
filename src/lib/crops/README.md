# Crop Codes

- `crop-codes.ts` definește codurile canonice de cultură (`CropCod`) folosite de catalogul `crops.cod` și de consumatorii din Tratamente.
- `normalizeCropCod(...)` acceptă codul canonic, numele seed-ului și variațiile legacy/plurale (`zmeura` -> `zmeur`, `rosii` -> `rosie`).
- Tratamentele rezolvă mai întâi cultura liberă din parcelă prin `normalizeCropCod(...)`, apoi citesc `crops.grup_biologic` pentru a selecta profilul corect de stadii.
- `crops.cod` este cheia canonică de lookup în modulul Tratamente; nu se compară direct stringurile libere din UI sau din datele legacy fără normalizare.
- `crops.grup_biologic` este sursa pentru alegerea profilului contextual de stadii, a regulilor de cohortă și a comportamentului sezonier.
- Când apar culturi noi, se actualizează mai întâi codul canonic și grupul biologic din catalog, apoi se propagă în Tratamente prin helper-ele existente, nu prin string literal în logică.
- `cartof` folosește temporar profilul generic `solanacee`; nu reflectă tuberizarea și rămâne datorie tehnică pentru un profil dedicat `solanacee_tuberizante`.
- `busuioc` folosește temporar profilul generic `frunzoase`; nu reflectă ciclurile multiple de recoltare, dar este acceptabil ca aproximare pentru uz agricol general.
