// ==========================================
// LINGUALEARN - Auth Hook
// CDC V2.1 Section 5 - Comptes, Rôles & Sécurité
// ==========================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '@/types';
import {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
} from '@/lib/db/localStorage';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
    setLoading(false);
  }, []);

  const register = useCallback(
    (firstName: string, email: string, password: string, role: UserRole) => {
      const result = registerUser(firstName, email, password, role);
      if (result.success && result.user) {
        setUser(result.user);
      }
      return result;
    },
    []
  );

  const login = useCallback((email: string, password: string) => {
    const result = loginUser(email, password);
    if (result.success && result.user) {
      setUser(result.user);
    }
    return result;
  }, []);

  const logout = useCallback(() => {
    logoutUser();
    setUser(null);
  }, []);

  const refreshUser = useCallback(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
    return currentUser;
  }, []);

  return {
    user,
    loading,
    register,
    login,
    logout,
    refreshUser,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
  };
}
