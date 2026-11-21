/**
 * Legăturile vechi către secțiunile paginii lungi de Setări (`/settings#…`) → subpagina nouă.
 * Ancora nu ajunge la server, deci redirecționarea se face în pagina /settings, în browser.
 */
export const SETTINGS_LEGACY_HASH_ROUTES: Record<string, string> = {
  // „Contul tău”: email, telefonul contului, parola, ghidul de pornire
  profil: '/settings/cont',
  parola: '/settings/cont',
  password: '/settings/cont',
  // Numele, telefonul și locul fermei
  locatie: '/settings/ferma',
  // Secțiunile de pe kit (SetariFerma)
  'pret-standard': '/settings/pret-standard',
  acasa: '/settings/acasa',
  'date-clienti': '/settings/cont',
  // Export, ștergeri
  gdpr: '/settings/cont',
  'actiuni-permanente': '/settings/cont',
  // Rămân pe ecranele lor
  'documente-legale': '/settings/ferma/acte',
  acte: '/settings/ferma/acte',
  echipa: '/settings/echipa',
  // Notificări push → „Ce primești”
  'notificari-push': '/notificari/setari',
  // Temă și tip interfață → Aspect
  tema: '/settings/aspect',
  interfata: '/settings/aspect',
  // Rânduri de pe lista Setări, pentru cine le vede
  demo: '/settings/demo',
  ferma: '/settings/schimba-ferma',
  // „Asistent AI” (istoricul chatului) a fost scos: rămâne lista Setări
  ai: '/settings',
}

/** `#gdpr` → `/settings/cont`. Ancoră necunoscută sau goală → `null` (rămâi pe listă). */
export function settingsRouteForLegacyHash(hash: string | null | undefined): string | null {
  const key = (hash ?? '').replace(/^#/, '').trim()
  if (!key) return null
  const route = SETTINGS_LEGACY_HASH_ROUTES[key]
  if (!route || route === '/settings') return null
  return route
}
