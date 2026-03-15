'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  MapPin,
  Users,
  UserCheck,
  PackageOpen,
  ShoppingCart,
  TrendingUp,
  Sprout,
  Receipt,
  ShoppingBag,
} from 'lucide-react';
import { ActionCard, EntityCard, InfoCard, ListCard } from '@/components/ui/app-card';
import { getRecoltari } from '@/lib/supabase/queries/recoltari';
import { getVanzari } from '@/lib/supabase/queries/vanzari';
import { getActivitatiAgricole } from '@/lib/supabase/queries/activitati-agricole';

const modules = [
  {
    href: '/parcele',
    label: 'Terenuri',
    description: 'Gestionează terenurile',
    icon: MapPin,
    color: '#F16B6B',
  },
  {
    href: '/culegatori',
    label: 'Culegători',
    description: 'Personal recoltare',
    icon: Users,
    color: '#F16B6B',
  },
  {
    href: '/clienti',
    label: 'Clienți',
    description: 'Baza de cumpărători',
    icon: UserCheck,
    color: '#F16B6B',
  },
  {
    href: '/recoltari',
    label: 'Recoltări',
    description: 'Producție zilnică',
    icon: PackageOpen,
    color: '#F16B6B',
  },
  {
    href: '/vanzari',
    label: 'Vânzări',
    description: 'Livrări și încasări',
    icon: ShoppingCart,
    color: '#F16B6B',
  },
  {
    href: '/vanzari-butasi',
    label: 'Material săditor',
    description: 'Material săditor',
    icon: ShoppingBag,
    color: '#F16B6B',
  },
  {
    href: '/activitati-agricole',
    label: 'Activități Agricole',
    description: 'Tratamente & fertilizări',
    icon: Sprout,
    color: '#F16B6B',
  },
  {
    href: '/investitii',
    label: 'Investiții',
    description: 'Cheltuieli de capital',
    icon: TrendingUp,
    color: '#F16B6B',
  },
  {
    href: '/cheltuieli',
    label: 'Cheltuieli',
    description: 'Costuri operaționale',
    icon: Receipt,
    color: '#F16B6B',
  },
];

interface ActivityItem {
  id: string;
  type: 'recoltare' | 'vanzare' | 'activitate';
  title: string;
  subtitle: string;
  value?: string;
  date: string;
}

interface KPIData {
  totalRecoltatAzi: number;
  totalVanzariAzi: number;
}

function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function useKPIs() {
  const [kpis, setKpis] = useState<KPIData>({
    totalRecoltatAzi: 0,
    totalVanzariAzi: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchKPIs() {
      try {
        const today = getTodayDateString();
        const [recoltari, vanzari] = await Promise.all([
          getRecoltari(),
          getVanzari(),
        ]);

        const totalRecoltatAzi = recoltari
          .filter((r) => r.data === today)
          .reduce((sum, r) => sum + Number(r.kg_cal1 || 0) + Number(r.kg_cal2 || 0), 0);

        const totalVanzariAzi = vanzari
          .filter((v) => v.data === today)
          .reduce((sum, v) => sum + v.cantitate_kg * v.pret_lei_kg, 0);

        setKpis({ totalRecoltatAzi, totalVanzariAzi });
      } catch (error) {
        console.error('Error fetching KPIs:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchKPIs();
  }, []);

  return { kpis, loading };
}

function useActivityFeed() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActivities() {
      try {
        const [recoltari, vanzari, activitati] = await Promise.all([
          getRecoltari(),
          getVanzari(),
          getActivitatiAgricole(),
        ]);

        const normalized: ActivityItem[] = [];

        recoltari.slice(0, 5).forEach((r) => {
          const totalKg = Number(r.kg_cal1 || 0) + Number(r.kg_cal2 || 0);
          normalized.push({
            id: r.id,
            type: 'recoltare',
            title: 'Recoltare',
            subtitle: `${totalKg} kg`,
            value: `${totalKg} kg`,
            date: r.data,
          });
        });

        vanzari.slice(0, 5).forEach((v) => {
          normalized.push({
            id: v.id,
            type: 'vanzare',
            title: 'Vânzare',
            subtitle: `${v.cantitate_kg} kg · ${v.pret_lei_kg} lei/kg`,
            value: `${(v.cantitate_kg * v.pret_lei_kg).toFixed(2)} lei`,
            date: v.data,
          });
        });

        activitati.slice(0, 5).forEach((a) => {
          normalized.push({
            id: a.id,
            type: 'activitate',
            title: a.tip_activitate || 'Activitate agricolă',
            subtitle: a.produs_utilizat || 'Fără produs specificat',
            date: a.data_aplicare,
          });
        });

        normalized.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setActivities(normalized);
      } catch (error) {
        console.error('Error fetching activities:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchActivities();
  }, []);

  return { activities, loading };
}

function ActivityCard({ activity }: { activity: ActivityItem }) {
  const iconMap = {
    recoltare: PackageOpen,
    vanzare: ShoppingCart,
    activitate: Sprout,
  };

  const Icon = iconMap[activity.type];

  return (
    <ListCard className="bg-white flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-[#F16B6B]/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-[#F16B6B]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-[#312E3F] truncate">
          {activity.title}
        </div>
        <div className="text-xs text-slate-600 truncate">
          {activity.subtitle}
        </div>
      </div>
      {activity.value && (
        <div className="text-sm font-bold text-[#E5484D] flex-shrink-0">
          {activity.value}
        </div>
      )}
    </ListCard>
  );
}

function KPICard({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <InfoCard className="bg-white flex flex-col items-center">
      {loading ? (
        <div className="h-10 w-24 bg-slate-200 rounded animate-pulse"></div>
      ) : (
        <div className="text-4xl font-bold text-[#E5484D]">
          {value}
        </div>
      )}
      <div className="text-xs text-slate-600 mt-2 text-center">
        {label}
      </div>
    </InfoCard>
  );
}

export function DashboardHome() {
  const { activities, loading: activitiesLoading } = useActivityFeed();
  const { kpis, loading: kpisLoading } = useKPIs();

  return (
    <>
      {/* Desktop layout */}
      <div className="hidden lg:block min-h-screen bg-gray-50 p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#312E3F]">
            Bun venit! 👋
          </h1>
          <p className="text-gray-500 mt-1 text-base">
            Selectează un modul pentru a începe
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {modules.map(({ href, label, description, icon: Icon }) => (
            <Link key={href} href={href} className="group block">
              <ActionCard
                className="bg-white border-gray-100 p-6 flex flex-col items-center text-center
                  lg:hover:shadow-md hover:-translate-y-1.5 hover:border-[#F16B6B]/20
                  transition-all duration-250 ease-out cursor-pointer"
              >
                {/* Icon bubble */}
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4
                    bg-[#F16B6B]/10 group-hover:bg-[#F16B6B]/20 transition-colors duration-200"
                >
                  <Icon
                    className="w-7 h-7 text-[#F16B6B] group-hover:scale-110 transition-transform duration-200"
                  />
                </div>

                {/* Text */}
                <p className="text-[#312E3F] font-semibold text-sm leading-tight mb-1">
                  {label}
                </p>
                <p className="text-gray-400 text-xs leading-snug">
                  {description}
                </p>
              </ActionCard>
            </Link>
          ))}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="lg:hidden space-y-4 pb-24">
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-[#312E3F]">
            Bun venit! 👋
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            Selectează un modul pentru a începe
          </p>
        </div>

        {/* KPI Section */}
        <div className="grid grid-cols-2 gap-3">
          <KPICard
            label="Total Recoltat Azi"
            value={`${kpis.totalRecoltatAzi} kg`}
            loading={kpisLoading}
          />
          <KPICard
            label="Vânzări Azi"
            value={`${kpis.totalVanzariAzi.toFixed(2)} lei`}
            loading={kpisLoading}
          />
        </div>

        {/* Activity Feed */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-[#312E3F]">
            Activitate Recentă
          </h2>
          {activitiesLoading ? (
            <div className="text-sm text-slate-600">Se încarcă...</div>
          ) : activities.length > 0 ? (
            activities.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))
          ) : (
            <div className="text-sm text-slate-600">Nicio activitate</div>
          )}
        </div>

        {/* Modules */}
        <div className="space-y-3 pt-4">
          <h2 className="text-base font-semibold text-[#312E3F]">
            Module
          </h2>
          {modules.map(({ href, label, description, icon: Icon }) => (
            <Link key={href} href={href} className="block">
              <EntityCard className="bg-white flex items-center gap-4 active:scale-[0.98] transition-transform">
                <div className="w-12 h-12 rounded-xl bg-[#F16B6B]/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-6 h-6 text-[#F16B6B]" />
                </div>
                <div className="flex-1">
                  <div className="text-lg font-bold text-[#312E3F]">
                    {label}
                  </div>
                  <div className="text-sm text-slate-600">
                    {description}
                  </div>
                </div>
              </EntityCard>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
