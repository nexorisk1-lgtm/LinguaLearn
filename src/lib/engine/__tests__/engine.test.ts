// ==========================================
// LINGUALEARN ENGINE — Auto-tests Phase 1
// Valide les 5 fonctions publiques du moteur
// ==========================================

import {
  getCourseDefinitions,
  getCourseContentMap,
  getCourseById,
  getTotalWordCount,
  getAllVocabulary,
  getAllGrammarRules,
  getVocabularyForCourse,
  searchVocabulary,
} from '../index';

// --- Test helpers ---
let passed = 0;
let failed = 0;
function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${label}`);
  }
}

function section(name: string) {
  console.log(`\n▸ ${name}`);
}

// ===========================================
// RUN TESTS
// ===========================================
export function runEngineTests() {
  console.log('========================================');
  console.log('LINGUALEARN ENGINE — Phase 1 Auto-Tests');
  console.log('========================================');

  // --- CourseRegistry ---
  section('CourseRegistry');
  const definitions = getCourseDefinitions();
  assert(definitions.length === 40, `40 course definitions (got ${definitions.length})`);
  assert(definitions[0].courseId === 'en_a1_c1', `First course = en_a1_c1 (got ${definitions[0].courseId})`);
  assert(definitions[0].langueId === 'en', `First course langue = en`);
  assert(definitions[0].level === 'A1', `First course level = A1`);
  assert(definitions[0].order === 1, `First course order = 1`);
  assert(definitions[0].prerequisite === null, `First course has no prerequisite`);
  assert(definitions[39].courseId === 'en_a1_c40', `Last course = en_a1_c40 (got ${definitions[39]?.courseId})`);

  const c5 = getCourseById('en_a1_c5');
  assert(c5 !== null, `getCourseById('en_a1_c5') found`);
  assert(c5?.prerequisite === 'en_a1_c4', `Course 5 prerequisite = en_a1_c4`);

  // --- CourseContentMap ---
  section('CourseContentMap');
  const contentMap = getCourseContentMap();
  const mapKeys = Object.keys(contentMap);
  assert(mapKeys.length === 40, `40 entries in contentMap (got ${mapKeys.length})`);

  const c1Content = contentMap['en_a1_c1'];
  assert(c1Content !== undefined, `en_a1_c1 exists in contentMap`);
  assert(c1Content.vocabularyIds.length >= 5, `en_a1_c1 has ≥5 vocab IDs (got ${c1Content?.vocabularyIds.length})`);
  assert(c1Content.vocabularyIds[0] === 'en_a1_c1_w1', `First vocab ID = en_a1_c1_w1 (got ${c1Content?.vocabularyIds[0]})`);
  assert(c1Content.grammarRuleId === 'en_a1_c1_rule', `Grammar rule ID correct`);
  assert(c1Content.langueId === 'en', `Content langue = en`);

  // --- ContentStore: Vocabulary ---
  section('ContentStore: Vocabulary');
  const allVocab = getAllVocabulary();
  assert(allVocab.length > 250, `Total vocab > 250 (got ${allVocab.length})`);

  const totalCount = getTotalWordCount('en');
  assert(totalCount === allVocab.length, `getTotalWordCount matches (${totalCount} = ${allVocab.length})`);

  const c1Vocab = getVocabularyForCourse('en_a1_c1');
  assert(c1Vocab.length >= 5, `en_a1_c1 vocab count ≥ 5 (got ${c1Vocab.length})`);
  assert(c1Vocab[0].word_target === 'hello', `First word = hello (got ${c1Vocab[0]?.word_target})`);
  assert(c1Vocab[0].langueId === 'en', `Vocab langueId = en`);
  assert(c1Vocab[0].courseId === 'en_a1_c1', `Vocab courseId = en_a1_c1`);
  assert(c1Vocab[0].phonetic !== '', `Vocab has phonetic`);

  // --- ContentStore: Grammar ---
  section('ContentStore: Grammar');
  const allRules = getAllGrammarRules();
  assert(allRules.length === 40, `40 grammar rules (got ${allRules.length})`);
  assert(allRules[0].courseId === 'en_a1_c1', `First rule courseId = en_a1_c1`);
  assert(allRules[0].definition_native !== '', `Rule has native definition`);

  // --- Search Dictionary ---
  section('searchDictionary');
  const searchHello = searchVocabulary('hello', 'en');
  assert(searchHello.length >= 1, `Search 'hello' returns ≥1 result (got ${searchHello.length})`);
  assert(searchHello[0].word_target === 'hello', `First result = hello`);

  const searchBonjour = searchVocabulary('bonjour', 'en');
  assert(searchBonjour.length >= 1, `Search 'bonjour' (native) returns ≥1 result (got ${searchBonjour.length})`);

  const searchEmpty = searchVocabulary('xyznotexist', 'en');
  assert(searchEmpty.length === 0, `Search unknown term returns 0`);

  const searchEs = searchVocabulary('hello', 'es');
  assert(searchEs.length === 0, `Search 'hello' in ES returns 0 (no ES content yet)`);

  // --- Summary ---
  console.log('\n========================================');
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('========================================');

  return { passed, failed };
}
