import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppStorage } from '../features/app/appStorage';
import { ParentPinModal } from './ParentPinModal';

type ScreenHeaderProps = {
  title: string;
  subtitle: string;
};

export function ScreenHeader({ title, subtitle }: ScreenHeaderProps) {
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const { lockParent, parentSession, unlockParent } = useAppStorage();

  return (
    <View style={styles.header}>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Pressable
        onPress={() => {
          if (parentSession.isUnlocked) {
            lockParent();
            return;
          }

          setPinModalVisible(true);
        }}
        style={[
          styles.modeButton,
          parentSession.isUnlocked
            ? styles.modeButtonActive
            : styles.modeButtonIdle,
        ]}
      >
        <Text
          style={[
            styles.modeButtonText,
            parentSession.isUnlocked
              ? styles.modeButtonTextActive
              : styles.modeButtonTextIdle,
          ]}
        >
          {parentSession.isUnlocked ? 'Lock Parent Mode' : 'Unlock Parent Mode'}
        </Text>
      </Pressable>
      <ParentPinModal
        visible={pinModalVisible}
        onClose={() => setPinModalVisible(false)}
        onSubmit={unlockParent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 16,
  },
  copy: {
    gap: 6,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#475569',
  },
  modeButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  modeButtonIdle: {
    backgroundColor: '#e2e8f0',
  },
  modeButtonActive: {
    backgroundColor: '#0f766e',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  modeButtonTextIdle: {
    color: '#0f172a',
  },
  modeButtonTextActive: {
    color: '#f8fafc',
  },
});
