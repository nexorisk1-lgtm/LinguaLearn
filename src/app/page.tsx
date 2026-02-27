'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/db/localStorage';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const currentUser = getCurrentUser();

    if (!currentUser) {
      // Not logged in - redirect to auth
      router.push('/auth');
    } else if (currentUser.role === 'admin') {
      // AD-01: Admin users go directly to admin page, not onboarding
      router.push('/module/admin');
    } else if (currentUser.onboardingCompleted) {
      // Logged in and onboarding completed - redirect to dashboard
      router.push('/dashboard');
    } else {
      // Logged in but onboarding not completed - redirect to onboarding
      router.push('/onboarding');
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <p className="text-foreground text-lg">Redirecting...</p>
    </div>
  );
}
