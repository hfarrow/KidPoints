import { create } from 'zustand';

export type ListPickerModalItem = {
  id: string;
  label: string;
};

export type ListPickerSelectionMode = 'multiple' | 'single';

export type ListPickerModalRequestInput = {
  closeLabel?: string;
  items: ListPickerModalItem[];
  onSelect: (itemId: string) => void;
  selectedItemId?: string | null;
  selectedItemIds?: string[];
  selectionMode?: ListPickerSelectionMode;
  title: string;
};

export type ListPickerModalRequest = ListPickerModalRequestInput & {
  requestId: number;
};

type ListPickerModalState = {
  clearRequest: () => void;
  openRequest: (request: ListPickerModalRequest) => void;
  request: ListPickerModalRequest | null;
};
let nextListPickerModalRequestId = 1;

export const useListPickerModalStore = create<ListPickerModalState>((set) => ({
  clearRequest: () => {
    set({ request: null });
  },
  openRequest: (request) => {
    set({ request });
  },
  request: null,
}));

export function presentListPickerModal(request: ListPickerModalRequestInput) {
  useListPickerModalStore.getState().openRequest({
    ...request,
    requestId: nextListPickerModalRequestId++,
  });
}

export function clearListPickerModal() {
  useListPickerModalStore.getState().clearRequest();
}
