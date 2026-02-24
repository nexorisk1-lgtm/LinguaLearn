// ==========================================
// LINGUALEARN - Internationalisation
// CDC V2.1 - 2 langues d'interface (FR, EN)
// ==========================================

import { InterfaceLanguage } from '@/types';

const translations = {
  fr: {
    // Auth
    'auth.login': 'Connexion',
    'auth.register': 'Inscription',
    'auth.email': 'Email',
    'auth.password': 'Mot de passe',
    'auth.firstName': 'Prénom',
    'auth.role': 'Rôle',
    'auth.user': 'Utilisateur',
    'auth.admin': 'Administrateur',
    'auth.submit': 'Valider',
    'auth.noAccount': 'Pas encore de compte ?',
    'auth.hasAccount': 'Déjà un compte ?',
    'auth.logout': 'Déconnexion',
    'auth.error.email': 'Email invalide',
    'auth.error.password': 'Mot de passe requis (6 caractères min.)',
    'auth.error.firstName': 'Prénom requis',
    'auth.error.credentials': 'Identifiants incorrects',
    'auth.error.emailExists': 'Cet email est déjà utilisé',

    // Onboarding
    'onboarding.step': 'Étape',
    'onboarding.of': 'sur',
    'onboarding.next': 'Suivant',
    'onboarding.previous': 'Précédent',
    'onboarding.finish': 'Terminer',
    'onboarding.startDiagnostic': 'Commencer le diagnostic',

    // Écran 1
    'onboarding.screen1.title': 'Paramètres généraux',
    'onboarding.screen1.interfaceLang': 'Langue d\'affichage de l\'interface',
    'onboarding.screen1.learningLangs': 'Langue(s) à apprendre',
    'onboarding.screen1.selectAtLeast1': 'Sélectionnez au moins une langue',

    // Écran 2
    'onboarding.screen2.title': 'Objectifs & Thématiques',
    'onboarding.screen2.objectives': 'Objectifs de progression',
    'onboarding.screen2.objectivesHint': 'Au moins 1 obligatoire',
    'onboarding.screen2.personalThemes': 'Thèmes personnels',
    'onboarding.screen2.proThemes': 'Thèmes professionnels (GRC & Cybersécurité)',
    'onboarding.screen2.selectAtLeast1Theme': 'Sélectionnez au moins un thème',

    // Écran 3
    'onboarding.screen3.title': 'Organisation',
    'onboarding.screen3.days': 'Jours de révision',
    'onboarding.screen3.duration': 'Durée quotidienne',
    'onboarding.screen3.selectAtLeast1Day': 'Sélectionnez au moins un jour',

    // Écran 4
    'onboarding.screen4.title': 'Évaluations initiales',
    'onboarding.screen4.cecrDescription': 'Évaluation diagnostique CECRL',
    'onboarding.screen4.cecrMandatory': 'Obligatoire',
    'onboarding.screen4.grcDescription': 'Évaluation diagnostique GRC/Cyber',
    'onboarding.screen4.grcConditional': 'Thèmes professionnels détectés',
    'onboarding.screen4.filteredByObjectives': 'Filtré selon vos objectifs sélectionnés',

    // Diagnostic
    'diagnostic.title': 'Évaluation diagnostique',
    'diagnostic.cecrl': 'CECRL',
    'diagnostic.grc': 'GRC / Cyber',
    'diagnostic.question': 'Question',
    'diagnostic.of': 'sur',
    'diagnostic.submit': 'Valider la réponse',
    'diagnostic.next': 'Question suivante',
    'diagnostic.results': 'Résultats du diagnostic',
    'diagnostic.yourLevel': 'Votre niveau',
    'diagnostic.goToDashboard': 'Accéder au tableau de bord',
    'diagnostic.objectivesFiltered': 'Questions filtrées selon vos objectifs :',

    // Dashboard
    'dashboard.hello': 'Hello',
    'dashboard.streak': 'Streak',
    'dashboard.days': 'jours',
    'dashboard.activeLang': 'Langue active',
    'dashboard.levelCecrl': 'Niveau CECRL',
    'dashboard.levelGrc': 'Niveau GRC/Cyber',
    'dashboard.progress': 'Progression',
    'dashboard.schedule': 'Calendrier',
    'dashboard.todayReview': 'Révision du jour',
    'dashboard.certifReminder': 'Rappel certification',
    'dashboard.challenges': 'Défis en cours',

    // Général
    'general.loading': 'Chargement...',
    'general.error': 'Erreur',
    'general.save': 'Enregistrer',
    'general.cancel': 'Annuler',
    'general.confirm': 'Confirmer',
    'general.back': 'Retour',
  },
  en: {
    // Auth
    'auth.login': 'Login',
    'auth.register': 'Register',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.firstName': 'First Name',
    'auth.role': 'Role',
    'auth.user': 'User',
    'auth.admin': 'Administrator',
    'auth.submit': 'Submit',
    'auth.noAccount': 'Don\'t have an account?',
    'auth.hasAccount': 'Already have an account?',
    'auth.logout': 'Logout',
    'auth.error.email': 'Invalid email',
    'auth.error.password': 'Password required (6 characters min.)',
    'auth.error.firstName': 'First name required',
    'auth.error.credentials': 'Invalid credentials',
    'auth.error.emailExists': 'This email is already in use',

    // Onboarding
    'onboarding.step': 'Step',
    'onboarding.of': 'of',
    'onboarding.next': 'Next',
    'onboarding.previous': 'Previous',
    'onboarding.finish': 'Finish',
    'onboarding.startDiagnostic': 'Start Diagnostic',

    // Screen 1
    'onboarding.screen1.title': 'General Settings',
    'onboarding.screen1.interfaceLang': 'Interface display language',
    'onboarding.screen1.learningLangs': 'Language(s) to learn',
    'onboarding.screen1.selectAtLeast1': 'Select at least one language',

    // Screen 2
    'onboarding.screen2.title': 'Goals & Topics',
    'onboarding.screen2.objectives': 'Learning goals',
    'onboarding.screen2.objectivesHint': 'At least 1 required',
    'onboarding.screen2.personalThemes': 'Personal topics',
    'onboarding.screen2.proThemes': 'Professional topics (GRC & Cybersecurity)',
    'onboarding.screen2.selectAtLeast1Theme': 'Select at least one topic',

    // Screen 3
    'onboarding.screen3.title': 'Schedule',
    'onboarding.screen3.days': 'Study days',
    'onboarding.screen3.duration': 'Daily duration',
    'onboarding.screen3.selectAtLeast1Day': 'Select at least one day',

    // Screen 4
    'onboarding.screen4.title': 'Initial Assessments',
    'onboarding.screen4.cecrDescription': 'CEFR Diagnostic Assessment',
    'onboarding.screen4.cecrMandatory': 'Mandatory',
    'onboarding.screen4.grcDescription': 'GRC/Cyber Diagnostic Assessment',
    'onboarding.screen4.grcConditional': 'Professional topics detected',
    'onboarding.screen4.filteredByObjectives': 'Filtered by your selected goals',

    // Diagnostic
    'diagnostic.title': 'Diagnostic Assessment',
    'diagnostic.cecrl': 'CEFR',
    'diagnostic.grc': 'GRC / Cyber',
    'diagnostic.question': 'Question',
    'diagnostic.of': 'of',
    'diagnostic.submit': 'Submit answer',
    'diagnostic.next': 'Next question',
    'diagnostic.results': 'Diagnostic Results',
    'diagnostic.yourLevel': 'Your level',
    'diagnostic.goToDashboard': 'Go to Dashboard',
    'diagnostic.objectivesFiltered': 'Questions filtered by your goals:',

    // Dashboard
    'dashboard.hello': 'Hello',
    'dashboard.streak': 'Streak',
    'dashboard.days': 'days',
    'dashboard.activeLang': 'Active language',
    'dashboard.levelCecrl': 'CEFR Level',
    'dashboard.levelGrc': 'GRC/Cyber Level',
    'dashboard.progress': 'Progress',
    'dashboard.schedule': 'Schedule',
    'dashboard.todayReview': 'Today\'s Review',
    'dashboard.certifReminder': 'Certification Reminder',
    'dashboard.challenges': 'Active Challenges',

    // General
    'general.loading': 'Loading...',
    'general.error': 'Error',
    'general.save': 'Save',
    'general.cancel': 'Cancel',
    'general.confirm': 'Confirm',
    'general.back': 'Back',
  },
} as const;

export function t(key: string, lang: InterfaceLanguage = 'fr'): string {
  const dict = translations[lang] as Record<string, string>;
  return dict[key] || key;
}

export function getThemeName(themeId: string, lang: InterfaceLanguage, themes: { id: string; nameEn: string; nameFr: string }[]): string {
  const theme = themes.find(t => t.id === themeId);
  if (!theme) return themeId;
  return lang === 'fr' ? theme.nameFr : theme.nameEn;
}
