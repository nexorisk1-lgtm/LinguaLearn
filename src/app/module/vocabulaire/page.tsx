'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Volume2,
  Heart,
  Send,
  BookOpen,
} from 'lucide-react';

import { getCurrentUser } from '@/lib/db/localStorage';
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
} from '@/lib/db/bankHelpers';
import { VocabWord } from '@/lib/db/bankTypes';

export default function VocabulairePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'discovery' | 'myWords' | 'propose'>('discovery');
  const [selectedTheme, setSelectedTheme] = useState<string>('all');
  const [vocabulary, setVocabulary] = useState<VocabWord[]>([]);
  const [personalVocab, setPersonalVocab] = useState<VocabWord[]>([]);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');

  // Form state for propose word
  const [formData, setFormData] = useState({
    word_target: '',
    word_fr: '',
    definition_en: '',
    example_en: '',
    theme: '',
    isGrc: false,
  });

  // Initialize user and load vocabulary
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
    setVocabulary(allVocab);

    // Get personal vocabulary
    const personal = getPersonalVocab(currentUser.id);
    const personalWords = allVocab.filter((word) =>
      personal.some((pv) => pv.wordId === word.id)
    );
    setPersonalVocab(personalWords);

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

  const activeLang = user.activeLang || user.settings.learningLangs[0] || 'en';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const userLevel = user.progress?.[activeLang]?.levelCecrl || 'A1';
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

  // Handle propose word form
  const handleProposeSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.word_target || !formData.word_fr || !formData.theme) {
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

    setSuccessMessage(t('vocab.proposeForm.success', interfaceLang));
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

  // Render vocabulary card
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
          <div className="mt-3 space-y-2 pt-3 border-t" style={{ borderColor: '#D9B438' }}>
            <div>
              <p className="text-xs font-semibold" style={{ color: '#D9B438' }}>
                {t('vocab.definition', interfaceLang)}
              </p>
              <p style={{ color: '#555555', fontSize: '0.875rem' }}>
                {word.definition_en}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: '#D9B438' }}>
                {t('vocab.example', interfaceLang)}
              </p>
              <p style={{ color: '#555555', fontSize: '0.875rem' }}>
                {word.example_en}
              </p>
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

        {/* Filter bar */}
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
      </header>

      {/* Tabs */}
      <div
        className="px-4 md:px-8 py-4 flex gap-0 border-b-2"
        style={{
          borderColor: '#D9B438',
          backgroundColor: '#ffffff',
        }}
      >
        <button
          onClick={() => setActiveTab('discovery')}
          className="px-4 py-3 font-semibold text-sm md:text-base transition-colors border-b-2"
          style={{
            color: activeTab === 'discovery' ? '#D9B438' : '#555555',
            borderColor: activeTab === 'discovery' ? '#D9B438' : 'transparent',
          }}
        >
          {t('vocab.discovery', interfaceLang)}
        </button>
        <button
          onClick={() => setActiveTab('myWords')}
          className="px-4 py-3 font-semibold text-sm md:text-base transition-colors border-b-2"
          style={{
            color: activeTab === 'myWords' ? '#D9B438' : '#555555',
            borderColor: activeTab === 'myWords' ? '#D9B438' : 'transparent',
          }}
        >
          {t('vocab.myWords', interfaceLang)}
        </button>
        <button
          onClick={() => setActiveTab('propose')}
          className="px-4 py-3 font-semibold text-sm md:text-base transition-colors border-b-2"
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
                <p style={{ color: '#555555', fontSize: '1.125rem' }}>
                  {t('vocab.noWords', interfaceLang)}
                </p>
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
                    <VocabCard key={word.id} word={word} isPersonal={true} />
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <p style={{ color: '#555555', fontSize: '1.125rem' }}>
                  {t('vocab.noWords', interfaceLang)}
                </p>
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
              {/* Word target */}
              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: '#002844' }}
                >
                  {t('vocab.proposeForm.word', interfaceLang)} *
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

              {/* Translation */}
              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: '#002844' }}
                >
                  {t('vocab.proposeForm.translation', interfaceLang)} *
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

              {/* Definition */}
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

              {/* Example */}
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

              {/* Theme */}
              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: '#002844' }}
                >
                  {t('vocab.proposeForm.theme', interfaceLang)} *
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
