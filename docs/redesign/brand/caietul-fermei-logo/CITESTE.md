# Caietul Fermei — logo

Semnul: „Dealuri” (brazde pe deal, ca în Bucovina), culorile „Verde + pământ”.

Culori:
- verde (fond iconiță, culoarea temei): #3d7a5f
- hârtie: #fbf8ef
- brazde (ocru): #b07a32
- frunze: #4f9a74
- inele și tulpină: #1f3d30
- soare: #e2a93b
Font pentru nume: Inter Display Bold (în SVG-uri textul e transformat în contururi, nu cere fontul instalat).

## Ce e în fiecare folder

svg/            sursele (toate celelalte fișiere se fac din ele)
  icon.svg                 iconița cu colțuri rotunjite (sursa principală)
  icon-patrat.svg          pătrat plin, pentru Apple și magazine (ele rotunjesc singure)
  icon-maskable.svg        pentru Android: desenul încape în zona sigură
  icon-monocrom.svg        siluetă albă, pentru iconița de notificare Android
  og-image.svg, google-play-feature-graphic.svg

web/            favicon.ico (16/32/48), favicon-16/32/48.png, icon.svg
pwa/            icon-72 … icon-512.png, icon-maskable-192/512.png, badge-monocrom-96.png
apple/          apple-touch-icon-180.png (fără transparență)
magazine/       google-play-icon-512.png, app-store-icon-1024.png (fără transparență),
                google-play-feature-graphic-1024x500.png
social/         og-image-1200x630.png (previzualizarea la distribuirea linkului pe Facebook/WhatsApp)
logo-cu-nume/   semn + „Caietul Fermei” (+ variantă cu sloganul), pentru fundal deschis și închis, SVG și PNG

manifest-exemplu.json  cum se leagă iconițele în aplicația instalabilă
Numele scurt pentru telefon: „Caietul” (pe ecranul telefonului numele lung se taie).
