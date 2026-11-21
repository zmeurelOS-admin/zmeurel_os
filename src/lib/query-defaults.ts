import type { DefaultOptions } from '@tanstack/react-query'

/**
 * Setările implicite ale interogărilor (folosite de `Providers`).
 *
 * `refetchOnMount`: datele din memorie se arată pe loc și NU se reîncarcă doar pentru că au trecut 60 de secunde
 * (ca până acum). Dar o interogare invalidată cât pagina ei era închisă (de ex. stocul, după o vânzare făcută din
 * altă pagină) se reîncarcă la deschiderea paginii. Cu `false` simplu, invalidarea se pierdea: `invalidateQueries`
 * reîncarcă doar interogările de pe ecran, iar la revenire pagina arăta valoarea veche până la 10 minute.
 */
export const QUERY_DEFAULT_OPTIONS: DefaultOptions = {
  queries: {
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    placeholderData: (previousData: unknown) => previousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: (query) => query.state.isInvalidated,
    retry: 1,
  },
}
