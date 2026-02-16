// src/app/(dashboard)/dashboard/page.tsx
import { 
  MapPin, 
  Users, 
  UserCheck, 
  Package,
  ShoppingCart,
  DollarSign,
  Sprout,
  TrendingDown,
  Receipt
} from 'lucide-react';
import Link from 'next/link';

const modules = [
  { name: 'Parcele', href: '/parcele', icon: MapPin },
  { name: 'Culegători', href: '/culegatori', icon: Users },
  { name: 'Clienți', href: '/clienti', icon: UserCheck },
  { name: 'Recoltări', href: '/recoltari', icon: Package },
  { name: 'Vânzări Fructe', href: '/vanzari', icon: ShoppingCart },
  { name: 'Vânzări Butași', href: '/vanzari-butasi', icon: DollarSign },
  { name: 'Activități Agricole', href: '/activitati-agricole', icon: Sprout },
  { name: 'Investiții', href: '/investitii', icon: TrendingDown },
  { name: 'Cheltuieli', href: '/cheltuieli', icon: Receipt },
];

export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-16 pt-8">
        <h1 className="text-5xl font-semibold text-gray-900 tracking-tight mb-3">
          Zmeurel OS
        </h1>
        <p className="text-xl text-gray-500">
          Gestionează plantația ta
        </p>
      </div>

      {/* Module Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Link
              key={module.name}
              href={module.href}
              className="group bg-white rounded-2xl p-8 hover:bg-gray-50 transition-colors duration-200 border border-gray-100"
            >
              <div className="flex flex-col gap-4">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center group-hover:bg-[#F16B6B] transition-colors">
                  <Icon className="h-6 w-6 text-gray-600 group-hover:text-white transition-colors" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    {module.name}
                  </h3>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
