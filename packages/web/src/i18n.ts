import type {
  CategoryPair,
  TopLevelCategory,
  SubCategory,
  Locale,
} from '@benoit-bremaud/feedback-widget-core'

/** Guided question and placeholder shown on the precision step (spec D4). */
export interface Prompt {
  question: string
  placeholder: string
}

/**
 * All user-facing widget strings. Icons live in the view (locale-neutral);
 * only text is translated here. Static strings may contain HTML entities
 * (e.g. `&nbsp;`) because the view interpolates titles/labels without escaping
 * — they never carry user input.
 *
 * Translations are kept in a single source (`SOURCE`) where each message
 * carries every locale's value together (`t('fr', 'en')`), and the per-locale
 * `Messages` bundle is derived. This makes drift between locales impossible and
 * avoids two parallel, structurally-identical objects.
 */
export interface Messages {
  categoryLabels: Record<TopLevelCategory, string>
  subCategoryLabels: Record<SubCategory, string>
  trigger: { aria: string; label: string }
  /** Shared close affordance (X aria-label + "close" buttons). */
  close: string
  cancel: string
  back: string
  /** aria-label of the `family › sub-family` breadcrumb. */
  breadcrumb: string
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
    /** Per pair first, then per family, then `defaultPrompt` (see `promptFor`). */
    prompts: Partial<Record<CategoryPair, Prompt>>
    familyPrompts: Partial<Record<TopLevelCategory, Prompt>>
    defaultPrompt: Prompt
    descriptionLabel: string
    reporterLabel: string
    submit: string
    privacy: string
  }
  discardConfirm: {
    title: string
    subtitle: string
    keepEditing: string
    discard: string
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

// Prompts shared by two pairs (spec D4 table).
const WRONG_INFO_PROMPT = {
  question: t(
    'Qu’est-ce qui est faux ou dépassé ?',
    'What is wrong or out of date?',
  ),
  placeholder: t('Il est écrit … mais …', 'It says … but …'),
}
const EXPECTED_TEXT_PROMPT = {
  question: t('Qu’aurais-tu voulu lire ?', 'What did you expect to read?'),
  placeholder: t('Je m’attendais à trouver …', 'I expected to find …'),
}

// One guided prompt across every locale.
const prompt = (question: Localized, placeholder: Localized) => ({
  question,
  placeholder,
})

const SOURCE: DeepLocalized<Messages> = {
  categoryLabels: {
    bug: t('Ça ne marche pas', 'Something is broken'),
    display: t('C’est mal affiché', 'It looks wrong'),
    content: t('Erreur dans le contenu', 'Wrong content'),
    unclear: t(
      'Je n’ai pas compris ou j’ai une question',
      'I didn’t understand or I have a question',
    ),
    suggestion: t('J’ai une idée', 'I have an idea'),
    praise: t('J’aime bien', 'I like it'),
  },
  subCategoryLabels: {
    // bug
    'no-effect': t('Rien ne se passe', 'Nothing happens'),
    crash: t('Plantage', 'Crash'),
    'form-rejected': t('Formulaire refusé', 'Form rejected'),
    'wrong-data': t('Résultat faux', 'Wrong result'),
    'personal-data': t(
      'Données qui ne devraient pas être visibles',
      'Data that should not be visible',
    ),
    // display
    'broken-layout': t('Mise en page cassée', 'Broken layout'),
    mobile: t('Problème sur mobile', 'Problem on mobile'),
    'missing-media': t('Image ou vidéo manquante', 'Missing image or video'),
    'too-slow': t('Trop lent', 'Too slow'),
    // content
    typo: t('Faute de frappe', 'Typo'),
    'wrong-info': t('Information fausse', 'Wrong information'),
    outdated: t('Information périmée', 'Outdated information'),
    'dead-link': t('Lien mort ou mauvais lien', 'Dead or wrong link'),
    // unclear
    wording: t('Formulation', 'Wording'),
    'missing-info': t('Information manquante', 'Missing information'),
    navigation: t('Je me perds dans le site', 'I get lost on the site'),
    question: t('J’ai une question', 'I have a question'),
    // suggestion
    'new-feature': t('Nouvelle fonction', 'New feature'),
    improvement: t('Amélioration', 'Improvement'),
    design: t('Design', 'Design'),
    accessibility: t('Accessibilité', 'Accessibility'),
    // every family but praise
    other: t('Autre', 'Other'),
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
  breadcrumb: t('Ta sélection', 'Your selection'),
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
    prompts: {
      'bug/no-effect': prompt(
        t('Qu’as-tu essayé de faire ?', 'What were you trying to do?'),
        t(
          'J’ai cliqué sur … et rien ne s’est passé',
          'I clicked … and nothing happened',
        ),
      ),
      'bug/crash': prompt(
        t('Que faisais-tu juste avant ?', 'What were you doing just before?'),
        t('La page s’est figée quand …', 'The page froze when …'),
      ),
      'bug/form-rejected': prompt(
        t(
          'Quel champ est refusé, avec quelle valeur ?',
          'Which field is rejected, with which value?',
        ),
        t('Le champ … refuse …', 'The … field rejects …'),
      ),
      'bug/wrong-data': prompt(
        t(
          'Qu’est-ce qui est affiché, et qu’attendais-tu ?',
          'What is shown, and what did you expect?',
        ),
        t('Il affiche … alors que …', 'It shows … but …'),
      ),
      'bug/personal-data': prompt(
        t(
          'Qu’as-tu vu qui ne devrait pas l’être ?',
          'What did you see that should not be visible?',
        ),
        t('Je vois …', 'I can see …'),
      ),
      'display/broken-layout': prompt(
        t(
          'Qu’est-ce qui déborde ou se chevauche ?',
          'What overflows or overlaps?',
        ),
        t('Le bouton … passe sous …', 'The … button goes under …'),
      ),
      'display/mobile': prompt(
        t(
          'Que se passe-t-il sur ton appareil ?',
          'What happens on your device?',
        ),
        t('Sur mon téléphone, …', 'On my phone, …'),
      ),
      'display/missing-media': prompt(
        t('Quelle image ou vidéo manque ?', 'Which image or video is missing?'),
        t('L’image de … ne s’affiche pas', 'The image of … does not show'),
      ),
      'display/too-slow': prompt(
        t('Quelle action est lente ?', 'Which action is slow?'),
        t('Le chargement de … prend …', 'Loading … takes …'),
      ),
      'content/typo': prompt(
        t('Recopie la faute.', 'Copy the mistake.'),
        t('« … » devrait être « … »', '“…” should be “…”'),
      ),
      'content/wrong-info': WRONG_INFO_PROMPT,
      'content/outdated': WRONG_INFO_PROMPT,
      'content/dead-link': prompt(
        t(
          'Où mène le lien, et où devrait-il mener ?',
          'Where does the link go, and where should it go?',
        ),
        t('Le lien « … » mène à …', 'The “…” link goes to …'),
      ),
      'unclear/wording': EXPECTED_TEXT_PROMPT,
      'unclear/missing-info': EXPECTED_TEXT_PROMPT,
      'unclear/navigation': prompt(
        t('Que cherchais-tu ?', 'What were you looking for?'),
        t(
          'Je cherchais … et je n’ai pas trouvé',
          'I was looking for … and could not find it',
        ),
      ),
      'unclear/question': prompt(
        t('Pose ta question.', 'Ask your question.'),
        t('Comment … ?', 'How …?'),
      ),
    },
    familyPrompts: {
      suggestion: prompt(
        t('Décris ton idée.', 'Describe your idea.'),
        t('Ce serait bien de …', 'It would be nice to …'),
      ),
      praise: prompt(
        t('Qu’est-ce qui t’a plu ?', 'What did you like?'),
        t('J’ai aimé …', 'I liked …'),
      ),
    },
    defaultPrompt: prompt(
      t('Explique-nous.', 'Tell us more.'),
      t(
        'Décris ce que tu as vu (10 caractères minimum)',
        'Describe what you saw (10 characters minimum)',
      ),
    ),
    descriptionLabel: t('Description', 'Description'),
    reporterLabel: t('Prénom (optionnel)', 'First name (optional)'),
    submit: t('Envoyer', 'Send'),
    privacy: t(
      'Les retours sont envoyés anonymement. Le prénom n’est utilisé que pour identifier ton feedback.',
      'Feedback is sent anonymously. Your name is only used to identify your report.',
    ),
  },
  discardConfirm: {
    title: t('Abandonner ton message ?', 'Discard your message?'),
    subtitle: t(
      'Ce que tu as écrit sera perdu.',
      'What you wrote will be lost.',
    ),
    keepEditing: t('Continuer', 'Keep editing'),
    discard: t('Abandonner', 'Discard'),
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
  // Every non-leaf of `SOURCE` is an object (`DeepLocalized<Messages>`).
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    out[key] = localize(value, locale)
  }
  return out
}

function buildMessages(locale: Locale): Messages {
  // `localize` structurally mirrors `Messages` from `SOURCE: DeepLocalized<Messages>`.
  return localize(SOURCE, locale) as Messages
}

/** Per-locale message bundles, derived from the single translation source. */
export const LOCALES: Record<Locale, Messages> = {
  fr: buildMessages('fr'),
  en: buildMessages('en'),
}

/**
 * The guided prompt for a selection (spec D4): the pair, then the family
 * fallback, then `defaultPrompt`. The pair key matters because `other`
 * exists in five families.
 */
export function promptFor(
  messages: Messages,
  category: TopLevelCategory | null,
  subCategory: SubCategory | null,
): Prompt {
  const p = messages.precision
  if (category === null) return p.defaultPrompt
  // Every (category, sub-category) pair reaching here was validated by
  // the domain table, so the template literal is a `CategoryPair`.
  const byPair =
    subCategory === null
      ? undefined
      : p.prompts[`${category}/${subCategory}` as CategoryPair]
  return byPair ?? p.familyPrompts[category] ?? p.defaultPrompt
}
