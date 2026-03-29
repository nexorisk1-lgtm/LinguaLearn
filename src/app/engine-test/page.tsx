'use client';

import { useState } from 'react';
import {
  getCourseDefinitions,
  getCourseContentMap,
  getCourseById,
  getTotalWordCount,
  getAllVocabulary,
  getAllGrammarRules,
  getVocabularyForCourse,
  getOrCreateProfile,
  getOrCreateProgress,
  getAvailableContent,
  getNextTraining,
  getUnlockedModules,
  getRecommendedNextStep,
  searchDictionary,
  getAvailableCoachModes,
  getUserScore,
  getDueRevisions,
  getRevisionSummary,
} from '@/lib/engine';
import type { User } from '@/types';

interface TestResult {
  label: string;
  passed: boolean;
  detail?: string;
}

// Mock user for engine tests
const MOCK_USER: User = {
  id: 'test-user-001',
  firstName: 'TestUser',
  email: 'test@test.com',
  role: 'user',
  status: 'active',
  settings: {
    interfaceLang: 'fr',
    learningLangs: ['en'],
    languageConfigs: { en: { objectives: ['vocabulaire', 'grammaire', 'oral', 'lecture', 'ecrit'], themes: [], hasGrcThemes: false, learningPath: 'A' } },
    schedule: { days: ['mon', 'wed', 'fri'], duration: 20 },
  },
  progress: { en: { levelCecrl: 'A1', objectiveProgress: { grammaire: 0, vocabulaire: 0, lecture: 0, ecrit: 0, oral: 0 } } },
  onboardingCompleted: true,
  activeLang: 'en',
  createdAt: new Date().toISOString(),
};

export default function EngineTestPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);

  async function runAllTests() {
    setResults([]);
    setRunning(true);
    const r: TestResult[] = [];

    function assert(cond: boolean, label: string, detail?: string) {
      r.push({ label, passed: cond, detail: detail || (cond ? '' : 'FAILED') });
    }

    try {
      // ▸ CourseRegistry
      const defs = getCourseDefinitions();
      assert(defs.length === 40, `CourseRegistry: 40 definitions (got ${defs.length})`);
      assert(defs[0].courseId === 'en_a1_c1', `First course = en_a1_c1`);

      const c5 = getCourseById('en_a1_c5');
      assert(c5 !== null, `getCourseById(en_a1_c5) found`);

      // ▸ CourseContentMap
      const map = getCourseContentMap();
      assert(Object.keys(map).length === 40, `ContentMap: 40 entries (got ${Object.keys(map).length})`);
      assert(map['en_a1_c1']?.vocabularyIds.length >= 5, `en_a1_c1 has ≥5 vocab IDs`);

      // ▸ ContentStore
      const allV = getAllVocabulary();
      assert(allV.length > 250, `Vocabulary > 250 words (got ${allV.length})`);
      assert(getTotalWordCount('en') === allV.length, `getTotalWordCount matches`);

      const c1V = getVocabularyForCourse('en_a1_c1');
      assert(c1V.length >= 5, `en_a1_c1 vocab ≥ 5 words`);
      assert(c1V[0].word_target === 'hello', `First word = hello`);
      assert(c1V[0].langueId === 'en', `Vocab langueId = en`);

      const rules = getAllGrammarRules();
      assert(rules.length === 40, `40 grammar rules (got ${rules.length})`);

      // ▸ searchDictionary
      const sh = searchDictionary('hello', 'en');
      assert(sh.length >= 1, `searchDictionary('hello') ≥ 1 result`);
      const sb = searchDictionary('bonjour', 'en');
      assert(sb.length >= 1, `searchDictionary('bonjour') native search works`);
      const sn = searchDictionary('xyznotexist', 'en');
      assert(sn.length === 0, `searchDictionary unknown = 0 results`);

      // ▸ Engine: 5 fonctions publiques avec profil test
      const profile = getOrCreateProfile(MOCK_USER);
      assert(profile.userId === 'test-user-001', `Profile created: userId correct`);
      assert(profile.activeLang === 'en', `Profile activeLang = en`);
      assert(profile.nativeLangue === 'fr', `Profile nativeLangue = fr`);

      const progress = getOrCreateProgress(profile.userId, 'en', 'A');
      assert(progress.langueId === 'en', `Progress langueId = en`);
      assert(progress.learningScore === 0, `Progress learningScore = 0`);

      // Fn 1: getAvailableContent
      const avail = getAvailableContent(profile, progress, 'en_a1_c1');
      assert(!avail.empty, `getAvailableContent(en_a1_c1) not empty`);
      assert(avail.vocabulary.length >= 5, `getAvailableContent: ≥5 vocab (got ${avail.vocabulary.length})`);

      const availBad = getAvailableContent(profile, progress, 'nonexistent_course');
      assert(availBad.empty === true, `getAvailableContent(nonexistent) = empty`);
      assert(availBad.reason === 'no_content_for_language', `Correct error reason`);

      // Fn 2: getNextTraining
      const trainGuided = getNextTraining(profile, progress, 'guided');
      assert(trainGuided.empty === true, `getNextTraining(guided) empty for new user`);
      assert(trainGuided.reason !== undefined, `Has reason for empty guided`);

      const trainFree = getNextTraining(profile, progress, 'free');
      assert(!trainFree.empty, `getNextTraining(free) not empty`);
      assert(trainFree.words.length > 0, `Free mode has words`);
      assert(trainFree.modeLabel.includes('exploration'), `Free mode label correct`);

      // Fn 3: getUnlockedModules
      const mods = getUnlockedModules(profile, progress);
      assert(mods.modules.length === 5, `Path A: 5 modules (got ${mods.modules.length})`);
      assert(mods.modules.every(m => m.id !== undefined), `All modules have id`);

      // Fn 4: getRecommendedNextStep
      const step = getRecommendedNextStep(profile, progress);
      assert(step.type === 'course', `Recommended: course (got ${step.type})`);
      assert(step.courseId === 'en_a1_c1', `Recommended course = en_a1_c1`);

      // Fn 5: searchDictionary already tested above

      // ▸ CoachEngine
      const coachModes = getAvailableCoachModes(profile);
      assert(coachModes.length >= 4, `Coach: ≥4 modes for A1 (got ${coachModes.length})`);
      assert(!coachModes.find(m => m.mode === 'conversation'), `A1 user cannot access conversation mode`);

      // ▸ GamificationEngine
      const scores = getUserScore(progress);
      assert(scores.learningScore === 0, `Initial learningScore = 0`);
      assert(scores.gameScore === 0, `Initial gameScore = 0`);
      assert(scores.battleScore === 0, `Initial battleScore = 0`);

      // ▸ RevisionEngine
      const dueRevs = getDueRevisions(progress);
      assert(dueRevs.length === 0, `No revisions due for new user`);
      const revSummary = getRevisionSummary(progress);
      assert(revSummary.totalItems === 0, `Revision summary: 0 items`);

    } catch (e: unknown) {
      r.push({ label: `ERROR: ${e instanceof Error ? e.message : String(e)}`, passed: false });
    }

    setResults(r);
    setRunning(false);
  }

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">LinguaLearn Engine — Phase 1 Tests</h1>
        <p className="text-gray-600 mb-6">Architecture V2.1.1 — 5 fonctions publiques + coach + gamification + révision</p>

        <button
          onClick={runAllTests}
          disabled={running}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 mb-6"
        >
          {running ? 'Running...' : 'Run All Tests'}
        </button>

        {results.length > 0 && (
          <>
            <div className={`p-4 rounded-lg mb-4 ${failedCount === 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              <strong>{passedCount}</strong> passed, <strong>{failedCount}</strong> failed
            </div>

            <div className="space-y-1">
              {results.map((r, i) => (
                <div key={i} className={`p-2 rounded text-sm font-mono ${r.passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {r.passed ? '✅' : '❌'} {r.label}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
