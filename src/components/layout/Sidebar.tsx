// src/components/layout/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  MapPin,
  Users,
  UserCheck,
  Receipt,
  TrendingDown,
  Package,
  Sprout,
  ShoppingCart,
  DollarSign,
  LogOut,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
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

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-64 flex-col bg-[#312E3F] text-white">
      {/* Logo / Header */}
      <div className="flex h-16 items-center justify-center border-b border-gray-700 px-4">
        <h1 className="text-2xl font-bold text-[#F16B6B]">🍓 Zmeurel OS</h1>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#F16B6B] text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Info / Logout */}
      <div className="border-t border-gray-700 p-4">
        <div className="mb-3 text-sm text-gray-400">
          <p className="font-medium text-white">Popa Elena</p>
          <p className="text-xs">popa.andrei.sv@gmail.com</p>
        </div>
        <button
          onClick={() => {
            // TODO: Implement logout
            window.location.href = '/login';
          }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
