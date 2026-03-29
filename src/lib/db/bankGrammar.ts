// ==========================================
// LINGUALEARN - LOT 2 : Banque Grammaire
// EN (10 règles A1-B2, 3 exercices/règle) + ES (5 règles A1-A2)
// ==========================================

import { GrammarRule, GrammarExercise, IrregularVerb } from './bankTypes';

export const BANK_GRAMMAR: GrammarRule[] = [
  // ===== ANGLAIS A1 =====
  { id:'gr_en_01', language:'en', rule_name:'Present Simple - To Be', level:'A1',
    definition_en:'The verb "to be" conjugates as: I am, you are, he/she/it is, we/you/they are.',
    definition_fr:'Le verbe "to be" (être) se conjugue : I am, you are, he/she/it is, we/you/they are.',
    attention_points:'Ne pas confondre "your" (ton) et "you\'re" (you are).',
    examples:[{en:'I am a student.',fr:'Je suis étudiant.'},{en:'She is happy.',fr:'Elle est heureuse.'},{en:'They are from France.',fr:'Ils sont de France.'}] },
  { id:'gr_en_02', language:'en', rule_name:'Articles: A / An / The', level:'A1',
    definition_en:'"A" before a consonant sound, "an" before a vowel sound, "the" for specific things.',
    definition_fr:'"A" devant une consonne, "an" devant une voyelle sonore, "the" pour quelque chose de spécifique.',
    attention_points:'"An hour" (h muet), "a university" (son /juː/).',
    examples:[{en:'I have a cat.',fr:'J\'ai un chat.'},{en:'She is an engineer.',fr:'Elle est ingénieure.'},{en:'The book is on the table.',fr:'Le livre est sur la table.'}] },
  { id:'gr_en_03', language:'en', rule_name:'Present Simple - Regular Verbs', level:'A1',
    definition_en:'In present simple, add -s for third person singular. Negative: do not / does not + base verb.',
    definition_fr:'Au présent simple, on ajoute -s à la 3e personne du singulier. Forme négative : do not / does not + base verbale.',
    attention_points:'He/she/it → ajoute -s ou -es (watches, goes). Avec "does", le verbe reste à la base.',
    examples:[{en:'She works every day.',fr:'Elle travaille tous les jours.'},{en:'He does not like coffee.',fr:'Il n\'aime pas le café.'},{en:'Do you speak English?',fr:'Parlez-vous anglais?'}] },

  // ===== ANGLAIS A2 =====
  { id:'gr_en_04', language:'en', rule_name:'Past Simple - Regular & Irregular', level:'A2',
    definition_en:'Past simple is formed by adding -ed to regular verbs. Irregular verbs have unique past forms.',
    definition_fr:'Le passé simple se forme avec -ed pour les verbes réguliers. Les verbes irréguliers ont une forme spécifique.',
    attention_points:'Forme négative : did not + base verbale. Question : Did + sujet + base verbale ?',
    examples:[{en:'I worked yesterday.',fr:'J\'ai travaillé hier.'},{en:'She went to London.',fr:'Elle est allée à Londres.'},{en:'Did you see the movie?',fr:'As-tu vu le film?'}] },
  { id:'gr_en_05', language:'en', rule_name:'Comparatives & Superlatives', level:'A2',
    definition_en:'Comparative: short adj + -er / more + long adj. Superlative: the + adj + -est / the most + adj.',
    definition_fr:'Comparatif : adjectif court + -er / more + adjectif long. Superlatif : the + adjectif + -est / the most + adjectif.',
    attention_points:'Good → better → the best. Bad → worse → the worst.',
    examples:[{en:'She is taller than me.',fr:'Elle est plus grande que moi.'},{en:'This is the most interesting book.',fr:'C\'est le livre le plus intéressant.'},{en:'He is better at math.',fr:'Il est meilleur en mathématiques.'}] },

  // ===== ANGLAIS B1 =====
  { id:'gr_en_06', language:'en', rule_name:'Present Perfect', level:'B1',
    definition_en:'Present perfect (have/has + past participle) links a past action to the present.',
    definition_fr:'Le present perfect (have/has + participe passé) exprime une action passée avec un lien au présent.',
    attention_points:'Since = point de départ, For = durée. Ne pas utiliser avec une date précise du passé.',
    examples:[{en:'I have lived here since 2010.',fr:'J\'habite ici depuis 2010.'},{en:'She has never been to Japan.',fr:'Elle n\'a jamais été au Japon.'},{en:'Have you finished your homework?',fr:'As-tu fini tes devoirs?'}] },
  { id:'gr_en_07', language:'en', rule_name:'Conditionals - First & Second', level:'B1',
    definition_en:'First conditional: If + present, will + base (likely). Second conditional: If + past, would + base (hypothetical).',
    definition_fr:'1er conditionnel : If + présent, will + base (probable). 2e conditionnel : If + past simple, would + base (hypothétique).',
    attention_points:'If I were (pas "was") est préféré dans le 2e conditionnel formel.',
    examples:[{en:'If it rains, I will stay home.',fr:'S\'il pleut, je resterai à la maison.'},{en:'If I were rich, I would travel the world.',fr:'Si j\'étais riche, je voyagerais dans le monde.'}] },
  { id:'gr_en_08', language:'en', rule_name:'Passive Voice', level:'B1',
    definition_en:'Passive voice: subject + be (conjugated) + past participle. Agent introduced by "by".',
    definition_fr:'Voix passive : sujet + be (conjugué) + participe passé. L\'agent est introduit par "by".',
    attention_points:'Utiliser la passive quand l\'action est plus importante que l\'agent.',
    examples:[{en:'The report was written by the manager.',fr:'Le rapport a été écrit par le directeur.'},{en:'English is spoken worldwide.',fr:'L\'anglais est parlé dans le monde.'},{en:'The building was built in 1990.',fr:'Le bâtiment a été construit en 1990.'}] },

  // ===== ANGLAIS B2 =====
  { id:'gr_en_09', language:'en', rule_name:'Reported Speech', level:'B2',
    definition_en:'Reported speech: shift tense back. Present → Past, Past → Past Perfect, Will → Would.',
    definition_fr:'Discours rapporté : on recule le temps d\'un cran. Present → Past, Past → Past Perfect, Will → Would.',
    attention_points:'Les pronoms et les marqueurs de temps changent aussi (today→that day, here→there).',
    examples:[{en:'He said he was tired.',fr:'Il a dit qu\'il était fatigué.'},{en:'She told me she had finished.',fr:'Elle m\'a dit qu\'elle avait fini.'},{en:'They said they would come.',fr:'Ils ont dit qu\'ils viendraient.'}] },
  { id:'gr_en_10', language:'en', rule_name:'Relative Clauses', level:'B2',
    definition_en:'Relative clauses use who (people), which (things), that, where, when. Defining vs non-defining.',
    definition_fr:'Les propositions relatives commencent par who (personnes), which (choses), that, where, when. Defining vs non-defining.',
    attention_points:'Non-defining clauses use commas and cannot use "that".',
    examples:[{en:'The woman who called you is my sister.',fr:'La femme qui t\'a appelé est ma soeur.'},{en:'Paris, which is in France, is beautiful.',fr:'Paris, qui est en France, est magnifique.'},{en:'The house where I grew up was sold.',fr:'La maison où j\'ai grandi a été vendue.'}] },

  // V2.1.1: Spanish content removed — Phase 14 will add via CanonicalContent

  // ===== ANGLAIS A1 - FAMILY THEME =====
  { id:'gr_en_11', language:'en', rule_name:'Possessive Adjectives (Family)', level:'A1',
    definition_en:'Possessive adjectives (my, your, his, her, our, their) show ownership. They agree with the noun, not the person.',
    definition_fr:'Les adjectifs possessifs (my, your, his, her, our, their) indiquent la possession. Ils s\'accordent avec le nom, pas avec la personne.',
    attention_points:'His sister = sa soeur (soeur du garçon). Her brother = son frère (frère de la fille). Always use the same form regardless of singular/plural noun.',
    examples:[{en:'My mother is kind.',fr:'Ma mère est gentille.'},{en:'His family is large.',fr:'Sa famille est grande.'},{en:'Their children are happy.',fr:'Leurs enfants sont heureux.'}] },
  { id:'gr_en_12', language:'en', rule_name:'Plural Nouns (Regular -s, -es)', level:'A1',
    definition_en:'Add -s to most nouns for plural. Add -es to nouns ending in s, x, z, ch, sh.',
    definition_fr:'Ajouter -s à la plupart des noms au pluriel. Ajouter -es aux noms finissant par s, x, z, ch, sh.',
    attention_points:'sister → sisters, brother → brothers, box → boxes, church → churches, baby → babies (y → ies).',
    examples:[{en:'I have two sisters.',fr:'J\'ai deux soeurs.'},{en:'The families are happy.',fr:'Les familles sont heureuses.'},{en:'She has one daughter.',fr:'Elle a une fille.'}] },
  { id:'gr_en_13', language:'en', rule_name:'Subject Pronouns (I, you, he, she, it, we, they)', level:'A1',
    definition_en:'Subject pronouns perform the action in a sentence. They come before the verb.',
    definition_fr:'Les pronoms sujets effectuent l\'action. Ils viennent avant le verbe.',
    attention_points:'I, you, he, she, it (singular), we, you, they (plural). "You" is the same in singular and plural.',
    examples:[{en:'I am the oldest child.',fr:'Je suis le plus âgé.'},{en:'We are a family.',fr:'Nous sommes une famille.'},{en:'They love their parents.',fr:'Ils aiment leurs parents.'}] },
  { id:'gr_en_14', language:'en', rule_name:'"Have got" for Possession', level:'A1',
    definition_en:'"Have got" shows possession or family relationships. Use: I have got / I\'ve got. For negatives: I haven\'t got.',
    definition_fr:'"Have got" montre la possession. Utiliser : I have got / I\'ve got. Négatif : I haven\'t got.',
    attention_points:'British English prefers "have got". American English prefers "have". Question: Have you got? Negative: I haven\'t got.',
    examples:[{en:'I have got two brothers.',fr:'J\'ai deux frères.'},{en:'She hasn\'t got a sister.',fr:'Elle n\'a pas de soeur.'},{en:'Have you got any cousins?',fr:'Avez-vous des cousins?'}] },
  { id:'gr_en_15', language:'en', rule_name:'Basic Articles (A, An, The) with Family', level:'A1',
    definition_en:'"A" before consonant sound, "an" before vowel sound, "the" for specific. Use "a" before "mother", "an" before "uncle".',
    definition_fr:'"A" devant consonne, "an" devant voyelle, "the" pour spécifique. Utilisez "a" avant "mother", "an" avant "uncle".',
    attention_points:'"A mother" (non spécifique), "the mother" (spécifique). "An uncle", "an aunt", "an only child".',
    examples:[{en:'I have a mother and a father.',fr:'J\'ai une mère et un père.'},{en:'She is the youngest sister.',fr:'Elle est la plus jeune soeur.'},{en:'He is an only child.',fr:'C\'est un enfant unique.'}] },
];

export const BANK_GRAMMAR_EXERCISES: GrammarExercise[] = [
  // === gr_en_01 : Present Simple - To Be ===
  { id:'ex_01_1', grammar_rule_id:'gr_en_01', type:'fill_blank', question:'I ___ a student.', answer:'am' },
  { id:'ex_01_2', grammar_rule_id:'gr_en_01', type:'multiple_choice', question:'She ___ happy.', options:['am','is','are','be'], answer:'is' },
  { id:'ex_01_3', grammar_rule_id:'gr_en_01', type:'fill_blank', question:'They ___ from France.', answer:'are' },

  // === gr_en_02 : Articles ===
  { id:'ex_02_1', grammar_rule_id:'gr_en_02', type:'multiple_choice', question:'I have ___ cat.', options:['a','an','the','—'], answer:'a' },
  { id:'ex_02_2', grammar_rule_id:'gr_en_02', type:'fill_blank', question:'She is ___ engineer.', answer:'an' },
  { id:'ex_02_3', grammar_rule_id:'gr_en_02', type:'multiple_choice', question:'___ book on the table is mine.', options:['A','An','The','—'], answer:'The' },

  // === gr_en_03 : Present Simple Regular ===
  { id:'ex_03_1', grammar_rule_id:'gr_en_03', type:'fill_blank', question:'She ___ (work) every day.', answer:'works' },
  { id:'ex_03_2', grammar_rule_id:'gr_en_03', type:'multiple_choice', question:'He ___ not like coffee.', options:['do','does','is','has'], answer:'does' },
  { id:'ex_03_3', grammar_rule_id:'gr_en_03', type:'reorder', question:'Reorder: English / you / speak / Do / ?', answer:'Do you speak English?' },

  // === gr_en_04 : Past Simple ===
  { id:'ex_04_1', grammar_rule_id:'gr_en_04', type:'fill_blank', question:'I ___ (work) yesterday.', answer:'worked' },
  { id:'ex_04_2', grammar_rule_id:'gr_en_04', type:'multiple_choice', question:'She ___ to London last week.', options:['go','goes','went','gone'], answer:'went' },
  { id:'ex_04_3', grammar_rule_id:'gr_en_04', type:'fill_blank', question:'___ you see the movie? (auxiliary)', answer:'Did' },

  // === gr_en_05 : Comparatives ===
  { id:'ex_05_1', grammar_rule_id:'gr_en_05', type:'fill_blank', question:'She is ___ (tall) than me.', answer:'taller' },
  { id:'ex_05_2', grammar_rule_id:'gr_en_05', type:'multiple_choice', question:'This is the ___ interesting book.', options:['more','most','much','many'], answer:'most' },
  { id:'ex_05_3', grammar_rule_id:'gr_en_05', type:'fill_blank', question:'He is ___ (good) at math than his brother.', answer:'better' },

  // === gr_en_06 : Present Perfect ===
  { id:'ex_06_1', grammar_rule_id:'gr_en_06', type:'fill_blank', question:'I have ___ (live) here since 2010.', answer:'lived' },
  { id:'ex_06_2', grammar_rule_id:'gr_en_06', type:'multiple_choice', question:'She has never ___ to Japan.', options:['be','been','being','was'], answer:'been' },
  { id:'ex_06_3', grammar_rule_id:'gr_en_06', type:'fill_blank', question:'___ you finished your homework? (auxiliary)', answer:'Have' },

  // === gr_en_07 : Conditionals ===
  { id:'ex_07_1', grammar_rule_id:'gr_en_07', type:'fill_blank', question:'If it rains, I ___ stay home.', answer:'will' },
  { id:'ex_07_2', grammar_rule_id:'gr_en_07', type:'multiple_choice', question:'If I ___ rich, I would travel.', options:['am','was','were','be'], answer:'were' },
  { id:'ex_07_3', grammar_rule_id:'gr_en_07', type:'fill_blank', question:'If she studies hard, she ___ pass the exam.', answer:'will' },

  // === gr_en_08 : Passive Voice ===
  { id:'ex_08_1', grammar_rule_id:'gr_en_08', type:'fill_blank', question:'The report ___ written by the manager.', answer:'was' },
  { id:'ex_08_2', grammar_rule_id:'gr_en_08', type:'multiple_choice', question:'English ___ spoken worldwide.', options:['is','are','was','were'], answer:'is' },
  { id:'ex_08_3', grammar_rule_id:'gr_en_08', type:'reorder', question:'Reorder: built / was / 1990 / The building / in', answer:'The building was built in 1990' },

  // === gr_en_09 : Reported Speech ===
  { id:'ex_09_1', grammar_rule_id:'gr_en_09', type:'fill_blank', question:'He said he ___ tired. (be → past)', answer:'was' },
  { id:'ex_09_2', grammar_rule_id:'gr_en_09', type:'multiple_choice', question:'She told me she ___ finished.', options:['has','had','have','having'], answer:'had' },
  { id:'ex_09_3', grammar_rule_id:'gr_en_09', type:'fill_blank', question:'They said they ___ come. (will → past)', answer:'would' },

  // === gr_en_10 : Relative Clauses ===
  { id:'ex_10_1', grammar_rule_id:'gr_en_10', type:'multiple_choice', question:'The woman ___ called you is my sister.', options:['who','which','where','when'], answer:'who' },
  { id:'ex_10_2', grammar_rule_id:'gr_en_10', type:'fill_blank', question:'The house ___ I grew up was sold.', answer:'where' },
  { id:'ex_10_3', grammar_rule_id:'gr_en_10', type:'multiple_choice', question:'Paris, ___ is in France, is beautiful.', options:['who','that','which','where'], answer:'which' },

  // === gr_en_11 : Possessive Adjectives (Family) ===
  { id:'ex_11_1', grammar_rule_id:'gr_en_11', type:'fill_blank', question:'___ mother is a doctor.', answer:'My' },
  { id:'ex_11_2', grammar_rule_id:'gr_en_11', type:'multiple_choice', question:'___ sister is very kind.', options:['his','her','their','our'], answer:'his' },
  { id:'ex_11_3', grammar_rule_id:'gr_en_11', type:'fill_blank', question:'We love ___ family very much.', answer:'our' },

  // === gr_en_12 : Plural Nouns ===
  { id:'ex_12_1', grammar_rule_id:'gr_en_12', type:'fill_blank', question:'I have three ___. (sister)', answer:'sisters' },
  { id:'ex_12_2', grammar_rule_id:'gr_en_12', type:'multiple_choice', question:'The ___ are eating dinner.', options:['child','childs','children','childes'], answer:'children' },
  { id:'ex_12_3', grammar_rule_id:'gr_en_12', type:'fill_blank', question:'My two ___ are brothers.', answer:'sons' },

  // === gr_en_13 : Subject Pronouns ===
  { id:'ex_13_1', grammar_rule_id:'gr_en_13', type:'fill_blank', question:'___ am a student.', answer:'I' },
  { id:'ex_13_2', grammar_rule_id:'gr_en_13', type:'multiple_choice', question:'___ are very happy together.', options:['We','They','I','She'], answer:'We' },
  { id:'ex_13_3', grammar_rule_id:'gr_en_13', type:'fill_blank', question:'___ love their parents.', answer:'They' },

  // === gr_en_14 : Have got ===
  { id:'ex_14_1', grammar_rule_id:'gr_en_14', type:'fill_blank', question:'I have ___ two brothers.', answer:'got' },
  { id:'ex_14_2', grammar_rule_id:'gr_en_14', type:'multiple_choice', question:'She hasn\'t ___ any sisters.', options:['have','got','get','had'], answer:'got' },
  { id:'ex_14_3', grammar_rule_id:'gr_en_14', type:'reorder', question:'Reorder: got / cousins / have / you / Have / ?', answer:'Have you got any cousins?' },

  // === gr_en_15 : Articles with Family ===
  { id:'ex_15_1', grammar_rule_id:'gr_en_15', type:'fill_blank', question:'I have ___ mother and ___ father.', answer:'a...a' },
  { id:'ex_15_2', grammar_rule_id:'gr_en_15', type:'multiple_choice', question:'___ only child has many cousins.', options:['A','An','The','—'], answer:'An' },
  { id:'ex_15_3', grammar_rule_id:'gr_en_15', type:'fill_blank', question:'___ youngest sister is five years old.', answer:'The' },

  // V2.1.1: Spanish exercises removed — Phase 14 will add via CanonicalContent
];

export const BANK_IRREGULAR_VERBS: IrregularVerb[] = [
  // AAA group
  { base:'cut', past:'cut', past_participle:'cut', french:'couper', group:'AAA' },
  { base:'put', past:'put', past_participle:'put', french:'mettre', group:'AAA' },
  { base:'let', past:'let', past_participle:'let', french:'laisser', group:'AAA' },
  { base:'set', past:'set', past_participle:'set', french:'placer', group:'AAA' },
  { base:'shut', past:'shut', past_participle:'shut', french:'fermer', group:'AAA' },
  { base:'cost', past:'cost', past_participle:'cost', french:'coûter', group:'AAA' },
  { base:'hit', past:'hit', past_participle:'hit', french:'frapper', group:'AAA' },
  { base:'hurt', past:'hurt', past_participle:'hurt', french:'blesser', group:'AAA' },
  // ABB group
  { base:'buy', past:'bought', past_participle:'bought', french:'acheter', group:'ABB' },
  { base:'bring', past:'brought', past_participle:'brought', french:'apporter', group:'ABB' },
  { base:'build', past:'built', past_participle:'built', french:'construire', group:'ABB' },
  { base:'catch', past:'caught', past_participle:'caught', french:'attraper', group:'ABB' },
  { base:'feel', past:'felt', past_participle:'felt', french:'sentir/ressentir', group:'ABB' },
  { base:'find', past:'found', past_participle:'found', french:'trouver', group:'ABB' },
  { base:'get', past:'got', past_participle:'got', french:'obtenir', group:'ABB' },
  { base:'have', past:'had', past_participle:'had', french:'avoir', group:'ABB' },
  { base:'hear', past:'heard', past_participle:'heard', french:'entendre', group:'ABB' },
  { base:'hold', past:'held', past_participle:'held', french:'tenir', group:'ABB' },
  { base:'keep', past:'kept', past_participle:'kept', french:'garder', group:'ABB' },
  { base:'leave', past:'left', past_participle:'left', french:'quitter/partir', group:'ABB' },
  { base:'lose', past:'lost', past_participle:'lost', french:'perdre', group:'ABB' },
  { base:'make', past:'made', past_participle:'made', french:'faire/fabriquer', group:'ABB' },
  { base:'meet', past:'met', past_participle:'met', french:'rencontrer', group:'ABB' },
  { base:'pay', past:'paid', past_participle:'paid', french:'payer', group:'ABB' },
  { base:'say', past:'said', past_participle:'said', french:'dire', group:'ABB' },
  { base:'sell', past:'sold', past_participle:'sold', french:'vendre', group:'ABB' },
  { base:'send', past:'sent', past_participle:'sent', french:'envoyer', group:'ABB' },
  { base:'sit', past:'sat', past_participle:'sat', french:'s\'asseoir', group:'ABB' },
  { base:'sleep', past:'slept', past_participle:'slept', french:'dormir', group:'ABB' },
  { base:'spend', past:'spent', past_participle:'spent', french:'dépenser', group:'ABB' },
  { base:'stand', past:'stood', past_participle:'stood', french:'être debout', group:'ABB' },
  { base:'teach', past:'taught', past_participle:'taught', french:'enseigner', group:'ABB' },
  { base:'tell', past:'told', past_participle:'told', french:'raconter', group:'ABB' },
  { base:'think', past:'thought', past_participle:'thought', french:'penser', group:'ABB' },
  { base:'understand', past:'understood', past_participle:'understood', french:'comprendre', group:'ABB' },
  { base:'win', past:'won', past_participle:'won', french:'gagner', group:'ABB' },
  // ABC group
  { base:'be', past:'was/were', past_participle:'been', french:'être', group:'ABC' },
  { base:'begin', past:'began', past_participle:'begun', french:'commencer', group:'ABC' },
  { base:'break', past:'broke', past_participle:'broken', french:'casser', group:'ABC' },
  { base:'choose', past:'chose', past_participle:'chosen', french:'choisir', group:'ABC' },
  { base:'come', past:'came', past_participle:'come', french:'venir', group:'ABC' },
  { base:'do', past:'did', past_participle:'done', french:'faire', group:'ABC' },
  { base:'drink', past:'drank', past_participle:'drunk', french:'boire', group:'ABC' },
  { base:'drive', past:'drove', past_participle:'driven', french:'conduire', group:'ABC' },
  { base:'eat', past:'ate', past_participle:'eaten', french:'manger', group:'ABC' },
  { base:'fall', past:'fell', past_participle:'fallen', french:'tomber', group:'ABC' },
  { base:'fly', past:'flew', past_participle:'flown', french:'voler', group:'ABC' },
  { base:'forget', past:'forgot', past_participle:'forgotten', french:'oublier', group:'ABC' },
  { base:'give', past:'gave', past_participle:'given', french:'donner', group:'ABC' },
  { base:'go', past:'went', past_participle:'gone', french:'aller', group:'ABC' },
  { base:'grow', past:'grew', past_participle:'grown', french:'grandir', group:'ABC' },
  { base:'know', past:'knew', past_participle:'known', french:'savoir', group:'ABC' },
  { base:'ride', past:'rode', past_participle:'ridden', french:'monter/rouler', group:'ABC' },
  { base:'ring', past:'rang', past_participle:'rung', french:'sonner', group:'ABC' },
  { base:'run', past:'ran', past_participle:'run', french:'courir', group:'ABC' },
  { base:'see', past:'saw', past_participle:'seen', french:'voir', group:'ABC' },
  { base:'show', past:'showed', past_participle:'shown', french:'montrer', group:'ABC' },
  { base:'sing', past:'sang', past_participle:'sung', french:'chanter', group:'ABC' },
  { base:'speak', past:'spoke', past_participle:'spoken', french:'parler', group:'ABC' },
  { base:'swim', past:'swam', past_participle:'swum', french:'nager', group:'ABC' },
  { base:'take', past:'took', past_participle:'taken', french:'prendre', group:'ABC' },
  { base:'throw', past:'threw', past_participle:'thrown', french:'lancer', group:'ABC' },
  { base:'wake', past:'woke', past_participle:'woken', french:'se réveiller', group:'ABC' },
  { base:'wear', past:'wore', past_participle:'worn', french:'porter', group:'ABC' },
  { base:'write', past:'wrote', past_participle:'written', french:'écrire', group:'ABC' },
  // ABA group (past tense changes, but past participle = base form)
  { base:'come', past:'came', past_participle:'come', french:'venir', group:'ABA' },
  { base:'run', past:'ran', past_participle:'run', french:'courir', group:'ABA' },
  { base:'become', past:'became', past_participle:'become', french:'devenir', group:'ABA' },
  { base:'overcome', past:'overcame', past_participle:'overcome', french:'surmonter', group:'ABA' },
  { base:'income', past:'incame', past_participle:'income', french:'revenu', group:'ABA' },
  { base:'rerun', past:'reran', past_participle:'rerun', french:'rediffuser', group:'ABA' },
  { base:'forecome', past:'forecame', past_participle:'forecome', french:'précéder', group:'ABA' },
  { base:'misbecome', past:'misbecame', past_participle:'misbecome', french:'ne pas bien aller', group:'ABA' },
];

export interface VerbExercise {
  id: string;
  verb_base: string;
  group: 'AAA' | 'ABB' | 'ABC' | 'ABA' | 'mixed';
  question_type: 'fill_past' | 'fill_participle' | 'fill_both';
  hint_fr: string;
}

export const BANK_VERB_EXERCISES: VerbExercise[] = [
  // === AAA Group Exercises ===
  { id:'verb_ex_AAA_1', verb_base:'cut', group:'AAA', question_type:'fill_both', hint_fr:'Base: cut, Passé: cut, Participe: cut' },
  { id:'verb_ex_AAA_2', verb_base:'put', group:'AAA', question_type:'fill_past', hint_fr:'I ___ the book on the table (mettre)' },
  { id:'verb_ex_AAA_3', verb_base:'let', group:'AAA', question_type:'fill_participle', hint_fr:'She has ___ me go (laisser)' },

  // === ABB Group Exercises ===
  { id:'verb_ex_ABB_1', verb_base:'buy', group:'ABB', question_type:'fill_both', hint_fr:'Base: buy, Passé: bought, Participe: bought' },
  { id:'verb_ex_ABB_2', verb_base:'find', group:'ABB', question_type:'fill_past', hint_fr:'I ___ my keys yesterday (trouver)' },
  { id:'verb_ex_ABB_3', verb_base:'make', group:'ABB', question_type:'fill_participle', hint_fr:'She has ___ a cake (faire/fabriquer)' },

  // === ABC Group Exercises ===
  { id:'verb_ex_ABC_1', verb_base:'be', group:'ABC', question_type:'fill_both', hint_fr:'Base: be, Passé: was/were, Participe: been' },
  { id:'verb_ex_ABC_2', verb_base:'go', group:'ABC', question_type:'fill_past', hint_fr:'They ___ to Paris last week (aller)' },
  { id:'verb_ex_ABC_3', verb_base:'speak', group:'ABC', question_type:'fill_participle', hint_fr:'He has ___ to the manager (parler)' },

  // === ABA Group Exercises ===
  { id:'verb_ex_ABA_1', verb_base:'come', group:'ABA', question_type:'fill_both', hint_fr:'Base: come, Passé: came, Participe: come' },
  { id:'verb_ex_ABA_2', verb_base:'run', group:'ABA', question_type:'fill_past', hint_fr:'She ___ quickly to the bus stop (courir)' },
  { id:'verb_ex_ABA_3', verb_base:'become', group:'ABA', question_type:'fill_participle', hint_fr:'He has ___ a doctor (devenir)' },
];
