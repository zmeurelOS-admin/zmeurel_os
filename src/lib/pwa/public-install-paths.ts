/** Rute publice unde promptul PWA nu trebuie afișat (landing, magazin, livratori). */
export function isPublicNoPwaInstallPath(pathname: string | null): boolean {
  if (!pathname) return true
  return (
    pathname === '/' ||
    pathname.startsWith('/comanda') ||
    pathname.startsWith('/livrator')
  )
}
