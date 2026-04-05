import { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type ParentPinModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (pin: string) => boolean;
};

export function ParentPinModal({
  visible,
  onClose,
  onSubmit,
}: ParentPinModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const resetState = () => {
    setPin('');
    setError('');
  };

  const handlePinChange = (value: string) => {
    setPin(value);
    setError('');

    if (value.length < 4) {
      return;
    }

    const success = onSubmit(value);

    if (success) {
      resetState();
      onClose();
      return;
    }

    setError('That PIN did not unlock Parent Mode.');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Parent Mode</Text>
          <Text style={styles.subtitle}>
            Enter the parent PIN to unlock admin actions.
          </Text>
          <TextInput
            accessibilityLabel="Parent PIN"
            keyboardType="number-pad"
            maxLength={8}
            onChangeText={handlePinChange}
            placeholder="Default prototype PIN: 0000"
            placeholderTextColor="#94a3b8"
            secureTextEntry
            style={styles.input}
            value={pin}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Pressable onPress={handleClose} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    backgroundColor: '#f8fafc',
    padding: 24,
    gap: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0f172a',
  },
  error: {
    color: '#b91c1c',
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  secondaryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    fontWeight: '700',
    color: '#334155',
  },
});
