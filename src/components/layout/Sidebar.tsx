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
    <div className="flex h-screen w-64 flex-col bg-gradient-to-b from-[#312E3F] to-[#2a2738] text-white shadow-2xl">
      {/* Logo / Header */}
      <div className="flex h-16 items-center justify-center border-b border-gray-700/50 px-4">
        <h1 className="text-2xl font-bold">
          <span className="text-[#F16B6B]">🍓</span>
          <span className="ml-2 bg-gradient-to-r from-[#F16B6B] to-[#ff8585] bg-clip-text text-transparent">
            Zmeurel OS
          </span>
        </h1>
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
              className={`
                group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium 
                transition-all duration-200 ease-in-out
                ${
                  isActive
                    ? 'bg-gradient-to-r from-[#F16B6B] to-[#ef4444] text-white shadow-lg shadow-[#F16B6B]/20 scale-[1.02]'
                    : 'text-gray-300 hover:bg-white/5 hover:text-white hover:scale-[1.01]'
                }
              `}
            >
              <Icon 
                className={`h-5 w-5 transition-transform duration-200 ${
                  isActive ? '' : 'group-hover:scale-110'
                }`} 
              />
              <span>{item.name}</span>
              {isActive && (
                <div className="ml-auto h-2 w-2 rounded-full bg-white animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Info / Logout */}
      <div className="border-t border-gray-700/50 bg-black/10 p-4">
        <div className="mb-3 rounded-lg bg-white/5 p-3">
          <p className="font-semibold text-white">Popa Elena</p>
          <p className="text-xs text-gray-400">popa.andrei.sv@gmail.com</p>
        </div>
        <button
          onClick={() => {
            // TODO: Implement logout
            window.location.href = '/login';
          }}
          className="
            flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium 
            text-gray-300 transition-all duration-200 
            hover:bg-red-500/10 hover:text-red-400 hover:scale-[1.02]
          "
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
