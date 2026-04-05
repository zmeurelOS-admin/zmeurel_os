# Logo-uri magazin public `Gustă din Bucovina`

Fișiere recomandate în `public/images/`:

- `gusta-logo.png`
  Format: PNG transparent, 512x512
  Folosit pentru PDF și fallback general.
- `gusta-logo-horizontal.png`
  Format: PNG transparent, 800x200
  Folosit pentru header-ul magazinului.
- `gusta-logo-white.png`
  Format: PNG transparent, 512x512
  Folosit pentru footer pe fundal verde.
- `gusta-logo-square.png`
  Format: PNG, 192x192
  Folosit pentru icon / PWA.
- `gusta-logo-square-512.png`
  Format: PNG, 512x512
  Folosit pentru icon / PWA.

Referințe actuale în cod:

- Header desktop + mobil magazin: [AssociationShopShell.tsx](c:/Users/Andrei/Desktop/zmeurel/src/components/shop/association/AssociationShopShell.tsx)
  În prezent folosește `/icons/icon.svg`.
  Pentru schimbare ulterioară, înlocuiește cu `/images/gusta-logo-horizontal.png`.
- Header marketplace alternativ: [MarketHeader.tsx](c:/Users/Andrei/Desktop/zmeurel/src/components/shop/association/marketplace/MarketHeader.tsx)
  Folosește `AssociationLogo`.
- Landing page: [AssociationLandingPage.tsx](c:/Users/Andrei/Desktop/zmeurel/src/components/shop/association/landing/AssociationLandingPage.tsx)
  Nu are încă un asset PNG dedicat în hero; aici se poate introduce `/images/gusta-logo.png` la 120x120.
- Footer: [AssociationShopFooter.tsx](c:/Users/Andrei/Desktop/zmeurel/src/components/shop/association/AssociationShopFooter.tsx)
  Aici se poate introduce `/images/gusta-logo-white.png`.
- PDF confirmare: [MarketSuccessOverlay.tsx](c:/Users/Andrei/Desktop/zmeurel/src/components/shop/association/marketplace/MarketSuccessOverlay.tsx)
  Deja încearcă să încarce `/images/gusta-logo.png`.

Dimensiuni recomandate în UI:

- Header desktop: lățime 160px, înălțime auto.
- Header mobil: lățime 120px, înălțime auto.
- Landing hero: 120x120.
- Footer: 60x60.
- PDF: 25x25 mm, centrat.
