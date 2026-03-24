'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

// ARCHI-05 (V3.9): Standard back button header for all pages
// Model: Profil page (cap 2) — ← arrow + page name, top left, 16px min
interface PageHeaderProps {
  title: string;
  backHref?: string; // defaults to router.back()
  variant?: 'dark' | 'light'; // dark = blue bg white text, light = white bg dark text
}

export default function PageHeader({ title, backHref, variant = 'dark' }: PageHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  if (variant === 'light') {
    return (
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={handleBack} className="p-1 -ml-1 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5 text-[#002844]" />
          </button>
          <h1 className="text-base font-bold text-[#002844]" style={{ fontSize: '16px' }}>{title}</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-40 bg-[#002844] px-4 py-3">
      <div className="max-w-lg mx-auto flex items-center gap-3">
        <button onClick={handleBack} className="p-1 -ml-1 hover:bg-white/10 rounded-lg transition-colors">
          <ArrowLeft className="h-5 w-5 text-white" />
        </button>
        <h1 className="text-base font-bold text-white" style={{ fontSize: '16px' }}>{title}</h1>
      </div>
    </div>
  );
}
