/**
 * Template (App Router) re-montează copiii la navigare între segmente.
 * Ajută la evitarea stării „înghețate” a clientului când intri din /magazin în /magazin/asociatie.
 */
export default function MagazinAsociatieTemplate({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
