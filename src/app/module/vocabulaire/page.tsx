'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Volume2,
  Heart,
  Send,
  BookOpen,
  Mic,
  MicOff,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

import { getCurrentUser, updateUserProgress } from '@/lib/db/localStorage';
import { User, ALL_THEMES } from '@/types';
import { t, getThemeName } from '@/lib/i18n';
import {
  getVocabulary,
  speakText,
  addToPersonalVocab,
  removeFromPersonalVocab,
  isInPersonalVocab,
  getPersonalVocab,
  proposeWord,
  getWritingExercises,
  getSpeakingExercises,
  isCloseEnough,
} from '@/lib/db/bankHelpers';
import {
  VocabWord,
  WritingExercise,
  SpeakingExercise,
} from '@/lib/db/bankTypes';

type TabType = 'discovery' | 'myWords' | 'write' | 'pronounce' | 'propose';

type WritingFeedback = 'correct' | 'almost' | 'wrong' | null;
type SpeakingRecognitionState = 'idle' | 'listening' | 'recognized' | 'error';

export default function VocabulairePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('discovery');
  const [selectedTheme, setSelectedTheme] = useState<string>('all');
  const [vocabulary, setVocabulary] = useState<VocabWord[]>([]);
  const [personalVocab, setPersonalVocab] = useState<VocabWord[]>([]);
  const [personalVocabStatus, setPersonalVocabStatus] = useState<Record<string, string>>({});
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');

  // Writing exercise state
  const [writingExercises, setWritingExercises] = useState<WritingExercise[]>([]);
  const [writingIndex, setWritingIndex] = useState(0);
  const [writingAnswer, setWritingAnswer] = useState('');
  const [writingFeedback, setWritingFeedback] = useState<WritingFeedback>(null);
  const [writingExpectedAnswer, setWritingExpectedAnswer] = useState('');
  const [writingSubmitted, setWritingSubmitted] = useState(false);
  const [writingCorrectCount, setWritingCorrectCount] = useState(0);

  // Speaking exercise state
  const [speakingExercises, setSpeakingExercises] = useState<SpeakingExercise[]>(
    []
  );
  const [speakingIndex, setSpeakingIndex] = useState(0);
  const [speakingRecognition, setSpeakingRecognition] =
    useState<SpeakingRecognitionState>('idle');
  const [speakingRecognizedText, setSpeakingRecognizedText] = useState('');
  const [speakingIsMatch, setSpeakingIsMatch] = useState<boolean | null>(null);
  const [speakingCorrectCount, setSpeakingCorrectCount] = useState(0);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const userAudioUrlRef = useRef<string>('');
  const prevSpeakingIndexRef = useRef<number>(-1);
  const hasReceivedResultRef = useRef<boolean>(false);
  const [vocabulaireProgressUpdated, setVocabulaireProgressUpdated] = useState(false);

  // Form state for propose word
  const [formData, setFormData] = useState({
    word_target: '',
    word_fr: '',
    definition_en: '',
    example_en: '',
    theme: '',
    isGrc: false,
  });

  // Initialize user and load data
  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      router.push('/login');
      return;
    }
    setUser(currentUser);

    const activeLang = currentUser.activeLang || currentUser.settings.learningLangs[0] || 'en';
    const userLevel = currentUser.progress?.[activeLang]?.levelCecrl || 'A1';
    const userThemes = currentUser.settings.languageConfigs?.[activeLang]?.themes || ['travel'];

    // Get vocabulary
    const allVocab = getVocabulary(activeLang, userThemes, userLevel);

    // BUG-30: Filter Discovery tab to show only X words per day
    const wordsPerDay = currentUser.settings.schedules?.[activeLang]?.wordsPerDay || 8;
    const personal = getPersonalVocab(currentUser.id);
    const personalWordIds = new Set(personal.map(pv => pv.wordId));

    // Filter out words already in personal vocab (already learned)
    const remainingWords = allVocab.filter(word => !personalWordIds.has(word.id));

    // Use date as seed for deterministic daily rotation
    const dateStr = new Date().toISOString().split('T')[0];
    const seedHash = dateStr.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

    // Shuffle deterministically using seed, then slice to wordsPerDay
    const shuffled = remainingWords.slice().sort((a, b) => {
      const hashA = (seedHash + (a.id?.charCodeAt(0) || 0)) % 1000;
      const hashB = (seedHash + (b.id?.charCodeAt(0) || 0)) % 1000;
      return hashA - hashB;
    });

    const discoveryWords = shuffled.slice(0, wordsPerDay);
    setVocabulary(discoveryWords);

    // Get personal vocabulary
    const personalWords = allVocab.filter((word) =>
      personal.some((pv) => pv.wordId === word.id)
    );
    setPersonalVocab(personalWords);

    // Build status map for personal vocab
    const statusMap: Record<string, string> = {};
    personal.forEach(pv => { statusMap[pv.wordId] = pv.status || 'in_progress'; });
    setPersonalVocabStatus(statusMap);

    // Get writing exercises
    const writing = getWritingExercises(activeLang, userThemes, userLevel);
    setWritingExercises(writing);
    setWritingIndex(0);

    // Get speaking exercises
    const speaking = getSpeakingExercises(activeLang, userThemes, userLevel);
    setSpeakingExercises(speaking);
    setSpeakingIndex(0);

    setIsLoading(false);
  }, [router]);

  // Update vocabulaire progress when vocabulary is loaded and discovery tab is viewed
  useEffect(() => {
    if (user && vocabulary.length > 0 && activeTab === 'discovery' && !vocabulaireProgressUpdated) {
      const currentActiveLang = user.activeLang || user.settings.learningLangs[0] || 'en';
      // Award some progress for viewing vocabulary
      updateUserProgress(user.id, currentActiveLang, {
        objectiveProgress: {
          ...user.progress?.[currentActiveLang]?.objectiveProgress,
          vocabulaire: Math.min(
            (user.progress?.[currentActiveLang]?.objectiveProgress?.vocabulaire || 0) + 10,
            100
          ),
        },
      });
      setVocabulaireProgressUpdated(true);
    }
  }, [activeTab, vocabulary, user, vocabulaireProgressUpdated]);

  // O-01: Auto-play for pronunciation exercises
  useEffect(() => {
    if (activeTab === 'pronounce' && speakingExercises[speakingIndex] && prevSpeakingIndexRef.current !== speakingIndex) {
      prevSpeakingIndexRef.current = speakingIndex;
      const currentLang = user?.activeLang || user?.settings?.learningLangs[0] || 'en';
      const timer = setTimeout(() => {
        speakText(speakingExercises[speakingIndex].target_text, currentLang);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [speakingIndex, activeTab, speakingExercises, user]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mb-4 inline-block">
            <BookOpen className="w-8 h-8" style={{ color: '#002844' }} />
          </div>
          <p style={{ color: '#555555' }}>
            {t('onboarding.loading', user?.settings.interfaceLang || 'fr')}
          </p>
        </div>
      </div>
    );
  }

  const activeLang = user.activeLang || user.settings.learningLangs[0] || 'en';
  const userThemes = user.settings.languageConfigs?.[activeLang]?.themes || ['travel'];
  const interfaceLang = user.settings.interfaceLang || 'fr';

  // Filter vocabulary based on selected theme
  const filteredVocabulary =
    selectedTheme === 'all'
      ? vocabulary
      : vocabulary.filter((word) => word.theme === selectedTheme);

  // Toggle expand/collapse for card
  const toggleExpand = (wordId: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(wordId)) {
      newExpanded.delete(wordId);
    } else {
      newExpanded.add(wordId);
    }
    setExpandedCards(newExpanded);
  };

  // Handle add to personal vocab
  const handleAddToPersonal = (word: VocabWord) => {
    addToPersonalVocab(user.id, word.id);
    const personal = getPersonalVocab(user.id);
    const personalWords = vocabulary.filter((v) =>
      personal.some((pv) => pv.wordId === v.id)
    );
    setPersonalVocab(personalWords);
  };

  // Handle remove from personal vocab
  const handleRemoveFromPersonal = (word: VocabWord) => {
    removeFromPersonalVocab(user.id, word.id);
    const personal = getPersonalVocab(user.id);
    const personalWords = vocabulary.filter((v) =>
      personal.some((pv) => pv.wordId === v.id)
    );
    setPersonalVocab(personalWords);
  };

  // Writing exercise handlers
  const handleWritingSubmit = () => {
    if (writingSubmitted) return;

    const exercise = writingExercises[writingIndex];
    if (!exercise) return;

    setWritingSubmitted(true);

    if (exercise.type === 'free_writing') {
      setWritingFeedback(null);
    } else {
      const expected = exercise.answer || '';
      setWritingExpectedAnswer(expected);

      if (writingAnswer.toLowerCase().trim() === expected.toLowerCase().trim()) {
        setWritingFeedback('correct');
        setWritingCorrectCount(writingCorrectCount + 1);
      } else if (isCloseEnough(writingAnswer, expected)) {
        setWritingFeedback('almost');
      } else {
        setWritingFeedback('wrong');
      }
    }
  };

  const handleWritingNext = () => {
    if (writingIndex < writingExercises.length - 1) {
      setWritingIndex(writingIndex + 1);
      setWritingAnswer('');
      setWritingFeedback(null);
      setWritingExpectedAnswer('');
      setWritingSubmitted(false);
    } else {
      // All writing exercises completed, update progress
      if (user && writingExercises.length > 0) {
        const ecritProgress = Math.round((writingCorrectCount / writingExercises.length) * 100);
        updateUserProgress(user.id, activeLang, {
          objectiveProgress: {
            ...user.progress?.[activeLang]?.objectiveProgress,
            ecrit: ecritProgress,
          },
        });
      }
    }
  };

  // Speaking exercise handlers
  const initSpeechRecognition = () => {
    if (recognitionRef.current) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeakingRecognition('error');
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    const langMap: Record<string, string> = {
      en: 'en-US',
      es: 'es-ES',
      fr: 'fr-FR',
      de: 'de-DE',
      it: 'it-IT',
      pt: 'pt-PT',
      ru: 'ru-RU',
      ja: 'ja-JP',
      zh: 'zh-CN',
    };

    recognition.lang = langMap[activeLang] || activeLang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setSpeakingRecognition('listening');
    };

    recognition.onresult = (event: any) => {
      // Build transcript from all results
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }

      hasReceivedResultRef.current = true;
      setSpeakingRecognizedText(transcript);

      // Only process final results (not interim results)
      const isFinal = event.results[event.results.length - 1].isFinal;
      if (!isFinal) {
        return;
      }

      const exercise = speakingExercises[speakingIndex];
      if (exercise) {
        // Normalize strings by removing punctuation and extra spaces
        const normalize = (s: string) => s.toLowerCase().trim().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ');
        const targetNorm = normalize(exercise.target_text);
        const inputNorm = normalize(transcript);

        // Check exact match, partial matches, or close enough
        const match = targetNorm === inputNorm
          || inputNorm.includes(targetNorm)
          || targetNorm.includes(inputNorm)
          || isCloseEnough(transcript, exercise.target_text);

        setSpeakingIsMatch(match);
        if (match) {
          setSpeakingCorrectCount(speakingCorrectCount + 1);
        }
      }

      setSpeakingRecognition('recognized');
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        setSpeakingRecognition('error');
      } else if (event.error !== 'network') {
        setSpeakingRecognition('error');
      }
    };

    recognition.onend = () => {
      // Only set error if no result was received
      if (!hasReceivedResultRef.current) {
        setSpeakingRecognition('error');
      }
    };
  };

  const handleSpeakingRecord = async () => {
    if (speakingRecognition === 'listening') {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      setSpeakingRecognition('idle');
      return;
    }

    // Start MediaRecorder for playback
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      
      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        if (userAudioUrlRef.current) URL.revokeObjectURL(userAudioUrlRef.current);
        userAudioUrlRef.current = URL.createObjectURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      
      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch {
      console.log('MediaRecorder not available, playback disabled');
    }

    // Start SpeechRecognition
    initSpeechRecognition();
    if (recognitionRef.current) {
      hasReceivedResultRef.current = false;
      setSpeakingRecognizedText('');
      setSpeakingIsMatch(null);
      recognitionRef.current.start();
    }
  };

  const handleSpeakingTryAgain = () => {
    setSpeakingRecognition('idle');
    setSpeakingRecognizedText('');
    setSpeakingIsMatch(null);
  };

  const handleSpeakingNext = () => {
    if (speakingIndex < speakingExercises.length - 1) {
      setSpeakingIndex(speakingIndex + 1);
      setSpeakingRecognition('idle');
      setSpeakingRecognizedText('');
      setSpeakingIsMatch(null);
    } else {
      // All speaking exercises completed, update progress
      if (user && speakingExercises.length > 0) {
        const oralProgress = Math.round((speakingCorrectCount / speakingExercises.length) * 100);
        updateUserProgress(user.id, activeLang, {
          objectiveProgress: {
            ...user.progress?.[activeLang]?.objectiveProgress,
            oral: oralProgress,
          },
        });
      }
    }
  }
  const playUserRecording = () => {
    if (userAudioUrlRef.current) {
      const audio = new Audio(userAudioUrlRef.current);
      audio.play();
    }
  };

  // Handle propose word form
  const handleProposeSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Only word_fr is required now
    if (!formData.word_fr) {
      alert(t('vocab.proposeForm.error', interfaceLang));
      return;
    }

    proposeWord(user.id, {
      language: activeLang,
      word_target: formData.word_target,
      word_fr: formData.word_fr,
      definition_en: formData.definition_en,
      example_en: formData.example_en,
      theme: formData.theme,
      type: undefined,
      is_grc: formData.isGrc,
    });

    setSuccessMessage('Mot envoyé pour validation admin');
    setFormData({
      word_target: '',
      word_fr: '',
      definition_en: '',
      example_en: '',
      theme: '',
      isGrc: false,
    });

    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // Vocabulary card component
  const VocabCard = ({ word, isPersonal = false }: { word: VocabWord; isPersonal?: boolean }) => {
    const isExpanded = expandedCards.has(word.id);
    const inPersonal = isInPersonalVocab(user.id, word.id);

    return (
      <div
        className="rounded-lg border-2 p-4 transition-all hover:shadow-md"
        style={{
          borderColor: '#D9B438',
          backgroundColor: '#ffffff',
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <h3 className="text-xl font-bold mb-1" style={{ color: '#002844' }}>
              {word.word_target}
            </h3>
            <p style={{ color: '#555555', fontSize: '0.875rem' }}>
              {word.word_fr}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 ml-2">
            <button
              onClick={() => speakText(word.word_target, activeLang)}
              className="p-2 rounded-lg hover:opacity-80 transition-opacity"
              style={{ backgroundColor: '#D9B438' }}
              title={t('vocab.listen', interfaceLang)}
              aria-label={t('vocab.listen', interfaceLang)}
            >
              <Volume2 className="w-4 h-4" style={{ color: '#002844' }} />
            </button>

            {isPersonal ? (
              <button
                onClick={() => handleRemoveFromPersonal(word)}
                className="p-2 rounded-lg hover:opacity-80 transition-opacity"
                style={{ backgroundColor: '#ffebee' }}
                title={t('vocab.removeFromList', interfaceLang)}
                aria-label={t('vocab.removeFromList', interfaceLang)}
              >
                <Heart
                  className="w-4 h-4 fill-current"
                  style={{ color: '#d32f2f' }}
                />
              </button>
            ) : (
              <button
                onClick={() => handleAddToPersonal(word)}
                className={`p-2 rounded-lg hover:opacity-80 transition-opacity ${
                  inPersonal ? 'opacity-50' : ''
                }`}
                style={{
                  backgroundColor: inPersonal ? '#ffebee' : '#f0f0f0',
                }}
                title={t('vocab.addToList', interfaceLang)}
                aria-label={t('vocab.addToList', interfaceLang)}
                disabled={inPersonal}
              >
                <Heart
                  className={`w-4 h-4 ${inPersonal ? 'fill-current' : ''}`}
                  style={{ color: inPersonal ? '#d32f2f' : '#555555' }}
                />
              </button>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="flex gap-2 mb-3 flex-wrap">
          <span
            className="text-xs font-semibold px-2 py-1 rounded"
            style={{
              backgroundColor: '#D9B438',
              color: '#002844',
            }}
          >
            {word.level}
          </span>
          {word.type && (
            <span
              className="text-xs font-semibold px-2 py-1 rounded"
              style={{
                backgroundColor: '#f0f0f0',
                color: '#555555',
              }}
            >
              {word.type}
            </span>
          )}
        </div>

        {/* Expand/collapse button */}
        <button
          onClick={() => toggleExpand(word.id)}
          className="w-full text-left py-2 px-2 rounded text-sm font-semibold transition-colors"
          style={{
            color: '#002844',
            backgroundColor: '#f0f0f0',
          }}
        >
          {isExpanded ? '▼' : '▶'} {t('vocab.definition', interfaceLang)}
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div
            className="mt-3 space-y-2 pt-3 border-t"
            style={{ borderColor: '#D9B438' }}
          >
            <div>
              <p className="text-xs font-semibold" style={{ color: '#D9B438' }}>
                {interfaceLang === 'fr' ? 'Définition' : 'Definition'}
              </p>
              <p style={{ color: '#555555', fontSize: '0.875rem' }}>
                {word.definition_en}
              </p>
              {word.definition_fr && (
                <p style={{ color: '#002844', fontSize: '0.875rem', fontWeight: 600 }}>
                  FR: {word.definition_fr}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: '#D9B438' }}>
                {interfaceLang === 'fr' ? 'Exemple' : 'Example'}
              </p>
              <p style={{ color: '#555555', fontSize: '0.875rem' }}>
                {word.example_en}
              </p>
              {word.example_fr && (
                <p style={{ color: '#002844', fontSize: '0.875rem', fontStyle: 'italic' }}>
                  FR: {word.example_fr}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header
        className="px-4 md:px-8 py-6 md:py-8"
        style={{
          backgroundColor: '#002844',
          color: '#ffffff',
        }}
      >
        <div className="flex items-center gap-4 mb-4">
          <Link href="/dashboard">
            <button
              className="p-2 rounded-lg hover:opacity-80 transition-opacity"
              style={{ backgroundColor: '#D9B438' }}
              aria-label={t('module.back', interfaceLang)}
            >
              <ArrowLeft className="w-5 h-5" style={{ color: '#002844' }} />
            </button>
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold">
            {t('vocab.title', interfaceLang)}
          </h1>
        </div>

        {/* Filter bar - only show on discovery tab */}
        {activeTab === 'discovery' && (
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <label className="text-sm font-semibold">
              {t('module.filter.theme', interfaceLang)}
            </label>
            <select
              value={selectedTheme}
              onChange={(e) => setSelectedTheme(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm font-medium border-2"
              style={{
                borderColor: '#D9B438',
                backgroundColor: '#ffffff',
                color: '#002844',
              }}
            >
              <option value="all">{t('module.filter.all', interfaceLang)}</option>
              {userThemes.map((themeId) => {
                const themeName = getThemeName(themeId, interfaceLang, ALL_THEMES);
                return (
                  <option key={themeId} value={themeId}>
                    {themeName}
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </header>

      {/* Tabs - scrollable on mobile */}
      <div
        className="px-4 md:px-8 py-4 flex gap-0 border-b-2 overflow-x-auto"
        style={{
          borderColor: '#D9B438',
          backgroundColor: '#ffffff',
        }}
      >
        <button
          onClick={() => setActiveTab('discovery')}
          className="px-4 py-3 font-semibold text-sm md:text-base transition-colors border-b-2 whitespace-nowrap"
          style={{
            color: activeTab === 'discovery' ? '#D9B438' : '#555555',
            borderColor: activeTab === 'discovery' ? '#D9B438' : 'transparent',
          }}
        >
          Découverte
        </button>
        <button
          onClick={() => setActiveTab('myWords')}
          className="px-4 py-3 font-semibold text-sm md:text-base transition-colors border-b-2 whitespace-nowrap"
          style={{
            color: activeTab === 'myWords' ? '#D9B438' : '#555555',
            borderColor: activeTab === 'myWords' ? '#D9B438' : 'transparent',
          }}
        >
          {t('vocab.myWords', interfaceLang)}
        </button>
        <button
          onClick={() => setActiveTab('write')}
          className="px-4 py-3 font-semibold text-sm md:text-base transition-colors border-b-2 whitespace-nowrap"
          style={{
            color: activeTab === 'write' ? '#D9B438' : '#555555',
            borderColor: activeTab === 'write' ? '#D9B438' : 'transparent',
          }}
        >
          Écrire
        </button>
        <button
          onClick={() => setActiveTab('pronounce')}
          className="px-4 py-3 font-semibold text-sm md:text-base transition-colors border-b-2 whitespace-nowrap"
          style={{
            color: activeTab === 'pronounce' ? '#D9B438' : '#555555',
            borderColor: activeTab === 'pronounce' ? '#D9B438' : 'transparent',
          }}
        >
          Prononcer
        </button>
        <button
          onClick={() => setActiveTab('propose')}
          className="px-4 py-3 font-semibold text-sm md:text-base transition-colors border-b-2 whitespace-nowrap"
          style={{
            color: activeTab === 'propose' ? '#D9B438' : '#555555',
            borderColor: activeTab === 'propose' ? '#D9B438' : 'transparent',
          }}
        >
          {t('vocab.proposeWord', interfaceLang)}
        </button>
      </div>

      {/* Content */}
      <main className="px-4 md:px-8 py-8">
        {/* Discovery Tab */}
        {activeTab === 'discovery' && (
          <div>
            {filteredVocabulary.length > 0 ? (
              <>
                <p className="mb-6 font-semibold" style={{ color: '#555555' }}>
                  {filteredVocabulary.length} {t('vocab.wordCount', interfaceLang)}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredVocabulary.map((word) => (
                    <VocabCard key={word.id} word={word} isPersonal={false} />
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <div className="max-w-md mx-auto">
                  <p style={{ color: '#002844', fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
                    {interfaceLang === 'fr'
                      ? 'Aucun contenu disponible pour vos thèmes et votre niveau actuellement'
                      : 'No content available for your themes and level currently'}
                  </p>
                  <p style={{ color: '#555555', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
                    {interfaceLang === 'fr'
                      ? "L'administrateur va enrichir le contenu bientôt. En attendant, explorez les autres modules !"
                      : 'The administrator will add content soon. In the meantime, explore other modules!'}
                  </p>
                  <a
                    href="/dashboard"
                    className="mt-4 inline-block px-6 py-2 rounded-xl bg-[#002844] text-white text-sm font-bold hover:bg-[#003a5c] transition-colors"
                  >
                    {interfaceLang === 'fr' ? 'Retour au dashboard' : 'Back to dashboard'}
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* My Words Tab */}
        {activeTab === 'myWords' && (
          <div>
            {personalVocab.length > 0 ? (
              <>
                <p className="mb-6 font-semibold" style={{ color: '#555555' }}>
                  {personalVocab.length} {t('vocab.wordCount', interfaceLang)}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {personalVocab.map((word) => (
                    <div key={word.id} className="relative">
                      <VocabCard word={word} isPersonal={true} />
                      <span className={`absolute top-2 right-2 text-xs font-bold px-2 py-0.5 rounded-full ${
                        personalVocabStatus[word.id] === 'learned' ? 'bg-green-100 text-green-700' :
                        personalVocabStatus[word.id] === 'to_review' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {personalVocabStatus[word.id] === 'learned' ? (interfaceLang === 'fr' ? 'Appris' : 'Learned') :
                         personalVocabStatus[word.id] === 'to_review' ? (interfaceLang === 'fr' ? 'À revoir' : 'To review') :
                         (interfaceLang === 'fr' ? 'En cours' : 'In progress')}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <div className="max-w-md mx-auto">
                  <p style={{ color: '#002844', fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
                    {interfaceLang === 'fr'
                      ? 'Aucun contenu disponible pour vos thèmes et votre niveau actuellement'
                      : 'No content available for your themes and level currently'}
                  </p>
                  <p style={{ color: '#555555', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
                    {interfaceLang === 'fr'
                      ? "L'administrateur va enrichir le contenu bientôt. En attendant, explorez les autres modules !"
                      : 'The administrator will add content soon. In the meantime, explore other modules!'}
                  </p>
                  <a
                    href="/dashboard"
                    className="mt-4 inline-block px-6 py-2 rounded-xl bg-[#002844] text-white text-sm font-bold hover:bg-[#003a5c] transition-colors"
                  >
                    {interfaceLang === 'fr' ? 'Retour au dashboard' : 'Back to dashboard'}
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Writing Tab */}
        {activeTab === 'write' && (
          <div className="max-w-2xl mx-auto">
            {writingExercises.length > 0 ? (
              <>
                <div className="mb-6">
                  <p className="font-semibold" style={{ color: '#555555' }}>
                    Exercice {writingIndex + 1} / {writingExercises.length}
                  </p>
                </div>

                <div
                  className="p-6 rounded-lg border-2 mb-6"
                  style={{
                    borderColor: '#D9B438',
                    backgroundColor: '#ffffff',
                  }}
                >
                  {(() => {
                    const exercise = writingExercises[writingIndex];
                    if (!exercise) return null;

                    let typeBadgeText = '';
                    if (exercise.type === 'translation') typeBadgeText = 'Traduction';
                    else if (exercise.type === 'completion') typeBadgeText = 'Complément';
                    else if (exercise.type === 'free_writing') typeBadgeText = 'Libre';

                    return (
                      <>
                        {/* Type badge */}
                        <div className="mb-4">
                          <span
                            className="text-xs font-semibold px-3 py-1 rounded inline-block"
                            style={{
                              backgroundColor: '#D9B438',
                              color: '#002844',
                            }}
                          >
                            {typeBadgeText}
                          </span>
                        </div>

                        {/* Instruction */}
                        <p
                          className="mb-4 font-semibold"
                          style={{ color: '#002844' }}
                        >
                          {interfaceLang === 'fr'
                            ? exercise.instruction_fr
                            : exercise.instruction_en}
                        </p>

                        {/* Prompt */}
                        <p
                          className="mb-6 text-lg"
                          style={{ color: '#555555' }}
                        >
                          {exercise.prompt}
                        </p>

                        {/* Answer textarea */}
                        <textarea
                          value={writingAnswer}
                          onChange={(e) => setWritingAnswer(e.target.value)}
                          disabled={writingSubmitted}
                          className="w-full px-4 py-3 rounded-lg border-2 mb-4 font-medium"
                          style={{
                            borderColor: '#D9B438',
                            color: '#002844',
                          }}
                          placeholder="Votre réponse..."
                          rows={4}
                        />

                        {/* Feedback */}
                        {writingSubmitted && (
                          <div className="mb-6">
                            {exercise.type === 'free_writing' ? (
                              <div
                                className="p-4 rounded-lg flex gap-3 items-start"
                                style={{
                                  backgroundColor: '#e3f2fd',
                                  borderLeft: '4px solid #002844',
                                }}
                              >
                                <AlertCircle
                                  className="w-5 h-5 flex-shrink-0 mt-0.5"
                                  style={{ color: '#002844' }}
                                />
                                <p
                                  style={{ color: '#002844' }}
                                  className="text-sm font-semibold"
                                >
                                  Exercice libre - pas de correction automatique
                                </p>
                              </div>
                            ) : writingFeedback === 'correct' ? (
                              <div
                                className="p-4 rounded-lg flex gap-3 items-start"
                                style={{
                                  backgroundColor: '#c8e6c9',
                                  borderLeft: '4px solid #2e7d32',
                                }}
                              >
                                <CheckCircle
                                  className="w-5 h-5 flex-shrink-0 mt-0.5"
                                  style={{ color: '#2e7d32' }}
                                />
                                <p
                                  style={{ color: '#1b5e20' }}
                                  className="text-sm font-semibold"
                                >
                                  Correct !
                                </p>
                              </div>
                            ) : writingFeedback === 'almost' ? (
                              <div
                                className="p-4 rounded-lg"
                                style={{
                                  backgroundColor: '#fff3e0',
                                  borderLeft: '4px solid #f57c00',
                                }}
                              >
                                <p
                                  style={{ color: '#e65100' }}
                                  className="text-sm font-semibold mb-2"
                                >
                                  Presque correct !
                                </p>
                                <p style={{ color: '#555555' }} className="text-sm">
                                  Attendu: <strong>{writingExpectedAnswer}</strong>
                                </p>
                              </div>
                            ) : writingFeedback === 'wrong' ? (
                              <div
                                className="p-4 rounded-lg"
                                style={{
                                  backgroundColor: '#ffebee',
                                  borderLeft: '4px solid #d32f2f',
                                }}
                              >
                                <p
                                  style={{ color: '#b71c1c' }}
                                  className="text-sm font-semibold mb-2"
                                >
                                  À retravailler
                                </p>
                                <p style={{ color: '#555555' }} className="text-sm mb-3">
                                  Attendu: <strong>{writingExpectedAnswer}</strong>
                                </p>
                                <div className="p-3 rounded bg-white/50 border border-red-200">
                                  <p style={{ color: '#555555' }} className="text-xs font-semibold mb-1">
                                    {interfaceLang === 'fr' ? 'Conseil:' : 'Tip:'}
                                  </p>
                                  <p style={{ color: '#555555' }} className="text-xs">
                                    {interfaceLang === 'fr'
                                      ? 'Vérifiez l\'orthographe, les accents et la grammaire. Les verbes et noms doivent correspondre exactement à la cible.'
                                      : 'Check spelling, accents, and grammar. Verbs and nouns must match the target exactly.'}
                                  </p>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )}

                        {/* Buttons */}
                        <div className="flex gap-3">
                          {!writingSubmitted ? (
                            <button
                              onClick={handleWritingSubmit}
                              className="flex-1 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
                              style={{
                                backgroundColor: '#D9B438',
                                color: '#002844',
                              }}
                            >
                              Soumettre
                            </button>
                          ) : (
                            <button
                              onClick={handleWritingNext}
                              disabled={writingIndex >= writingExercises.length - 1}
                              className="flex-1 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                              style={{
                                backgroundColor: '#D9B438',
                                color: '#002844',
                              }}
                            >
                              Exercice suivant
                            </button>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <div className="max-w-md mx-auto">
                  <p style={{ color: '#002844', fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
                    {interfaceLang === 'fr'
                      ? 'Aucun contenu disponible pour vos thèmes et votre niveau actuellement'
                      : 'No content available for your themes and level currently'}
                  </p>
                  <p style={{ color: '#555555', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
                    {interfaceLang === 'fr'
                      ? "L'administrateur va enrichir le contenu bientôt. En attendant, explorez les autres modules !"
                      : 'The administrator will add content soon. In the meantime, explore other modules!'}
                  </p>
                  <a
                    href="/dashboard"
                    className="mt-4 inline-block px-6 py-2 rounded-xl bg-[#002844] text-white text-sm font-bold hover:bg-[#003a5c] transition-colors"
                  >
                    {interfaceLang === 'fr' ? 'Retour au dashboard' : 'Back to dashboard'}
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Speaking Tab */}
        {activeTab === 'pronounce' && (
          <div className="max-w-2xl mx-auto">
            {speakingExercises.length > 0 ? (
              <>
                <div className="mb-6">
                  <p className="font-semibold" style={{ color: '#555555' }}>
                    Exercice {speakingIndex + 1} / {speakingExercises.length}
                  </p>
                </div>

                <div
                  className="p-6 rounded-lg border-2 mb-6"
                  style={{
                    borderColor: '#D9B438',
                    backgroundColor: '#ffffff',
                  }}
                >
                  {(() => {
                    const exercise = speakingExercises[speakingIndex];
                    if (!exercise) return null;

                    const typeBadgeText =
                      exercise.type === 'word' ? 'Mot' : 'Phrase';

                    return (
                      <>
                        {/* Type badge */}
                        <div className="mb-4">
                          <span
                            className="text-xs font-semibold px-3 py-1 rounded inline-block"
                            style={{
                              backgroundColor: '#D9B438',
                              color: '#002844',
                            }}
                          >
                            {typeBadgeText}
                          </span>
                        </div>

                        {/* Instruction */}
                        <p
                          className="mb-6 font-semibold"
                          style={{ color: '#002844' }}
                        >
                          {interfaceLang === 'fr'
                            ? exercise.instruction_fr
                            : exercise.instruction_en}
                        </p>

                        {/* Target text - large */}
                        <div
                          className="p-6 rounded-lg mb-6 text-center"
                          style={{
                            backgroundColor: '#f0f0f0',
                          }}
                        >
                          <p
                            className="text-3xl font-bold"
                            style={{ color: '#002844' }}
                          >
                            {exercise.target_text}
                          </p>
                        </div>

                        {/* TTS Button */}
                        <button
                          onClick={() => speakText(exercise.target_text, activeLang)}
                          className="w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity mb-6"
                          style={{
                            backgroundColor: '#D9B438',
                            color: '#002844',
                          }}
                        >
                          <Volume2 className="w-5 h-5" />
                          Écouter la prononciation
                        </button>

                        {/* Recognized text */}
                        {speakingRecognizedText && (
                          <div className="mb-6 p-4 rounded-lg" style={{
                            backgroundColor: '#f0f0f0',
                          }}>
                            <p style={{ color: '#555555' }} className="text-sm font-semibold mb-2">
                              Vous avez dit:
                            </p>
                            <p style={{ color: '#002844' }} className="text-lg font-semibold">
                              {speakingRecognizedText}
                            </p>
                          </div>
                        )}

                        {/* Match feedback */}
                        {speakingIsMatch !== null && (
                          <div className="mb-6">
                            {speakingIsMatch ? (
                              <div className="p-5 rounded-lg text-center" style={{ backgroundColor: '#c8e6c9' }}>
                                <CheckCircle className="w-10 h-10 mx-auto mb-2" style={{ color: '#2e7d32' }} />
                                <p style={{ color: '#1b5e20' }} className="text-lg font-bold">Bien joué !</p>
                              </div>
                            ) : (
                              <div className="p-4 rounded-lg" style={{ backgroundColor: '#ffebee', borderLeft: '4px solid #d32f2f' }}>
                                <p style={{ color: '#b71c1c' }} className="text-sm font-semibold mb-1">Pas tout à fait, réécoute et réessaie</p>
                                <p style={{ color: '#555555' }} className="text-sm mb-3">Cible: <strong>{exercise.target_text}</strong></p>
                                <div className="flex gap-2 flex-wrap">
                                  <button onClick={() => speakText(exercise.target_text, activeLang)}
                                    className="px-3 py-2 rounded-lg font-medium flex items-center gap-2 hover:opacity-80 text-sm"
                                    style={{ backgroundColor: '#D9B438', color: '#002844' }}>
                                    <Volume2 className="w-4 h-4" />
                                    Écouter la bonne prononciation
                                  </button>
                                  <button onClick={playUserRecording}
                                    className="px-3 py-2 rounded-lg font-medium flex items-center gap-2 hover:opacity-80 text-sm"
                                    style={{ backgroundColor: '#002844', color: '#ffffff' }}>
                                    <Mic className="w-4 h-4" />
                                    Réécouter votre prononciation
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Mic error */}
                        {speakingRecognition === 'error' && !speakingRecognizedText && (
                          <div
                            className="mb-6 p-4 rounded-lg flex gap-3 items-start"
                            style={{
                              backgroundColor: '#ffebee',
                              borderLeft: '4px solid #d32f2f',
                            }}
                          >
                            <AlertCircle
                              className="w-5 h-5 flex-shrink-0 mt-0.5"
                              style={{ color: '#d32f2f' }}
                            />
                            <p
                              style={{ color: '#b71c1c' }}
                              className="text-sm font-semibold"
                            >
                              Erreur microphone. Vérifiez les permissions.
                            </p>
                          </div>
                        )}

                        {/* Buttons */}
                        <div className="flex gap-3">
                          <button
                            onClick={handleSpeakingRecord}
                            disabled={speakingRecognition === 'error' && !speakingRecognizedText}
                            className="flex-1 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                            style={{
                              backgroundColor:
                                speakingRecognition === 'listening'
                                  ? '#d32f2f'
                                  : '#D9B438',
                              color: '#002844',
                            }}
                          >
                            {speakingRecognition === 'listening' ? (
                              <>
                                <MicOff className="w-5 h-5" />
                                Arrêter
                              </>
                            ) : (
                              <>
                                <Mic className="w-5 h-5" />
                                Enregistrer
                              </>
                            )}
                          </button>

                          {(speakingRecognizedText || speakingRecognition === 'error' || speakingIsMatch === false) && (
                            <button
                              onClick={handleSpeakingTryAgain}
                              className="flex-1 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
                              style={{
                                backgroundColor: '#f0f0f0',
                                color: '#555555',
                              }}
                            >
                              Réessayer
                            </button>
                          )}

                          {speakingIsMatch && (
                            <button
                              onClick={handleSpeakingNext}
                              disabled={speakingIndex >= speakingExercises.length - 1}
                              className="flex-1 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                              style={{
                                backgroundColor: '#D9B438',
                                color: '#002844',
                              }}
                            >
                              Suivant
                            </button>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <div className="max-w-md mx-auto">
                  <p style={{ color: '#002844', fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
                    {interfaceLang === 'fr'
                      ? 'Aucun contenu disponible pour vos thèmes et votre niveau actuellement'
                      : 'No content available for your themes and level currently'}
                  </p>
                  <p style={{ color: '#555555', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
                    {interfaceLang === 'fr'
                      ? "L'administrateur va enrichir le contenu bientôt. En attendant, explorez les autres modules !"
                      : 'The administrator will add content soon. In the meantime, explore other modules!'}
                  </p>
                  <a
                    href="/dashboard"
                    className="mt-4 inline-block px-6 py-2 rounded-xl bg-[#002844] text-white text-sm font-bold hover:bg-[#003a5c] transition-colors"
                  >
                    {interfaceLang === 'fr' ? 'Retour au dashboard' : 'Back to dashboard'}
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Propose Word Tab */}
        {activeTab === 'propose' && (
          <div className="max-w-2xl mx-auto">
            {successMessage && (
              <div
                className="mb-6 p-4 rounded-lg font-semibold text-center"
                style={{
                  backgroundColor: '#c8e6c9',
                  color: '#2e7d32',
                }}
              >
                {successMessage}
              </div>
            )}

            <form
              onSubmit={handleProposeSubmit}
              className="space-y-6 p-6 rounded-lg border-2"
              style={{
                borderColor: '#D9B438',
                backgroundColor: '#ffffff',
              }}
            >
              {/* Word target - OPTIONAL */}
              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: '#002844' }}
                >
                  {t('vocab.proposeForm.word', interfaceLang)}
                </label>
                <input
                  type="text"
                  value={formData.word_target}
                  onChange={(e) =>
                    setFormData({ ...formData, word_target: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border-2"
                  style={{
                    borderColor: '#D9B438',
                    color: '#002844',
                  }}
                  placeholder={t('vocab.proposeForm.word', interfaceLang)}
                />
              </div>

              {/* Translation - REQUIRED */}
              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: '#002844' }}
                >
                  {interfaceLang === 'fr' ? 'Mot en français' : 'Word in French'} *
                </label>
                <input
                  type="text"
                  value={formData.word_fr}
                  onChange={(e) =>
                    setFormData({ ...formData, word_fr: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border-2"
                  style={{
                    borderColor: '#D9B438',
                    color: '#002844',
                  }}
                  placeholder={t('vocab.proposeForm.translation', interfaceLang)}
                />
              </div>

              {/* Definition - OPTIONAL */}
              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: '#002844' }}
                >
                  {t('vocab.proposeForm.definition', interfaceLang)}
                </label>
                <textarea
                  value={formData.definition_en}
                  onChange={(e) =>
                    setFormData({ ...formData, definition_en: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border-2"
                  style={{
                    borderColor: '#D9B438',
                    color: '#002844',
                  }}
                  placeholder={t('vocab.proposeForm.definition', interfaceLang)}
                  rows={3}
                />
              </div>

              {/* Example - OPTIONAL */}
              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: '#002844' }}
                >
                  {t('vocab.proposeForm.example', interfaceLang)}
                </label>
                <textarea
                  value={formData.example_en}
                  onChange={(e) =>
                    setFormData({ ...formData, example_en: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border-2"
                  style={{
                    borderColor: '#D9B438',
                    color: '#002844',
                  }}
                  placeholder={t('vocab.proposeForm.example', interfaceLang)}
                  rows={3}
                />
              </div>

              {/* Theme - OPTIONAL */}
              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: '#002844' }}
                >
                  {t('vocab.proposeForm.theme', interfaceLang)}
                </label>
                <select
                  value={formData.theme}
                  onChange={(e) =>
                    setFormData({ ...formData, theme: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border-2"
                  style={{
                    borderColor: '#D9B438',
                    color: '#002844',
                  }}
                >
                  <option value="">
                    {t('module.filter.theme', interfaceLang)}
                  </option>
                  {userThemes.map((themeId) => {
                    const themeName = getThemeName(
                      themeId,
                      interfaceLang,
                      ALL_THEMES
                    );
                    return (
                      <option key={themeId} value={themeId}>
                        {themeName}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* GRC checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isGrc"
                  checked={formData.isGrc}
                  onChange={(e) =>
                    setFormData({ ...formData, isGrc: e.target.checked })
                  }
                  className="w-4 h-4 rounded cursor-pointer"
                  style={{
                    accentColor: '#D9B438',
                  }}
                />
                <label
                  htmlFor="isGrc"
                  className="text-sm font-semibold cursor-pointer"
                  style={{ color: '#002844' }}
                >
                  {t('vocab.proposeForm.isGrc', interfaceLang)}
                </label>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                className="w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                style={{
                  backgroundColor: '#D9B438',
                  color: '#002844',
                }}
              >
                <Send className="w-4 h-4" />
                {t('vocab.proposeForm.submit', interfaceLang)}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
