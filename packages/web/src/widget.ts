import type { Category, Viewport } from '@benoit-bremaud/feedback-widget-core';
import { requiresUserMessage } from '@benoit-bremaud/feedback-widget-core';
import type { WidgetState } from '@benoit-bremaud/feedback-widget-core';
import type { ViewportDetector } from '@benoit-bremaud/feedback-widget-core';
import { createHttpTransport, defaultBackoff } from './adapters/HttpTransport';
import { createLocalStorageRateLimiter } from './adapters/LocalStorageRateLimiter';
import { createLocalStorageOutbox } from './adapters/LocalStorageOutbox';
import { createIntersectionViewportDetector } from './adapters/IntersectionViewportDetector';
import type { FeedbackWidgetElement } from './adapters/WebComponentView';
import { createWebComponentView, defineFeedbackWidgetElement } from './adapters/WebComponentView';
import { buildFeedbackPayload, EMPTY_TARGET } from '@benoit-bremaud/feedback-widget-core';
import { submitFeedback } from '@benoit-bremaud/feedback-widget-core';
import { drainOutbox } from '@benoit-bremaud/feedback-widget-core';
import type { WidgetConfig } from '@benoit-bremaud/feedback-widget-core';
import { resolveConfig } from '@benoit-bremaud/feedback-widget-core';

const TAG_NAME = 'feedback-widget';
const STORAGE_KEY_PREFIX = 'impropedia.feedback-widget';
const OUTBOX_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface FeedbackWidgetHandle {
  // Rescans observed blocks. Call this after a SPA navigation or any DOM
  // mutation that replaces the content area, so viewport detection and
  // pointing mode target the current page's blocks.
  refresh(): void;
}

const NOOP_HANDLE: FeedbackWidgetHandle = { refresh: () => {} };

export function mountFeedbackWidget(config: WidgetConfig): FeedbackWidgetHandle {
  if (typeof window === 'undefined' || typeof customElements === 'undefined') {
    return NOOP_HANDLE;
  }

  if (!customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, defineFeedbackWidgetElement());
  }

  const existing = document.querySelector<FeedbackWidgetElement>(TAG_NAME);
  if (existing) {
    const handle = handleRegistry.get(existing);
    if (handle) {
      handle.refresh();
      return handle;
    }
  }

  const element = document.createElement(TAG_NAME) as FeedbackWidgetElement;
  document.body.appendChild(element);

  const handle = attachController(element, resolveConfig(config));
  handleRegistry.set(element, handle);
  return handle;
}

const handleRegistry = new WeakMap<FeedbackWidgetElement, FeedbackWidgetHandle>();

function attachController(
  element: FeedbackWidgetElement,
  config: ReturnType<typeof resolveConfig>,
): FeedbackWidgetHandle {
  const view = createWebComponentView(element);

  element.setOptions({
    maxMessageLength: config.maxMessageLength,
    categories: config.categories ?? undefined,
    position: config.position,
  });

  const rateLimiter = createLocalStorageRateLimiter({
    storage: window.localStorage,
    key: `${STORAGE_KEY_PREFIX}.${config.projectId}`,
    windowMs: config.rateLimitWindowMs,
    maxAttempts: config.rateLimitMaxAttempts,
    now: () => Date.now(),
  });

  const transport = createHttpTransport({
    endpoint: config.endpoint,
    token: config.token ?? undefined,
    maxAttempts: config.maxTransportAttempts,
    timeoutMs: config.transportTimeoutMs,
    backoffMs: defaultBackoff,
    fetchImpl: window.fetch.bind(window),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });

  const outbox = createLocalStorageOutbox({
    storage: window.localStorage,
    key: `${STORAGE_KEY_PREFIX}.outbox.${config.projectId}`,
    now: () => Date.now(),
  });

  const detector: ViewportDetector = createIntersectionViewportDetector({
    doc: document,
    win: window,
  });

  detector.startObserving();

  void drainOutbox({ outbox, transport, maxAgeMs: OUTBOX_MAX_AGE_MS });

  let state: WidgetState = initialState();
  let formOpenedAt = 0;

  // setState renders by default. Pass { silent: true } to update the
  // controller's state without re-rendering the shadow DOM — used while
  // the user is typing in a textarea/input, since the DOM already
  // reflects the typed value and re-rendering would destroy the focused
  // element and lose the caret.
  const setState = (next: Partial<WidgetState>, opts: { silent?: boolean } = {}): void => {
    state = { ...state, ...next };
    if (!opts.silent) {
      view.render(state);
    }
  };

  view.render(state);

  view.onUserAction((action) => {
    switch (action.kind) {
      case 'open':
        formOpenedAt = Date.now();
        setState({
          step: 'target-confirm',
          target: detector.getCurrentTarget(),
          errorMessage: null,
        });
        break;

      case 'close':
        detector.disablePointingMode();
        detector.clearHighlight();
        setState(initialState());
        break;

      case 'reset':
        formOpenedAt = Date.now();
        setState({
          step: 'target-confirm',
          target: detector.getCurrentTarget(),
          selectedCategory: null,
          userMessage: '',
          reporterName: '',
          errorMessage: null,
        });
        break;

      case 'confirm-target':
        setState({ step: 'type', errorMessage: null });
        break;

      case 'reject-target':
        detector.enablePointingMode((picked) => {
          detector.disablePointingMode();
          setState({
            step: 'target-confirm',
            target: picked,
            errorMessage: null,
          });
        });
        setState({ step: 'pointing', errorMessage: null });
        break;

      case 'cancel-pointing':
        detector.disablePointingMode();
        setState({
          step: 'target-confirm',
          errorMessage: null,
        });
        break;

      case 'pick-target':
        setState({
          step: 'target-confirm',
          target: action.target,
          errorMessage: null,
        });
        break;

      case 'select-category':
        setState({
          step: 'precision',
          selectedCategory: action.category,
          errorMessage: null,
        });
        break;

      case 'update-message': {
        // Silent by default to preserve textarea focus while typing. But
        // we must render when:
        //  - an inline validation error was visible (so the user sees it
        //    disappear as they correct their input)
        //  - the value was actually normalised (paste >maxlength), so the
        //    DOM stays in sync with what handleSubmit will read from state
        const hadError = state.errorMessage !== null;
        const truncated = action.value.slice(0, config.maxMessageLength);
        const wasTruncated = truncated !== action.value;
        setState(
          { userMessage: truncated, errorMessage: null },
          { silent: !hadError && !wasTruncated },
        );
        break;
      }

      case 'update-reporter': {
        // Same logic as update-message but without errorMessage tracking.
        const truncated = action.value.slice(0, 50);
        const wasTruncated = truncated !== action.value;
        setState({ reporterName: truncated }, { silent: !wasTruncated });
        break;
      }

      case 'submit':
        void handleSubmit();
        break;
    }
  });

  const handleSubmit = async (): Promise<void> => {
    const category = state.selectedCategory;
    if (!category) {
      setState({ step: 'type' });
      return;
    }

    const message = state.userMessage.trim();
    if (requiresUserMessage(category) && message.length < 10) {
      setState({ errorMessage: 'Merci de décrire le problème (10 caractères minimum).' });
      return;
    }

    const honeypotFilled = element.isHoneypotFilled();
    const payload = buildFeedbackPayload({
      projectId: config.projectId,
      pageUrl: window.location.href,
      pageTitle: document.title,
      target: state.target ?? EMPTY_TARGET,
      category,
      userMessage: message.length > 0 ? message : null,
      reporterName: state.reporterName.trim() || null,
      viewport: currentViewport(),
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });

    setState({ step: 'sending' });

    const result = await submitFeedback(
      {
        transport,
        rateLimiter,
        now: () => Date.now(),
        minFormOpenMs: config.minFormOpenMs,
      },
      { payload, formOpenedAt, honeypotFilled },
    );

    if (result.ok) {
      view.showConfirmation();
      return;
    }

    if (result.reason === 'honeypot' || result.reason === 'too-fast') {
      // Silently pretend success to avoid giving feedback to bots.
      view.showConfirmation();
      return;
    }

    if (result.reason === 'rate-limited') {
      setState({
        step: 'error',
        errorMessage: 'Tu as envoyé plusieurs retours récemment. Réessaie dans quelques minutes.',
      });
      return;
    }

    if (result.reason === 'invalid') {
      setState({
        step: 'error',
        errorMessage: 'Ton retour a été refusé (format invalide). Réessaie en le reformulant.',
      });
      return;
    }

    // network or server: enqueue for later retry, then show mailto fallback if available.
    await outbox.enqueue(payload);

    const mailto = buildMailto(config.mailtoFallback, payload);
    if (mailto) {
      view.showMailtoFallback(
        mailto,
        result.reason === 'network'
          ? 'Pas de connexion réseau — ton retour sera renvoyé automatiquement plus tard.'
          : 'Le service est momentanément indisponible — ton retour sera renvoyé automatiquement.',
      );
      return;
    }

    setState({
      step: 'error',
      errorMessage:
        result.reason === 'network'
          ? 'Pas de connexion réseau. Ton retour a été mis en file d\u2019attente et sera renvoyé automatiquement.'
          : 'Le service est momentanément indisponible. Ton retour a été mis en file d\u2019attente.',
    });
  };

  return {
    refresh: () => {
      detector.refresh();
    },
  };
}

function initialState(): WidgetState {
  return {
    step: 'closed',
    target: null,
    selectedCategory: null,
    userMessage: '',
    reporterName: '',
    errorMessage: null,
  };
}

function currentViewport(): Viewport {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const device: Viewport['device'] =
    width < 600 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
  return { width, height, device };
}

function buildMailto(base: string | null, payload: unknown): string | null {
  if (!base) return null;
  const subject = encodeURIComponent('[Impropedia] Signalement d\u2019un problème');
  const body = encodeURIComponent(
    `Voici le contenu du retour (l\u2019envoi automatique a échoué) :\n\n${JSON.stringify(payload, null, 2)}`,
  );
  return `mailto:${base}?subject=${subject}&body=${body}`;
}

export type { WidgetConfig, Category };
