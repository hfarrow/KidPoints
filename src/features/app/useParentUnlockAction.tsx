import { useState } from 'react';

import { ParentPinModal } from '../../components/ParentPinModal';
import { useAppStorage } from './appStorage';

type ParentUnlockAction = (() => void) | null;

export function useParentUnlockAction() {
  const { parentSession, unlockParent } = useAppStorage();
  const [isPinModalVisible, setIsPinModalVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<ParentUnlockAction>(null);

  const requestParentUnlock = (action?: () => void) => {
    if (parentSession.isUnlocked) {
      action?.();
      return true;
    }

    setPendingAction(() => action ?? null);
    setIsPinModalVisible(true);
    return false;
  };

  const handleClose = () => {
    setIsPinModalVisible(false);
    setPendingAction(null);
  };

  const handleSubmit = (pin: string) => {
    const success = unlockParent(pin);

    if (!success) {
      return false;
    }

    setIsPinModalVisible(false);
    const action = pendingAction;
    setPendingAction(null);
    action?.();
    return true;
  };

  return {
    parentPinModal: (
      <ParentPinModal
        visible={isPinModalVisible}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
    ),
    requestParentUnlock,
  };
}
