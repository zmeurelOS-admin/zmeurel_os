/**
 * Textele despre atestatul de producător (din 2014 actul se numește „atestat de producător”, valabil 7 ani).
 * În baza de date valorile rămân cele vechi: `certificat_producator` în enum și coloanele `certificate_*`.
 * Sursa unică pentru Actele fermei, Setări și cronul `farmer-legal-docs-check`.
 */

export const ATESTAT_LABEL = 'Atestat de producător'

/** Ce apare public, spus exact în confirmarea din Actele fermei. */
export const CONFIRMARE_ATESTAT_DETALIU =
  'Când magazinul și asociația revin, public apar doar numele fermei, localitatea, seria și valabilitatea atestatului și telefonul de contact. Numărul și poza atestatului nu se afișează.'

function dataLunga(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('ro-RO', { dateStyle: 'long' })
}

/** Notificarea proprietarului: atestatul expiră curând. */
export function notificareAtestatExpiraCurand(expiryDate: string): { title: string; body: string } {
  return {
    title: 'Atestatul tău expiră curând',
    body: `Atestatul tău de producător e valabil până la ${dataLunga(expiryDate)}. Reînnoiește-l ca să poți vinde în continuare.`,
  }
}

/** Notificarea proprietarului: atestatul a expirat. */
export function notificareAtestatExpirat(expiryDate: string): { title: string; body: string } {
  return {
    title: 'Atestatul tău a expirat',
    body: `Atestatul tău de producător a fost valabil până la ${dataLunga(expiryDate)}. Reînnoiește-l ca să poți vinde în continuare.`,
  }
}

/** Notificarea administratorilor asociației. */
export function notificareAsociatieAtestatExpirat(farmName: string, expiryDate: string): { title: string; body: string } {
  return {
    title: 'Atestat expirat la producător',
    body: `${farmName} are atestatul expirat din ${dataLunga(expiryDate)}. Produsele au fost retrase automat din listarea asociației.`,
  }
}
