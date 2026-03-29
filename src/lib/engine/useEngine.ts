// ==========================================
// LINGUALEARN ENGINE — React Hook Bridge
// Architecture V2.1.1 — useEngine()
// Point d'entrée unique pour les composants React
// ==========================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { User } from '@/types';
import { getCurrentUser } from '@/lib/db/localStorage';
import type { UserProfile } from './userProfile';
import type { EngineProgress } from './userProgress';
import type {
  AvailableContent,
  TrainingContent,
  UnlockedModules,
  RecommendedStep,
  TaggedVocabWord,
} from './types';
import { ensureMigrated } from './migration';
import {
  getAvailableContent,
  getNextTraining,
  getUnlockedModules,
  getRecommendedNextStep,
  searchDictionary,
} from './contentEngine';
import { saveEngineProgress } from './userProgress';
import { saveEngineProfile } from './userProfile';

// --- Hook return type ---
export interface EngineState {
  // Loading state
  loading: boolean;
  error: string | null;

  // Core data
  profile: UserProfile | null;
  progress: EngineProgress | null;
  user: User | null;

  // 5 public engine functions (bound to current profile/progress)
  getContent: (courseId: string) => AvailableContent;
  getTraining: (mode: 'guided' | 'free') => TrainingContent;
  getModules: () => UnlockedModules;
  getNextStep: () => RecommendedStep;
  search: (query: string) => TaggedVocabWord[];

  // Mutations
  updateProgress: (updater: (prev: EngineProgress) => EngineProgress) => void;
  updateProfile: (updater: (prev: UserProfile) => UserProfile) => void;
  reload: () => void;
}

// --- Default empty states ---
const EMPTY_CONTENT: AvailableContent = {
  vocabulary: [], grammar: [], grammarExercises: [],
  reading: [], speaking: [], writing: [],
  empty: true, reason: 'no_course_completed',
};

const EMPTY_TRAINING: TrainingContent = {
  words: [], rules: [], exercises: [],
  modeLabel: '', empty: true,
};

const EMPTY_MODULES: UnlockedModules = {
  modules: [], progressBars: [],
};

const EMPTY_STEP: RecommendedStep = {
  type: 'course', reason: 'Loading...', priority: 1,
};

// --- The Hook ---
export function useEngine(): EngineState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [progress, setProgress] = useState<EngineProgress | null>(null);

  // Initialize
  const initialize = useCallback(() => {
    try {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        setLoading(false);
        return;
      }

      setUser(currentUser);

      // Auto-migrate if needed
      const { profile: p, progress: prog } = ensureMigrated(currentUser);
      setProfile(p);
      setProgress(prog);
      setError(null);

      console.log('[Engine:useEngine] Initialized', {
        userId: p.userId,
        activeLang: p.activeLang,
        learningScore: prog.learningScore,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Engine:useEngine] Init failed:', msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Bound engine functions
  const getContent = useCallback((courseId: string): AvailableContent => {
    if (!profile || !progress) return EMPTY_CONTENT;
    return getAvailableContent(profile, progress, courseId);
  }, [profile, progress]);

  const getTraining = useCallback((mode: 'guided' | 'free'): TrainingContent => {
    if (!profile || !progress) return EMPTY_TRAINING;
    return getNextTraining(profile, progress, mode);
  }, [profile, progress]);

  const getModules = useCallback((): UnlockedModules => {
    if (!profile || !progress) return EMPTY_MODULES;
    return getUnlockedModules(profile, progress);
  }, [profile, progress]);

  const getNextStep = useCallback((): RecommendedStep => {
    if (!profile || !progress) return EMPTY_STEP;
    return getRecommendedNextStep(profile, progress);
  }, [profile, progress]);

  const search = useCallback((query: string): TaggedVocabWord[] => {
    if (!profile) return [];
    return searchDictionary(query, profile.activeLang);
  }, [profile]);

  // Mutations
  const updateProgress = useCallback((updater: (prev: EngineProgress) => EngineProgress) => {
    setProgress(prev => {
      if (!prev) return prev;
      const updated = updater(prev);
      saveEngineProgress(updated);
      return updated;
    });
  }, []);

  const updateProfile = useCallback((updater: (prev: UserProfile) => UserProfile) => {
    setProfile(prev => {
      if (!prev) return prev;
      const updated = updater(prev);
      saveEngineProfile(updated);
      return updated;
    });
  }, []);

  return {
    loading,
    error,
    profile,
    progress,
    user,
    getContent,
    getTraining,
    getModules,
    getNextStep,
    search,
    updateProgress,
    updateProfile,
    reload: initialize,
  };
}
