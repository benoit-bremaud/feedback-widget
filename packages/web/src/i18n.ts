import type {
  TopLevelCategory,
  SubCategory,
  Locale,
} from '@benoit-bremaud/feedback-widget-core'

// All user-facing widget strings. Icons live in the view (locale-neutral);
// only text is translated here. Static strings may contain HTML entities
// (e.g. `&nbsp;`) because the view interpolates titles/labels without escaping
// — they never carry user input.
//
// Translations are kept in a single source (`SOURCE`) where each message
// carries every locale's value together (`t('fr', 'en')`), and the per-locale
// `Messages` bundle is derived. This makes drift between locales impossible and
// avoids two parallel, structurally-identical objects.
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

// One message's value across every locale, kept together.
type Localized = Record<Locale, string>
const t = (fr: string, en: string): Localized => ({ fr, en })

// `Messages` with every leaf string replaced by a `Localized` value. Derived
// from `Messages` so the structure is declared once.
type DeepLocalized<T> = T extends string
  ? Localized
  : { [K in keyof T]: DeepLocalized<T[K]> }

const SOURCE: DeepLocalized<Messages> = {
  categoryLabels: {
    bug: t('Bug', 'Bug'),
    typo: t('Faute de frappe', 'Typo'),
    error: t('Info erronée', 'Incorrect info'),
    ambiguous: t('Formulation ambiguë', 'Unclear wording'),
    suggestion: t('Suggestion', 'Suggestion'),
    other: t('Autre', 'Other'),
  },
  subCategoryLabels: {
    crash: t('Plantage', 'Crash'),
    'broken-feature': t('Fonction cassée', 'Broken feature'),
    'visual-glitch': t('Bug visuel', 'Visual glitch'),
    'wrong-output': t('Résultat erroné', 'Wrong output'),
    regression: t('Régression', 'Regression'),
    prose: t('Texte', 'Text'),
    'code-sample': t('Exemple de code', 'Code sample'),
    heading: t('Titre', 'Heading'),
    'link-text': t('Texte de lien', 'Link text'),
    'alt-text': t('Texte alternatif', 'Alt text'),
    'js-console': t('Erreur console', 'Console error'),
    'http-404': t('Page introuvable (404)', 'Not found (404)'),
    'http-5xx': t('Erreur serveur (5xx)', 'Server error (5xx)'),
    'broken-link': t('Lien mort', 'Broken link'),
    'missing-asset': t('Ressource manquante', 'Missing asset'),
    wording: t('Formulation', 'Wording'),
    navigation: t('Navigation', 'Navigation'),
    terminology: t('Terminologie', 'Terminology'),
    'example-unclear': t('Exemple peu clair', 'Unclear example'),
    'missing-context': t('Contexte manquant', 'Missing context'),
    'new-feature': t('Nouvelle fonction', 'New feature'),
    improvement: t('Amélioration', 'Improvement'),
    'new-example': t('Nouvel exemple', 'New example'),
    'content-refactor': t('Refonte du contenu', 'Content rework'),
    accessibility: t('Accessibilité', 'Accessibility'),
  },
  trigger: {
    aria: t(
      'Signaler un problème sur cette page',
      'Report a problem on this page',
    ),
    label: t('Signaler', 'Report'),
  },
  close: t('Fermer', 'Close'),
  cancel: t('Annuler', 'Cancel'),
  back: t('Retour', 'Back'),
  pointing: {
    text: t(
      'Tape sur le passage que tu veux signaler.',
      'Tap the passage you want to report.',
    ),
  },
  targetConfirm: {
    title: t('C’est bien ce passage&nbsp;?', 'Is this the right passage?'),
    noTarget: t(
      'Aucun passage précis détecté — tu peux quand même continuer ou choisir un bloc.',
      'No specific passage detected — you can still continue or pick a block.',
    ),
    reject: t('Choisir un autre', 'Pick another'),
    confirm: t('Oui, continuer', 'Yes, continue'),
  },
  type: {
    title: t(
      'Qu’est-ce qui ne va pas sur cette page&nbsp;?',
      'What’s wrong on this page?',
    ),
    subtitle: t('Choisis le type de problème.', 'Choose the type of problem.'),
    aria: t('Type de problème', 'Problem type'),
  },
  subCategory: {
    subtitle: t(
      'Précise la nature du problème.',
      'Specify the nature of the problem.',
    ),
    aria: t('Sous-catégorie', 'Sub-category'),
  },
  precision: {
    subtitle: t(
      'Décris le problème (obligatoire), et ton prénom si tu veux.',
      'Describe the problem (required), and your name if you like.',
    ),
    descriptionLabel: t('Description', 'Description'),
    placeholder: t(
      'Décris ce que tu as vu (10 caractères minimum)',
      'Describe what you saw (10 characters minimum)',
    ),
    reporterLabel: t('Prénom (optionnel)', 'First name (optional)'),
    submit: t('Envoyer', 'Send'),
    privacy: t(
      'Les retours sont envoyés anonymement. Le prénom n’est utilisé que pour identifier ton feedback.',
      'Feedback is sent anonymously. Your name is only used to identify your report.',
    ),
  },
  sending: t('Envoi en cours…', 'Sending…'),
  confirmed: {
    title: t('Merci&nbsp;! 🙏', 'Thanks! 🙏'),
    subtitle: t(
      'Ton retour a bien été envoyé.',
      'Your feedback has been sent.',
    ),
    reset: t('Signaler autre chose', 'Report something else'),
  },
  error: {
    title: t('Oups…', 'Oops…'),
    defaultMessage: t('Une erreur est survenue.', 'Something went wrong.'),
    retry: t('Réessayer', 'Retry'),
  },
  validation: {
    minMessage: t(
      'Merci de décrire le problème (10 caractères minimum).',
      'Please describe the problem (10 characters minimum).',
    ),
    buildError: t(
      'Une erreur est survenue lors de la préparation de ton retour. Réessaie.',
      'Something went wrong while preparing your report. Please try again.',
    ),
  },
  transport: {
    rateLimited: t(
      'Tu as envoyé plusieurs retours récemment. Réessaie dans quelques minutes.',
      'You’ve sent several reports recently. Please try again in a few minutes.',
    ),
    invalid: t(
      'Ton retour a été refusé (format invalide). Réessaie en le reformulant.',
      'Your report was rejected (invalid format). Please rephrase and try again.',
    ),
    networkBase: t('Pas de connexion réseau', 'No network connection'),
    serverBase: t(
      'Le service est momentanément indisponible',
      'The service is temporarily unavailable',
    ),
    mailtoSuffixEnqueued: t(
      ' — ton retour sera renvoyé automatiquement plus tard.',
      ' — your report will be resent automatically later.',
    ),
    mailtoSuffixNotEnqueued: t(
      ' — impossible de le mettre en file d’attente, utilise plutôt le mail ci-dessous.',
      ' — it could not be queued, please use the email below instead.',
    ),
    mailtoLinkPrefix: t(
      ' — tu peux aussi nous écrire par mail : ',
      ' — you can also email us: ',
    ),
    noMailtoNotEnqueued: t(
      'Ton retour n’a pas pu être envoyé ni mis en file d’attente — réessaie quand la connexion sera rétablie.',
      'Your report could not be sent or queued — please try again when the connection is back.',
    ),
    noMailtoEnqueuedNetwork: t(
      'Pas de connexion réseau. Ton retour a été mis en file d’attente et sera renvoyé automatiquement.',
      'No network connection. Your report has been queued and will be resent automatically.',
    ),
    noMailtoEnqueuedServer: t(
      'Le service est momentanément indisponible. Ton retour a été mis en file d’attente.',
      'The service is temporarily unavailable. Your report has been queued.',
    ),
  },
  mailto: {
    subject: t('Signalement d’un problème', 'Problem report'),
    bodyIntro: t(
      'Voici le contenu du retour (l’envoi automatique a échoué) :',
      'Here is the report content (automatic sending failed):',
    ),
  },
}

function isLocalized(value: unknown): value is Localized {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).fr === 'string' &&
    typeof (value as Record<string, unknown>).en === 'string'
  )
}

// Recursively replace every Localized leaf with its value for `locale`.
function localize(node: unknown, locale: Locale): unknown {
  if (isLocalized(node)) return node[locale]
  if (typeof node === 'object' && node !== null) {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(
      node as Record<string, unknown>,
    )) {
      out[key] = localize(value, locale)
    }
    return out
  }
  return node
}

function buildMessages(locale: Locale): Messages {
  // `localize` structurally mirrors `Messages` from `SOURCE: DeepLocalized<Messages>`.
  return localize(SOURCE, locale) as Messages
}

export const LOCALES: Record<Locale, Messages> = {
  fr: buildMessages('fr'),
  en: buildMessages('en'),
}
