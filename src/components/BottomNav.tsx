'use client';

import { usePathname } from 'next/navigation';
import { Home, Map, Target, User as UserIcon } from 'lucide-react';

interface NavItem {
  id: string;
  labelFr: string;
  labelEn: string;
  icon: typeof Home;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', labelFr: 'Accueil', labelEn: 'Home', icon: Home, href: '/dashboard' },
  { id: 'parcours', labelFr: 'Parcours', labelEn: 'Path', icon: Map, href: '/module/parcours' },
  { id: 'pratiquer', labelFr: 'Pratiquer', labelEn: 'Practice', icon: Target, href: '/module/pratiquer' },
  { id: 'profil', labelFr: 'Profil', labelEn: 'Profile', icon: UserIcon, href: '/module/profil' },
];

export default function BottomNav({ lang = 'fr' }: { lang?: string }) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.id === 'home' && pathname === '/dashboard');
          const color = active ? '#D9B438' : '#555555';
          return (
            <a key={item.id} href={item.href}
              className="flex flex-col items-center gap-0.5 px-3 py-1 min-w-[60px]">
              <Icon className="h-5 w-5" style={{ color }} />
              <span className="text-[10px] font-semibold" style={{ color }}>
                {lang === 'fr' ? item.labelFr : item.labelEn}
              </span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
