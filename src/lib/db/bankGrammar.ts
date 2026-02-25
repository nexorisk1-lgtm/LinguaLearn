// ==========================================
// LINGUALEARN - LOT 2 : Banque Grammaire
// EN (10 règles A1-B2, 3 exercices/règle) + ES (5 règles A1-A2)
// ==========================================

import { GrammarRule, GrammarExercise, IrregularVerb } from './bankTypes';

export const BANK_GRAMMAR: GrammarRule[] = [
  // ===== ANGLAIS A1 =====
  { id:'gr_en_01', language:'en', rule_name:'Present Simple - To Be', level:'A1',
    definition_fr:'Le verbe "to be" (être) se conjugue : I am, you are, he/she/it is, we/you/they are.',
    definition_en:'The verb "to be" conjugates as: I am, you are, he/she/it is, we/you/they are.',
    attention_points:'Ne pas confondre "your" (ton) et "you\'re" (you are).',
    examples:['I am a student.','She is happy.','They are from France.'] },
  { id:'gr_en_02', language:'en', rule_name:'Articles: A / An / The', level:'A1',
    definition_fr:'"A" devant une consonne, "an" devant une voyelle sonore, "the" pour quelque chose de spécifique.',
    definition_en:'"A" before a consonant sound, "an" before a vowel sound, "the" for specific things.',
    attention_points:'"An hour" (h muet), "a university" (son /juː/).',
    examples:['I have a cat.','She is an engineer.','The book is on the table.'] },
  { id:'gr_en_03', language:'en', rule_name:'Present Simple - Regular Verbs', level:'A1',
    definition_fr:'Au présent simple, on ajoute -s à la 3e personne du singulier. Forme négative : do not / does not + base verbale.',
    definition_en:'In present simple, add -s for third person singular. Negative: do not / does not + base verb.',
    attention_points:'He/she/it → ajoute -s ou -es (watches, goes). Avec "does", le verbe reste à la base.',
    examples:['She works every day.','He does not like coffee.','Do you speak English?'] },

  // ===== ANGLAIS A2 =====
  { id:'gr_en_04', language:'en', rule_name:'Past Simple - Regular & Irregular', level:'A2',
    definition_fr:'Le passé simple se forme avec -ed pour les verbes réguliers. Les verbes irréguliers ont une forme spécifique.',
    definition_en:'Past simple is formed by adding -ed to regular verbs. Irregular verbs have unique past forms.',
    attention_points:'Forme négative : did not + base verbale. Question : Did + sujet + base verbale ?',
    examples:['I worked yesterday.','She went to London.','Did you see the movie?'] },
  { id:'gr_en_05', language:'en', rule_name:'Comparatives & Superlatives', level:'A2',
    definition_fr:'Comparatif : adjectif court + -er / more + adjectif long. Superlatif : the + adjectif + -est / the most + adjectif.',
    definition_en:'Comparative: short adj + -er / more + long adj. Superlative: the + adj + -est / the most + adj.',
    attention_points:'Good → better → the best. Bad → worse → the worst.',
    examples:['She is taller than me.','This is the most interesting book.','He is better at math.'] },

  // ===== ANGLAIS B1 =====
  { id:'gr_en_06', language:'en', rule_name:'Present Perfect', level:'B1',
    definition_fr:'Le present perfect (have/has + participe passé) exprime une action passée avec un lien au présent.',
    definition_en:'Present perfect (have/has + past participle) links a past action to the present.',
    attention_points:'Since = point de départ, For = durée. Ne pas utiliser avec une date précise du passé.',
    examples:['I have lived here since 2010.','She has never been to Japan.','Have you finished your homework?'] },
  { id:'gr_en_07', language:'en', rule_name:'Conditionals - First & Second', level:'B1',
    definition_fr:'1er conditionnel : If + présent, will + base (probable). 2e conditionnel : If + past simple, would + base (hypothétique).',
    definition_en:'First conditional: If + present, will + base (likely). Second conditional: If + past, would + base (hypothetical).',
    attention_points:'If I were (pas "was") est préféré dans le 2e conditionnel formel.',
    examples:['If it rains, I will stay home.','If I were rich, I would travel the world.'] },
  { id:'gr_en_08', language:'en', rule_name:'Passive Voice', level:'B1',
    definition_fr:'Voix passive : sujet + be (conjugué) + participe passé. L\'agent est introduit par "by".',
    definition_en:'Passive voice: subject + be (conjugated) + past participle. Agent introduced by "by".',
    attention_points:'Utiliser la passive quand l\'action est plus importante que l\'agent.',
    examples:['The report was written by the manager.','English is spoken worldwide.','The building was built in 1990.'] },

  // ===== ANGLAIS B2 =====
  { id:'gr_en_09', language:'en', rule_name:'Reported Speech', level:'B2',
    definition_fr:'Discours rapporté : on recule le temps d\'un cran. Present → Past, Past → Past Perfect, Will → Would.',
    definition_en:'Reported speech: shift tense back. Present → Past, Past → Past Perfect, Will → Would.',
    attention_points:'Les pronoms et les marqueurs de temps changent aussi (today→that day, here→there).',
    examples:['He said he was tired.','She told me she had finished.','They said they would come.'] },
  { id:'gr_en_10', language:'en', rule_name:'Relative Clauses', level:'B2',
    definition_fr:'Les propositions relatives commencent par who (personnes), which (choses), that, where, when. Defining vs non-defining.',
    definition_en:'Relative clauses use who (people), which (things), that, where, when. Defining vs non-defining.',
    attention_points:'Non-defining clauses use commas and cannot use "that".',
    examples:['The woman who called you is my sister.','Paris, which is in France, is beautiful.','The house where I grew up was sold.'] },

  // ===== ESPAGNOL A1 =====
  { id:'gr_es_01', language:'es', rule_name:'Ser vs Estar', level:'A1',
    definition_fr:'"Ser" pour les caractéristiques permanentes, "estar" pour les états temporaires ou la localisation.',
    definition_en:'"Ser" for permanent characteristics, "estar" for temporary states or location.',
    attention_points:'Ser : nationalité, profession, caractère. Estar : émotions, lieu, états temporaires.',
    examples:['Yo soy francés.','Ella está cansada.','Madrid está en España.'] },
  { id:'gr_es_02', language:'es', rule_name:'Artículos: El / La / Un / Una', level:'A1',
    definition_fr:'Articles définis : el (masc), la (fém), los, las. Articles indéfinis : un, una, unos, unas.',
    definition_en:'Definite articles: el (m), la (f), los, las. Indefinite: un, una, unos, unas.',
    attention_points:'Attention aux exceptions : el agua (fém mais "el" devant a- tonique).',
    examples:['El libro es interesante.','Tengo una casa grande.','Los gatos son bonitos.'] },
  { id:'gr_es_03', language:'es', rule_name:'Presente de indicativo - Verbos regulares', level:'A1',
    definition_fr:'Conjugaison des verbes réguliers en -ar, -er, -ir au présent de l\'indicatif.',
    definition_en:'Regular verb conjugation in -ar, -er, -ir in the present indicative.',
    attention_points:'-ar: o, as, a, amos, áis, an. -er: o, es, e, emos, éis, en. -ir: o, es, e, imos, ís, en.',
    examples:['Yo hablo español.','Él come una manzana.','Nosotros vivimos en París.'] },

  // ===== ESPAGNOL A2 =====
  { id:'gr_es_04', language:'es', rule_name:'Pretérito indefinido', level:'A2',
    definition_fr:'Le passé simple espagnol pour les actions terminées dans le passé avec un marqueur temporel.',
    definition_en:'The Spanish simple past for completed actions in the past with a time marker.',
    attention_points:'Verbes irréguliers fréquents : ir/ser (fui), tener (tuve), hacer (hice).',
    examples:['Ayer fui al cine.','Ella comió paella.','Nosotros llegamos tarde.'] },
  { id:'gr_es_05', language:'es', rule_name:'Gustar y verbos similares', level:'A2',
    definition_fr:'"Gustar" fonctionne à l\'envers : ce qui plaît est le sujet. Me gusta + singulier, me gustan + pluriel.',
    definition_en:'"Gustar" works inversely: what is liked is the subject. Me gusta + singular, me gustan + plural.',
    attention_points:'Pronoms : me, te, le, nos, os, les. "A mí me gusta" pour insister.',
    examples:['Me gusta el chocolate.','Nos gustan los animales.','A ella le encanta bailar.'] },
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

  // === gr_es_01 : Ser vs Estar ===
  { id:'ex_es_01_1', grammar_rule_id:'gr_es_01', type:'multiple_choice', question:'Yo ___ francés.', options:['soy','estoy','es','está'], answer:'soy' },
  { id:'ex_es_01_2', grammar_rule_id:'gr_es_01', type:'fill_blank', question:'Ella ___ cansada.', answer:'está' },
  { id:'ex_es_01_3', grammar_rule_id:'gr_es_01', type:'multiple_choice', question:'Madrid ___ en España.', options:['es','está','son','están'], answer:'está' },

  // === gr_es_02 : Articles ===
  { id:'ex_es_02_1', grammar_rule_id:'gr_es_02', type:'multiple_choice', question:'___ libro es interesante.', options:['El','La','Un','Una'], answer:'El' },
  { id:'ex_es_02_2', grammar_rule_id:'gr_es_02', type:'fill_blank', question:'Tengo ___ casa grande. (article indéfini fém)', answer:'una' },
  { id:'ex_es_02_3', grammar_rule_id:'gr_es_02', type:'multiple_choice', question:'___ gatos son bonitos.', options:['El','La','Los','Las'], answer:'Los' },

  // === gr_es_03 : Presente regular ===
  { id:'ex_es_03_1', grammar_rule_id:'gr_es_03', type:'fill_blank', question:'Yo ___ (hablar) español.', answer:'hablo' },
  { id:'ex_es_03_2', grammar_rule_id:'gr_es_03', type:'multiple_choice', question:'Él ___ una manzana.', options:['como','comes','come','comen'], answer:'come' },
  { id:'ex_es_03_3', grammar_rule_id:'gr_es_03', type:'fill_blank', question:'Nosotros ___ (vivir) en París.', answer:'vivimos' },

  // === gr_es_04 : Pretérito indefinido ===
  { id:'ex_es_04_1', grammar_rule_id:'gr_es_04', type:'multiple_choice', question:'Ayer ___ al cine.', options:['voy','fui','iba','iré'], answer:'fui' },
  { id:'ex_es_04_2', grammar_rule_id:'gr_es_04', type:'fill_blank', question:'Ella ___ (comer) paella ayer.', answer:'comió' },
  { id:'ex_es_04_3', grammar_rule_id:'gr_es_04', type:'fill_blank', question:'Nosotros ___ (llegar) tarde.', answer:'llegamos' },

  // === gr_es_05 : Gustar ===
  { id:'ex_es_05_1', grammar_rule_id:'gr_es_05', type:'multiple_choice', question:'Me ___ el chocolate.', options:['gusto','gusta','gustan','gustas'], answer:'gusta' },
  { id:'ex_es_05_2', grammar_rule_id:'gr_es_05', type:'fill_blank', question:'Nos ___ los animales.', answer:'gustan' },
  { id:'ex_es_05_3', grammar_rule_id:'gr_es_05', type:'multiple_choice', question:'A ella le ___ bailar.', options:['gusta','encanta','gustan','encantan'], answer:'encanta' },
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
];
