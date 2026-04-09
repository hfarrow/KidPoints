import * as Haptics from 'expo-haptics';

export function triggerLightImpactHaptic(hapticsEnabled: boolean) {
  if (!hapticsEnabled) {
    return;
  }

  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
    // Haptics are best-effort UI polish; ignore unsupported-device failures.
  });
}

export function triggerErrorHaptic(hapticsEnabled: boolean) {
  if (!hapticsEnabled) {
    return;
  }

  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
    () => {
      // Haptics are best-effort UI polish; ignore unsupported-device failures.
    },
  );
}
