# AI Test Checklist

Manual test checklist for Zmeurel OS chat AI.

Format:
`| # | Input | Expected | Actual | Status |`

| # | Input | Expected | Actual | Status |
|---|---|---|---|---|
| 1 | `Adaugă o cheltuială de 300 lei pentru caserole, pentru azi` | Form cheltuială cu prefill: `suma=300`, `data=azi`, `descriere=caserole` |  |  |
| 2 | `bagă 220 lei motorină azi` | Form cheltuială cu prefill și categorie `Combustibil și energie` |  |  |
| 3 | `300 lei manoperă ieri` | Form cheltuială cu prefill și categorie `Forță de muncă` |  |  |
| 4 | `Am recoltat 20 kg azi din Delniwa` | Form recoltare cu prefill corect pentru cantitate, dată și parcelă |  |  |
| 5 | `Fă o comandă pt Matia 5 kg azi` | Form comandă cu prefill corect pentru client, cantitate și dată |  |  |
| 6 | `Adaugă tratament Switch azi la Delniwa` | Form activitate cu prefill corect pentru produs, dată și parcelă |  |  |
| 7 | `adaugă cheltuială` → AI cere detalii → `300 lei caserole azi` | Multi-turn: AI cere clarificare, apoi deschide form cheltuială cu prefill corect |  |  |
| 8 | `am dat 300` | AI cere clarificare, fără form imediat |  |  |
| 9 | `ce timp e azi?` | Răspuns text, fără form |  |  |
| 10 | Mesajul 21 | Mesaj de limită / rate limit atins |  |  |
| 11 | `modifică cheltuiala cu motorină de azi` | Form cheltuială cu mod edit și datele corecte preluate |  |  |
| 12 | `trece butași 1500 lei la delniwa` | Form investiție cu prefill corect |  |  |

