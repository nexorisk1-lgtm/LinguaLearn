'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import {
  Volume2,
  VolumeX,
  BookOpen,
  Search,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import { getCurrentUser } from '@/lib/db/localStorage';
import { User, ALL_THEMES } from '@/types';
import { t, getThemeName } from '@/lib/i18n';
import BottomNav from '@/components/BottomNav';
import {
  getReadingTexts,
  getVocabulary,
  speakText,
  proposeWord,
} from '@/lib/db/bankHelpers';
import { ReadingText, VocabWord } from '@/lib/db/bankTypes';
import { BANK_VOCABULARY } from '@/lib/db/bankVocabulary';

export default function LecturePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'texts' | 'dictionary'>('texts');
  const [readingTexts, setReadingTexts] = useState<ReadingText[]>([]);
  const [vocabulary, setVocabulary] = useState<VocabWord[]>([]);
  const [expandedTexts, setExpandedTexts] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingTextId, setSpeakingTextId] = useState<string | null>(null);
  const [speechRate, setSpeechRate] = useState<0.5 | 1 | 1.5>(1);

  // Dictionary tab state
  const [dictMode, setDictMode] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dictSearchResults, setDictSearchResults] = useState<VocabWord[]>([]);

  // Double-click word lookup popup
  const [selectedWord, setSelectedWord] = useState<VocabWord | null>(null);
  const [wordNotFound, setWordNotFound] = useState(false);
  const [unknownWord, setUnknownWord] = useState<string>('');
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [addWordLoading, setAddWordLoading] = useState(false);
  const [addWordSuccess, setAddWordSuccess] = useState(false);

  // BUG-16: Word-by-word highlight state
  const [highlightWordIndex, setHighlightWordIndex] = useState<number>(-1);
  const [highlightTextId, setHighlightTextId] = useState<string | null>(null);

  // BUG-17: Track read texts
  const [readTexts, setReadTexts] = useState<Set<string>>(new Set());

  // Initialize user and load data
  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      router.push('/auth');
      return;
    }
    setUser(currentUser);

    const activeLang = currentUser.activeLang || currentUser.settings.learningLangs[0] || 'en';
    const userLevel = currentUser.progress?.[activeLang]?.levelCecrl || 'A1';
    const userThemes = currentUser.settings.languageConfigs?.[activeLang]?.themes || ['travel'];

    // Get reading texts
    const texts = getReadingTexts(activeLang, userThemes, userLevel);
    setReadingTexts(texts);

    // Get vocabulary
    const vocab = getVocabulary(activeLang, userThemes, userLevel);
    setVocabulary(vocab);

    // Initialize dictionary mode based on active language
    const langCode = activeLang.toUpperCase();
    setDictMode(`${langCode}>${langCode}`);

    setIsLoading(false);
  }, [router]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mb-4 inline-block">
            <BookOpen className="w-8 h-8" style={{ color: '#002844' }} />
          </div>
          <p style={{ color: '#555555' }}>{t('onboarding.loading', user?.settings.interfaceLang || 'fr')}</p>
        </div>
      </div>
    );
  }

  const interfaceLang = user.settings.interfaceLang || 'fr';
  const activeLang = user.activeLang || user.settings.learningLangs[0] || 'en';

  // Generate dictionary modes dynamically based on active language
  const getDictModes = (): string[] => {
    const langCode = activeLang.toUpperCase();
    return [`${langCode}>${langCode}`, `${langCode}>FR`, `FR>${langCode}`];
  };

  // ==========================================
  // TEXT TAB HANDLERS
  // ==========================================

  const toggleTextExpand = (textId: string) => {
    const newExpanded = new Set(expandedTexts);
    if (newExpanded.has(textId)) {
      newExpanded.delete(textId);
    } else {
      newExpanded.add(textId);
    }
    setExpandedTexts(newExpanded);
  };

  const handleReadAloud = (textId: string, text: string) => {
    if (isSpeaking && speakingTextId === textId) {
      // Stop reading
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setSpeakingTextId(null);
      setHighlightWordIndex(-1);
      setHighlightTextId(null);
    } else {
      // Stop any ongoing speech first
      window.speechSynthesis.cancel();

      setSpeakingTextId(textId);
      setHighlightTextId(textId);
      setHighlightWordIndex(0);
      setIsSpeaking(true);

      const utterance = new SpeechSynthesisUtterance(text);

      const languageMap: Record<string, string> = {
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

      utterance.lang = languageMap[activeLang] || activeLang;
      utterance.rate = speechRate;
      utterance.pitch = 1;
      utterance.volume = 1;

      // BUG-16: Word-by-word highlight via boundary event
      const words = text.split(/\s+/);
      utterance.onboundary = (event: SpeechSynthesisEvent) => {
        if (event.name === 'word') {
          // Find which word index we're at based on charIndex
          let charCount = 0;
          for (let i = 0; i < words.length; i++) {
            if (charCount >= event.charIndex) {
              setHighlightWordIndex(i);
              break;
            }
            charCount += words[i].length + 1; // +1 for space
          }
        }
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setSpeakingTextId(null);
        setHighlightWordIndex(-1);
        setHighlightTextId(null);
        // BUG-17: Mark text as read and update progression
        markTextAsRead(textId);
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        setSpeakingTextId(null);
        setHighlightWordIndex(-1);
        setHighlightTextId(null);
      };

      window.speechSynthesis.speak(utterance);
    }
  };

  // BUG-17: Update reading progression
  const markTextAsRead = (textId: string) => {
    if (readTexts.has(textId)) return;
    const newRead = new Set(readTexts);
    newRead.add(textId);
    setReadTexts(newRead);

    // Update progression in localStorage
    if (user && readingTexts.length > 0) {
      const totalTexts = readingTexts.length;
      const readCount = newRead.size;
      const pct = Math.round((readCount / totalTexts) * 100);

      // Import and call updateUserProgress
      import('@/lib/db/localStorage').then(({ updateUserProgress }) => {
        updateUserProgress(user.id, activeLang, {
          objectiveProgress: {
            ...user.progress?.[activeLang]?.objectiveProgress,
            lecture: pct,
          },
        });
      });
    }
  };

  // ==========================================
  // DOUBLE-CLICK WORD LOOKUP
  // ==========================================

  const handleTextDoubleClick = async (e: React.MouseEvent<HTMLParagraphElement>) => {
    const selection = window.getSelection();
    if (!selection || selection.toString().trim().length === 0) return;

    const selectedText = selection.toString().trim().toLowerCase();

    // Search in user's filtered vocabulary first
    const found = vocabulary.find(
      (word) => word.word_target.toLowerCase() === selectedText
    );

    if (found) {
      setSelectedWord(found);
      setWordNotFound(false);
      setUnknownWord('');
    } else {
      // Word not found in user's vocabulary, try Free Dictionary API
      try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/${activeLang}/${selectedText}`);
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            const entry = data[0];
            const definition = entry.meanings?.[0]?.definitions?.[0]?.definition || entry.meanings?.[0]?.definitions?.[0]?.shortdef || 'No definition available';
            const example = entry.meanings?.[0]?.definitions?.[0]?.example || '';

            // Create a temporary word object from API response
            const apiWord: VocabWord = {
              id: `api_${selectedText}`,
              word_target: selectedText,
              word_fr: selectedText,
              language: activeLang,
              level: 'A1',
              theme: 'general',
              definition_en: definition,
              example_en: example,
              is_grc: false,
            };

            setSelectedWord(apiWord);
            setWordNotFound(false);
            setUnknownWord('');
          } else {
            setSelectedWord(null);
            setWordNotFound(true);
            setUnknownWord(selectedText);
          }
        } else {
          setSelectedWord(null);
          setWordNotFound(true);
          setUnknownWord(selectedText);
        }
      } catch (error) {
        console.error('Dictionary API error:', error);
        // Fall back to showing word not found
        setSelectedWord(null);
        setWordNotFound(true);
        setUnknownWord(selectedText);
      }
    }

    // Position popup near cursor
    setPopupPosition({
      x: e.clientX,
      y: e.clientY,
    });
  };

  const closeWordPopup = () => {
    setSelectedWord(null);
    setWordNotFound(false);
    setUnknownWord('');
    setAddWordSuccess(false);
  };

  const handleAddWord = async () => {
    if (!unknownWord || !user) return;

    setAddWordLoading(true);
    try {
      proposeWord(user.id, {
        word_fr: unknownWord,
        word_target: unknownWord,
        language: activeLang,
        definition_en: '',
        example_en: '',
        theme: '',
        is_grc: false,
      });
      setAddWordSuccess(true);
      setTimeout(() => {
        closeWordPopup();
      }, 1500);
    } catch (error) {
      console.error('Error proposing word:', error);
    } finally {
      setAddWordLoading(false);
    }
  };

  // ==========================================
  // DICTIONARY TAB HANDLERS
  // ==========================================

  const handleDictSearch = () => {
    if (!searchQuery.trim()) {
      setDictSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    let results: VocabWord[] = [];

    // Filter by language only (not by theme or level)
    const allLanguageVocab = BANK_VOCABULARY.filter((word) => word.language === activeLang);

    if (dictMode === `${activeLang.toUpperCase()}>${activeLang.toUpperCase()}`) {
      // Search in target language words
      results = allLanguageVocab.filter((word) =>
        word.word_target.toLowerCase().includes(query)
      );
    } else if (dictMode === `${activeLang.toUpperCase()}>FR`) {
      // Search in target language words, show French translation
      results = allLanguageVocab.filter((word) =>
        word.word_target.toLowerCase().includes(query)
      );
    } else if (dictMode === `FR>${activeLang.toUpperCase()}`) {
      // Search in French words
      results = allLanguageVocab.filter((word) =>
        word.word_fr.toLowerCase().includes(query)
      );
    }

    setDictSearchResults(results);
  };

  // ==========================================
  // RENDER TEXT CARD
  // ==========================================

  const TextCard = ({ text }: { text: ReadingText }) => {
    const isExpanded = expandedTexts.has(text.id);
    const wordCount = text.body_text.split(/\s+/).length;
    const isSpeakingThis = isSpeaking && speakingTextId === text.id;

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
            <h3 className="text-xl font-bold mb-2" style={{ color: '#002844' }}>
              {text.title}
            </h3>
            <div className="flex gap-2 flex-wrap">
              <span
                className="text-xs font-semibold px-2 py-1 rounded"
                style={{
                  backgroundColor: '#D9B438',
                  color: '#002844',
                }}
              >
                {text.level}
              </span>
              <span
                className="text-xs font-semibold px-2 py-1 rounded"
                style={{
                  backgroundColor: '#f0f0f0',
                  color: '#555555',
                }}
              >
                {getThemeName(text.theme, interfaceLang, ALL_THEMES)}
              </span>
              <span
                className="text-xs font-semibold px-2 py-1 rounded"
                style={{
                  backgroundColor: '#e8f4f8',
                  color: '#002844',
                }}
              >
                {wordCount} {interfaceLang === 'fr' ? 'mots' : 'words'}
              </span>
            </div>
          </div>

          {/* Read Aloud Button */}
          <button
            onClick={() => handleReadAloud(text.id, text.body_text)}
            className="p-2 rounded-lg hover:opacity-80 transition-opacity ml-2 flex-shrink-0"
            style={{ backgroundColor: isSpeakingThis ? '#ff6b6b' : '#D9B438' }}
            title={
              isSpeakingThis
                ? t('reading.stopReading', interfaceLang)
                : t('reading.readAloud', interfaceLang)
            }
            aria-label={
              isSpeakingThis
                ? t('reading.stopReading', interfaceLang)
                : t('reading.readAloud', interfaceLang)
            }
          >
            {isSpeakingThis ? (
              <VolumeX className="w-4 h-4" style={{ color: '#ffffff' }} />
            ) : (
              <Volume2 className="w-4 h-4" style={{ color: '#002844' }} />
            )}
          </button>
        </div>

        {/* Expand/Collapse Button */}
        <button
          onClick={() => toggleTextExpand(text.id)}
          className="w-full text-left py-2 px-2 rounded text-sm font-semibold transition-colors"
          style={{
            color: '#002844',
            backgroundColor: '#f0f0f0',
          }}
        >
          {isExpanded ? <ChevronUp className="w-4 h-4 inline mr-2" /> : <ChevronDown className="w-4 h-4 inline mr-2" />}
          {isExpanded ? (t('vocab.definition', interfaceLang)) : (t('reading.texts', interfaceLang))}
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t" style={{ borderColor: '#D9B438' }}>
            {/* TTS Speed Selector */}
            <div className="mb-4 p-3 rounded bg-gray-50 border border-gray-200">
              <p className="text-xs font-semibold mb-2" style={{ color: '#002844' }}>
                {interfaceLang === 'fr' ? 'Vitesse de lecture:' : 'Reading speed:'}
              </p>
              <div className="flex gap-2">
                {[0.5, 1, 1.5].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => setSpeechRate(rate as 0.5 | 1 | 1.5)}
                    className="px-3 py-1 text-xs font-semibold rounded transition-colors"
                    style={{
                      backgroundColor: speechRate === rate ? '#D9B438' : '#ffffff',
                      color: speechRate === rate ? '#002844' : '#555555',
                      border: `1px solid ${speechRate === rate ? '#D9B438' : '#cccccc'}`,
                    }}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>

            <p
              className="leading-relaxed cursor-text select-text"
              style={{ color: '#555555', fontSize: '0.95rem' }}
              onDoubleClick={handleTextDoubleClick}
              title={t('reading.doubleClick', interfaceLang)}
            >
              {highlightTextId === text.id
                ? text.body_text.split(/(\s+)/).map((segment, i) => {
                    // Split preserving spaces: words are at even indices
                    if (/^\s+$/.test(segment)) return segment;
                    const wordIdx = Math.floor(i / 2);
                    const isHighlighted = wordIdx === highlightWordIndex;
                    return (
                      <span
                        key={i}
                        style={{
                          backgroundColor: isHighlighted ? '#D9B438' : 'transparent',
                          color: isHighlighted ? '#002844' : '#555555',
                          borderRadius: isHighlighted ? '3px' : '0',
                          padding: isHighlighted ? '1px 2px' : '0',
                          fontWeight: isHighlighted ? '600' : 'normal',
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        {segment}
                      </span>
                    );
                  })
                : text.body_text}
            </p>
            <p
              className="mt-4 text-xs italic"
              style={{ color: '#D9B438' }}
            >
              {t('reading.doubleClick', interfaceLang)}
            </p>

            {/* BUG-17: Mark as read button */}
            <button
              onClick={() => markTextAsRead(text.id)}
              disabled={readTexts.has(text.id)}
              className="mt-4 w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              style={{
                backgroundColor: readTexts.has(text.id) ? '#c8e6c9' : '#002844',
                color: readTexts.has(text.id) ? '#2e7d32' : '#FFFFFF',
              }}
            >
              {readTexts.has(text.id)
                ? (interfaceLang === 'fr' ? '✓ Texte lu' : '✓ Text read')
                : (interfaceLang === 'fr' ? 'Marquer comme lu' : 'Mark as read')}
            </button>
          </div>
        )}
      </div>
    );
  };

  // ==========================================
  // RENDER DICTIONARY RESULT CARD
  // ==========================================

  const DictResultCard = ({ word }: { word: VocabWord }) => {
    const isLangToLang = dictMode === `${activeLang.toUpperCase()}>${activeLang.toUpperCase()}`;
    const isLangToFr = dictMode === `${activeLang.toUpperCase()}>FR`;
    const isFrToLang = dictMode === `FR>${activeLang.toUpperCase()}`;

    return (
      <div
        className="rounded-lg border-2 p-4 transition-all hover:shadow-md"
        style={{
          borderColor: '#D9B438',
          backgroundColor: '#ffffff',
        }}
      >
        <div className="flex justify-between items-start">
          <div className="flex-1">
            {isLangToLang && (
              <>
                <h3 className="text-lg font-bold mb-2" style={{ color: '#002844' }}>
                  {word.word_target}
                </h3>
                <p style={{ color: '#555555', fontSize: '0.875rem' }}>
                  {word.definition_en}
                </p>
              </>
            )}
            {isLangToFr && (
              <>
                <h3 className="text-lg font-bold mb-2" style={{ color: '#002844' }}>
                  {word.word_target}
                </h3>
                <p style={{ color: '#555555', fontSize: '0.875rem' }}>
                  {word.word_fr}
                </p>
              </>
            )}
            {isFrToLang && (
              <>
                <h3 className="text-lg font-bold mb-2" style={{ color: '#002844' }}>
                  {word.word_fr}
                </h3>
                <p style={{ color: '#555555', fontSize: '0.875rem' }}>
                  {word.word_target}
                </p>
              </>
            )}
          </div>

          <button
            onClick={() => speakText(word.word_target, activeLang)}
            className="p-2 rounded-lg hover:opacity-80 transition-opacity ml-2 flex-shrink-0"
            style={{ backgroundColor: '#D9B438' }}
            title={t('vocab.listen', interfaceLang)}
            aria-label={t('vocab.listen', interfaceLang)}
          >
            <Volume2 className="w-4 h-4" style={{ color: '#002844' }} />
          </button>
        </div>
      </div>
    );
  };

  // ==========================================
  // RENDER WORD LOOKUP POPUP
  // ==========================================

  const WordLookupPopup = () => {
    if (!selectedWord && !wordNotFound) return null;

    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-40"
          onClick={closeWordPopup}
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
        />

        {/* Popup */}
        <div
          className="fixed z-50 rounded-lg shadow-2xl p-6 max-w-sm border-2"
          style={{
            left: Math.min(popupPosition.x, window.innerWidth - 350),
            top: Math.min(popupPosition.y + 20, window.innerHeight - 300),
            borderColor: '#D9B438',
            backgroundColor: '#ffffff',
          }}
        >
          {/* Close Button */}
          <button
            onClick={closeWordPopup}
            className="absolute top-2 right-2 p-1 hover:opacity-80 transition-opacity"
            aria-label="Close"
          >
            <X className="w-5 h-5" style={{ color: '#002844' }} />
          </button>

          {/* Word Not Found */}
          {wordNotFound && (
            <div className="space-y-4">
              <p style={{ color: '#555555', fontSize: '1rem' }}>
                {t('reading.dict.noResult', interfaceLang)}
              </p>
              {unknownWord && (
                <div className="border-t pt-4" style={{ borderColor: '#D9B438' }}>
                  <p className="text-sm font-semibold mb-3" style={{ color: '#002844' }}>
                    {interfaceLang === 'fr' ? 'Mot inconnu:' : 'Unknown word:'}
                  </p>
                  <p className="text-lg font-bold mb-4" style={{ color: '#D9B438' }}>
                    {unknownWord}
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => speakText(unknownWord, activeLang)}
                      className="w-full py-2 rounded-lg font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                      style={{
                        backgroundColor: '#D9B438',
                        color: '#002844',
                      }}
                    >
                      <Volume2 className="w-4 h-4" />
                      {t('vocab.listen', interfaceLang)}
                    </button>
                    <button
                      onClick={handleAddWord}
                      disabled={addWordLoading || addWordSuccess}
                      className="w-full py-2 rounded-lg font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
                      style={{
                        backgroundColor: addWordSuccess ? '#4ade80' : '#002844',
                        color: '#ffffff',
                      }}
                    >
                      {addWordSuccess
                        ? interfaceLang === 'fr'
                          ? '✓ Ajouté'
                          : '✓ Added'
                        : interfaceLang === 'fr'
                        ? 'Ajouter ce mot'
                        : 'Add this word'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Word Found */}
          {selectedWord && (
            <div className="space-y-3">
              <div>
                <h3 className="text-xl font-bold mb-2" style={{ color: '#002844' }}>
                  {selectedWord.word_target}
                </h3>
                <p className="text-sm" style={{ color: '#555555' }}>
                  {selectedWord.word_fr}
                </p>
              </div>

              <div className="border-t pt-3" style={{ borderColor: '#D9B438' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: '#D9B438' }}>
                  {t('vocab.definition', interfaceLang)}
                </p>
                <p className="text-sm" style={{ color: '#555555' }}>
                  {selectedWord.definition_en}
                </p>
              </div>

              {selectedWord.example_en && (
                <div className="border-t pt-3" style={{ borderColor: '#D9B438' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#D9B438' }}>
                    {t('vocab.example', interfaceLang)}
                  </p>
                  <p className="text-sm italic" style={{ color: '#555555' }}>
                    {selectedWord.example_en}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-3 border-t" style={{ borderColor: '#D9B438' }}>
                <button
                  onClick={() => speakText(selectedWord.word_target, activeLang)}
                  className="flex-1 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                  style={{
                    backgroundColor: '#D9B438',
                    color: '#002844',
                  }}
                >
                  <Volume2 className="w-4 h-4" />
                  {t('vocab.listen', interfaceLang)}
                </button>
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  const dictModes = getDictModes();

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <PageHeader title={interfaceLang === 'fr' ? 'Lecture' : 'Reading'} backHref="/dashboard" />

      {/* Tabs */}
      <div
        className="px-4 md:px-8 py-4 flex gap-0 border-b-2"
        style={{
          borderColor: '#D9B438',
          backgroundColor: '#ffffff',
        }}
      >
        <button
          onClick={() => setActiveTab('texts')}
          className="px-4 py-3 font-semibold text-sm md:text-base transition-colors border-b-2"
          style={{
            color: activeTab === 'texts' ? '#D9B438' : '#555555',
            borderColor: activeTab === 'texts' ? '#D9B438' : 'transparent',
          }}
        >
          {t('reading.texts', interfaceLang)}
        </button>
        <button
          onClick={() => setActiveTab('dictionary')}
          className="px-4 py-3 font-semibold text-sm md:text-base transition-colors border-b-2"
          style={{
            color: activeTab === 'dictionary' ? '#D9B438' : '#555555',
            borderColor: activeTab === 'dictionary' ? '#D9B438' : 'transparent',
          }}
        >
          {t('reading.dictionary', interfaceLang)}
        </button>
      </div>

      {/* Content */}
      <main className="px-4 md:px-8 py-8">
        {/* Texts Tab */}
        {activeTab === 'texts' && (
          <div>
            {readingTexts.length > 0 ? (
              <>
                <p className="mb-6 font-semibold" style={{ color: '#555555' }}>
                  {readingTexts.length} {interfaceLang === 'fr' ? 'texte(s)' : 'text(s)'}
                </p>
                <div className="space-y-6">
                  {readingTexts.map((text) => (
                    <TextCard key={text.id} text={text} />
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

        {/* Dictionary Tab */}
        {activeTab === 'dictionary' && (
          <div>
            {/* Link to standalone dictionary */}
            <div className="mb-8 p-6 rounded-lg border-2" style={{ borderColor: '#D9B438', backgroundColor: '#f9f9f9' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold mb-2" style={{ color: '#002844' }}>
                    {interfaceLang === 'fr' ? 'Dictionnaire complet' : 'Full dictionary'}
                  </p>
                  <p className="text-xs" style={{ color: '#555555' }}>
                    {interfaceLang === 'fr'
                      ? 'Accédez au dictionnaire complet avec plus de fonctionnalités'
                      : 'Access the full dictionary with more features'}
                  </p>
                </div>
                <Link href="/module/dictionnaire">
                  <button
                    className="px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity flex-shrink-0"
                    style={{
                      backgroundColor: '#002844',
                      color: '#ffffff',
                    }}
                  >
                    <BookOpen className="w-4 h-4" />
                    {interfaceLang === 'fr' ? 'Accéder' : 'Go'}
                  </button>
                </Link>
              </div>
            </div>

            {/* Mode Selection */}
            <div className="mb-8 p-6 rounded-lg border-2" style={{ borderColor: '#D9B438', backgroundColor: '#ffffff' }}>
              <p className="text-sm font-semibold mb-3" style={{ color: '#002844' }}>
                {t('reading.dictionary', interfaceLang)}
              </p>
              <div className="flex gap-4 flex-wrap">
                {dictModes.map((mode) => (
                  <label key={mode} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="dictMode"
                      value={mode}
                      checked={dictMode === mode}
                      onChange={(e) => {
                        setDictMode(e.target.value);
                        setSearchQuery('');
                        setDictSearchResults([]);
                      }}
                      className="w-4 h-4"
                      style={{ accentColor: '#D9B438' }}
                    />
                    <span style={{ color: '#555555', fontWeight: dictMode === mode ? '600' : '400' }}>
                      {mode}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Search Box */}
            <div className="mb-8">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleDictSearch();
                    }}
                    className="w-full px-4 py-3 rounded-lg border-2"
                    style={{
                      borderColor: '#D9B438',
                      color: '#002844',
                    }}
                    placeholder={t('reading.dict.search', interfaceLang)}
                  />
                </div>
                <button
                  onClick={handleDictSearch}
                  className="px-6 py-3 rounded-lg font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity"
                  style={{
                    backgroundColor: '#D9B438',
                    color: '#002844',
                  }}
                >
                  <Search className="w-4 h-4" />
                  {t('general.search', interfaceLang) || 'Search'}
                </button>
              </div>
            </div>

            {/* Search Results */}
            {dictSearchResults.length > 0 ? (
              <>
                <p className="mb-6 font-semibold" style={{ color: '#555555' }}>
                  {dictSearchResults.length} {interfaceLang === 'fr' ? 'résultat(s)' : 'result(s)'}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {dictSearchResults.map((word) => (
                    <DictResultCard key={word.id} word={word} />
                  ))}
                </div>
              </>
            ) : searchQuery.trim() ? (
              <div className="text-center py-12">
                <p style={{ color: '#555555', fontSize: '1.125rem' }}>
                  {t('reading.dict.noResult', interfaceLang)}
                </p>
              </div>
            ) : (
              <div className="text-center py-12">
                <p style={{ color: '#555555', fontSize: '1rem' }}>
                  {interfaceLang === 'fr'
                    ? 'Commencez par sélectionner un mode et entrez un mot'
                    : 'Start by selecting a mode and enter a word'}
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Word Lookup Popup */}
      <WordLookupPopup />
      <BottomNav lang={interfaceLang} />
    </div>
  );
}
