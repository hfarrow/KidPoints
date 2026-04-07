import type { KeyboardTypeOptions } from 'react-native';
import { create } from 'zustand';

export type TextInputModalSubmitResult =
  | { ok: true }
  | { error: string; ok: false };

export type TextInputModalRequest = {
  confirmLabel: string;
  description: string;
  initialValue?: string;
  inputAccessibilityLabel: string;
  keyboardType?: KeyboardTypeOptions;
  onSubmit: (value: string) => TextInputModalSubmitResult;
  placeholder?: string;
  title: string;
};

type TextInputModalState = {
  clearRequest: () => void;
  openRequest: (request: TextInputModalRequest) => void;
  request: TextInputModalRequest | null;
};

export const useTextInputModalStore = create<TextInputModalState>((set) => ({
  clearRequest: () => {
    set({ request: null });
  },
  openRequest: (request) => {
    set({ request });
  },
  request: null,
}));

export function presentTextInputModal(request: TextInputModalRequest) {
  useTextInputModalStore.getState().openRequest(request);
}

export function clearTextInputModal() {
  useTextInputModalStore.getState().clearRequest();
}
