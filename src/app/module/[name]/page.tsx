'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/db/localStorage'
import { InterfaceLanguage } from '@/types'
import { t } from '@/lib/i18n'
import { Construction, ArrowLeft } from 'lucide-react'

export default function ModulePlaceholder() {
  const router = useRouter()
  const [lang, setLang] = useState<InterfaceLanguage>('fr')

  useEffect(() => {
    const user = getCurrentUser()
    if (user) setLang(user.settings.interfaceLang || 'fr')
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="w-full max-w-md text-center">
        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <Construction className="mx-auto mb-4 h-16 w-16 text-[#D9B438]" />
          <h1 className="text-2xl font-bold text-[#002844] mb-3">
            🚧 {t('placeholder.title', lang)}
          </h1>
          <p className="text-[#555555] mb-6">
            {t('placeholder.subtitle', lang)}
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center justify-center gap-2 mx-auto rounded-xl bg-[#002844] px-6 py-3 font-semibold text-white hover:opacity-90 transition-all"
          >
            <ArrowLeft className="h-5 w-5" />
            {t('placeholder.back', lang)}
          </button>
        </div>
      </div>
    </div>
  )
}
