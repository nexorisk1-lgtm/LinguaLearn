'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/db/localStorage';

// V3.10 Règle 2: Standard back button identique à page Profil
// avatar rond doré + prénom + titre + ← flèche, fond bleu foncé, ~56px
interface PageHeaderProps {
  title: string;
  backHref?: string;
  onBack?: () => void; // Custom back handler (e.g. session quit confirmation)
}

export default function PageHeader({ title, backHref, onBack }: PageHeaderProps) {
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
    if (onBack) {
      onBack();
    } else if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  const avatarLetter = firstName ? firstName.charAt(0).toUpperCase() : '?';

  return (
    <div className="bg-[#002844] px-4 py-4 flex items-center gap-3">
      <button onClick={handleBack} className="p-1 -ml-1 hover:bg-white/10 rounded-lg transition-colors">
        <ArrowLeft className="h-5 w-5 text-white" />
      </button>
      <div className="w-12 h-12 rounded-full bg-[#D9B438] flex items-center justify-center flex-shrink-0">
        <span className="text-lg font-bold text-[#002844]">{avatarLetter}</span>
      </div>
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-bold text-white truncate">{firstName || title}</h1>
        <p className="text-xs text-white/60 truncate">{title}</p>
      </div>
    </div>
  );
}
