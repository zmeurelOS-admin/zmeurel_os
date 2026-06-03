export type ShopCustomer = {
  order_count: number | null
  total_value_lei?: number | null
}

export type CustomerLabel = 'VIP' | 'Fidel' | 'Nou'

export function getCustomerLabel(customer: ShopCustomer): CustomerLabel {
  const orderCount = customer.order_count ?? 0
  const totalValueLei = customer.total_value_lei ?? 0

  if (orderCount >= 5 || totalValueLei >= 500) return 'VIP'
  if (orderCount >= 2) return 'Fidel'
  return 'Nou'
}

export function getBadgeColor(label: CustomerLabel): string {
  switch (label) {
    case 'VIP':
      return 'border-amber-200 bg-amber-100 text-amber-900'
    case 'Fidel':
      return 'border-emerald-200 bg-emerald-100 text-emerald-900'
    case 'Nou':
      return 'border-slate-200 bg-slate-100 text-slate-700'
  }
}
