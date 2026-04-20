import type { TargetBlock } from '@benoit-bremaud/feedback-widget-core';
import type { ViewportDetector } from '@benoit-bremaud/feedback-widget-core';
import { extractExcerpt, pickBestCandidate } from '@benoit-bremaud/feedback-widget-core';

export interface IntersectionViewportDetectorDeps {
  rootSelector?: string;
  targetSelectors?: string;
  highlightClass?: string;
  pointingClass?: string;
  doc: Document;
  win: Window;
}

const DEFAULT_SELECTORS = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, figure, table, pre';
const DEFAULT_ROOT = 'main';
const HIGHLIGHT_CLASS = 'fw-highlight';
const POINTING_CLASS = 'fw-pointing';

export function createIntersectionViewportDetector(
  deps: IntersectionViewportDetectorDeps,
): ViewportDetector {
  const doc = deps.doc;
  const win = deps.win;
  const rootSelector = deps.rootSelector ?? DEFAULT_ROOT;
  const targetSelectors = deps.targetSelectors ?? DEFAULT_SELECTORS;
  const highlightClass = deps.highlightClass ?? HIGHLIGHT_CLASS;
  const pointingClass = deps.pointingClass ?? POINTING_CLASS;

  const visibleById = new Map<string, { element: Element; visibleRatio: number }>();
  let observer: IntersectionObserver | null = null;
  let pointingHandler: ((ev: Event) => void) | null = null;
  let currentHighlighted: Element | null = null;
  let styleNode: HTMLStyleElement | null = null;

  const ensureStyles = (): void => {
    if (styleNode) return;
    styleNode = doc.createElement('style');
    styleNode.dataset.feedbackWidget = 'runtime-styles';
    styleNode.textContent = `
      .${highlightClass} {
        outline: 3px solid #c8102e !important;
        outline-offset: 4px !important;
        border-radius: 4px !important;
        animation: fw-pulse 1.6s ease-in-out infinite !important;
      }
      @keyframes fw-pulse {
        0%, 100% { outline-color: rgba(200, 16, 46, 0.95); }
        50%      { outline-color: rgba(200, 16, 46, 0.35); }
      }
      .${pointingClass} :is(${targetSelectors}) {
        cursor: pointer !important;
        transition: background-color 120ms ease !important;
      }
      .${pointingClass} :is(${targetSelectors}):hover {
        background-color: rgba(200, 16, 46, 0.08) !important;
      }
      @media (prefers-reduced-motion: reduce) {
        .${highlightClass} { animation: none !important; }
      }
    `;
    doc.head.appendChild(styleNode);
  };

  const getRoot = (): Element => doc.querySelector(rootSelector) ?? doc.body;

  const elementToTarget = (element: Element): TargetBlock => {
    const heading = findParentHeading(element);
    const text = element.textContent ?? '';
    const parentChildren = heading
      ? collectBlocksBetween(heading, element)
      : [element];
    const blockIndex = parentChildren.indexOf(element);

    return {
      headingId: heading?.id ?? null,
      headingText: heading?.textContent?.trim() ?? null,
      blockIndex: blockIndex >= 0 ? blockIndex : null,
      blockTag: element.tagName.toLowerCase(),
      excerpt: extractExcerpt(text),
    };
  };

  const highlight = (element: Element | null): void => {
    if (currentHighlighted && currentHighlighted !== element) {
      currentHighlighted.classList.remove(highlightClass);
    }
    currentHighlighted = element;
    if (element) {
      element.classList.add(highlightClass);
    }
  };

  const startObserving = (): void => {
    // Always (re)build: on SPA navigation, the previous targets belong to
    // the replaced DOM and must be rescanned.
    observer?.disconnect();
    visibleById.clear();
    ensureStyles();

    const root = getRoot();
    const targets = Array.from(root.querySelectorAll(targetSelectors));
    targets.forEach((el, idx) => {
      if (!el.id) {
        el.setAttribute('data-fw-id', `fw-${idx}`);
      }
    });

    observer = new (win as Window & typeof globalThis).IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = idOf(entry.target);
          if (!id) return;
          if (entry.isIntersecting) {
            visibleById.set(id, {
              element: entry.target,
              visibleRatio: entry.intersectionRatio,
            });
          } else {
            visibleById.delete(id);
          }
        });
      },
      {
        root: null,
        threshold: [0, 0.25, 0.5, 0.75, 1.0],
        rootMargin: '-20% 0px -20% 0px',
      },
    );

    targets.forEach((el) => observer?.observe(el));
  };

  const stopObserving = (): void => {
    observer?.disconnect();
    observer = null;
    visibleById.clear();
    highlight(null);
  };

  const getCurrentTarget = (): TargetBlock | null => {
    if (visibleById.size === 0) return null;

    const viewportHeight = win.innerHeight;
    const candidates = Array.from(visibleById.values()).map(({ element }) => {
      const rect = element.getBoundingClientRect();
      return {
        id: idOf(element) ?? '',
        top: rect.top,
        bottom: rect.bottom,
        height: rect.height,
      };
    });

    const best = pickBestCandidate(candidates, {
      top: 0,
      bottom: viewportHeight,
      height: viewportHeight,
    });

    if (!best) return null;

    const entry = visibleById.get(best.id);
    if (!entry) return null;

    highlight(entry.element);
    return elementToTarget(entry.element);
  };

  const enablePointingMode = (onPick: (target: TargetBlock) => void): void => {
    // Guard against re-entry: if a previous listener is still installed
    // (rapid double-click on « Choisir un autre »), remove it first.
    disablePointingMode();

    ensureStyles();
    getRoot().classList.add(pointingClass);
    highlight(null);

    pointingHandler = (ev: Event) => {
      const target = ev.target as Element | null;
      if (!target) return;
      const block = target.closest(targetSelectors);
      if (!block || !getRoot().contains(block)) return;
      ev.preventDefault();
      ev.stopPropagation();
      highlight(block);
      onPick(elementToTarget(block));
    };

    doc.addEventListener('click', pointingHandler, { capture: true });
  };

  const disablePointingMode = (): void => {
    getRoot().classList.remove(pointingClass);
    if (pointingHandler) {
      doc.removeEventListener('click', pointingHandler, { capture: true } as EventListenerOptions);
      pointingHandler = null;
    }
  };

  const clearHighlight = (): void => {
    highlight(null);
  };

  const refresh = (): void => {
    startObserving();
  };

  return {
    getCurrentTarget,
    startObserving,
    stopObserving,
    refresh,
    clearHighlight,
    enablePointingMode,
    disablePointingMode,
  };
}

function idOf(element: Element): string | null {
  return element.id || element.getAttribute('data-fw-id');
}

function findParentHeading(element: Element): Element | null {
  let walker: Element | null = element.previousElementSibling;
  while (walker) {
    if (/^H[1-6]$/.test(walker.tagName)) return walker;
    walker = walker.previousElementSibling;
  }
  const parent = element.parentElement;
  if (!parent) return null;
  return findParentHeading(parent);
}

function collectBlocksBetween(heading: Element, target: Element): Element[] {
  const blocks: Element[] = [];
  let walker = heading.nextElementSibling;
  while (walker && !/^H[1-6]$/.test(walker.tagName)) {
    if (walker === target || walker.contains(target)) {
      blocks.push(walker);
      if (walker === target) return blocks;
    } else {
      blocks.push(walker);
    }
    walker = walker.nextElementSibling;
  }
  return blocks;
}
