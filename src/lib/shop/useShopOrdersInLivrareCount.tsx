import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query-keys'
import { fetchShopOrdersInLivrareCount } from '@/lib/shop/shop-orders-queries'

export function useShopOrdersInLivrareCount() {
  return useQuery({
    queryKey: queryKeys.shopOrdersInLivrareCount,
    queryFn: fetchShopOrdersInLivrareCount,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })
}

export function ShopOrdersInLivrareNavBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span
      className="min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold text-white"
      style={{ backgroundColor: '#F16B6B' }}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
