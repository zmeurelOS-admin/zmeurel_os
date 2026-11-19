# Mockup Acasă (Dashboard) — aprobat 19.11.2026

Mockup interactiv: https://claude.ai/artifact/8GLpxcFTFMdiGjDciuBm3A (6 ecrane: sezon zi/noapte, extrasezon zi/noapte, Setări „Ce arată Acasă”, întrebarea de la sfârșitul lui octombrie).

## Decizii (Andrei)

- Acasă răspunde la „ce am de făcut azi”, **nu e o grilă de widget-uri**. Pe telefon: fără „Adaugă widget”, fără scurtături „Intră direct în fluxuri” (bara de jos le are), fără recomandări generice. **Grila editabilă de pe desktop rămâne cum e.**
- Antet: „Acasă”, data, pastila perioadei („Sezon · zmeură” / „Extrasezon · butași și lucrări”), meteo compact în dreapta (temperatură + o notă: ploaie/vânt în sezon, îngheț/brumă în extrasezon).
- **Conținutul se schimbă după perioadă:**
  - **Sezon:** card mare „De livrat azi” (kg, comenzi, câte prioritare) lângă „În stoc cal. 1”, cu bandă „Lipsesc X kg — notează recoltarea sau mută comenzi” când stocul nu ajunge; „De făcut azi”: ⚠ pauză după tratament pe o parcelă (nu recolta), livrări în drum / de pus în livrare, recoltarea de azi (nenotată / notată), următorul tratament cu fereastra meteo; jos „Sezonul <an>, până azi”: recoltat (kg) + încasat (lei).
  - **Extrasezon:** card mare „Butași de livrat săpt. asta” (buc, comenzi, prima dată) lângă „Rest de încasat” (lei, comenzi), bandă cu stocul de butași pe soiuri; „De făcut”: comenzi de butași de pregătit, încasări restante, lucrări planificate (din Activități, cu dată), tratamente de toamnă/iarnă; jos „Sezonul <an> încheiat”: recoltat + încasat fructe (detaliu în Rapoarte).
- Fiecare rând duce în modulul lui (Comenzi, Livrări, Recoltări, Activități, Material săditor, Vânzări).
- **Schimbarea perioadei:**
  - sezonul începe **automat la prima recoltare din an**;
  - extrasezonul **NU pornește singur**: din ~25 octombrie, Acasă afișează sus cardul „Începem extrasezonul?” (cu data ultimei recoltări) — „Da, începem” trece pe extrasezon; „Mai am de cules” amână întrebarea 7 zile („Bine. Te întreb din nou pe <dată>”);
  - Setări › „Ce arată Acasă”: Perioada Automat / Sezon / Extrasezon (forțare manuală), „Întrebarea pentru extrasezon: din 25 octombrie, dacă amâni revine după 7 zile”, și ce arată în extrasezon (comenzi butași, rest de încasat, lucrări planificate, avertizare de îngheț).
- **Material săditor** (butașii) rămâne pe ecranul vechi; Acasă doar arată cifrele și trimite acolo.
- **Lucrările planificate** vin din Activități (înregistrări cu dată în viitor).
