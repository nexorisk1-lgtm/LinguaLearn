'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { t } from '@/lib/i18n';
import { InterfaceLanguage, UserRole } from '@/types';

type AuthMode = 'login' | 'register';

export default function AuthPage() {
  const router = useRouter();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [interfaceLang, setInterfaceLang] = useState<InterfaceLanguage>('fr');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [registerFirstName, setRegisterFirstName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerRole, setRegisterRole] = useState<UserRole>('user');

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string): boolean => {
    return password.length >= 6;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!loginEmail.trim()) {
      setError(t('auth.error.email', interfaceLang));
      return;
    }
    if (!validateEmail(loginEmail)) {
      setError(t('auth.error.email', interfaceLang));
      return;
    }
    if (!loginPassword.trim()) {
      setError(t('auth.error.password', interfaceLang));
      return;
    }

    setLoading(true);
    const result = login(loginEmail, loginPassword);

    if (!result.success) {
      setError(t(`auth.error.${result.error}`, interfaceLang));
      setLoading(false);
      return;
    }

    // Redirect to onboarding (since we just need to check that it will redirect to dashboard if already completed)
    router.push('/onboarding');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!registerFirstName.trim()) {
      setError(t('auth.error.firstName', interfaceLang));
      return;
    }
    if (!registerEmail.trim()) {
      setError(t('auth.error.email', interfaceLang));
      return;
    }
    if (!validateEmail(registerEmail)) {
      setError(t('auth.error.email', interfaceLang));
      return;
    }
    if (!registerPassword.trim() || !validatePassword(registerPassword)) {
      setError(t('auth.error.password', interfaceLang));
      return;
    }

    setLoading(true);
    const result = register(registerFirstName, registerEmail, registerPassword, registerRole);

    if (!result.success) {
      setError(t(`auth.error.${result.error}`, interfaceLang));
      setLoading(false);
      return;
    }

    // Redirect to onboarding
    router.push('/onboarding');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue to-blue-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Lingua<span className="text-gold">Learn</span>
          </h1>
          <p className="text-blue-100 text-sm">
            {interfaceLang === 'fr' ? 'Apprenez les langues avec intelligence' : 'Learn languages intelligently'}
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 mb-6">
          {/* Mode Toggle */}
          <div className="flex gap-2 mb-8">
            <button
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
                mode === 'login'
                  ? 'bg-blue text-white shadow-md'
                  : 'bg-gray-light text-blue hover:bg-gray-200'
              }`}
            >
              {t('auth.login', interfaceLang)}
            </button>
            <button
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
                mode === 'register'
                  ? 'bg-blue text-white shadow-md'
                  : 'bg-gray-light text-blue hover:bg-gray-200'
              }`}
            >
              {t('auth.register', interfaceLang)}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Login Form */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-blue mb-2">
                  {t('auth.email', interfaceLang)}
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="vous@exemple.com"
                  className="w-full px-4 py-3 border-2 border-gray-light rounded-lg focus:border-blue focus:outline-none transition-colors"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-sm font-medium text-blue mb-2">
                  {t('auth.password', interfaceLang)}
                </label>
                <input
                  id="login-password"
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full px-4 py-3 border-2 border-gray-light rounded-lg focus:border-blue focus:outline-none transition-colors"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary bg-blue text-white py-3 rounded-lg font-semibold mt-6 hover:opacity-90 disabled:opacity-70 transition-all"
              >
                {loading ? t('general.loading', interfaceLang) : t('auth.submit', interfaceLang)}
              </button>
            </form>
          )}

          {/* Register Form */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <label htmlFor="register-firstName" className="block text-sm font-medium text-blue mb-2">
                  {t('auth.firstName', interfaceLang)}
                </label>
                <input
                  id="register-firstName"
                  type="text"
                  value={registerFirstName}
                  onChange={(e) => setRegisterFirstName(e.target.value)}
                  placeholder={interfaceLang === 'fr' ? 'Jean' : 'John'}
                  className="w-full px-4 py-3 border-2 border-gray-light rounded-lg focus:border-blue focus:outline-none transition-colors"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="register-email" className="block text-sm font-medium text-blue mb-2">
                  {t('auth.email', interfaceLang)}
                </label>
                <input
                  id="register-email"
                  type="email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  placeholder="vous@exemple.com"
                  className="w-full px-4 py-3 border-2 border-gray-light rounded-lg focus:border-blue focus:outline-none transition-colors"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="register-password" className="block text-sm font-medium text-blue mb-2">
                  {t('auth.password', interfaceLang)}
                </label>
                <input
                  id="register-password"
                  type="password"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full px-4 py-3 border-2 border-gray-light rounded-lg focus:border-blue focus:outline-none transition-colors"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="register-role" className="block text-sm font-medium text-blue mb-2">
                  {t('auth.role', interfaceLang)}
                </label>
                <select
                  id="register-role"
                  value={registerRole}
                  onChange={(e) => setRegisterRole(e.target.value as UserRole)}
                  className="w-full px-4 py-3 border-2 border-gray-light rounded-lg focus:border-blue focus:outline-none transition-colors bg-white"
                  disabled={loading}
                >
                  <option value="user">{t('auth.user', interfaceLang)}</option>
                  <option value="admin">{t('auth.admin', interfaceLang)}</option>
                </select>
                <p className="text-xs text-gray mt-1">
                  {interfaceLang === 'fr'
                    ? 'Le rôle est défini une seule fois à la création du compte'
                    : 'Role is set once at account creation'}
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary bg-blue text-white py-3 rounded-lg font-semibold mt-6 hover:opacity-90 disabled:opacity-70 transition-all"
              >
                {loading ? t('general.loading', interfaceLang) : t('auth.submit', interfaceLang)}
              </button>
            </form>
          )}
        </div>

        {/* Language Toggle */}
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => setInterfaceLang('fr')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              interfaceLang === 'fr'
                ? 'bg-gold text-blue'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            FR
          </button>
          <button
            onClick={() => setInterfaceLang('en')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              interfaceLang === 'en'
                ? 'bg-gold text-blue'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            EN
          </button>
        </div>
      </div>
    </div>
  );
}
