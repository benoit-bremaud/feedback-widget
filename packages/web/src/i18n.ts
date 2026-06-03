import type {
  TopLevelCategory,
  SubCategory,
  Locale,
} from '@benoit-bremaud/feedback-widget-core'

// All user-facing widget strings, grouped by surface. Icons live in the view
// (locale-neutral); only text is translated here. The default locale is 'fr'
// and its values reproduce the v0.4.0 copy verbatim, so existing behaviour is
// unchanged. Static strings may contain HTML entities (e.g. `&nbsp;`) because
// the view interpolates titles/labels without escaping — they never carry user
// input.
export interface Messages {
  categoryLabels: Record<TopLevelCategory, string>
  subCategoryLabels: Record<SubCategory, string>
  trigger: { aria: string; label: string }
  /** Shared close affordance (X aria-label + "close" buttons). */
  close: string
  cancel: string
  back: string
  pointing: { text: string }
  targetConfirm: {
    title: string
    noTarget: string
    reject: string
    confirm: string
  }
  type: { title: string; subtitle: string; aria: string }
  subCategory: { subtitle: string; aria: string }
  precision: {
    subtitle: string
    descriptionLabel: string
    placeholder: string
    reporterLabel: string
    submit: string
    privacy: string
  }
  sending: string
  confirmed: { title: string; subtitle: string; reset: string }
  error: { title: string; defaultMessage: string; retry: string }
  validation: { minMessage: string; buildError: string }
  transport: {
    rateLimited: string
    invalid: string
    networkBase: string
    serverBase: string
    mailtoSuffixEnqueued: string
    mailtoSuffixNotEnqueued: string
    mailtoLinkPrefix: string
    noMailtoNotEnqueued: string
    noMailtoEnqueuedNetwork: string
    noMailtoEnqueuedServer: string
  }
  mailto: { subject: string; bodyIntro: string }
}

const fr: Messages = {
  categoryLabels: {
    bug: 'Bug',
    typo: 'Faute de frappe',
    error: 'Info erronée',
    ambiguous: 'Formulation ambiguë',
    suggestion: 'Suggestion',
    other: 'Autre',
  },
  subCategoryLabels: {
    crash: 'Plantage',
    'broken-feature': 'Fonction cassée',
    'visual-glitch': 'Bug visuel',
    'wrong-output': 'Résultat erroné',
    regression: 'Régression',
    prose: 'Texte',
    'code-sample': 'Exemple de code',
    heading: 'Titre',
    'link-text': 'Texte de lien',
    'alt-text': 'Texte alternatif',
    'js-console': 'Erreur console',
    'http-404': 'Page introuvable (404)',
    'http-5xx': 'Erreur serveur (5xx)',
    'broken-link': 'Lien mort',
    'missing-asset': 'Ressource manquante',
    wording: 'Formulation',
    navigation: 'Navigation',
    terminology: 'Terminologie',
    'example-unclear': 'Exemple peu clair',
    'missing-context': 'Contexte manquant',
    'new-feature': 'Nouvelle fonction',
    improvement: 'Amélioration',
    'new-example': 'Nouvel exemple',
    'content-refactor': 'Refonte du contenu',
    accessibility: 'Accessibilité',
  },
  trigger: { aria: 'Signaler un problème sur cette page', label: 'Signaler' },
  close: 'Fermer',
  cancel: 'Annuler',
  back: 'Retour',
  pointing: { text: 'Tape sur le passage que tu veux signaler.' },
  targetConfirm: {
    title: 'C’est bien ce passage&nbsp;?',
    noTarget:
      'Aucun passage précis détecté — tu peux quand même continuer ou choisir un bloc.',
    reject: 'Choisir un autre',
    confirm: 'Oui, continuer',
  },
  type: {
    title: 'Qu’est-ce qui ne va pas sur cette page&nbsp;?',
    subtitle: 'Choisis le type de problème.',
    aria: 'Type de problème',
  },
  subCategory: {
    subtitle: 'Précise la nature du problème.',
    aria: 'Sous-catégorie',
  },
  precision: {
    subtitle: 'Décris le problème (obligatoire), et ton prénom si tu veux.',
    descriptionLabel: 'Description',
    placeholder: 'Décris ce que tu as vu (10 caractères minimum)',
    reporterLabel: 'Prénom (optionnel)',
    submit: 'Envoyer',
    privacy:
      'Les retours sont envoyés anonymement. Le prénom n’est utilisé que pour identifier ton feedback.',
  },
  sending: 'Envoi en cours…',
  confirmed: {
    title: 'Merci&nbsp;! 🙏',
    subtitle: 'Ton retour a bien été envoyé.',
    reset: 'Signaler autre chose',
  },
  error: {
    title: 'Oups…',
    defaultMessage: 'Une erreur est survenue.',
    retry: 'Réessayer',
  },
  validation: {
    minMessage: 'Merci de décrire le problème (10 caractères minimum).',
    buildError:
      'Une erreur est survenue lors de la préparation de ton retour. Réessaie.',
  },
  transport: {
    rateLimited:
      'Tu as envoyé plusieurs retours récemment. Réessaie dans quelques minutes.',
    invalid:
      'Ton retour a été refusé (format invalide). Réessaie en le reformulant.',
    networkBase: 'Pas de connexion réseau',
    serverBase: 'Le service est momentanément indisponible',
    mailtoSuffixEnqueued: ' — ton retour sera renvoyé automatiquement plus tard.',
    mailtoSuffixNotEnqueued:
      ' — impossible de le mettre en file d’attente, utilise plutôt le mail ci-dessous.',
    mailtoLinkPrefix: ' — tu peux aussi nous écrire par mail : ',
    noMailtoNotEnqueued:
      'Ton retour n’a pas pu être envoyé ni mis en file d’attente — réessaie quand la connexion sera rétablie.',
    noMailtoEnqueuedNetwork:
      'Pas de connexion réseau. Ton retour a été mis en file d’attente et sera renvoyé automatiquement.',
    noMailtoEnqueuedServer:
      'Le service est momentanément indisponible. Ton retour a été mis en file d’attente.',
  },
  mailto: {
    subject: 'Signalement d’un problème',
    bodyIntro:
      'Voici le contenu du retour (l’envoi automatique a échoué) :',
  },
}

const en: Messages = {
  categoryLabels: {
    bug: 'Bug',
    typo: 'Typo',
    error: 'Incorrect info',
    ambiguous: 'Unclear wording',
    suggestion: 'Suggestion',
    other: 'Other',
  },
  subCategoryLabels: {
    crash: 'Crash',
    'broken-feature': 'Broken feature',
    'visual-glitch': 'Visual glitch',
    'wrong-output': 'Wrong output',
    regression: 'Regression',
    prose: 'Text',
    'code-sample': 'Code sample',
    heading: 'Heading',
    'link-text': 'Link text',
    'alt-text': 'Alt text',
    'js-console': 'Console error',
    'http-404': 'Not found (404)',
    'http-5xx': 'Server error (5xx)',
    'broken-link': 'Broken link',
    'missing-asset': 'Missing asset',
    wording: 'Wording',
    navigation: 'Navigation',
    terminology: 'Terminology',
    'example-unclear': 'Unclear example',
    'missing-context': 'Missing context',
    'new-feature': 'New feature',
    improvement: 'Improvement',
    'new-example': 'New example',
    'content-refactor': 'Content rework',
    accessibility: 'Accessibility',
  },
  trigger: { aria: 'Report a problem on this page', label: 'Report' },
  close: 'Close',
  cancel: 'Cancel',
  back: 'Back',
  pointing: { text: 'Tap the passage you want to report.' },
  targetConfirm: {
    title: 'Is this the right passage?',
    noTarget:
      'No specific passage detected — you can still continue or pick a block.',
    reject: 'Pick another',
    confirm: 'Yes, continue',
  },
  type: {
    title: 'What’s wrong on this page?',
    subtitle: 'Choose the type of problem.',
    aria: 'Problem type',
  },
  subCategory: {
    subtitle: 'Specify the nature of the problem.',
    aria: 'Sub-category',
  },
  precision: {
    subtitle: 'Describe the problem (required), and your name if you like.',
    descriptionLabel: 'Description',
    placeholder: 'Describe what you saw (10 characters minimum)',
    reporterLabel: 'First name (optional)',
    submit: 'Send',
    privacy:
      'Feedback is sent anonymously. Your name is only used to identify your report.',
  },
  sending: 'Sending…',
  confirmed: {
    title: 'Thanks! 🙏',
    subtitle: 'Your feedback has been sent.',
    reset: 'Report something else',
  },
  error: {
    title: 'Oops…',
    defaultMessage: 'Something went wrong.',
    retry: 'Retry',
  },
  validation: {
    minMessage: 'Please describe the problem (10 characters minimum).',
    buildError:
      'Something went wrong while preparing your report. Please try again.',
  },
  transport: {
    rateLimited:
      'You’ve sent several reports recently. Please try again in a few minutes.',
    invalid:
      'Your report was rejected (invalid format). Please rephrase and try again.',
    networkBase: 'No network connection',
    serverBase: 'The service is temporarily unavailable',
    mailtoSuffixEnqueued: ' — your report will be resent automatically later.',
    mailtoSuffixNotEnqueued:
      ' — it could not be queued, please use the email below instead.',
    mailtoLinkPrefix: ' — you can also email us: ',
    noMailtoNotEnqueued:
      'Your report could not be sent or queued — please try again when the connection is back.',
    noMailtoEnqueuedNetwork:
      'No network connection. Your report has been queued and will be resent automatically.',
    noMailtoEnqueuedServer:
      'The service is temporarily unavailable. Your report has been queued.',
  },
  mailto: {
    subject: 'Problem report',
    bodyIntro: 'Here is the report content (automatic sending failed):',
  },
}

export const LOCALES: Record<Locale, Messages> = { fr, en }
