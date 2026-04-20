import type { Category, TargetBlock } from '../domain/Feedback';

export type WidgetStep =
  | 'closed'
  | 'target-confirm'
  | 'pointing'
  | 'type'
  | 'precision'
  | 'sending'
  | 'confirmed'
  | 'error';

export interface WidgetState {
  step: WidgetStep;
  target: TargetBlock | null;
  selectedCategory: Category | null;
  userMessage: string;
  reporterName: string;
  errorMessage: string | null;
}

export type UserAction =
  | { kind: 'open' }
  | { kind: 'close' }
  | { kind: 'confirm-target' }
  | { kind: 'reject-target' }
  | { kind: 'cancel-pointing' }
  | { kind: 'pick-target'; target: TargetBlock }
  | { kind: 'select-category'; category: Category }
  | { kind: 'update-message'; value: string }
  | { kind: 'update-reporter'; value: string }
  | { kind: 'submit' }
  | { kind: 'reset' };

export interface View {
  render(state: WidgetState): void;
  onUserAction(cb: (action: UserAction) => void): void;
  showConfirmation(): void;
  showMailtoFallback(mailtoUrl: string, message: string): void;
}
