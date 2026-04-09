import type { KeyboardTypeOptions } from 'react-native';
import { create } from 'zustand';

import { createModuleLogger, createStructuredLog } from '../../logging/logger';

export type TextInputModalSubmitResult =
  | { ok: true }
  | { error: string; ok: false };

export type TextInputModalRequestInput = {
  clearLabel?: string;
  confirmLabel: string;
  description: string;
  initialValue?: string;
  inputAccessibilityLabel: string;
  keyboardType?: KeyboardTypeOptions;
  onClear?: () => void;
  onSubmit: (value: string) => TextInputModalSubmitResult;
  placeholder?: string;
  title: string;
};

export type TextInputModalRequest = TextInputModalRequestInput & {
  requestId: number;
};

type TextInputModalState = {
  clearRequest: () => void;
  openRequest: (request: TextInputModalRequest) => void;
  request: TextInputModalRequest | null;
};

const log = createModuleLogger('text-input-modal-store');
let nextTextInputModalRequestId = 1;
const logTextInputModalMutation = createStructuredLog(
  log,
  'debug',
  'Text input modal mutation committed',
);

export const useTextInputModalStore = create<TextInputModalState>((set) => ({
  clearRequest: () => {
    logTextInputModalMutation({
      action: 'clearRequest',
    });
    set({ request: null });
  },
  openRequest: (request) => {
    logTextInputModalMutation({
      action: 'openRequest',
      title: request.title,
    });
    set({ request });
  },
  request: null,
}));

export function presentTextInputModal(request: TextInputModalRequestInput) {
  useTextInputModalStore.getState().openRequest({
    ...request,
    requestId: nextTextInputModalRequestId++,
  });
}

export function clearTextInputModal() {
  useTextInputModalStore.getState().clearRequest();
}
