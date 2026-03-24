'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/db/localStorage';

// V3.10 Règle 2: Standard back button with avatar + prénom + ← flèche
// Model: Profil page — avatar/photo + prénom + ← arrow, min 44px height
interface PageHeaderProps {
  title: string;
  backHref?: string; // defaults to router.back()
  variant?: 'dark' | 'light'; // dark = blue bg white text, light = white bg dark text
}

function AvatarBadge({ letter, darkBg }: { letter: string; darkBg?: boolean }) {
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${darkBg ? 'bg-white/20' : 'bg-[#D9B438]/20'}`}>
      <span className={`text-sm font-bold ${darkBg ? 'text-white' : 'text-[#002844]'}`}>{letter}</span>
    </div>
  );
}

export default function PageHeader({ title, backHref, variant = 'dark' }: PageHeaderProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState<string>('');

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      const name = user.firstName && !user.firstName.includes('@')
        ? user.firstName
        : user.firstName?.split('@')[0] || '';
      setFirstName(name);
    }
  }, []);

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  const avatarLetter = firstName ? firstName.charAt(0).toUpperCase() : '?';

  if (variant === 'light') {
    return (
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4" style={{ minHeight: '44px' }}>
        <div className="max-w-lg mx-auto flex items-center gap-3 py-2" style={{ minHeight: '44px' }}>
          <button onClick={handleBack} className="p-1 -ml-1 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5 text-[#002844]" />
          </button>
          <AvatarBadge letter={avatarLetter} />
          <div className="flex-1 min-w-0">
            {firstName && (
              <p className="text-xs text-[#555555] leading-tight">{firstName}</p>
            )}
            <h1 className="text-base font-bold text-[#002844] leading-tight" style={{ fontSize: '16px' }}>{title}</h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-40 bg-[#002844] px-4" style={{ minHeight: '44px' }}>
      <div className="max-w-lg mx-auto flex items-center gap-3 py-2" style={{ minHeight: '44px' }}>
        <button onClick={handleBack} className="p-1 -ml-1 hover:bg-white/10 rounded-lg transition-colors">
          <ArrowLeft className="h-5 w-5 text-white" />
        </button>
        <AvatarBadge letter={avatarLetter} darkBg />
        <div className="flex-1 min-w-0">
          {firstName && (
            <p className="text-xs text-white/70 leading-tight">{firstName}</p>
          )}
          <h1 className="text-base font-bold text-white leading-tight" style={{ fontSize: '16px' }}>{title}</h1>
        </div>
      </div>
    </div>
  );
}
