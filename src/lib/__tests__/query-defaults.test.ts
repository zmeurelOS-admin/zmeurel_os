import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { invalidateStock, queryKeys } from '@/lib/query-keys'
import { QUERY_DEFAULT_OPTIONS } from '@/lib/query-defaults'

/** O pagină care citește stocul: se deschide (`subscribe`) și se închide (funcția întoarsă). */
function paginaStocuri(queryClient: QueryClient, queryFn: () => Promise<number>) {
  const observer = new QueryObserver(queryClient, { queryKey: queryKeys.stocGlobalCal1, queryFn })
  return observer.subscribe(() => undefined)
}

async function asteapta(queryClient: QueryClient) {
  await vi.waitFor(() => expect(queryClient.isFetching()).toBe(0))
}

describe('setările implicite ale interogărilor', () => {
  it('stocul schimbat cât pagina era închisă se reîncarcă la deschiderea ei', async () => {
    const queryClient = new QueryClient({ defaultOptions: QUERY_DEFAULT_OPTIONS })
    let stoc = 252
    const queryFn = vi.fn(async () => stoc)

    const inchide = paginaStocuri(queryClient, queryFn)
    await asteapta(queryClient)
    expect(queryClient.getQueryData(queryKeys.stocGlobalCal1)).toBe(252)
    inchide()

    // O vânzare făcută din altă pagină: Stocuri nu e pe ecran.
    stoc = 251
    invalidateStock(queryClient)
    await asteapta(queryClient)
    expect(queryFn).toHaveBeenCalledTimes(1)

    const inchideIar = paginaStocuri(queryClient, queryFn)
    await asteapta(queryClient)
    expect(queryFn).toHaveBeenCalledTimes(2)
    expect(queryClient.getQueryData(queryKeys.stocGlobalCal1)).toBe(251)
    inchideIar()
  })

  it('fără nicio schimbare, redeschiderea paginii nu mai cere nimic', async () => {
    const queryClient = new QueryClient({ defaultOptions: QUERY_DEFAULT_OPTIONS })
    const queryFn = vi.fn(async () => 252)

    paginaStocuri(queryClient, queryFn)()
    await asteapta(queryClient)
    const inchide = paginaStocuri(queryClient, queryFn)
    await asteapta(queryClient)

    expect(queryFn).toHaveBeenCalledTimes(1)
    inchide()
  })

  it('pagina de pe ecran se reîncarcă pe loc la invalidare', async () => {
    const queryClient = new QueryClient({ defaultOptions: QUERY_DEFAULT_OPTIONS })
    const queryFn = vi.fn(async () => 252)

    const inchide = paginaStocuri(queryClient, queryFn)
    await asteapta(queryClient)
    invalidateStock(queryClient)
    await asteapta(queryClient)

    expect(queryFn).toHaveBeenCalledTimes(2)
    inchide()
  })
})
